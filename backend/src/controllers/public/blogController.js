const BlogPost = require('../../models/admin/BlogPost');
const { resolveFromReq } = require('../../utils/helpers/urlHelper');

/**
 * GET /api/v1/public/blog/posts
 * List published blog posts with search, category filter, pagination, sorting
 */
const getPosts = async (req, res) => {
  try {
    const {
      search,
      category,
      tag,
      sort = 'latest', // latest | popular | featured
      page = 1,
      limit = 9,
    } = req.query;

    const filter = { status: 'published' };

    // Search in title, excerpt, tags
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    if (category && category !== 'All') {
      filter.category = category;
    }

    if (tag) {
      filter.tags = tag;
    }

    // Sorting
    let sortObj = { publishedAt: -1 }; // default: latest
    if (sort === 'popular') sortObj = { views: -1, publishedAt: -1 };
    if (sort === 'featured') {
      filter.isFeatured = true;
      sortObj = { publishedAt: -1 };
    }

    const total = await BlogPost.countDocuments(filter);
    const posts = await BlogPost.find(filter)
      .select('title slug excerpt featuredImage category tags publishedAt views readTime authorName isFeatured')
      .sort(sortObj)
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
    console.error('Error fetching public blog posts:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch blog posts' });
  }
};

/**
 * GET /api/v1/public/blog/popular
 * Get top 5 most popular posts
 */
const getPopularPosts = async (req, res) => {
  try {
    const posts = await BlogPost.find({ status: 'published' })
      .select('title slug featuredImage views readTime publishedAt')
      .sort({ views: -1 })
      .limit(5);

    res.json(resolveFromReq({ success: true, posts }, req));
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch popular posts' });
  }
};

/**
 * GET /api/v1/public/blog/categories
 * Get all categories with post counts
 */
const getCategories = async (req, res) => {
  try {
    const categories = await BlogPost.aggregate([
      { $match: { status: 'published' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      categories: categories.map(c => ({ name: c._id, count: c.count })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
};

/**
 * GET /api/v1/public/blog/posts/:slug
 * Get a single published blog post by slug (increments views)
 */
const getPostBySlug = async (req, res) => {
  try {
    const post = await BlogPost.findOneAndUpdate(
      { slug: req.params.slug, status: 'published' },
      { $inc: { views: 1 } },
      { new: true }
    );

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Also fetch related posts (same category, excluding current)
    const related = await BlogPost.find({
      status: 'published',
      category: post.category,
      _id: { $ne: post._id },
    })
      .select('title slug excerpt featuredImage readTime publishedAt')
      .sort({ publishedAt: -1 })
      .limit(3);

    res.json(resolveFromReq({ success: true, post, related }, req));
  } catch (err) {
    console.error('Error fetching blog post:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch post' });
  }
};

module.exports = {
  getPosts,
  getPopularPosts,
  getCategories,
  getPostBySlug,
};
