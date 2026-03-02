const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Info
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters']
  },
  
  // Account Type & Role
  accountType: {
    type: String,
    enum: ['customer', 'admin'],
    default: 'customer',
    required: true
  },
  role: {
    type: String,
    enum: ['customer', 'super_admin', 'admin', 'moderator', 'viewer', 'custom'],
    default: 'customer',
    required: true
  },
  
  // Custom Role (if role is 'custom')
  customRole: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CustomRole',
    default: null
  },
  
  // Account Status
  status: {
    type: String,
    enum: ['pending_verification', 'active', 'suspended', 'banned', 'inactive'],
    default: 'pending_verification'
  },
  
  // Email Verification
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  
  // Customer-Specific Fields
  // Legacy string plan field (kept for backward compatibility)
  plan: {
    type: String,
    enum: ['free', 'starter', 'pro', 'unlimited'],
    default: 'free'
  },
  // Dynamic plan reference (new system)
  currentPlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    default: null
  },
  // Frozen snapshot of plan features at time of assignment
  planSnapshot: {
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
    planName: { type: String },
    features: [{
      featureId: { type: mongoose.Schema.Types.ObjectId, ref: 'Feature' },
      featureKey: { type: String },
      featureName: { type: String },
      enabled: { type: Boolean, default: true },
      limit: { type: Number, default: null },
      value: { type: mongoose.Schema.Types.Mixed, default: null }
    }],
    assignedAt: { type: Date },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  analysisCount: {
    type: Number,
    default: 0
  },
  analysisLimit: {
    type: Number,
    default: 1
  },
  monthlyResetDate: {
    type: Date,
    default: () => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
  },
  subscriptionStatus: {
    type: String,
    enum: ['none', 'trial', 'active', 'past_due', 'expired', 'cancelled'],
    default: 'none'
  },
  subscriptionStartDate: {
    type: Date,
    default: null
  },
  subscriptionExpiresAt: {
    type: Date,
    default: null
  },
  trialEndsAt: {
    type: Date,
    default: null
  },
  trialWarningEmailSent: {
    type: Boolean,
    default: false
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly', 'none'],
    default: 'none'
  },
  subscriptionId: String,
  stripeCustomerId: String,
  lemonSqueezyCustomerId: String,
  lemonSqueezySubscriptionId: String,
  
  // Admin-Specific Fields
  department: String,
  permissions: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Security & Preferences
  avatar: {
    type: String,
    default: null
  },
  // Google OAuth
  googleId: {
    type: String,
    default: null,
    sparse: true,   // allows multiple null values in the unique index
    index: true,
  },
  lastLogin: Date,
  lastLoginIP: String,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  timezone: {
    type: String,
    default: 'UTC'
  },
  
  // Password Reset
  passwordResetToken: String,
  passwordResetExpires: Date,
  resetPasswordRequestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resetPasswordRequestedAt: Date,
  passwordChangeRequired: {
    type: Boolean,
    default: false // true = user must change password on first login
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Update timestamp
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Update analysis limit based on plan (supports both legacy and dynamic plans)
userSchema.methods.updateAnalysisLimit = function() {
  // If using dynamic plan snapshot, check for a numeric feature with key containing 'analysis' or 'listing_audit'
  if (this.planSnapshot && this.planSnapshot.features && this.planSnapshot.features.length > 0) {
    const analysisFeature = this.planSnapshot.features.find(f =>
      f.enabled && f.limit !== null && f.limit !== undefined &&
      (f.featureKey === 'listing_audit' || f.featureKey === 'keyword_search' || f.featureKey === 'analysis')
    );
    if (analysisFeature) {
      this.analysisLimit = analysisFeature.limit;
      return;
    }
  }

  // Fallback to legacy hardcoded limits
  const limits = {
    free: 1,
    starter: 50,
    pro: 250,
    unlimited: 999999
  };
  this.analysisLimit = limits[this.plan] || 1;
};

// Check if user can perform analysis
userSchema.methods.canAnalyze = function() {
  return this.analysisCount < this.analysisLimit;
};

// Reset monthly analysis count
userSchema.methods.resetMonthlyCount = function() {
  const now = new Date();
  const resetDate = new Date(this.monthlyResetDate);
  
  if (now >= resetDate) {
    this.analysisCount = 0;
    this.monthlyResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return true;
  }
  return false;
};

// Check if subscription is currently valid (active or within trial period)
userSchema.methods.isSubscriptionActive = function() {
  if (this.subscriptionStatus === 'active' || this.subscriptionStatus === 'past_due') return true;
  if (this.subscriptionStatus === 'trial' && this.trialEndsAt) {
    return new Date() < new Date(this.trialEndsAt);
  }
  return false;
};

// Check if account is locked
userSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Increment login attempts
userSchema.methods.incLoginAttempts = async function(maxAttempts = 5, lockDuration = 2 * 60 * 60 * 1000) {
  // Reset attempts if lock has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  
  // Otherwise increment
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after maxAttempts
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + lockDuration };
  }
  
  return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = async function() {
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 }
  });
};

// Get user permissions
userSchema.methods.getPermissions = function() {
  if (this.role === 'super_admin') {
    return ['*']; // All permissions
  }
  
  if (this.role === 'custom' && this.customRole) {
    return this.customRole.permissions || [];
  }
  
  // Built-in role permissions
  const builtInPermissions = {
    admin: [
      'users.view', 'users.create', 'users.edit', 'users.delete',
      'customers.view', 'customers.edit', 'customers.plans',
      'plans.view', 'plans.create', 'plans.edit',
      'features.view', 'features.create', 'features.edit',
      'subscriptions.view', 'subscriptions.manage',
      'analytics.view', 'logs.view', 'settings.edit'
    ],
    moderator: [
      'users.view', 'customers.view', 'customers.edit',
      'plans.view', 'features.view', 'subscriptions.view',
      'analytics.view'
    ],
    viewer: [
      'users.view', 'customers.view',
      'plans.view', 'features.view', 'subscriptions.view',
      'analytics.view'
    ]
  };
  
  return builtInPermissions[this.role] || [];
};

// Check if user has permission
userSchema.methods.hasPermission = function(permission) {
  const permissions = this.getPermissions();
  
  // Super admin has all permissions
  if (permissions.includes('*')) return true;
  
  // Check exact permission
  if (permissions.includes(permission)) return true;
  
  // Check wildcard permissions (e.g., users.*)
  const [resource, action] = permission.split('.');
  if (permissions.includes(`${resource}.*`)) return true;
  
  return false;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
