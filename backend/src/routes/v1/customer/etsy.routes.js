const express = require('express');
const router = express.Router();
const multer = require('multer');
const etsyController = require('../../../controllers/customer/etsyController');
const { checkShopConnection } = require('../../../middleware/etsy');
const { checkShopLimit, checkSubscription, checkFeatureAccess, trackFeatureUsage } = require('../../../middleware/subscription');

// Multer config for file uploads (in-memory, max 20MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// Separate multer config for video uploads (in-memory, max 100MB — Etsy's limit)
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
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
// @access  Private — requires shop connection + create_listing feature
router.post('/listings', checkShopConnection, checkSubscription, checkFeatureAccess('create_listing'), trackFeatureUsage('create_listing'), etsyController.createListing);

// @route   PATCH /api/v1/customer/etsy/listings/:listingId
// @desc    Update an existing listing on Etsy
// @access  Private — requires shop connection + edit_listing feature
router.patch('/listings/:listingId', checkShopConnection, checkSubscription, checkFeatureAccess('edit_listing'), trackFeatureUsage('edit_listing'), etsyController.updateListing);

// @route   POST /api/v1/customer/etsy/listings/:listingId/images
// @desc    Upload an image to an Etsy listing
// @access  Private — requires shop connection
router.post('/listings/:listingId/images', checkShopConnection, upload.single('image'), etsyController.uploadListingImage);

// @route   DELETE /api/v1/customer/etsy/listings/:listingId/images/:imageId
// @desc    Delete an image from an Etsy listing
// @access  Private — requires shop connection
router.delete('/listings/:listingId/images/:imageId', checkShopConnection, etsyController.deleteListingImage);

// @route   POST /api/v1/customer/etsy/listings/:listingId/videos
// @desc    Upload a video to an Etsy listing (auto-replaces existing video)
// @access  Private — requires shop connection
router.post('/listings/:listingId/videos', checkShopConnection, videoUpload.single('video'), etsyController.uploadListingVideo);

// @route   DELETE /api/v1/customer/etsy/listings/:listingId/videos/:videoId
// @desc    Delete a video from an Etsy listing
// @access  Private — requires shop connection
router.delete('/listings/:listingId/videos/:videoId', checkShopConnection, etsyController.deleteListingVideo);

// @route   POST /api/v1/customer/etsy/listings/:listingId/files
// @desc    Upload a digital file to an Etsy listing
// @access  Private — requires shop connection
router.post('/listings/:listingId/files', checkShopConnection, upload.single('file'), etsyController.uploadListingFile);

// @route   PUT /api/v1/customer/etsy/listings/:listingId/publish
// @desc    Publish a draft listing (state → active)
// @access  Private — requires shop connection
router.put('/listings/:listingId/publish', checkShopConnection, etsyController.publishListing);

// @route   GET /api/v1/customer/etsy/taxonomy/:taxonomyId/properties
// @desc    Get available listing properties for a taxonomy (category)
// @access  Private — requires shop connection
router.get('/taxonomy/:taxonomyId/properties', checkShopConnection, etsyController.getTaxonomyProperties);

// @route   POST /api/v1/customer/etsy/listings/:listingId/properties
// @desc    Set listing attributes (craft type, occasion, etc.)
// @access  Private — requires shop connection
router.post('/listings/:listingId/properties', checkShopConnection, etsyController.setListingProperties);

module.exports = router;
