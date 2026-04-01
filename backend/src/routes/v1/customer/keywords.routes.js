const express = require('express');
const router = express.Router();
const { checkSubscription, checkFeatureAccess, trackFeatureUsage } = require('../../../middleware/subscription');
const { checkShopConnection } = require('../../../middleware/etsy');
const keywordController = require('../../../controllers/customer/keywordController');

// @route   POST /api/v1/customer/keywords/search
// @desc    Basic keyword research — extract & rank tags from top search results
// @access  Private — needs subscription + Etsy shop + keyword_search feature
router.post('/search',
  checkSubscription,
  checkShopConnection,
  checkFeatureAccess('keyword_search'),
  trackFeatureUsage('keyword_search'),
  keywordController.searchKeywords
);

// @route   POST /api/v1/customer/keywords/deep-analysis
// @desc    Deep keyword analysis — 20 sub-queries, competition, opportunity scoring
// @access  Private — needs subscription + Etsy shop + keyword_deep_analysis feature
router.post('/deep-analysis',
  checkSubscription,
  checkShopConnection,
  checkFeatureAccess('keyword_deep_analysis'),
  trackFeatureUsage('keyword_deep_analysis'),
  keywordController.deepAnalysis
);

// @route   GET /api/v1/customer/keywords/history
// @desc    Get keyword search history
// @access  Private
router.get('/history',
  checkSubscription,
  keywordController.getKeywordHistory
);

// @route   GET /api/v1/customer/keywords/trending
// @desc    Get trending keywords from snapshot data (rising, hot, declining)
// @access  Private — needs subscription + keyword_search feature
router.get('/trending',
  checkSubscription,
  checkFeatureAccess('keyword_search'),
  keywordController.getTrendingKeywords
);

module.exports = router;
