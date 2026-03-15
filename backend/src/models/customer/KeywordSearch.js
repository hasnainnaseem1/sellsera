const mongoose = require('mongoose');

const keywordSearchSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  seedKeyword: {
    type: String,
    required: [true, 'Seed keyword is required'],
    trim: true,
    maxlength: 100,
  },
  // Type of search
  searchType: {
    type: String,
    enum: ['basic', 'deep'],
    default: 'basic',
  },
  // Results (embedded for fast retrieval)
  results: [{
    keyword: { type: String, required: true },
    estimatedVolume: { type: Number, default: 0 },
    volumeTier: {
      type: String,
      enum: ['very_high', 'high', 'medium', 'low'],
      default: 'low',
    },
    competitionPct: { type: Number, default: 0, min: 0, max: 100 },
    competitionLevel: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium',
    },
    trend: {
      type: String,
      enum: ['rising', 'stable', 'declining'],
      default: 'stable',
    },
    opportunityScore: { type: Number, default: 0 },
    ctrProxy: { type: Number, default: 0 },
  }],
  resultCount: {
    type: Number,
    default: 0,
  },
  // SERP cost tracking
  serpCallCount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

keywordSearchSchema.index({ userId: 1, createdAt: -1 });
keywordSearchSchema.index({ userId: 1, seedKeyword: 1, createdAt: -1 });

const KeywordSearch = mongoose.model('KeywordSearch', keywordSearchSchema);
module.exports = KeywordSearch;
