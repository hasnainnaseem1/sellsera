const mongoose = require('mongoose');

// Sub-schema for features attached to a plan
const planFeatureSchema = new mongoose.Schema({
  featureId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Feature',
    required: true
  },
  featureKey: {
    type: String,
    required: true
  },
  featureName: {
    type: String,
    required: true
  },
  // Whether this feature is enabled in this plan
  enabled: {
    type: Boolean,
    default: true
  },
  // Numeric limit (null = unlimited for numeric features)
  limit: {
    type: Number,
    default: null
  },
  // Period type for usage counting (monthly = standard, lifetime = all-time cap)
  periodType: {
    type: String,
    enum: ['monthly', 'lifetime'],
    default: 'monthly'
  },
  // Flexible value (e.g. text-based config)
  value: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, { _id: false });

const planSchema = new mongoose.Schema({
  // Plan name (e.g. "Free", "Starter", "Pro", "Elite")
  name: {
    type: String,
    required: [true, 'Plan name is required'],
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

  // Description
  description: {
    type: String,
    trim: true,
    default: ''
  },

  // Pricing
  price: {
    monthly: {
      type: Number,
      default: 0,
      min: 0
    },
    yearly: {
      type: Number,
      default: 0,
      min: 0
    }
  },

  // Currency
  currency: {
    type: String,
    default: 'USD',
    uppercase: true,
    trim: true
  },

  // Billing cycle options
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly', 'both'],
    default: 'both'
  },

  // Is this plan currently available?
  isActive: {
    type: Boolean,
    default: true
  },

  // Default plan for new signups (only one plan should have this)
  isDefault: {
    type: Boolean,
    default: false
  },

  // Display order on pricing page
  displayOrder: {
    type: Number,
    default: 0
  },

  // Features attached to this plan with their limits
  features: [planFeatureSchema],

  // Trial period
  trialDays: {
    type: Number,
    default: 0,
    min: 0
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

// Auto-generate slug from name
planSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  if (this.isModified('name') || !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Ensure only one default plan exists
planSchema.pre('save', async function (next) {
  if (this.isDefault && this.isModified('isDefault')) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id }, isDefault: true },
      { $set: { isDefault: false } }
    );
  }
  next();
});

// Indexes
planSchema.index({ slug: 1 });
planSchema.index({ isActive: 1 });
planSchema.index({ isDefault: 1 });
planSchema.index({ displayOrder: 1 });

// Static: get the default plan
planSchema.statics.getDefaultPlan = async function () {
  let defaultPlan = await this.findOne({ isDefault: true, isActive: true });
  if (!defaultPlan) {
    // Fallback: first active plan sorted by displayOrder
    defaultPlan = await this.findOne({ isActive: true }).sort({ displayOrder: 1 });
  }
  return defaultPlan;
};

// Static: count customers on a plan
planSchema.statics.getCustomerCount = async function (planId) {
  const User = mongoose.model('User');
  return User.countDocuments({ accountType: 'customer', currentPlan: planId });
};

const Plan = mongoose.model('Plan', planSchema);

module.exports = Plan;
