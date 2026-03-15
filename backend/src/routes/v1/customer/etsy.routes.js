const express = require('express');
const router = express.Router();
const etsyController = require('../../../controllers/customer/etsyController');
const { checkShopConnection } = require('../../../middleware/etsy');

// @route   GET /api/v1/customer/etsy/auth
// @desc    Initiate Etsy OAuth flow (returns auth URL)
// @access  Private — auth applied by parent router
router.get('/auth', etsyController.initiateAuth);

// @route   GET /api/v1/customer/etsy/callback
// @desc    Handle Etsy OAuth callback (exchange code for tokens)
// @access  Private — auth applied by parent router
router.get('/callback', etsyController.handleCallback);

// @route   GET /api/v1/customer/etsy/shop
// @desc    Get connected shop info
// @access  Private — requires shop connection
router.get('/shop', checkShopConnection, etsyController.getShopInfo);

// @route   GET /api/v1/customer/etsy/listings
// @desc    Get user's synced Etsy listings
// @access  Private — requires shop connection
router.get('/listings', checkShopConnection, etsyController.getListings);

// @route   POST /api/v1/customer/etsy/disconnect
// @desc    Disconnect Etsy shop
// @access  Private — requires shop connection
router.post('/disconnect', checkShopConnection, etsyController.disconnectShop);

module.exports = router;
