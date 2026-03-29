const log = require('../../utils/logger')('FeatureUsage');
/**
 * trackFeatureUsage Middleware Factory
 * 
 * Records a feature usage event in UsageLog AFTER the request succeeds.
 * Should be placed AFTER checkFeatureAccess so req.featureAccess is available.
 * 
 * This runs as a post-response hook — it doesn't block the response.
 * 
 * Usage:
 *   router.post('/keyword-search', 
 *     auth, 
 *     checkSubscription, 
 *     checkFeatureAccess('keyword_search'), 
 *     trackFeatureUsage('keyword_search'),
 *     handler
 *   );
 * 
 * Or call manually in your handler:
 *   const { recordUsage } = require('../../services/subscription/usageService');
 *   await recordUsage(req.user, 'keyword_search');
 */
const { UsageLog } = require('../../models/subscription');

const trackFeatureUsage = (featureKey) => {
  return async (req, res, next) => {
    // Store the original res.json to intercept successful responses
    const originalJson = res.json.bind(res);

    res.json = function (data) {
      // Only log usage if the response is successful
      if (res.statusCode >= 200 && res.statusCode < 300 && data?.success !== false) {
        // Fire and forget — don't block the response
        const user = req.user;
        const featureAccess = req.featureAccess || {};

        UsageLog.logUsage({
          userId: user._id,
          featureKey,
          featureName: featureAccess.featureName || featureKey,
          planId: user.planSnapshot?.planId || null,
          planName: user.planSnapshot?.planName || '',
          action: 'used',
          currentCount: (featureAccess.used || 0) + 1,
          limit: featureAccess.limit || null,
          metadata: {
            endpoint: req.originalUrl,
            method: req.method,
          },
        }).catch((err) => {
          log.error(`Failed to log feature usage (${featureKey}):`, err.message);
        });
      }

      return originalJson(data);
    };

    next();
  };
};

module.exports = trackFeatureUsage;
