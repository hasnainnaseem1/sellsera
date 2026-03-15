const mongoose = require('mongoose');

const serpCostLogSchema = new mongoose.Schema({
  // Which customer triggered the SERP request
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },

  // Which feature triggered the SERP call
  featureKey: {
    type: String,
    required: [true, 'Feature key is required'],
    enum: [
      'keyword_search',
      'keyword_deep_analysis',
      'bulk_rank_check',
      'tag_analysis',
      'competitor_tracking',
      'competitor_sales'
    ],
    index: true
  },

  // Number of SERP API requests consumed by this action
  requestCount: {
    type: Number,
    required: true,
    min: [1, 'Request count must be at least 1']
  },

  // Cost in USD for this batch of requests
  costUsd: {
    type: Number,
    required: true,
    min: [0, 'Cost cannot be negative']
  },

  // SERP provider info
  provider: {
    type: String,
    default: 'dataforseo',
    trim: true,
    lowercase: true
  },

  // Whether the result was served from cache (no actual SERP call)
  cacheHit: {
    type: Boolean,
    default: false
  },

  // Plan context at time of request
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    default: null
  },
  planName: {
    type: String,
    default: '',
    trim: true
  },

  // Flexible metadata (e.g., keyword searched, listing ID)
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Timestamp
  createdAt: {
    type: Date,
    default: Date.now,
    required: true
  }
});

// Compound indexes for efficient queries
serpCostLogSchema.index({ userId: 1, createdAt: -1 });
serpCostLogSchema.index({ userId: 1, featureKey: 1, createdAt: -1 });
serpCostLogSchema.index({ featureKey: 1, createdAt: -1 });

/**
 * Get total SERP cost for a user in a period
 */
serpCostLogSchema.statics.getUserCostInPeriod = async function (userId, startDate, endDate) {
  const match = { userId: new mongoose.Types.ObjectId(userId) };
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }

  const result = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalCost: { $sum: '$costUsd' },
        totalRequests: { $sum: '$requestCount' },
        cacheHits: { $sum: { $cond: ['$cacheHit', 1, 0] } }
      }
    }
  ]);

  return result[0] || { totalCost: 0, totalRequests: 0, cacheHits: 0 };
};

/**
 * Check if a user has exceeded the cost alert threshold this month
 */
serpCostLogSchema.statics.checkCostAlert = async function (userId, thresholdUsd = 30) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const usage = await this.getUserCostInPeriod(userId, startOfMonth, new Date());
  return {
    currentCost: usage.totalCost,
    threshold: thresholdUsd,
    exceeded: usage.totalCost >= thresholdUsd,
    totalRequests: usage.totalRequests
  };
};

/**
 * Platform-wide SERP cost analytics for admin dashboard
 */
serpCostLogSchema.statics.getPlatformCostSummary = async function (startDate, endDate) {
  const match = {};
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$featureKey',
        totalCost: { $sum: '$costUsd' },
        totalRequests: { $sum: '$requestCount' },
        uniqueUsers: { $addToSet: '$userId' },
        cacheHits: { $sum: { $cond: ['$cacheHit', 1, 0] } }
      }
    },
    {
      $project: {
        _id: 1,
        totalCost: { $round: ['$totalCost', 4] },
        totalRequests: 1,
        uniqueUsers: { $size: '$uniqueUsers' },
        cacheHitRate: {
          $round: [{ $multiply: [{ $divide: ['$cacheHits', '$totalRequests'] }, 100] }, 1]
        }
      }
    },
    { $sort: { totalCost: -1 } }
  ]);
};

const SerpCostLog = mongoose.model('SerpCostLog', serpCostLogSchema);

module.exports = SerpCostLog;
