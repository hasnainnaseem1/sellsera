const mongoose = require('mongoose');

const shopReceiptSchema = new mongoose.Schema({
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EtsyShop',
    required: true,
    index: true,
  },
  etsyReceiptId: {
    type: String,
    required: [true, 'Etsy receipt ID is required'],
  },
  // Order status
  status: {
    type: String,
    enum: ['paid', 'shipped', 'in_transit', 'delivered', 'completed', 'cancelled', 'refunded'],
    default: 'paid',
  },
  // Buyer info (for geo mapping)
  countryIso: {
    type: String,
    default: null,
    index: true,
  },
  city: {
    type: String,
    default: null,
  },
  state: {
    type: String,
    default: null,
  },
  // Financials
  grandTotal: {
    type: Number,
    default: 0,
  },
  currencyCode: {
    type: String,
    default: 'USD',
  },
  // Shipment tracking
  shipment: {
    carrier: { type: String, default: null },
    trackingCode: { type: String, default: null },
    shippedAt: { type: Date, default: null },
    estimatedDelivery: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
  },
  // Items in order
  items: [{
    listingId: { type: String },
    title: { type: String },
    quantity: { type: Number, default: 1 },
    price: { type: Number, default: 0 },
  }],
  // Etsy timestamps
  createdTstamp: {
    type: Date,
    default: null,
    index: true,
  },
  updatedTstamp: {
    type: Date,
    default: null,
  },
  // Local sync timestamp
  syncedAt: {
    type: Date,
    default: Date.now,
  },
});

shopReceiptSchema.index({ shopId: 1, etsyReceiptId: 1 }, { unique: true });
shopReceiptSchema.index({ shopId: 1, createdTstamp: -1 });
shopReceiptSchema.index({ shopId: 1, status: 1 });

const ShopReceipt = mongoose.model('ShopReceipt', shopReceiptSchema);
module.exports = ShopReceipt;
