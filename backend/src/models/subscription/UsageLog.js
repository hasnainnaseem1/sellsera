const mongoose = require('mongoose');

const usageLogSchema = new mongoose.Schema({
  // Which customer used the feature
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // Which feature was used
  featureKey: {
    type: String,
    required: true,
    index: true,
  },
  featureName: {
    type: String,
    default: '',
  },

  // Which plan the customer was on when they used it
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    default: null,
  },
  planName: {
    type: String,
    default: '',
  },

  // Usage details
  action: {
    type: String,
    enum: ['used', 'limit_reached', 'exceeded', 'reset'],
    default: 'used',
  },

  // Current count at time of log
  currentCount: {
    type: Number,
    default: 0,
  },
  limit: {
    type: Number,
    default: null,
  },

  // Flexible metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },

  // Timestamp
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Compound indexes for efficient queries
usageLogSchema.index({ userId: 1, featureKey: 1, createdAt: -1 });
usageLogSchema.index({ featureKey: 1, createdAt: -1 });
usageLogSchema.index({ planId: 1, featureKey: 1 });

/**
 * Log a feature usage event
 */
usageLogSchema.statics.logUsage = async function (data) {
  return this.create({
    userId: data.userId,
    featureKey: data.featureKey,
    featureName: data.featureName || '',
    planId: data.planId || null,
    planName: data.planName || '',
    action: data.action || 'used',
    currentCount: data.currentCount || 0,
    limit: data.limit || null,
    metadata: data.metadata || {},
  });
};

/**
 * Get usage summary for a customer
 */
usageLogSchema.statics.getCustomerUsageSummary = async function (userId, startDate, endDate) {
  const match = { userId: new mongoose.Types.ObjectId(userId) };
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
        featureName: { $first: '$featureName' },
        totalUsage: { $sum: 1 },
        lastUsed: { $max: '$createdAt' },
        limitReached: { $sum: { $cond: [{ $eq: ['$action', 'limit_reached'] }, 1, 0] } },
      },
    },
    { $sort: { totalUsage: -1 } },
  ]);
};

/**
 * Get platform-wide usage stats for analytics
 */
usageLogSchema.statics.getPlatformUsageStats = async function (startDate, endDate) {
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
        featureName: { $first: '$featureName' },
        totalUsage: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' },
        limitReached: { $sum: { $cond: [{ $eq: ['$action', 'limit_reached'] }, 1, 0] } },
      },
    },
    {
      $project: {
        _id: 1,
        featureName: 1,
        totalUsage: 1,
        uniqueUsers: { $size: '$uniqueUsers' },
        limitReached: 1,
      },
    },
    { $sort: { totalUsage: -1 } },
  ]);
};

/**
 * Get daily usage trend for a specific feature
 */
usageLogSchema.statics.getFeatureUsageTrend = async function (featureKey, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.aggregate([
    {
      $match: {
        featureKey,
        createdAt: { $gte: startDate },
        action: 'used',
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
        },
        count: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' },
      },
    },
    {
      $project: {
        date: '$_id',
        count: 1,
        uniqueUsers: { $size: '$uniqueUsers' },
        _id: 0,
      },
    },
    { $sort: { date: 1 } },
  ]);
};

const UsageLog = mongoose.model('UsageLog', usageLogSchema);

module.exports = UsageLog;
