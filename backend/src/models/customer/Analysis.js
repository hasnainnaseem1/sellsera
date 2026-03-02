const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Original listing data
  originalListing: {
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    tags: [{
      type: String
    }],
    price: {
      type: Number,
      required: true
    },
    category: {
      type: String,
      required: true
    }
  },
  
  // AI-generated recommendations
  recommendations: {
    optimizedTitle: {
      type: String,
      required: true
    },
    titleReasoning: {
      type: String,
      required: true
    },
    optimizedDescription: {
      type: String,
      required: true
    },
    descriptionReasoning: {
      type: String,
      required: true
    },
    optimizedTags: [{
      tag: String,
      reasoning: String
    }],
    pricingRecommendation: {
      suggestedPrice: Number,
      reasoning: String,
      competitorRange: {
        min: Number,
        max: Number,
        average: Number
      }
    },
    actionItems: [{
      priority: {
        type: String,
        enum: ['high', 'medium', 'low']
      },
      action: String,
      impact: String
    }]
  },
  
  // Competitor analysis (will be populated from marketplace API later)
  competitors: [{
    title: String,
    price: Number,
    sales: Number,
    ranking: Number
  }],
  
  // Metadata
  score: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed'
  },
  processingTime: {
    type: Number, // in milliseconds
    default: 0
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Index for faster queries
analysisSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Analysis', analysisSchema);