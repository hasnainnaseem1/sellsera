const mongoose = require('mongoose');

const tagAnalysisSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  listingTitle: { type: String, default: '' },
  category: { type: String, default: '' },
  country: { type: String, default: 'US' },
  tags: [{
    tag: { type: String, required: true },
    score: { type: Number, default: 0 },
    qualityScore: { type: Number, default: 0 },
    volume: { type: Number, default: 0 },
    competition: { type: Number, default: 0 },
    competitionLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    status: { type: String, enum: ['excellent', 'good', 'needs_work'], default: 'needs_work' },
    suggestion: { type: String, default: null },
    details: {
      lengthOk: { type: Boolean, default: false },
      wordCount: { type: Number, default: 1 },
      relevance: { type: Number, default: 0 },
      categoryMatch: { type: Boolean, default: false },
    },
  }],
  summary: {
    totalTags: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    excellent: { type: Number, default: 0 },
    good: { type: Number, default: 0 },
    needsWork: { type: Number, default: 0 },
    missingTags: { type: Number, default: 0 },
  },
  suggestedReplacements: [{
    keyword: String,
    score: Number,
    estimatedVolume: Number,
    competitionLevel: String,
  }],
  analyzedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

tagAnalysisSchema.index({ userId: 1, analyzedAt: -1 });

const TagAnalysis = mongoose.model('TagAnalysis', tagAnalysisSchema);
module.exports = TagAnalysis;
