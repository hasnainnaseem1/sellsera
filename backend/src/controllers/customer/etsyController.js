/**
 * Etsy Controller
 * 
 * Handles Etsy OAuth flow and shop management endpoints.
 * 
 * Routes:
 *   GET  /api/v1/customer/etsy/auth       → Initiate OAuth (redirect to Etsy)
 *   GET  /api/v1/customer/etsy/callback    → OAuth callback (exchange code for tokens)
 *   GET  /api/v1/customer/etsy/shop        → Get connected shop info
 *   POST /api/v1/customer/etsy/disconnect  → Disconnect shop
 */

const { EtsyShop, EtsyListing, EtsyOAuthState } = require('../../models/integrations');
const { Plan } = require('../../models/subscription');
const oauthService = require('../../services/etsy/oauthService');
const shopSyncService = require('../../services/etsy/shopSyncService');
const etsyApi = require('../../services/etsy/etsyApiService');
const log = require('../../utils/logger')('EtsyCtrl');

/**
 * GET /api/v1/customer/etsy/auth
 * Initiates OAuth flow — stores PKCE verifier + state in session, redirects to Etsy.
 */
const initiateAuth = async (req, res) => {
  try {
    const { authUrl, state, codeVerifier } = await oauthService.generateAuthUrl();

    // Store state + PKCE verifier in DB (not session — cross-domain cookies are unreliable)
    await EtsyOAuthState.create({
      state,
      codeVerifier,
      userId: req.userId,
    });

    return res.json({
      success: true,
      data: { authUrl },
    });
  } catch (error) {
    log.error('Etsy auth initiation error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate Etsy authorization',
    });
  }
};

/**
 * GET /api/v1/customer/etsy/callback
 * Handles OAuth callback — validates state, exchanges code, connects shop.
 */
const handleCallback = async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;

    // User denied access on Etsy
    if (oauthError) {
      const frontendUrl = process.env.CUSTOMER_FRONTEND_URL || 'http://localhost:3002';
      return res.redirect(`${frontendUrl}/dashboard?etsy_error=access_denied`);
    }

    // Validate required params
    if (!code || !state) {
      return res.status(400).json({
        success: false,
        message: 'Missing authorization code or state parameter',
      });
    }

    // Look up OAuth state from DB (replaces session-based storage)
    const oauthRecord = await EtsyOAuthState.findOneAndDelete({ state });

    if (!oauthRecord) {
      return res.status(403).json({
        success: false,
        message: 'Invalid OAuth state — possible CSRF attempt',
      });
    }

    const storedCodeVerifier = oauthRecord.codeVerifier;
    const userId = oauthRecord.userId;

    // Exchange code for tokens and connect shop
    const etsyShop = await oauthService.connectShop(
      userId,
      code,
      storedCodeVerifier
    );

    // Trigger initial listing sync (non-blocking — runs in background)
    shopSyncService.syncListings(etsyShop)
      .catch(err => log.error('Initial sync failed:', err.message));

    // Redirect to frontend with success
    const frontendUrl = process.env.CUSTOMER_FRONTEND_URL || 'http://localhost:3002';
    return res.redirect(`${frontendUrl}/dashboard?etsy_connected=true&shop=${encodeURIComponent(etsyShop.shopName)}`);

  } catch (error) {
    log.error('Etsy OAuth callback error:', error.message);
    const frontendUrl = process.env.CUSTOMER_FRONTEND_URL || 'http://localhost:3002';
    return res.redirect(`${frontendUrl}/dashboard?etsy_error=connection_failed`);
  }
};

/**
 * GET /api/v1/customer/etsy/shops
 * Returns ALL connected Etsy shops for the authenticated user.
 */
