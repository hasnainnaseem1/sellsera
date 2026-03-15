const express = require('express');
const router = express.Router();
const { checkSubscription, checkFeatureAccess, trackFeatureUsage } = require('../../../middleware/subscription');
const { checkShopConnection } = require('../../../middleware/etsy');
const listingAuditController = require('../../../controllers/customer/listingAuditController');

// @route   POST /api/v1/customer/listing-audit
// @desc    Audit a single listing's SEO & quality
// @access  Private — auth from parent, needs subscription + Etsy shop
router.post('/',
  checkSubscription,
  checkShopConnection,
  checkFeatureAccess('listing_audit'),
  trackFeatureUsage('listing_audit'),
  listingAuditController.auditListing
);

// @route   GET /api/v1/customer/listing-audit/history
// @desc    Get user's audit history
// @access  Private
router.get('/history',
  checkSubscription,
  listingAuditController.getAuditHistory
);

module.exports = router;
