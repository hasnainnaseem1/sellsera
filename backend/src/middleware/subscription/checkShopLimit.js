const log = require('../../utils/logger')('ShopLimit');
/**
 * checkShopLimit Middleware
 * 
 * Validates that the user hasn't exceeded their plan's connect_shops
 * limit before allowing a new shop connection.
 * 
 * Unlike checkFeatureAccess (which counts UsageLog entries), this middleware
 * counts actual EtsyShop records since shops are persistent resources.
 * 
 * Usage:
 *   router.get('/auth', auth, checkSubscription, checkShopLimit, handler);
 */

const { EtsyShop } = require('../../models/integrations');
const { Plan } = require('../../models/subscription');

const checkShopLimit = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Admins bypass
    if (user.accountType === 'admin') {
      return next();
    }

    // Read LIVE plan limits (not stale planSnapshot)
    let limit = 1;
    const planId = user.planSnapshot?.planId;
    if (planId) {
      const livePlan = await Plan.findById(planId).select('features').lean();
      const feature = livePlan?.features?.find(f => f.featureKey === 'connect_shops');
      if (feature?.enabled) {
        limit = feature.limit ?? -1;
      }
    }

    // If limit is -1 or null, it's unlimited
    if (limit === -1 || limit === null || limit === undefined) {
      req.shopLimit = { limit: null, used: 0, remaining: null, unlimited: true };
      return next();
    }

    // Count active (non-disconnected) shops for this user
    const activeShopCount = await EtsyShop.countDocuments({
      userId: user._id,
      status: { $ne: 'disconnected' },
    });

    if (activeShopCount >= limit) {
      return res.status(429).json({
        success: false,
        code: 'SHOP_LIMIT_REACHED',
        message: `You've reached your shop connection limit (${activeShopCount}/${limit}). Please upgrade your plan to connect more shops.`,
        used: activeShopCount,
        limit,
        remaining: 0,
        upgradeRequired: true,
      });
    }

    req.shopLimit = {
      limit,
      used: activeShopCount,
      remaining: limit - activeShopCount,
      unlimited: false,
    };

    return next();
  } catch (error) {
    log.error('checkShopLimit error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error checking shop limit',
    });
  }
};

module.exports = checkShopLimit;
