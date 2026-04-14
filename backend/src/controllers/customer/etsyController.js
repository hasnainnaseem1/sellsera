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
          isDigital: l.isDigital || false,
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
    // Additional editable fields — start from DB cache
    let whoMade = null;
    let whenMade = null;
    let isSupply = false;
    let shippingProfileId = null;
    let quantity = listing.quantity || 1;
    let materials = listing.materials || [];
    let isPersonalizable = false;
    let personalizationIsRequired = false;
    let personalizationCharCountMax = null;
    let personalizationInstructions = '';

    let liveVideos = [];
    try {
      // Use authenticated request — the listing belongs to the user's shop
      const liveResult = await etsyApi.authenticatedRequest(shop, 'GET',
        `/v3/application/listings/${listing.etsyListingId}`,
        { params: { includes: 'Images,Videos' } }
      );
      if (liveResult.success && liveResult.data) {
        const ld = liveResult.data;
        // Extract images with full data for edit/delete
        if (ld.images && ld.images.length > 0) {
          liveImages = ld.images.map(img => ({
            listing_image_id: img.listing_image_id,
            url: img.url_570xN || img.url_fullxfull || img.url_170x135 || '',
            url_75x75: img.url_75x75 || '',
            url_170x135: img.url_170x135 || '',
            url_570xN: img.url_570xN || '',
            url_fullxfull: img.url_fullxfull || '',
            rank: img.rank || 0,
            alt_text: img.alt_text || '',
          }));
          // Update DB cache so future loads are faster
          await EtsyListing.updateOne(
            { shopId: shop._id, etsyListingId: listing.etsyListingId },
            { $set: { images: liveImages.map(i => ({ url: i.url, rank: i.rank })), isDigital: !!ld.is_digital } }
          ).catch(() => {});
        }
        // Extract videos
        if (ld.videos && ld.videos.length > 0) {
          liveVideos = ld.videos.map(v => ({
            video_id: v.video_id,
            thumbnail_url: v.thumbnail_url || '',
            video_url: v.video_url || '',
            video_state: v.video_state || 'active',
          }));
        }
        // Digital status
        if (ld.is_digital !== undefined) isDigital = ld.is_digital;
        // Digital products don't need shipping
        if (ld.is_digital) {
          shippingProfile = { freeShipping: true, processingDays: null };
        }
        // Extract additional editable fields from live data
        if (ld.who_made) whoMade = ld.who_made;
        if (ld.when_made) whenMade = ld.when_made;
        if (ld.is_supply !== undefined) isSupply = ld.is_supply;
        if (ld.shipping_profile_id) shippingProfileId = ld.shipping_profile_id;
        if (ld.quantity !== undefined) quantity = ld.quantity;
        if (ld.materials && ld.materials.length > 0) materials = ld.materials;
        if (ld.is_personalizable !== undefined) isPersonalizable = ld.is_personalizable;
        if (ld.personalization_is_required !== undefined) personalizationIsRequired = ld.personalization_is_required;
        if (ld.personalization_char_count_max !== undefined) personalizationCharCountMax = ld.personalization_char_count_max;
        if (ld.personalization_instructions) personalizationInstructions = ld.personalization_instructions;
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
        materials,
        price: listing.price,
        quantity,
        category: (listing.taxonomyPath || []).join(' > '),
        taxonomyId: listing.taxonomyId,
        images: liveImages,
        isDigital,
        shippingProfile,
        shippingProfileId,
        returnsAccepted,
        views: listing.views,
        favorites: listing.favorites,
        state: listing.state,
        whoMade,
        whenMade,
        isSupply,
        isPersonalizable,
        personalizationIsRequired,
        personalizationCharCountMax,
        personalizationInstructions,
        videos: liveVideos,
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
      whoMade, whenMade, isDigital, isSupply,
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
      is_supply: isSupply === true,
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
    formData.append('name', req.file.originalname);

    log.info(`Uploading digital file "${req.file.originalname}" (${req.file.size} bytes, ${req.file.mimetype}) to listing ${listingId}`);

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

    const result = await etsyApi.authenticatedRequest(shop, 'PATCH',
      `/v3/application/shops/${shop.shopId}/listings/${listingId}`,
      { body: { state: 'active' } }
    );

    if (!result.success) {
      log.error('Publish listing failed:', result.error);

      // If listing was deleted on Etsy, clean up locally
      if (result.status === 404 || (result.error && String(result.error).toLowerCase().includes('not found'))) {
        await EtsyListing.deleteOne({ shopId: shop._id, etsyListingId: String(listingId) }).catch(() => {});
        return res.status(404).json({
          success: false,
          message: 'This listing no longer exists on Etsy. It has been removed from your dashboard. Please sync to refresh.',
        });
      }

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

/**
 * GET /api/v1/customer/etsy/taxonomy/:taxonomyId/properties
 * Get available listing properties for a given taxonomy (category) ID.
 * Returns properties like Craft type, Occasion, Celebration, etc.
 */
const getTaxonomyProperties = async (req, res) => {
  try {
    const { taxonomyId } = req.params;

    if (!taxonomyId || isNaN(taxonomyId)) {
      return res.status(400).json({ success: false, message: 'Valid taxonomy ID required' });
    }

    const result = await etsyApi.publicRequest(
      'GET',
      `/v3/application/seller-taxonomy/nodes/${taxonomyId}/properties`
    );

    if (!result.success) {
      log.error('Fetch taxonomy properties failed:', result.error);
      return res.status(502).json({ success: false, message: result.error || 'Failed to fetch properties' });
    }

    // Filter to attribute-capable properties and format
    const properties = (result.data?.results || [])
      .filter(p => p.supports_attributes)
      .map(p => ({
        propertyId: p.property_id,
        name: p.name,
        displayName: p.display_name,
        isRequired: p.is_required,
        possibleValues: (p.possible_values || []).map(v => ({
          valueId: v.value_id,
          name: v.name,
        })),
        scales: (p.scales || []).map(s => ({
          scaleId: s.scale_id,
          displayName: s.display_name,
        })),
      }));

    return res.json({ success: true, data: properties });
  } catch (error) {
    log.error('Get taxonomy properties error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch category properties' });
  }
};

/**
 * POST /api/v1/customer/etsy/listings/:listingId/properties
 * Set listing properties (attributes) like Craft type, Occasion, etc.
 * Body: { properties: [{ propertyId, valueIds, values, scaleId }] }
 */
const setListingProperties = async (req, res) => {
  try {
    const shop = req.etsyShop;
    if (!shop) {
      return res.status(403).json({ success: false, message: 'Shop connection required' });
    }

    const { listingId } = req.params;
    const { properties } = req.body;

    if (!properties || !Array.isArray(properties) || properties.length === 0) {
      return res.json({ success: true, data: { set: 0 } });
    }

    let setCount = 0;
    const errors = [];

    for (const prop of properties) {
      const body = {};
      // Etsy API requires BOTH value_ids and values arrays
      if (prop.valueIds && prop.valueIds.length > 0) body.value_ids = prop.valueIds;
      if (prop.values && prop.values.length > 0) body.values = prop.values;
      // If we have valueIds but no string values, send empty values array
      if (body.value_ids && !body.values) body.values = [''];
      // If we have string values but no valueIds, send empty valueIds array
      if (body.values && !body.value_ids) body.value_ids = [0];
      if (prop.scaleId) body.scale_id = prop.scaleId;

      log.info(`Setting property ${prop.propertyId} on listing ${listingId}: value_ids=${JSON.stringify(body.value_ids)}, values=${JSON.stringify(body.values)}`);

      const result = await etsyApi.authenticatedRequest(shop, 'PUT',
        `/v3/application/shops/${shop.shopId}/listings/${listingId}/properties/${prop.propertyId}`,
        { body }
      );

      if (result.success) {
        setCount++;
      } else {
        log.warn(`Property ${prop.propertyId} set failed for listing ${listingId}: ${result.error}`);
        errors.push({ propertyId: prop.propertyId, error: result.error });
      }
    }

    return res.json({ success: true, data: { set: setCount, errors } });
  } catch (error) {
    log.error('Set listing properties error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to set listing properties' });
  }
};

/**
 * PATCH /api/v1/customer/etsy/listings/:listingId
 * Update an existing listing on Etsy.
 * Only provided fields are sent to the API.
 */
const updateListing = async (req, res) => {
  try {
    const shop = req.etsyShop;
    if (!shop) {
      return res.status(403).json({ success: false, message: 'Shop connection required' });
    }

    const { listingId } = req.params;

    // Verify listing exists locally
    const listing = await EtsyListing.findOne({ shopId: shop._id, etsyListingId: String(listingId) });
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    const {
      title, description, price, quantity, taxonomyId,
      whoMade, whenMade, isSupply, shippingProfileId,
      tags, materials, imageIds,
      isPersonalizable, personalizationIsRequired,
      personalizationCharCountMax, personalizationInstructions,
    } = req.body;

    // Build PATCH body — quantity and price are NOT supported by Etsy PATCH listing.
    // They must be updated via the Inventory API (PUT /listings/{id}/inventory).
    const body = {};

    if (title !== undefined) body.title = title.trim();
    if (description !== undefined) body.description = description.trim();
    if (taxonomyId !== undefined) body.taxonomy_id = parseInt(taxonomyId, 10);
    if (whoMade !== undefined) body.who_made = whoMade;
    if (whenMade !== undefined) body.when_made = whenMade;
    if (isSupply !== undefined) body.is_supply = isSupply === true;
    if (shippingProfileId !== undefined) body.shipping_profile_id = parseInt(shippingProfileId, 10);

    // Image reordering — pass image_ids to set new image order
    if (imageIds !== undefined && Array.isArray(imageIds) && imageIds.length > 0) {
      body.image_ids = imageIds.map(id => parseInt(id, 10));
    }

    // Tags (max 13)
    if (tags !== undefined) {
      body.tags = (tags || []).slice(0, 13).map(t => t.trim()).filter(Boolean);
    }

    // Materials (max 13)
    if (materials !== undefined) {
      body.materials = (materials || []).slice(0, 13).map(m => m.trim()).filter(Boolean);
    }

    // Personalization
    if (isPersonalizable !== undefined) {
      body.is_personalizable = isPersonalizable === true;
      if (isPersonalizable) {
        if (personalizationIsRequired !== undefined) body.personalization_is_required = personalizationIsRequired === true;
        if (personalizationCharCountMax !== undefined) body.personalization_char_count_max = parseInt(personalizationCharCountMax, 10);
        if (personalizationInstructions !== undefined) body.personalization_instructions = personalizationInstructions.trim();
      }
    }

    const needsInventoryUpdate = price !== undefined || quantity !== undefined;

    if (Object.keys(body).length === 0 && !needsInventoryUpdate) {
      return res.status(400).json({ success: false, message: 'No fields provided to update' });
    }

    let updated = null;

    // PATCH listing fields (title, desc, tags, etc.)
    if (Object.keys(body).length > 0) {
      log.info(`Updating listing ${listingId} on Etsy for shop ${shop.shopId}: ${Object.keys(body).join(', ')}`);

      const result = await etsyApi.authenticatedRequest(shop, 'PATCH',
        `/v3/application/shops/${shop.shopId}/listings/${listingId}`,
        { body }
      );

      if (!result.success) {
        log.error('Etsy update listing failed:', result.error);

        if (result.status === 404 || (result.error && String(result.error).toLowerCase().includes('not found'))) {
          await EtsyListing.deleteOne({ shopId: shop._id, etsyListingId: String(listingId) }).catch(() => {});
          return res.status(404).json({
            success: false,
            message: 'This listing no longer exists on Etsy. It has been removed from your dashboard.',
          });
        }

        return res.status(502).json({
          success: false,
          message: result.error || 'Failed to update listing on Etsy',
        });
      }

      updated = result.data;
    }

    // Update price/quantity via Inventory API
    if (needsInventoryUpdate) {
      log.info(`Updating inventory for listing ${listingId}: price=${price}, quantity=${quantity}`);

      try {
        // Fetch current inventory
        const invResult = await etsyApi.authenticatedRequest(shop, 'GET',
          `/v3/application/listings/${listingId}/inventory`
        );

        if (!invResult.success || !invResult.data?.products?.length) {
          log.error('Failed to fetch inventory for listing', listingId);
          return res.status(502).json({ success: false, message: 'Failed to fetch listing inventory from Etsy' });
        }

        const invData = invResult.data;
        // Update offerings in the first product (simple listings without variations)
        const products = invData.products.map(product => ({
          sku: product.sku || '',
          property_values: product.property_values || [],
          offerings: product.offerings.map(offering => ({
            price: price !== undefined ? parseFloat(price) : (offering.price.amount / offering.price.divisor),
            quantity: quantity !== undefined ? parseInt(quantity, 10) : offering.quantity,
            is_enabled: offering.is_enabled !== false,
          })),
        }));

        const invUpdateResult = await etsyApi.authenticatedRequest(shop, 'PUT',
          `/v3/application/listings/${listingId}/inventory`,
          {
            body: {
              products,
              price_on_property: invData.price_on_property || [],
              quantity_on_property: invData.quantity_on_property || [],
              sku_on_property: invData.sku_on_property || [],
            },
          }
        );

        if (!invUpdateResult.success) {
          log.error('Etsy inventory update failed:', invUpdateResult.error);
          return res.status(502).json({
            success: false,
            message: invUpdateResult.error || 'Failed to update price/quantity on Etsy',
          });
        }

        log.info(`Inventory updated for listing ${listingId}`);
      } catch (invErr) {
        log.error('Inventory update error:', invErr.message);
        return res.status(502).json({ success: false, message: 'Failed to update price/quantity' });
      }
    }

    // Update local DB
    const dbUpdate = {};
    if (updated) {
      if (updated.title) dbUpdate.title = updated.title;
      if (updated.description) dbUpdate.description = updated.description;
      if (updated.tags) dbUpdate.tags = updated.tags;
      if (updated.materials) dbUpdate.materials = updated.materials;
      if (updated.taxonomy_id) dbUpdate.taxonomyId = updated.taxonomy_id;
      if (updated.state) dbUpdate.state = updated.state;
    }
    if (price !== undefined) dbUpdate.price = parseFloat(price);
    if (quantity !== undefined) dbUpdate.quantity = parseInt(quantity, 10);
    dbUpdate.syncedAt = new Date();

    await EtsyListing.updateOne(
      { shopId: shop._id, etsyListingId: String(listingId) },
      { $set: dbUpdate }
    ).catch(err => log.warn('Failed to update local listing:', err.message));

    log.info(`Listing ${listingId} updated successfully`);

    return res.json({
      success: true,
      message: 'Listing updated successfully',
      data: {
        listingId: (updated && updated.listing_id) || listingId,
        title: updated?.title || listing.title,
        state: updated?.state || listing.state,
        url: `https://www.etsy.com/listing/${listingId}`,
      },
    });
  } catch (error) {
    log.error('Update listing error:', error.message, error.stack);
    return res.status(500).json({ success: false, message: 'Failed to update listing' });
  }
};

/**
 * DELETE /api/v1/customer/etsy/listings/:listingId/images/:imageId
 * Delete a specific image from an Etsy listing.
 */
const deleteListingImage = async (req, res) => {
  try {
    const shop = req.etsyShop;
    if (!shop) {
      return res.status(403).json({ success: false, message: 'Shop connection required' });
    }

    const { listingId, imageId } = req.params;

    const result = await etsyApi.authenticatedRequest(shop, 'DELETE',
      `/v3/application/shops/${shop.shopId}/listings/${listingId}/images/${imageId}`
    );

    if (!result.success) {
      log.error('Image delete failed:', result.error);
      return res.status(502).json({ success: false, message: result.error || 'Failed to delete image' });
    }

    return res.json({ success: true, message: 'Image deleted successfully' });
  } catch (error) {
    log.error('Delete listing image error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to delete image' });
  }
};

