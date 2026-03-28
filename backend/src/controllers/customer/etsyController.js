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
 * GET /api/v1/customer/etsy/shop
 * Returns the authenticated user's connected Etsy shop info.
 */
const getShopInfo = async (req, res) => {
  try {
    const shop = await EtsyShop.findOne({ userId: req.userId })
      .select('-accessToken_enc -refreshToken_enc');

    if (!shop) {
      return res.json({
        success: true,
        data: { connected: false },
      });
    }

    return res.json({
      success: true,
      data: {
        connected: true,
        shop: {
          shopId: shop.shopId,
          shopName: shop.shopName,
          status: shop.status,
          listingCount: shop.listingCount,
          totalSales: shop.totalSales,
          shopMetadata: shop.shopMetadata,
          lastSyncAt: shop.lastSyncAt,
          tokenRevokedAt: shop.tokenRevokedAt,
          createdAt: shop.createdAt,
        },
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
 * POST /api/v1/customer/etsy/disconnect
 * Disconnects the user's Etsy shop (clears tokens, sets status to disconnected).
 */
const disconnectShop = async (req, res) => {
  try {
    const shop = await EtsyShop.findOne({ userId: req.userId });

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'No Etsy shop connected',
      });
    }

    shop.accessToken_enc = null;
    shop.refreshToken_enc = null;
    shop.tokenExpiresAt = null;
    shop.status = 'disconnected';
    await shop.save();

    return res.json({
      success: true,
      message: 'Etsy shop disconnected successfully',
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
    const shop = await EtsyShop.findOne({ userId: req.userId }).select('shopId');
    if (!shop) {
      return res.json({ success: true, data: { listings: [], total: 0 } });
    }

    const { page = 1, limit = 50, search, status } = req.query;
    const query = { shopId: shop.shopId };
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
          favorites: l.numFavorers,
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

module.exports = {
  initiateAuth,
  handleCallback,
  getShopInfo,
  getListings,
  disconnectShop,
};
