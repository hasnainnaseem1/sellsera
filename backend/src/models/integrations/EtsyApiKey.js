const mongoose = require('mongoose');

const etsyApiKeySchema = new mongoose.Schema({
  // Human-readable label
  label: {
    type: String,
    required: [true, 'Key label is required'],
    trim: true,
    maxlength: [50, 'Label cannot exceed 50 characters']
  },

  // Encrypted credentials (AES-256-GCM)
  // Stored format: iv:authTag:ciphertext (hex-encoded)
  apiKey: {
    type: String,
    required: [true, 'API key is required']
  },
  sharedSecret: {
    type: String,
    required: [true, 'Shared secret is required']
  },

  // Key status for rotation pool
  status: {
    type: String,
    enum: ['active', 'rate_limited', 'disabled', 'revoked'],
    default: 'active',
    required: true,
    index: true
  },

  // Rate limit recovery
  rateLimitResetAt: {
    type: Date,
    default: null
  },

  // Usage tracking (rolling 24h window)
  requestCount24h: {
    type: Number,
    default: 0,
    min: 0
  },
  lastRequestCountResetAt: {
    type: Date,
    default: Date.now
  },

  // Health tracking
  lastUsedAt: {
    type: Date,
    default: null
  },
  errorCount: {
    type: Number,
    default: 0,
    min: 0
  },
  lastErrorAt: {
    type: Date,
    default: null
  },
  lastErrorMessage: {
    type: String,
    default: null
  },

  // Audit trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by user is required']
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
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

// Update timestamp on save
etsyApiKeySchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes for key pool rotation queries
etsyApiKeySchema.index({ status: 1, requestCount24h: 1 });
etsyApiKeySchema.index({ status: 1, rateLimitResetAt: 1 });

// Record a successful API call
etsyApiKeySchema.methods.recordUsage = function () {
  this.requestCount24h += 1;
  this.lastUsedAt = new Date();
  this.errorCount = 0;
  return this.save();
};

// Record an API error
etsyApiKeySchema.methods.recordError = function (errorMessage) {
  this.errorCount += 1;
  this.lastErrorAt = new Date();
  this.lastErrorMessage = errorMessage;

  // Auto-disable after 3 consecutive errors + notify admins
  if (this.errorCount >= 3) {
    this.status = 'disabled';
    // Fire admin notification (non-blocking)
    const adminNotifier = require('../../services/notification/adminNotifier');
    adminNotifier.notifySystemAlert({
      title: `Etsy API Key Disabled: ${this.label}`,
      message: `Key "${this.label}" was auto-disabled after ${this.errorCount} consecutive errors. Last error: ${errorMessage}`,
      priority: 'high',
      metadata: { keyId: this._id, label: this.label, errorCount: this.errorCount },
    }).catch(err => console.error('[EtsyApiKey] Failed to send admin notification:', err.message));
  }

  return this.save();
};

// Mark as rate-limited with recovery time
etsyApiKeySchema.methods.markRateLimited = function (retryAfterSeconds) {
  this.status = 'rate_limited';
  this.rateLimitResetAt = new Date(Date.now() + (retryAfterSeconds * 1000));
  return this.save();
};

// Get all active keys sorted by least usage (for weighted round-robin)
etsyApiKeySchema.statics.getAvailableKeys = async function () {
  const now = new Date();

  // Un-rate-limit any keys whose cooldown has passed
  await this.updateMany(
    { status: 'rate_limited', rateLimitResetAt: { $lte: now } },
    { $set: { status: 'active', rateLimitResetAt: null } }
  );

  // Return active keys sorted by lowest usage first
  return this.find({ status: 'active' })
    .sort({ requestCount24h: 1, lastUsedAt: 1 })
    .lean();
};

// Reset 24h counters (called by daily cron)
etsyApiKeySchema.statics.resetDailyCounters = async function () {
  return this.updateMany(
    {},
    { $set: { requestCount24h: 0, lastRequestCountResetAt: new Date() } }
  );
};

const EtsyApiKey = mongoose.model('EtsyApiKey', etsyApiKeySchema);

module.exports = EtsyApiKey;
