const express = require('express');
const router = express.Router();
const { checkSubscription, checkFeatureAccess, trackFeatureUsage } = require('../../../middleware/subscription');
const { checkShopConnection } = require('../../../middleware/etsy');
const competitorController = require('../../../controllers/customer/competitorController');

// @route   POST /api/v1/customer/competitors/watch
// @desc    Add a competitor shop to watch list
// @access  Private — needs subscription + Etsy shop + competitor_tracking feature
router.post('/watch',
  checkSubscription,
  checkShopConnection,
  checkFeatureAccess('competitor_tracking'),
  trackFeatureUsage('competitor_tracking'),
  competitorController.addCompetitor
);

// @route   DELETE /api/v1/customer/competitors/watch/:id
// @desc    Remove a competitor from watch list
// @access  Private — needs Etsy shop connection
router.delete('/watch/:id',
  checkSubscription,
  checkShopConnection,
  competitorController.removeCompetitor
);

// @route   GET /api/v1/customer/competitors/watch
// @desc    Get the watch list with latest snapshot data
// @access  Private — needs Etsy shop connection
router.get('/watch',
  checkSubscription,
  checkShopConnection,
  competitorController.getWatchList
);

// @route   POST /api/v1/customer/competitors/refresh-all
// @desc    Refresh all competitors at once
// @access  Private — needs subscription + Etsy shop + competitor_tracking
router.post('/refresh-all',
  checkSubscription,
  checkShopConnection,
  checkFeatureAccess('competitor_tracking'),
  competitorController.refreshAll
);

// @route   GET /api/v1/customer/competitors/sales/overview
// @desc    Aggregated sales overview for all tracked shops
// @access  Private — needs subscription + Etsy shop + competitor_sales
router.get('/sales/overview',
  checkSubscription,
  checkShopConnection,
  checkFeatureAccess('competitor_sales'),
  trackFeatureUsage('competitor_sales'),
  competitorController.salesOverview
);

// @route   GET /api/v1/customer/competitors/:id/detail
// @desc    Get full competitor detail with all listings (Pro Plus)
// @access  Private — needs subscription + Etsy shop + competitor_detail_access
router.get('/:id/detail',
  checkSubscription,
  checkShopConnection,
  checkFeatureAccess('competitor_detail_access'),
  competitorController.getCompetitorDetail
);

// @route   GET /api/v1/customer/competitors/:id/snapshots
// @desc    Get snapshot history for a specific competitor
// @access  Private — needs Etsy shop connection
router.get('/:id/snapshots',
  checkSubscription,
  checkShopConnection,
  competitorController.getSnapshotHistory
);

// @route   GET /api/v1/customer/competitors/:id/sales
// @desc    Get sales data (daily deltas) for a competitor
// @access  Private — needs subscription + Etsy shop + competitor_sales feature
router.get('/:id/sales',
  checkSubscription,
  checkShopConnection,
  checkFeatureAccess('competitor_sales'),
  trackFeatureUsage('competitor_sales'),
  competitorController.getSalesData
);

// @route   POST /api/v1/customer/competitors/:id/refresh
// @desc    Force refresh competitor data
// @access  Private — needs Etsy shop connection
router.post('/:id/refresh',
  checkSubscription,
  checkShopConnection,
  competitorController.refreshCompetitor
);

module.exports = router;
