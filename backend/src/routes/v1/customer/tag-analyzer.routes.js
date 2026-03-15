const express = require('express');
const router = express.Router();
const { checkSubscription, checkFeatureAccess, trackFeatureUsage } = require('../../../middleware/subscription');
const { checkShopConnection } = require('../../../middleware/etsy');
const tagAnalyzerController = require('../../../controllers/customer/tagAnalyzerController');

// @route   POST /api/v1/customer/tag-analyzer
// @desc    Analyze tags for a listing — quality, competition, suggestions
// @access  Private — needs subscription + Etsy shop + tag_analysis feature
router.post('/',
  checkSubscription,
  checkShopConnection,
  checkFeatureAccess('tag_analysis'),
  trackFeatureUsage('tag_analysis'),
  tagAnalyzerController.analyzeTags
);

module.exports = router;
