const express = require('express');
const router = express.Router();
const { checkSubscription, checkFeatureAccess, trackFeatureUsage } = require('../../../middleware/subscription');
const { checkFeatureEnabled } = require('../../../middleware/security');
const analysisController = require('../../../controllers/customer/analysisController');

// @route   POST /api/analyze
// @desc    Analyze listing
// @access  Private (requires active subscription + 'listing_audit' feature) — auth applied by parent router
router.post('/',
  checkFeatureEnabled('enableAnalysis'),    // 0. Must be enabled by admin
  checkSubscription,                       // 1. Must have active/trial subscription
  checkFeatureAccess('listing_audit'),     // 2. Must have this feature enabled + within limit
  trackFeatureUsage('listing_audit'),      // 3. Auto-log usage on successful response
  analysisController.analyzeListing
);

module.exports = router;