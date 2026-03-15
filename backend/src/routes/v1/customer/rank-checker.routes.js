const express = require('express');
const router = express.Router();
const { checkSubscription, checkFeatureAccess, trackFeatureUsage } = require('../../../middleware/subscription');
const { checkShopConnection } = require('../../../middleware/etsy');
const rankCheckerController = require('../../../controllers/customer/rankCheckerController');

// @route   POST /api/v1/customer/rank-checker
// @desc    Check rankings for a listing across multiple keywords
// @access  Private — needs subscription + Etsy shop + bulk_rank_check feature
router.post('/',
  checkSubscription,
  checkShopConnection,
  checkFeatureAccess('bulk_rank_check'),
  trackFeatureUsage('bulk_rank_check'),
  rankCheckerController.checkRankings
);

// @route   GET /api/v1/customer/rank-checker/history
// @desc    Get rank check history
// @access  Private
router.get('/history',
  checkSubscription,
  rankCheckerController.getRankHistory
);

module.exports = router;
