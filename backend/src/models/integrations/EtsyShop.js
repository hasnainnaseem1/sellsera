const mongoose = require('mongoose');

const etsyShopSchema = new mongoose.Schema({
  // Owner reference
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },

  // Etsy identifiers
  shopId: {
    type: String,
    required: [true, 'Etsy Shop ID is required'],
    trim: true,
    index: true
  },
  shopName: {
    type: String,
    required: [true, 'Shop name is required'],
    trim: true
  },

  // OAuth tokens (AES-256-GCM encrypted at rest)
  accessToken_enc: {
    type: String,
    default: null
  },
  refreshToken_enc: {
    type: String,
    default: null
  },
  tokenExpiresAt: {
    type: Date,
    default: null
  },

  // Connection status
  status: {
    type: String,
    enum: ['active', 'syncing', 'token_expired', 'token_revoked', 'disconnected'],
    default: 'active',
    required: true,
    index: true
  },
  tokenRevokedAt: {
    type: Date,
    default: null
  },

  // Sync tracking
  lastSyncAt: {
    type: Date,
    default: null
  },
  listingCount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalSales: {
    type: Number,
    default: 0,
    min: 0
  },

  // Etsy shop metadata (cached from API)
  shopMetadata: {
    iconUrl: { type: String, default: null },
    bannerUrl: { type: String, default: null },
    currencyCode: { type: String, default: 'USD' },
    shopUrl: { type: String, default: null }
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
etsyShopSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes
etsyShopSchema.index({ userId: 1 });
etsyShopSchema.index({ userId: 1, shopId: 1 }, { unique: true }); // Prevent same shop connected twice per user
etsyShopSchema.index({ shopId: 1 });
etsyShopSchema.index({ status: 1 });

// Clear tokens on revocation
etsyShopSchema.methods.revokeTokens = function () {
  this.accessToken_enc = null;
  this.refreshToken_enc = null;
  this.tokenExpiresAt = null;
  this.status = 'token_revoked';
  this.tokenRevokedAt = new Date();
  return this.save();
};

// Reactivate after re-authorization
etsyShopSchema.methods.reauthorize = function (accessToken_enc, refreshToken_enc, tokenExpiresAt) {
  this.accessToken_enc = accessToken_enc;
  this.refreshToken_enc = refreshToken_enc;
  this.tokenExpiresAt = tokenExpiresAt;
  this.status = 'active';
  this.tokenRevokedAt = null;
  return this.save();
};

const EtsyShop = mongoose.model('EtsyShop', etsyShopSchema);

// Auto-migrate: drop old unique userId-only index if it exists (multi-shop upgrade)
EtsyShop.collection.indexes()
  .then(indexes => {
    const oldUniqueIdx = indexes.find(
      idx => idx.key?.userId === 1 && idx.unique === true && !idx.key?.shopId
    );
    if (oldUniqueIdx) {
      console.log(`[EtsyShop] Dropping old unique userId index: ${oldUniqueIdx.name}`);
      return EtsyShop.collection.dropIndex(oldUniqueIdx.name);
    }
  })
  .then(() => {})
  .catch(() => {}); // Silently ignore — collection may not exist yet

module.exports = EtsyShop;
