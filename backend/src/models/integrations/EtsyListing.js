const mongoose = require('mongoose');

const etsyListingSchema = new mongoose.Schema({
  // Parent shop reference
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EtsyShop',
    required: [true, 'Shop ID is required'],
    index: true
  },

  // Etsy listing identifier
  etsyListingId: {
    type: String,
    required: [true, 'Etsy Listing ID is required'],
    trim: true
  },

  // Listing content
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [300, 'Title cannot exceed 300 characters']
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  tags: {
    type: [String],
    default: [],
    validate: {
      validator: function (v) {
        return v.length <= 13;
      },
      message: 'Etsy allows a maximum of 13 tags'
    }
  },
  materials: {
    type: [String],
    default: []
  },

  // Pricing
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  },
  currencyCode: {
    type: String,
    default: 'USD',
    uppercase: true,
    trim: true
  },

  // Metrics (from Etsy API)
  views: {
    type: Number,
    default: 0,
    min: 0
  },
  favorites: {
    type: Number,
    default: 0,
    min: 0
  },
  quantity: {
    type: Number,
    default: 0,
    min: 0
  },

  // Listing state
  state: {
    type: String,
    enum: ['active', 'inactive', 'sold_out', 'draft', 'expired', 'removed'],
    default: 'active',
    index: true
  },

  // Category / taxonomy
  taxonomyId: {
    type: Number,
    default: null
  },
  taxonomyPath: {
    type: [String],
    default: []
  },

  // Images (URLs cached from Etsy)
  images: [{
    url: { type: String },
    rank: { type: Number }
  }],

  // Listing type
  isDigital: {
    type: Boolean,
    default: false
  },

  // Shop attributes relevant to audit scoring
  shippingProfile: {
    freeShipping: { type: Boolean, default: false },
    processingDays: { type: Number, default: null }
  },
  returnsAccepted: {
    type: Boolean,
    default: false
  },

  // Sync tracking
  syncedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  etsyCreatedAt: {
    type: Date,
    default: null
  },
  etsyUpdatedAt: {
    type: Date,
    default: null
  }
});

// Update syncedAt on save
etsyListingSchema.pre('save', function (next) {
  this.syncedAt = Date.now();
  next();
});

// Compound indexes
etsyListingSchema.index({ shopId: 1, etsyListingId: 1 }, { unique: true });
etsyListingSchema.index({ shopId: 1, syncedAt: -1 });
etsyListingSchema.index({ shopId: 1, state: 1 });

const EtsyListing = mongoose.model('EtsyListing', etsyListingSchema);

module.exports = EtsyListing;
