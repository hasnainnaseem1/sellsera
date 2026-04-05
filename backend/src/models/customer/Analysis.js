const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  originalListing: {
    title:       { type: String, required: true },
    description: { type: String, required: true },
    tags:        [{ type: String }],
    price:       { type: Number, required: true },
    category:    { type: String, required: true },
    imageCount:  { type: Number, default: 0 },
    freeShipping:    { type: Boolean, default: false },
    processingDays:  { type: Number, default: null },
    returnsAccepted: { type: Boolean, default: false },
  },

  recommendations: {
    optimizedTitle:       { type: String, default: '' },
    titleReasoning:       { type: String, default: '' },
    optimizedDescription: { type: String, default: '' },
    descriptionReasoning: { type: String, default: '' },
    optimizedTags: [{
      tag:       String,
      reasoning: String,
      category:  { type: String, enum: ['long_tail', 'high_volume', 'moderate', 'analyzing'], default: 'analyzing' },
    }],
    pricingRecommendation: {
      suggestedPrice: Number,
      reasoning:      String,
      competitorRange: { min: Number, max: Number, average: Number },
    },
    actionItems: [{
      priority: { type: String, enum: ['high', 'medium', 'low'] },
      action:   String,
      impact:   String,
    }],
  },

  // Weighted score breakdown
  breakdown: {
    titleQuality:         { score: { type: Number, default: 0 }, weight: { type: Number, default: 20 }, details: { type: mongoose.Schema.Types.Mixed, default: {} } },
    tagsCompleteness:     { score: { type: Number, default: 0 }, weight: { type: Number, default: 20 }, details: { type: mongoose.Schema.Types.Mixed, default: {} } },
    descriptionSeo:       { score: { type: Number, default: 0 }, weight: { type: Number, default: 20 }, details: { type: mongoose.Schema.Types.Mixed, default: {} } },
    imageQuality:         { score: { type: Number, default: 0 }, weight: { type: Number, default: 15 }, details: { type: mongoose.Schema.Types.Mixed, default: {} } },
    priceCompetitiveness: { score: { type: Number, default: 0 }, weight: { type: Number, default: 15 }, details: { type: mongoose.Schema.Types.Mixed, default: {} } },
    categoryAccuracy:     { score: { type: Number, default: 0 }, weight: { type: Number, default: 10 }, details: { type: mongoose.Schema.Types.Mixed, default: {} } },
    shopAttributes:       { score: { type: Number, default: 0 }, weight: { type: Number, default: 0  }, details: { type: mongoose.Schema.Types.Mixed, default: {} } },
  },

  competitors: [{ title: String, price: Number, sales: Number, ranking: Number }],

  score:          { type: Number, min: 0, max: 100, default: 0 },
  status:         { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
  processingTime: { type: Number, default: 0 },
  createdAt:      { type: Date, default: Date.now, index: true },
}, { timestamps: true });

analysisSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Analysis', analysisSchema);