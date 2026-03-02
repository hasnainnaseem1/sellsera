const mongoose = require('mongoose');

/**
 * SEO Redirect Schema — manages 301/302 URL redirects.
 */
const seoRedirectSchema = new mongoose.Schema({
  fromPath: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  toPath: {
    type: String,
    required: true,
    trim: true,
  },
  statusCode: {
    type: Number,
    enum: [301, 302, 307, 308],
    default: 301,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  hitCount: {
    type: Number,
    default: 0,
  },
  lastHitAt: {
    type: Date,
    default: null,
  },
  note: {
    type: String,
    default: '',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Ensure unique from paths
seoRedirectSchema.index({ fromPath: 1 }, { unique: true });

const SeoRedirect = mongoose.model('SeoRedirect', seoRedirectSchema);

module.exports = SeoRedirect;
