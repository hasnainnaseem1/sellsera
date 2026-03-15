const mongoose = require('mongoose');

const listingAuditSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  listingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EtsyListing',
    default: null,
  },
  // Etsy listing ID (for lookups when no local listing doc)
  etsyListingId: {
    type: String,
    default: null,
  },
  // Input data snapshot (so audits are viewable even if listing changes)
  listingSnapshot: {
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    tags: [{ type: String }],
    price: { type: Number, default: 0 },
    category: { type: String, default: '' },
    imageCount: { type: Number, default: 0 },
    shippingProfile: { type: String, default: '' },
    processingDays: { type: Number, default: null },
    returnsAccepted: { type: Boolean, default: false },
    freeShipping: { type: Boolean, default: false },
  },
  // Overall score 0-100
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  // Per-factor breakdown
  breakdown: {
    titleQuality: {
      score: { type: Number, default: 0 },
      weight: { type: Number, default: 20 },
      details: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    tagsCompleteness: {
      score: { type: Number, default: 0 },
      weight: { type: Number, default: 20 },
      details: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    descriptionSeo: {
      score: { type: Number, default: 0 },
      weight: { type: Number, default: 15 },
      details: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    imageQuality: {
      score: { type: Number, default: 0 },
      weight: { type: Number, default: 15 },
      details: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    priceCompetitiveness: {
      score: { type: Number, default: 0 },
      weight: { type: Number, default: 10 },
      details: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    categoryAccuracy: {
      score: { type: Number, default: 0 },
      weight: { type: Number, default: 10 },
      details: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    shopAttributes: {
      score: { type: Number, default: 0 },
      weight: { type: Number, default: 10 },
      details: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
  },
  // Actionable recommendations
  recommendations: [{
    priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    factor: { type: String, default: '' },
    message: { type: String, default: '' },
    impact: { type: String, default: '' },
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

listingAuditSchema.index({ userId: 1, createdAt: -1 });
listingAuditSchema.index({ userId: 1, etsyListingId: 1, createdAt: -1 });

const ListingAudit = mongoose.model('ListingAudit', listingAuditSchema);
module.exports = ListingAudit;
