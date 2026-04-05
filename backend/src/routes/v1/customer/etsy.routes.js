const express = require('express');
const router = express.Router();
const multer = require('multer');
const etsyController = require('../../../controllers/customer/etsyController');
const { checkShopConnection } = require('../../../middleware/etsy');
const { checkShopLimit } = require('../../../middleware/subscription');

// Multer config for file uploads (in-memory, max 20MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

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

// @route   GET /api/v1/customer/etsy/listings/:listingId
// @desc    Get a single listing's full details (for audit pre-fill)
// @access  Private — requires shop connection
router.get('/listings/:listingId', checkShopConnection, etsyController.getListingById);

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

// @route   GET /api/v1/customer/etsy/shipping-profiles
// @desc    Get the user's Etsy shipping profile templates
// @access  Private — requires shop connection
router.get('/shipping-profiles', checkShopConnection, etsyController.getShippingProfiles);

// @route   POST /api/v1/customer/etsy/listings
// @desc    Create a new listing on Etsy
// @access  Private — requires shop connection
router.post('/listings', checkShopConnection, etsyController.createListing);

// @route   POST /api/v1/customer/etsy/listings/:listingId/images
// @desc    Upload an image to an Etsy listing
// @access  Private — requires shop connection
router.post('/listings/:listingId/images', checkShopConnection, upload.single('image'), etsyController.uploadListingImage);

// @route   POST /api/v1/customer/etsy/listings/:listingId/files
// @desc    Upload a digital file to an Etsy listing
// @access  Private — requires shop connection
router.post('/listings/:listingId/files', checkShopConnection, upload.single('file'), etsyController.uploadListingFile);

// @route   PUT /api/v1/customer/etsy/listings/:listingId/publish
// @desc    Publish a draft listing (state → active)
// @access  Private — requires shop connection
router.put('/listings/:listingId/publish', checkShopConnection, etsyController.publishListing);

module.exports = router;
