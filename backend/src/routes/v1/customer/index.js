const express = require('express');
const router = express.Router();

const analysisRoutes = require('./analysis.routes');
const historyRoutes = require('./history.routes');
const subscriptionRoutes = require('./subscription.routes');
const billingRoutes = require('./billing.routes');
const plansRoutes = require('./plans.routes');
const etsyRoutes = require('./etsy.routes');
const listingAuditRoutes = require('./listing-audit.routes');
const keywordsRoutes = require('./keywords.routes');
const rankCheckerRoutes = require('./rank-checker.routes');
const tagAnalyzerRoutes = require('./tag-analyzer.routes');
const competitorsRoutes = require('./competitors.routes');
const logisticsRoutes = require('./logistics.routes');

// All customer routes require authentication
const { auth } = require('../../../middleware/auth');

// Etsy OAuth callback is a browser redirect from Etsy — no JWT token present.
// Must be mounted BEFORE the auth-protected /etsy routes so it's reachable.
const etsyController = require('../../../controllers/customer/etsyController');
router.get('/etsy/callback', etsyController.handleCallback);

router.use('/analysis', auth, analysisRoutes);
router.use('/history', auth, historyRoutes);
router.use('/subscription', auth, subscriptionRoutes);
router.use('/billing', auth, billingRoutes);
router.use('/plans', auth, plansRoutes);
router.use('/etsy', auth, etsyRoutes);
router.use('/listing-audit', auth, listingAuditRoutes);
router.use('/keywords', auth, keywordsRoutes);
router.use('/rank-checker', auth, rankCheckerRoutes);
router.use('/tag-analyzer', auth, tagAnalyzerRoutes);
router.use('/competitors', auth, competitorsRoutes);
router.use('/logistics', auth, logisticsRoutes);

module.exports = router;