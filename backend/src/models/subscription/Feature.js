const mongoose = require('mongoose');

const featureSchema = new mongoose.Schema({
  // Display name
  name: {
    type: String,
    required: [true, 'Feature name is required'],
    unique: true,
    trim: true
  },

  // URL-friendly slug (auto-generated)
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },

  // Machine key for code references (e.g., 'keyword_search', 'ai_image_analysis')
  featureKey: {
    type: String,
    required: [true, 'Feature key is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z][a-z0-9_]*$/, 'Feature key must start with a letter and contain only lowercase letters, numbers, and underscores']
  },

  // Description
  description: {
    type: String,
    trim: true,
    default: ''
  },

  // Feature value type
  type: {
    type: String,
    enum: ['boolean', 'numeric', 'text'],
    required: [true, 'Feature type is required'],
    default: 'boolean'
  },

  // Default value when not configured in a plan
  defaultValue: {
    type: mongoose.Schema.Types.Mixed,
    default: false
  },

  // Unit label for numeric features (e.g. 'searches/month', 'exports/day')
  unit: {
    type: String,
    trim: true,
    default: ''
  },

  // Grouping category (e.g. 'Analysis', 'Export', 'AI')
  category: {
    type: String,
    trim: true,
    default: 'General'
  },

  // Active/inactive toggle
  isActive: {
    type: Boolean,
    default: true
  },

  // Display ordering
  displayOrder: {
    type: Number,
    default: 0
  },

  // Flexible metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Audit trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Auto-generate slug from name before saving
featureSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  if (this.isModified('name') || !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Indexes
featureSchema.index({ featureKey: 1 });
featureSchema.index({ category: 1 });
featureSchema.index({ isActive: 1 });
featureSchema.index({ displayOrder: 1 });

const Feature = mongoose.model('Feature', featureSchema);

module.exports = Feature;
