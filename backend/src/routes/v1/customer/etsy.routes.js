const express = require('express');
const router = express.Router();
const etsyController = require('../../../controllers/customer/etsyController');
const { checkShopConnection } = require('../../../middleware/etsy');
const { checkShopLimit } = require('../../../middleware/subscription');

// @route   GET /api/v1/customer/etsy/auth
// @desc    Initiate Etsy OAuth flow (returns auth URL)
// @access  Private — auth applied by parent router; shop limit checked
router.get('/auth', checkShopLimit, etsyController.initiateAuth);

// @route   GET /api/v1/customer/etsy/callback
// @desc    Handle Etsy OAuth callback (exchange code for tokens)
// @access  Private — auth applied by parent router
router.get('/callback', etsyController.handleCallback);

// @route   GET /api/v1/customer/etsy/shop
// @desc    Get all connected shops for the user (multi-shop)
// @access  Private
router.get('/shop', etsyController.getShopInfo);

// @route   GET /api/v1/customer/etsy/listings
// @desc    Get user's synced Etsy listings (optional shopId query param)
// @access  Private — requires shop connection
router.get('/listings', checkShopConnection, etsyController.getListings);

// @route   POST /api/v1/customer/etsy/shop/:shopId/disconnect
// @desc    Disconnect a specific Etsy shop
// @access  Private — requires shop connection + ownership
router.post('/shop/:shopId/disconnect', checkShopConnection, etsyController.disconnectShop);

// @route   POST /api/v1/customer/etsy/shop/:shopId/sync
// @desc    Manually trigger async listing sync for a specific shop
// @access  Private — requires shop connection + ownership
router.post('/shop/:shopId/sync', checkShopConnection, etsyController.syncNow);

// @route   GET /api/v1/customer/etsy/sync-status/:jobId
// @desc    Poll background sync job status
// @access  Private
router.get('/sync-status/:jobId', etsyController.getSyncStatus);

// Legacy routes (backward compatible — operate on first active shop)
router.post('/disconnect', checkShopConnection, etsyController.disconnectShop);
router.post('/sync', checkShopConnection, etsyController.syncNow);

module.exports = router;