const getShopInfo = async (req, res) => {
  try {
    const shops = await EtsyShop.find({
      userId: req.userId,
      status: { $ne: 'disconnected' },
    })
      .select('-accessToken_enc -refreshToken_enc')
      .sort({ createdAt: 1 })
      .lean();

    // Get LIVE plan's shop limit (not stale planSnapshot)
    let shopLimit = 1;
    const planId = req.user?.planSnapshot?.planId;
    if (planId) {
      const livePlan = await Plan.findById(planId).select('features').lean();
      const liveFeature = livePlan?.features?.find(f => f.featureKey === 'connect_shops');
      if (liveFeature?.enabled) {
        shopLimit = liveFeature.limit ?? -1;
      }
    }

    return res.json({
      success: true,
      data: {
        connected: shops.length > 0,
        shops: shops.map(shop => ({
          id: shop._id,
          shopId: shop.shopId,
          shopName: shop.shopName,
          status: shop.status,
          listingCount: shop.listingCount,
          totalSales: shop.totalSales,
          shopMetadata: shop.shopMetadata,
          lastSyncAt: shop.lastSyncAt,
          tokenRevokedAt: shop.tokenRevokedAt,
          createdAt: shop.createdAt,
        })),
        shopCount: shops.length,
        shopLimit: shopLimit === -1 ? null : shopLimit,
        shopLimitUnlimited: shopLimit === -1 || shopLimit === null,
      },
    });
  } catch (error) {
    log.error('Get shop info error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve shop information',
    });
  }
};

/**
 * POST /api/v1/customer/etsy/shop/:shopId/disconnect
 * Disconnects a specific Etsy shop (clears tokens, sets status to disconnected).
 */
const disconnectShop = async (req, res) => {
  try {
    // checkShopConnection middleware validates ownership and attaches req.etsyShop
    const shop = req.etsyShop;

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'No Etsy shop found',
      });
    }

    shop.accessToken_enc = null;
    shop.refreshToken_enc = null;
    shop.tokenExpiresAt = null;
    shop.status = 'disconnected';
    await shop.save();

    return res.json({
      success: true,
      message: `Etsy shop "${shop.shopName}" disconnected successfully`,
    });
  } catch (error) {
    log.error('Disconnect shop error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to disconnect Etsy shop',
    });
  }
};

/**
 * GET /api/v1/customer/etsy/listings
 * Returns the user's synced Etsy listings from the local DB.
 */
const getListings = async (req, res) => {
  try {
    // Use shop from checkShopConnection middleware, or fallback to query
    const shop = req.etsyShop || await EtsyShop.findOne({ userId: req.userId }).select('_id');
    if (!shop) {
      return res.json({ success: true, data: { listings: [], total: 0 } });
    }

    const { page = 1, limit = 50, search, status } = req.query;
    const query = { shopId: shop._id };
    if (status) query.state = status;
    if (search) query.title = { $regex: search, $options: 'i' };

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
    const [listings, total] = await Promise.all([
      EtsyListing.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      EtsyListing.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: {
        listings: listings.map(l => ({
          listingId: l.etsyListingId,
          title: l.title,
          state: l.state,
          price: l.price,
          views: l.views,
          favorites: l.favorites,
          tags: l.tags,
          images: l.images,
          url: `https://www.etsy.com/listing/${l.etsyListingId}`,
          createdAt: l.originalCreatedAt,
          updatedAt: l.updatedAt,
        })),
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    log.error('Get listings error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve listings',
    });
  }
};

/**
 * POST /api/v1/customer/etsy/sync
 * Trigger an async background sync for the user's connected shop.
 * Returns 202 Accepted with a jobId for status polling.
 */
const syncNow = async (req, res) => {
  try {
    const shop = req.etsyShop || await EtsyShop.findOne({ userId: req.userId });
    if (!shop) {
      return res.status(404).json({ success: false, message: 'No Etsy shop connected' });
    }

    // Check if already syncing
    const syncJobManager = require('../../services/etsy/syncJobManager');
    if (syncJobManager.isShopSyncing(shop._id)) {
      const existing = syncJobManager.getLatestJobForShop(shop._id);
      return res.status(202).json({
        success: true,
        message: 'Sync already in progress',
        data: { jobId: existing?.id, status: 'running', progress: existing?.progress },
      });
    }

    // Start async sync — returns immediately
    const jobId = shopSyncService.asyncFullSync(shop);

    return res.status(202).json({
      success: true,
      message: 'Sync started in background',
      data: { jobId, status: 'running' },
    });
  } catch (error) {
    log.error('Manual sync error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to start sync',
    });
  }
};

/**
 * GET /api/v1/customer/etsy/sync-status/:jobId
 * Poll the status of a background sync job.
 */
const getSyncStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!jobId) {
      return res.status(400).json({ success: false, message: 'Job ID is required' });
    }

    const syncJobManager = require('../../services/etsy/syncJobManager');
    const job = await syncJobManager.getJob(jobId);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Sync job not found' });
    }

    // Ensure user can only see their own jobs
    if (job.userId !== String(req.userId)) {
      return res.status(404).json({ success: false, message: 'Sync job not found' });
    }

    return res.json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        error: job.error,
      },
    });
  } catch (error) {
    log.error('Sync status error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to get sync status',
    });
  }
};

