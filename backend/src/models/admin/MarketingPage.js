const mongoose = require('mongoose');

/**
 * Content Block Schema — each page is composed of ordered content blocks.
 * Block types: hero, features, pricing, cta, faq, text, contact, stats, testimonials, custom
 */
const contentBlockSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['hero', 'features', 'pricing', 'cta', 'faq', 'text', 'contact', 'stats', 'testimonials', 'custom'],
  },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  content: { type: String, default: '' }, // Rich text / HTML content
  buttonText: { type: String, default: '' },
  buttonLink: { type: String, default: '' },
  secondaryButtonText: { type: String, default: '' },
  secondaryButtonLink: { type: String, default: '' },
  backgroundImage: { type: String, default: '' },
  backgroundColor: { type: String, default: '' },
  textColor: { type: String, default: '' },
  items: [{
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    icon: { type: String, default: '' },
    image: { type: String, default: '' },
    link: { type: String, default: '' },
    price: { type: String, default: '' },
    features: [{ type: String }], // For pricing cards feature list
    highlighted: { type: Boolean, default: false },
  }],
  order: { type: Number, default: 0 },
  visible: { type: Boolean, default: true },
  settings: { type: mongoose.Schema.Types.Mixed, default: {} }, // Extra config per block type
}, { _id: true });

/**
 * Marketing Page Schema — represents a page on the marketing website.
 */
const marketingPageSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  description: {
    type: String,
    default: '',
  },
  // SEO fields
  metaTitle: { type: String, default: '' },
  metaDescription: { type: String, default: '' },
  metaKeywords: { type: String, default: '' },
  ogImage: { type: String, default: '' },
  canonicalUrl: { type: String, default: '' },
  noIndex: { type: Boolean, default: false },
  // Page status
  status: {
    type: String,
    enum: ['published', 'draft', 'archived'],
    default: 'draft',
  },
  // Is this the homepage?
  isHomePage: {
    type: Boolean,
    default: false,
  },
  // Show in main navigation
  showInNavigation: {
    type: Boolean,
    default: true,
  },
  navigationOrder: {
    type: Number,
    default: 0,
  },
  navigationLabel: {
    type: String,
    default: '', // Falls back to title if empty
  },
  // Content blocks
  blocks: [contentBlockSchema],
  // Custom CSS for this page
  customCSS: {
    type: String,
    default: '',
  },
  // Track who last edited
  lastEditedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Ensure only one homepage
marketingPageSchema.pre('save', async function(next) {
  if (this.isHomePage && this.isModified('isHomePage')) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id }, isHomePage: true },
      { isHomePage: false }
    );
  }
  next();
});

// Generate slug from title if not provided
marketingPageSchema.pre('validate', function(next) {
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Index for public queries
marketingPageSchema.index({ slug: 1, status: 1 });
marketingPageSchema.index({ showInNavigation: 1, navigationOrder: 1 });

module.exports = mongoose.model('MarketingPage', marketingPageSchema);
