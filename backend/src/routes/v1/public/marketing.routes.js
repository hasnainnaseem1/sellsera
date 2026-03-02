const express = require('express');
const router = express.Router();
const marketingController = require('../../../controllers/public/marketingController');

// GET /api/v1/public/site
router.get('/site', marketingController.getSiteSettings);

// GET /api/v1/public/navigation
router.get('/navigation', marketingController.getNavigation);

// GET /api/v1/public/pages
router.get('/pages', marketingController.getPages);

// GET /api/v1/public/pages/:slug
router.get('/pages/:slug', marketingController.getPageBySlug);

// GET /api/v1/public/home
router.get('/home', marketingController.getHomePage);

module.exports = router;