/**
 * GET /api/v1/customer/etsy/listings/:listingId
 * Get a single listing's full details for audit pre-fill.
 */
const getListingById = async (req, res) => {
  try {
    const shop = req.etsyShop;
    if (!shop) {
      return res.status(403).json({ success: false, message: 'Shop connection required' });
    }

    const listing = await EtsyListing.findOne({
      shopId: shop._id,
      etsyListingId: req.params.listingId,
    }).lean();

    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    // Fetch fresh data from Etsy API for images, is_digital, etc.
    let liveImages = listing.images || [];
    let isDigital = listing.isDigital || false;
    let shippingProfile = listing.shippingProfile || {};
    let returnsAccepted = listing.returnsAccepted || false;

    try {
      // Use authenticated request — the listing belongs to the user's shop
      const liveResult = await etsyApi.authenticatedRequest(shop, 'GET',
        `/v3/application/listings/${listing.etsyListingId}`,
        { params: { includes: 'Images' } }
      );
      if (liveResult.success && liveResult.data) {
        const ld = liveResult.data;
        // Extract images
        if (ld.images && ld.images.length > 0) {
          liveImages = ld.images.map(img => ({
            url: img.url_570xN || img.url_fullxfull || img.url_170x135 || '',
            rank: img.rank || 0,
          }));
          // Update DB cache so future loads are faster
          await EtsyListing.updateOne(
            { shopId: shop._id, etsyListingId: listing.etsyListingId },
            { $set: { images: liveImages, isDigital: !!ld.is_digital } }
          ).catch(() => {});
        }
        // Digital status
        if (ld.is_digital !== undefined) isDigital = ld.is_digital;
        // Digital products don't need shipping
        if (ld.is_digital) {
          shippingProfile = { freeShipping: true, processingDays: null };
        }
      }
    } catch (apiErr) {
      log.warn('Live listing fetch failed, using cached data:', apiErr.message);
    }

    return res.json({
      success: true,
      data: {
        listingId: listing.etsyListingId,
        title: listing.title,
        description: listing.description || '',
        tags: listing.tags || [],
        price: listing.price,
        category: (listing.taxonomyPath || []).join(' > '),
        taxonomyId: listing.taxonomyId,
        images: liveImages,
        isDigital,
        shippingProfile,
        returnsAccepted,
        views: listing.views,
        favorites: listing.favorites,
        state: listing.state,
      },
    });
  } catch (error) {
    log.error('Get listing by ID error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to retrieve listing' });
  }
};

/**
 * GET /api/v1/customer/etsy/shipping-profiles
 * Fetch the user's shipping profile templates from Etsy.
 */
const getShippingProfiles = async (req, res) => {
  try {
    const shop = req.etsyShop;
    if (!shop) {
      return res.status(403).json({ success: false, message: 'Shop connection required' });
    }

    const result = await etsyApi.authenticatedRequest(shop, 'GET',
      `/v3/application/shops/${shop.shopId}/shipping-profiles`
    );

    if (!result.success) {
      return res.status(502).json({ success: false, message: 'Failed to fetch shipping profiles from Etsy' });
    }

    const profiles = (result.data?.results || []).map(p => ({
      shippingProfileId: p.shipping_profile_id,
      title: p.title,
      processingMin: p.processing_min,
      processingMax: p.processing_max,
      originCountryIso: p.origin_country_iso,
    }));

    return res.json({ success: true, data: profiles });
  } catch (error) {
    log.error('Get shipping profiles error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to retrieve shipping profiles' });
  }
};

