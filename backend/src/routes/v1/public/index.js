const express = require('express');
const router = express.Router();

const marketingRoutes = require('./marketing.routes');
const blogRoutes = require('./blog.routes');
const seoRoutes = require('./seo.routes');
const plansRoutes = require('./plans.routes');
const { downloadInvoicePublic } = require('../../../controllers/customer/billingController');

// Public routes — no authentication required
router.use('/marketing', marketingRoutes);
router.use('/blog', blogRoutes);
router.use('/seo', seoRoutes);
router.use('/plans', plansRoutes);

// Public invoice download — authenticated via signed token in query param
router.get('/invoice/:paymentId', downloadInvoicePublic);

// Convenience aliases so frontends can use /api/v1/public/site directly
router.use('/', marketingRoutes);

module.exports = router;
