const mongoose = require('mongoose');

const salesGeoSnapshotSchema = new mongoose.Schema({
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EtsyShop',
    required: true,
    index: true,
  },
  // Period identifier (e.g., "2026-03", "2026-W12")
  period: {
    type: String,
    required: true,
  },
  periodType: {
    type: String,
    enum: ['monthly', 'weekly'],
    default: 'monthly',
  },
  // Regional breakdown
  regionBreakdown: {
    US: { orders: { type: Number, default: 0 }, revenue: { type: Number, default: 0 } },
    UK: { orders: { type: Number, default: 0 }, revenue: { type: Number, default: 0 } },
    EU: { orders: { type: Number, default: 0 }, revenue: { type: Number, default: 0 } },
    CA: { orders: { type: Number, default: 0 }, revenue: { type: Number, default: 0 } },
    AU: { orders: { type: Number, default: 0 }, revenue: { type: Number, default: 0 } },
    OTHER: { orders: { type: Number, default: 0 }, revenue: { type: Number, default: 0 } },
  },
  // Country-level detail
  countryBreakdown: [{
    countryIso: { type: String, required: true },
    orders: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
  }],
  totalOrders: {
    type: Number,
    default: 0,
  },
  totalRevenue: {
    type: Number,
    default: 0,
  },
  capturedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

salesGeoSnapshotSchema.index({ shopId: 1, period: 1 }, { unique: true });

const SalesGeoSnapshot = mongoose.model('SalesGeoSnapshot', salesGeoSnapshotSchema);
module.exports = SalesGeoSnapshot;