/**
 * POST /api/v1/customer/etsy/listings
 * Create a new listing on Etsy.
 * 
 * Required body fields: title, description, price, quantity, taxonomyId,
 *   whoMade, whenMade, isDigital
 * Physical-only: shippingProfileId
 * Optional: tags[], materials[], personalizationIsRequired, personalizationInstructions
 */
const createListing = async (req, res) => {
  try {
    const shop = req.etsyShop;
    if (!shop) {
      return res.status(403).json({ success: false, message: 'Shop connection required' });
    }

    const {
      title, description, price, quantity, taxonomyId,
      whoMade, whenMade, isDigital,
      shippingProfileId, tags, materials,
      personalizationIsRequired, personalizationInstructions,
    } = req.body;

    // Validation
    if (!title || !description || !price || !quantity || !taxonomyId || !whoMade || !whenMade) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, description, price, quantity, category, who made, when made',
      });
    }

    if (!isDigital && !shippingProfileId) {
      return res.status(400).json({
        success: false,
        message: 'Physical products require a shipping profile',
      });
    }

    // Build Etsy API payload
    const body = {
      title: title.trim(),
      description: description.trim(),
      price: parseFloat(price),
      quantity: parseInt(quantity, 10),
      taxonomy_id: parseInt(taxonomyId, 10),
      who_made: whoMade,
      when_made: whenMade,
      is_supply: false,
      should_auto_renew: true,
      type: isDigital ? 'download' : 'physical',
    };

    // Tags (max 13)
    if (tags && tags.length > 0) {
      body.tags = tags.slice(0, 13).map(t => t.trim()).filter(Boolean);
    }

    // Materials
    if (materials && materials.length > 0) {
      body.materials = materials.slice(0, 13).map(m => m.trim()).filter(Boolean);
    }

    // Shipping profile for physical products
    if (!isDigital && shippingProfileId) {
      body.shipping_profile_id = parseInt(shippingProfileId, 10);
    }

    // Personalization
    if (personalizationIsRequired) {
      body.is_personalizable = true;
      body.personalization_is_required = true;
      if (personalizationInstructions) {
        body.personalization_instructions = personalizationInstructions.trim();
      }
    }

    log.info(`Creating listing on Etsy: "${title.substring(0, 50)}..." for shop ${shop.shopId}`);

    const result = await etsyApi.authenticatedRequest(shop, 'POST',
      `/v3/application/shops/${shop.shopId}/listings`,
      { body }
    );

    if (!result.success) {
      log.error('Etsy create listing failed:', result.error);
      return res.status(502).json({
        success: false,
        message: result.error || 'Failed to create listing on Etsy',
      });
    }

    const created = result.data;

    // Save to local DB
    try {
      await EtsyListing.create({
        shopId: shop._id,
        etsyListingId: String(created.listing_id),
        title: created.title || title,
        description: created.description || description,
        tags: created.tags || tags || [],
        materials: created.materials || materials || [],
        price: created.price?.amount ? created.price.amount / created.price.divisor : parseFloat(price),
        currencyCode: created.price?.currency_code || 'USD',
        quantity: created.quantity || parseInt(quantity, 10),
        views: 0,
        favorites: 0,
        state: created.state || 'draft',
        taxonomyId: created.taxonomy_id || parseInt(taxonomyId, 10),
        taxonomyPath: [],
        isDigital: !!isDigital,
        syncedAt: new Date(),
      });
    } catch (dbErr) {
      log.warn('Failed to save created listing to local DB:', dbErr.message);
    }

    log.info(`Listing created: ${created.listing_id}`);

    return res.json({
      success: true,
      message: 'Listing created successfully on Etsy',
      data: {
        listingId: created.listing_id,
        title: created.title,
        state: created.state,
        url: `https://www.etsy.com/listing/${created.listing_id}`,
      },
    });
  } catch (error) {
    log.error('Create listing error:', error.message, error.stack);
    return res.status(500).json({ success: false, message: 'Failed to create listing' });
  }
};

