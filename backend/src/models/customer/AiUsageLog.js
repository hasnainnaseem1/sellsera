const mongoose = require('mongoose');

const aiUsageLogSchema = new mongoose.Schema({
  // Which customer used the AI feature
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },

  // Which AI feature was invoked
  featureKey: {
    type: String,
    required: [true, 'Feature key is required'],
    enum: ['ai_listing_optimizer', 'ai_tag_generator', 'ai_competitor_gap'],
    index: true
  },

  // Anthropic model used
  model: {
    type: String,
    required: [true, 'Model name is required'],
    trim: true,
    default: 'claude-sonnet-4-20250514'
  },

  // Token usage
  inputTokens: {
    type: Number,
    required: true,
    min: [0, 'Input tokens cannot be negative']
  },
  outputTokens: {
    type: Number,
    required: true,
    min: [0, 'Output tokens cannot be negative']
  },

  // Computed cost in USD
  costUsd: {
    type: Number,
    required: true,
    min: [0, 'Cost cannot be negative']
  },

  // Prompt versioning for A/B testing
  promptVersion: {
    type: String,
    trim: true,
    default: 'v1.0'
  },

  // Performance tracking
  latencyMs: {
    type: Number,
    default: null,
    min: 0
  },

  // Request context
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

  // Flexible metadata (e.g., listing ID analyzed, error details)
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
aiUsageLogSchema.index({ userId: 1, createdAt: -1 });
aiUsageLogSchema.index({ userId: 1, featureKey: 1, createdAt: -1 });
aiUsageLogSchema.index({ featureKey: 1, createdAt: -1 });

/**
 * Compute total AI cost for a user in a given period
 */
aiUsageLogSchema.statics.getUserCostInPeriod = async function (userId, startDate, endDate) {
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
        totalCalls: { $sum: 1 },
        totalInputTokens: { $sum: '$inputTokens' },
        totalOutputTokens: { $sum: '$outputTokens' }
      }
    }
  ]);

  return result[0] || { totalCost: 0, totalCalls: 0, totalInputTokens: 0, totalOutputTokens: 0 };
};

/**
 * Get cost breakdown by feature for admin analytics
 */
aiUsageLogSchema.statics.getCostBreakdownByFeature = async function (startDate, endDate) {
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
        totalCalls: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' },
        avgLatencyMs: { $avg: '$latencyMs' }
      }
    },
    {
      $project: {
        _id: 1,
        totalCost: 1,
        totalCalls: 1,
        uniqueUsers: { $size: '$uniqueUsers' },
        avgLatencyMs: { $round: ['$avgLatencyMs', 0] }
      }
    },
    { $sort: { totalCost: -1 } }
  ]);
};

const AiUsageLog = mongoose.model('AiUsageLog', aiUsageLogSchema);

module.exports = AiUsageLog;
