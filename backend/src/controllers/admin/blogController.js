const log = require('../../utils/logger')('AdminBlog');
const BlogPost = require('../../models/admin/BlogPost');
const { ActivityLog } = require('../../models/admin');
const { getClientIP } = require('../../utils/helpers/ipHelper');
const { toRelativeUploadPath, resolveFromReq } = require('../../utils/helpers/urlHelper');
const { safeSave, safeActivityLog } = require('../../utils/helpers/safeDbOps');
const escapeRegex = require('../../utils/helpers/escapeRegex');

/**
 * GET /api/v1/admin/blog/posts
 * List all blog posts (admin view — includes drafts)
 */
const listPosts = async (req, res) => {
  try {
    const { status, category, search, page = 1, limit = 20, dateFrom, dateTo, sortField, sortOrder } = req.query;
    const filter = {};

    // Multi-select status (OR)
    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length === 1) filter.status = statuses[0];
      else if (statuses.length > 1) filter.status = { $in: statuses };
    }

    // Multi-select category (OR)
    if (category) {
      const cats = category.split(',').map(c => c.trim()).filter(Boolean);
      if (cats.length === 1) filter.category = cats[0];
      else if (cats.length > 1) filter.category = { $in: cats };
    }

    // Date range filter (on createdAt)
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    if (search) {
      const safe = escapeRegex(search);
      filter.$or = [
        { title: { $regex: safe, $options: 'i' } },
        { tags: { $regex: safe, $options: 'i' } },
      ];
    }

    // Sorting
    let sort = { updatedAt: -1 };
    if (sortField) {
      sort = { [sortField]: sortOrder === 'ascend' ? 1 : -1 };
    }

    const total = await BlogPost.countDocuments(filter);
    const posts = await BlogPost.find(filter)
      .select('title slug status category tags publishedAt views isFeatured featuredImage excerpt updatedAt authorName createdAt')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json(resolveFromReq({
      success: true,
      posts,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    }, req));
  } catch (err) {
    log.error('Error fetching blog posts:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch blog posts' });
  }
};

/**
 * GET /api/v1/admin/blog/stats
 * Blog statistics
 */
