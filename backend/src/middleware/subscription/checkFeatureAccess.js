const log = require('../../utils/logger')('FeatureAccess');
/**
 * checkFeatureAccess Middleware Factory
 * 
 * Checks if the customer's current plan includes a specific feature
 * AND if they haven't exceeded the usage limit for that feature.
 * 
 * For boolean features: just checks if enabled in the plan.
 * For numeric features: checks if used < limit.
 * For text features: checks if enabled.
 * 
 * Usage:
 *   router.post('/keyword-search', auth, checkSubscription, checkFeatureAccess('keyword_search'), handler);
 *   router.post('/export', auth, checkSubscription, checkFeatureAccess('csv_export'), handler);
 * 
 * The middleware attaches feature info to req for downstream use:
 *   req.featureAccess = { featureKey, featureName, type, limit, used, remaining, unlimited }
 */
const { UsageLog } = require('../../models/subscription');

const checkFeatureAccess = (featureKey) => {
  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      // Admins bypass feature checks
      if (user.accountType === 'admin') {
        req.featureAccess = {
          featureKey,
          featureName: featureKey,
          type: 'bypass',
          limit: null,
          used: 0,
          remaining: null,
          unlimited: true,
        };
        return next();
      }

      // Get plan features from snapshot
      const planFeatures = user.planSnapshot?.features || [];

      // Find this feature in the customer's plan
      const feature = planFeatures.find(
        (f) => f.featureKey === featureKey
      );

      // Feature not in plan at all
      if (!feature) {
        return res.status(403).json({
          success: false,
          code: 'FEATURE_NOT_AVAILABLE',
          message: `The "${featureKey}" feature is not included in your current plan. Please upgrade to access this feature.`,
          featureKey,
          upgradeRequired: true,
        });
      }

      // Feature exists but is disabled
      if (!feature.enabled) {
        return res.status(403).json({
          success: false,
          code: 'FEATURE_DISABLED',
          message: `The "${feature.featureName}" feature is not enabled in your current plan. Please upgrade to access this feature.`,
          featureKey,
          featureName: feature.featureName,
          upgradeRequired: true,
        });
      }

      // Boolean feature — enabled is enough, no limit needed
      if (feature.limit === null || feature.limit === undefined) {
        req.featureAccess = {
          featureKey,
          featureName: feature.featureName,
          type: 'boolean',
          limit: null,
          used: 0,
          remaining: null,
          unlimited: true,
        };
        return next();
      }

      // Numeric feature — check usage against limit
      // Determine if this is a lifetime or monthly feature
      const isLifetime = feature.periodType === 'lifetime';

      let usageQuery = {
        userId: user._id,
        featureKey,
        action: 'used',
      };

      if (!isLifetime) {
        // Monthly: count usage for current billing period
        const periodStart = user.monthlyResetDate
          ? new Date(new Date(user.monthlyResetDate).getTime() - 30 * 24 * 60 * 60 * 1000)
          : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        usageQuery.createdAt = { $gte: periodStart };
      }
      // Lifetime: no date filter — counts all-time usage

      const usageCount = await UsageLog.countDocuments(usageQuery);

      const remaining = Math.max(0, feature.limit - usageCount);

      if (usageCount >= feature.limit) {
        // Log the limit_reached event
        await UsageLog.logUsage({
          userId: user._id,
          featureKey,
          featureName: feature.featureName,
          planId: user.planSnapshot?.planId,
          planName: user.planSnapshot?.planName,
          action: 'limit_reached',
          currentCount: usageCount,
          limit: feature.limit,
        });

        return res.status(429).json({
          success: false,
          code: 'FEATURE_LIMIT_REACHED',
          message: isLifetime
            ? `You've used your lifetime allowance for "${feature.featureName}" (${usageCount}/${feature.limit}). Upgrade your plan for more.`
            : `You've reached the limit for "${feature.featureName}". Used ${usageCount}/${feature.limit} this month. Please upgrade your plan for more.`,
          featureKey,
          featureName: feature.featureName,
          used: usageCount,
          limit: feature.limit,
          remaining: 0,
          upgradeRequired: true,
        });
      }

      // Allowed — attach info for downstream use
      req.featureAccess = {
        featureKey,
        featureName: feature.featureName,
        type: 'numeric',
        limit: feature.limit,
        used: usageCount,
        remaining,
        unlimited: false,
      };

      return next();
    } catch (error) {
      log.error(`Feature access check error (${featureKey}):`, error.message);
      return res.status(500).json({
        success: false,
        message: 'Error checking feature access',
      });
    }
  };
};

module.exports = checkFeatureAccess;