/**
 * POST /api/v1/customer/etsy/listings/:listingId/videos
 * Upload a video to an Etsy listing.
 * Etsy allows only 1 video per listing — automatically deletes existing video first.
 */
const uploadListingVideo = async (req, res) => {
  try {
    const shop = req.etsyShop;
    if (!shop) {
      return res.status(403).json({ success: false, message: 'Shop connection required' });
    }

    const { listingId } = req.params;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No video file provided' });
    }

    // Etsy allows only 1 video per listing — delete existing video if any
    try {
      const existingVideos = await etsyApi.authenticatedRequest(shop, 'GET',
        `/v3/application/listings/${listingId}/videos`
      );
      if (existingVideos.success && existingVideos.data?.results?.length > 0) {
        for (const v of existingVideos.data.results) {
          log.info(`Deleting existing video ${v.video_id} from listing ${listingId} before uploading new one`);
          await etsyApi.authenticatedRequest(shop, 'DELETE',
            `/v3/application/shops/${shop.shopId}/listings/${listingId}/videos/${v.video_id}`
          );
        }
      }
    } catch (delErr) {
      log.warn('Could not check/delete existing videos, proceeding with upload:', delErr.message);
    }

    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    const formData = new FormData();
    formData.append('video', blob, req.file.originalname);
    formData.append('name', req.file.originalname);

    const result = await etsyApi.authenticatedRequest(shop, 'POST',
      `/v3/application/shops/${shop.shopId}/listings/${listingId}/videos`,
      { formData }
    );

    if (!result.success) {
      log.error('Video upload failed:', result.error);
      return res.status(502).json({ success: false, message: result.error || 'Failed to upload video' });
    }

    return res.json({
      success: true,
      message: 'Video uploaded successfully',
      data: {
        video_id: result.data?.video_id,
        thumbnail_url: result.data?.thumbnail_url || '',
        video_url: result.data?.video_url || '',
        video_state: result.data?.video_state || 'active',
      },
    });
  } catch (error) {
    log.error('Upload listing video error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to upload video' });
  }
};

/**
 * DELETE /api/v1/customer/etsy/listings/:listingId/videos/:videoId
 * Delete a specific video from an Etsy listing.
 */
const deleteListingVideo = async (req, res) => {
  try {
    const shop = req.etsyShop;
    if (!shop) {
      return res.status(403).json({ success: false, message: 'Shop connection required' });
    }

    const { listingId, videoId } = req.params;

    const result = await etsyApi.authenticatedRequest(shop, 'DELETE',
      `/v3/application/shops/${shop.shopId}/listings/${listingId}/videos/${videoId}`
    );

    if (!result.success) {
      log.error('Video delete failed:', result.error);
      return res.status(502).json({ success: false, message: result.error || 'Failed to delete video' });
    }

    return res.json({ success: true, message: 'Video deleted successfully' });
  } catch (error) {
    log.error('Delete listing video error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to delete video' });
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
  updateListing,
  uploadListingImage,
  deleteListingImage,
  uploadListingFile,
  uploadListingVideo,
  deleteListingVideo,
  publishListing,
  getTaxonomyProperties,
  setListingProperties,
};
