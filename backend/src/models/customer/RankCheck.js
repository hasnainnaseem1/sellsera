const mongoose = require('mongoose');

const rankCheckSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  // The listing being checked
  etsyListingId: {
    type: String,
    required: [true, 'Etsy listing ID is required'],
  },
  listingTitle: {
    type: String,
    default: '',
  },
  // Results per keyword
  results: [{
    keyword: { type: String, required: true },
    rank: { type: Number, default: null }, // null = not found
    page: { type: Number, default: null },
    totalResults: { type: Number, default: 0 },
    found: { type: Boolean, default: false },
  }],
  keywordCount: {
    type: Number,
    default: 0,
  },
  serpCallCount: {
    type: Number,
    default: 0,
  },
  checkedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

rankCheckSchema.index({ userId: 1, checkedAt: -1 });
rankCheckSchema.index({ userId: 1, etsyListingId: 1, checkedAt: -1 });

const RankCheck = mongoose.model('RankCheck', rankCheckSchema);
module.exports = RankCheck;
