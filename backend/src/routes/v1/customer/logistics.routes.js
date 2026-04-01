const express = require('express');
const router = express.Router();
const { checkSubscription, checkFeatureAccess, trackFeatureUsage } = require('../../../middleware/subscription');
const { checkShopConnection } = require('../../../middleware/etsy');
const logisticsController = require('../../../controllers/customer/logisticsController');

// @route   GET /api/v1/customer/logistics/delivery-status
// @desc    Get delivery status and tracking info for orders
// @access  Private — needs subscription + Etsy shop + delivery_tracking feature
router.get('/delivery-status',
  checkSubscription,
  checkShopConnection,
  checkFeatureAccess('delivery_tracking'),
  trackFeatureUsage('delivery_tracking'),
  logisticsController.getDeliveryStatus
);

// @route   GET /api/v1/customer/logistics/sales-map
// @desc    Get sales geographic distribution (aggregated from receipts)
// @access  Private — needs subscription + Etsy shop + sales_map feature
router.get('/sales-map',
  checkSubscription,
  checkShopConnection,
  checkFeatureAccess('sales_map'),
  trackFeatureUsage('sales_map'),
  logisticsController.getSalesMap
);

// @route   GET /api/v1/customer/logistics/sales-map/history
// @desc    Get historical geo snapshots for trend analysis
// @access  Private — needs subscription + Etsy shop + sales_map feature
router.get('/sales-map/history',
  checkSubscription,
  checkShopConnection,
  checkFeatureAccess('sales_map'),
  trackFeatureUsage('sales_map'),
  logisticsController.getSalesMapHistory
);

// @route   POST /api/v1/customer/logistics/sync-receipts
// @desc    Trigger manual receipt sync from Etsy
// @access  Private — needs subscription + Etsy shop
router.post('/sync-receipts',
  checkSubscription,
  checkShopConnection,
  logisticsController.syncReceipts
);

module.exports = router;