const getStats = async (req, res) => {
  try {
    const [total, published, draft, archived, totalViews] = await Promise.all([
      BlogPost.countDocuments(),
      BlogPost.countDocuments({ status: 'published' }),
      BlogPost.countDocuments({ status: 'draft' }),
      BlogPost.countDocuments({ status: 'archived' }),
      BlogPost.aggregate([{ $group: { _id: null, views: { $sum: '$views' } } }]),
    ]);
    res.json({
      success: true,
      stats: { total, published, draft, archived, totalViews: totalViews[0]?.views || 0 },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
};

/**
 * GET /api/v1/admin/blog/categories
 * Get distinct categories
 */
const getCategories = async (req, res) => {
  try {
    const categories = await BlogPost.distinct('category');
    res.json({ success: true, categories: categories.filter(Boolean) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
};

/**
 * GET /api/v1/admin/blog/posts/:id
 * Get a single blog post
 */
const getPost = async (req, res) => {
  try {
    const post = await BlogPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    res.json(resolveFromReq({ success: true, post }, req));
  } catch (err) {
    log.error('Error fetching blog post:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch post' });
  }
};

/**
 * POST /api/v1/admin/blog/posts
 * Create a new blog post
 */
const createPost = async (req, res) => {
  try {
    const {
      title, slug, excerpt, content, featuredImage,
      category, tags, status, isFeatured, authorName,
      seoTitle, seoDescription
    } = req.body;

    // Check slug uniqueness
    if (slug) {
      const existing = await BlogPost.findOne({ slug });
      if (existing) {
        return res.status(400).json({ success: false, message: 'A post with this slug already exists' });
      }
    }

    const post = new BlogPost({
      title,
      slug,
      excerpt,
      content,
      featuredImage: toRelativeUploadPath(featuredImage),
      author: req.user?._id,
      authorName: authorName || req.user?.name || 'Admin',
      category: category || 'General',
      tags: tags || [],
      status: status || 'draft',
      isFeatured: isFeatured || false,
      seoTitle,
      seoDescription,
    });

    await safeSave(post);
    res.status(201).json({ success: true, post });
  } catch (err) {
    log.error('Error creating blog post:', err.message);
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'A post with this slug already exists' });
    }
    res.status(500).json({ success: false, message: 'Failed to create post' });
  }
};

/**
 * PUT /api/v1/admin/blog/posts/:id
 * Update a blog post
 */
const updatePost = async (req, res) => {
  try {
    const {
      title, slug, excerpt, content, featuredImage,
      category, tags, status, isFeatured, authorName,
      seoTitle, seoDescription
    } = req.body;

    // Check slug uniqueness (excluding current post)
    if (slug) {
      const existing = await BlogPost.findOne({ slug, _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(400).json({ success: false, message: 'A post with this slug already exists' });
      }
    }

    const post = await BlogPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Update fields
    if (title !== undefined) post.title = title;
    if (slug !== undefined) post.slug = slug;
    if (excerpt !== undefined) post.excerpt = excerpt;
    if (content !== undefined) post.content = content;
    if (featuredImage !== undefined) post.featuredImage = toRelativeUploadPath(featuredImage);
    if (category !== undefined) post.category = category;
    if (tags !== undefined) post.tags = tags;
    if (status !== undefined) post.status = status;
    if (isFeatured !== undefined) post.isFeatured = isFeatured;
    if (authorName !== undefined) post.authorName = authorName;
    if (seoTitle !== undefined) post.seoTitle = seoTitle;
    if (seoDescription !== undefined) post.seoDescription = seoDescription;

    await safeSave(post);
    res.json({ success: true, post });
  } catch (err) {
    log.error('Error updating blog post:', err.message);
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'A post with this slug already exists' });
    }
    res.status(500).json({ success: false, message: 'Failed to update post' });
  }
};

/**
 * DELETE /api/v1/admin/blog/posts/:id
 * Delete a blog post
 */
const deletePost = async (req, res) => {
  try {
    const post = await BlogPost.findByIdAndDelete(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (err) {
    log.error('Error deleting blog post:', err.message);
    res.status(500).json({ success: false, message: 'Failed to delete post' });
  }
};

/**
 * PUT /api/v1/admin/blog/posts/:id/status
 * Toggle blog post status
 */
const togglePostStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['draft', 'published', 'archived'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const post = await BlogPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    post.status = status;
    await safeSave(post);
    res.json({ success: true, post });
  } catch (err) {
    log.error('Error updating post status:', err.message);
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
};

/**
 * POST /api/v1/admin/blog/posts/bulk-delete
 * Delete multiple blog posts
 */
const bulkDeletePosts = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide post IDs to delete' });
    }
    const result = await BlogPost.deleteMany({ _id: { $in: ids } });
    await safeActivityLog(ActivityLog, {
      userId: req.userId, userName: req.user.name, userEmail: req.user.email, userRole: req.user.role,
      action: 'blog_posts_bulk_deleted', actionType: 'delete', targetModel: 'BlogPost',
      description: `Bulk deleted ${result.deletedCount} blog posts`,
      ipAddress: getClientIP(req), userAgent: req.get('user-agent'), status: 'success',
    });
    res.json({ success: true, message: `${result.deletedCount} post(s) deleted successfully`, deletedCount: result.deletedCount });
  } catch (error) {
    log.error('Bulk delete blog posts error:', error.message);
    res.status(500).json({ success: false, message: 'Error deleting blog posts' });
  }
};

module.exports = {
  listPosts,
  getStats,
  getCategories,
  getPost,
  createPost,
  updatePost,
  deletePost,
  togglePostStatus,
  bulkDeletePosts,
};
