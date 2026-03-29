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
    console.error(`[${new Date().toISOString()}] Etsy auth initiation error:`, error.message);
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
      .catch(err => console.error('[EtsyCallback] Initial sync failed:', err.message));

    // Redirect to frontend with success
    const frontendUrl = process.env.CUSTOMER_FRONTEND_URL || 'http://localhost:3002';
    return res.redirect(`${frontendUrl}/dashboard?etsy_connected=true&shop=${encodeURIComponent(etsyShop.shopName)}`);

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Etsy OAuth callback error:`, error.message);
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
    console.error('Get shop info error:', error.message);
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
    console.error('Disconnect shop error:', error.message);
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
    console.error('Get listings error:', error.message);
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
    console.error('Manual sync error:', error.message);
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
    console.error('Sync status error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to get sync status',
    });
  }
};

module.exports = {
  initiateAuth,
  handleCallback,
  getShopInfo,
  getListings,
  disconnectShop,
  syncNow,
  getSyncStatus,
};
