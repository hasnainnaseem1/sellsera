const mongoose = require('mongoose');

const competitorWatchSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  shopName: {
    type: String,
    required: [true, 'Competitor shop name is required'],
    trim: true,
    maxlength: 100,
  },
  etsyShopId: {
    type: String,
    default: null,
  },
  // Latest snapshot data (denormalized for fast display)
  latestSnapshot: {
    totalSales: { type: Number, default: 0 },
    totalListings: { type: Number, default: 0 },
    avgPrice: { type: Number, default: 0 },
    dailySalesDelta: { type: Number, default: 0 },
    capturedAt: { type: Date, default: null },
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'error'],
    default: 'active',
  },
  lastError: {
    type: String,
    default: null,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

competitorWatchSchema.index({ userId: 1, shopName: 1 }, { unique: true });
competitorWatchSchema.index({ status: 1 });

competitorWatchSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const CompetitorWatch = mongoose.model('CompetitorWatch', competitorWatchSchema);
module.exports = CompetitorWatch;
