const mongoose = require('mongoose');

const competitorSnapshotSchema = new mongoose.Schema({
  watchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CompetitorWatch',
    required: true,
    index: true,
  },
  shopName: {
    type: String,
    required: true,
  },
  totalSales: {
    type: Number,
    default: 0,
  },
  totalListings: {
    type: Number,
    default: 0,
  },
  avgPrice: {
    type: Number,
    default: 0,
  },
  // Top listings for gap analysis
  topListings: [{
    listingId: { type: String },
    title: { type: String },
    price: { type: Number },
    views: { type: Number, default: 0 },
    favorites: { type: Number, default: 0 },
    tags: [{ type: String }],
  }],
  capturedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

competitorSnapshotSchema.index({ watchId: 1, capturedAt: -1 });

const CompetitorSnapshot = mongoose.model('CompetitorSnapshot', competitorSnapshotSchema);
module.exports = CompetitorSnapshot;
