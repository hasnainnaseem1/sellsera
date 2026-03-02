const express = require('express');
const router = express.Router();
const seoController = require('../../../controllers/public/seoController');

// GET /api/v1/public/seo/sitemap.xml
router.get('/sitemap.xml', seoController.getSitemap);

// GET /api/v1/public/seo/robots.txt
router.get('/robots.txt', seoController.getRobotsTxt);

// GET /api/v1/public/seo/settings
router.get('/settings', seoController.getSettings);

// GET /api/v1/public/seo/check-redirect
router.get('/check-redirect', seoController.checkRedirect);

module.exports = router;