/**
 * POST /api/v1/customer/etsy/listings/:listingId/images
 * Upload an image to an existing Etsy listing.
 */
const uploadListingImage = async (req, res) => {
  try {
    const shop = req.etsyShop;
    if (!shop) {
      return res.status(403).json({ success: false, message: 'Shop connection required' });
    }

    const { listingId } = req.params;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    const formData = new FormData();
    formData.append('image', blob, req.file.originalname);

    const result = await etsyApi.authenticatedRequest(shop, 'POST',
      `/v3/application/shops/${shop.shopId}/listings/${listingId}/images`,
      { formData }
    );

    if (!result.success) {
      log.error('Image upload failed:', result.error);
      return res.status(502).json({ success: false, message: result.error || 'Failed to upload image' });
    }

    return res.json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        listingImageId: result.data?.listing_image_id,
        url: result.data?.url_570xN || result.data?.url_fullxfull || '',
      },
    });
  } catch (error) {
    log.error('Upload listing image error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to upload image' });
  }
};

/**
 * POST /api/v1/customer/etsy/listings/:listingId/files
 * Upload a digital file to an existing Etsy listing.
 */
const uploadListingFile = async (req, res) => {
  try {
    const shop = req.etsyShop;
    if (!shop) {
      return res.status(403).json({ success: false, message: 'Shop connection required' });
    }

    const { listingId } = req.params;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }

    const blob = new Blob([req.file.buffer], { type: req.file.mimetype || 'application/octet-stream' });
    const formData = new FormData();
    formData.append('file', blob, req.file.originalname);

    const result = await etsyApi.authenticatedRequest(shop, 'POST',
      `/v3/application/shops/${shop.shopId}/listings/${listingId}/files`,
      { formData }
    );

    if (!result.success) {
      log.error('File upload failed:', result.error);
      return res.status(502).json({ success: false, message: result.error || 'Failed to upload file' });
    }

    return res.json({
      success: true,
      message: 'Digital file uploaded successfully',
      data: {
        fileId: result.data?.listing_file_id,
        filename: result.data?.filename || req.file.originalname,
      },
    });
  } catch (error) {
    log.error('Upload listing file error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to upload digital file' });
  }
};

/**
 * PUT /api/v1/customer/etsy/listings/:listingId/publish
 * Publish a draft listing (change state to active).
 */
const publishListing = async (req, res) => {
  try {
    const shop = req.etsyShop;
    if (!shop) {
      return res.status(403).json({ success: false, message: 'Shop connection required' });
    }

    const { listingId } = req.params;

    const result = await etsyApi.authenticatedRequest(shop, 'PUT',
      `/v3/application/shops/${shop.shopId}/listings/${listingId}`,
      { body: { state: 'active' } }
    );

    if (!result.success) {
      log.error('Publish listing failed:', result.error);
      return res.status(502).json({
        success: false,
        message: result.error || 'Failed to publish listing. Make sure it has at least one image.',
      });
    }

    // Update local DB
    await EtsyListing.updateOne(
      { shopId: shop._id, etsyListingId: String(listingId) },
      { $set: { state: 'active' } }
    ).catch(() => {});

    return res.json({
      success: true,
      message: 'Listing published successfully',
      data: {
        listingId: result.data?.listing_id || listingId,
        state: 'active',
        url: `https://www.etsy.com/listing/${listingId}`,
      },
    });
  } catch (error) {
    log.error('Publish listing error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to publish listing' });
  }
};

module.exports = {
  initiateAuth,
  handleCallback,
  getShopInfo,
  getListings,
  getListingById,
  disconnectShop,
  syncNow,
  getSyncStatus,
  getShippingProfiles,
  createListing,
  uploadListingImage,
  uploadListingFile,
  publishListing,
};
