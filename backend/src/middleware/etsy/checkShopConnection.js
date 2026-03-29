const log = require('../../utils/logger')('ShopConnection');
/**
 * checkShopConnection Middleware
 * 
 * Verifies the authenticated user has a connected Etsy shop
 * with valid (non-revoked) tokens before proceeding.
 * 
 * Supports multi-shop: if shopId is provided in params/query/body,
 * validates that specific shop belongs to the user. Otherwise falls
 * back to finding any active shop for the user.
 * 
 * Returns appropriate error codes for frontend to show:
 * - SHOP_NOT_CONNECTED → ConnectShopPrompt
 * - SHOP_REQUIRES_REAUTH → amber re-auth banner
 * - SHOP_SYNCING → syncing state overlay
 * - SHOP_NOT_FOUND → specific shop not found / not owned
 * 
 * Usage:
 *   router.get('/listings', auth, checkShopConnection, handler);
 *   router.get('/shop/:shopId/listings', auth, checkShopConnection, handler);
 * 
 * Attaches to req:
 *   req.etsyShop = { _id, shopId, shopName, status, ... }
 */

const { EtsyShop } = require('../../models/integrations');

const checkShopConnection = async (req, res, next) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Check for shopId in params, query, or body (for multi-shop targeting)
    const shopId = req.params.shopId || req.query.shopId || req.body?.shopId;

    let shop;

    if (shopId) {
      // Target specific shop — validate ownership
      shop = await EtsyShop.findOne({ _id: shopId, userId });

      if (!shop) {
        return res.status(404).json({
          success: false,
          code: 'SHOP_NOT_FOUND',
          message: 'Shop not found or does not belong to your account',
        });
      }
    } else {
      // No specific shop — find any active shop for the user
      shop = await EtsyShop.findOne({
        userId,
        status: { $nin: ['disconnected'] },
      }).sort({ updatedAt: -1 });
    }

    // No shop connected at all
    if (!shop) {
      return res.status(403).json({
        success: false,
        code: 'SHOP_NOT_CONNECTED',
        message: 'Please connect your Etsy shop to use this feature',
      });
    }

    // Token was revoked by user on Etsy side or expired beyond refresh
    if (shop.status === 'token_revoked' || shop.status === 'token_expired') {
      return res.status(403).json({
        success: false,
        code: 'SHOP_REQUIRES_REAUTH',
        message: 'Your Etsy connection has expired. Please reconnect your shop.',
        shopName: shop.shopName,
      });
    }

    // Shop is disconnected (user manually disconnected)
    if (shop.status === 'disconnected') {
      return res.status(403).json({
        success: false,
        code: 'SHOP_NOT_CONNECTED',
        message: 'Your Etsy shop is disconnected. Please reconnect to continue.',
      });
    }

    // Shop is mid-sync — let them know but don't block
    if (shop.status === 'syncing') {
      req.etsyShop = shop;
      req.shopSyncing = true;
      return next();
    }

    // Active — attach shop to request and continue
    req.etsyShop = shop;
    return next();

  } catch (error) {
    log.error('checkShopConnection error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error checking shop connection',
    });
  }
};

module.exports = checkShopConnection;
