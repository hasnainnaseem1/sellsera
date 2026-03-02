const mongoose = require('mongoose');

/**
 * BlogPost Schema — represents a blog article managed from admin center.
 */
const blogPostSchema = new mongoose.Schema({
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
  excerpt: {
    type: String,
    default: '',
    maxlength: 500,
  },
  content: {
    type: String,
    default: '', // Rich text / HTML content
  },
  featuredImage: {
    type: String,
    default: '',
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  authorName: {
    type: String,
    default: 'Admin',
  },
  category: {
    type: String,
    default: 'General',
    trim: true,
  },
  tags: [{
    type: String,
    trim: true,
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
  },
  publishedAt: {
    type: Date,
    default: null,
  },
  views: {
    type: Number,
    default: 0,
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  seoTitle: {
    type: String,
    default: '',
  },
  seoDescription: {
    type: String,
    default: '',
  },
  ogImage: {
    type: String,
    default: '',
  },
  canonicalUrl: {
    type: String,
    default: '',
  },
  noIndex: {
    type: Boolean,
    default: false,
  },
  readTime: {
    type: Number, // minutes
    default: 0,
  },
}, {
  timestamps: true,
});

// Auto-generate slug from title if not provided
blogPostSchema.pre('validate', function (next) {
  if (this.title && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  next();
});

// Auto-calculate read time from content
blogPostSchema.pre('save', function (next) {
  if (this.content) {
    const plainText = this.content.replace(/<[^>]+>/g, '');
    const wordCount = plainText.split(/\s+/).filter(Boolean).length;
    this.readTime = Math.max(1, Math.ceil(wordCount / 200));
  }
  // Set publishedAt when status changes to published
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

// Indexes
blogPostSchema.index({ status: 1, publishedAt: -1 });
blogPostSchema.index({ category: 1 });
blogPostSchema.index({ tags: 1 });
blogPostSchema.index({ views: -1 });
blogPostSchema.index({ title: 'text', content: 'text', tags: 'text' });

const BlogPost = mongoose.model('BlogPost', blogPostSchema);

module.exports = BlogPost;
