const express = require('express');
const router = express.Router();
const blogController = require('../../../controllers/public/blogController');

// GET /api/v1/public/blog/posts
router.get('/posts', blogController.getPosts);

// GET /api/v1/public/blog/popular
router.get('/popular', blogController.getPopularPosts);

// GET /api/v1/public/blog/categories
router.get('/categories', blogController.getCategories);

// GET /api/v1/public/blog/posts/:slug
router.get('/posts/:slug', blogController.getPostBySlug);

module.exports = router;
