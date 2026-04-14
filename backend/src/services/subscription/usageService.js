/**
 * Usage Service
 * 
 * Clean API for recording and checking feature usage from anywhere in the app.
 * Use this in route handlers when you need manual control over usage tracking.
 * 
 * Usage in route handlers:
 * 
 *   const { recordUsage, checkUsage, getRemainingUsage } = require('../../services/subscription/usageService');
 * 
 *   // Record that a customer used a feature
 *   await recordUsage(user, 'keyword_search');
 * 
 *   // Check if customer can use a feature (returns { allowed, used, limit, remaining })
 *   const check = await checkUsage(user, 'keyword_search');
 *   if (!check.allowed) return res.status(429).json({ message: check.message });
 * 
 *   // Get remaining usage for all features
 *   const remaining = await getRemainingUsage(user);
 */

const { UsageLog } = require('../../models/subscription');
const { Plan } = require('../../models/subscription');
const { EtsyShop } = require('../../models/integrations');

/**
 * Get the start of the current billing period for a user
 */
const getBillingPeriodStart = (user) => {
  if (user.monthlyResetDate) {
    // monthlyResetDate is the END of the current period (first of next month)
    // So start = monthlyResetDate minus ~30 days
    const resetDate = new Date(user.monthlyResetDate);
    const start = new Date(resetDate);
    start.setMonth(start.getMonth() - 1);
    return start;
  }
  // Fallback: first of current month
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

/**
 * Record a feature usage event
 */
const recordUsage = async (user, featureKey, metadata = {}) => {
  const planFeatures = user.planSnapshot?.features || [];
  const feature = planFeatures.find((f) => f.featureKey === featureKey);

  const periodStart = getBillingPeriodStart(user);
  const currentCount = await UsageLog.countDocuments({
    userId: user._id,
    featureKey,
    action: 'used',
    createdAt: { $gte: periodStart },
  });

  return UsageLog.logUsage({
    userId: user._id,
    featureKey,
    featureName: feature?.featureName || featureKey,
    planId: user.planSnapshot?.planId || null,
    planName: user.planSnapshot?.planName || '',
    action: 'used',
    currentCount: currentCount + 1,
    limit: feature?.limit || null,
    metadata,
  });
};

/**
 * Check if a user can use a specific feature
 * Returns: { allowed, featureName, used, limit, remaining, unlimited, message }
 */
const checkUsage = async (user, featureKey) => {
  const planFeatures = user.planSnapshot?.features || [];
  const feature = planFeatures.find((f) => f.featureKey === featureKey);

  // Feature not in plan
  if (!feature) {
    return {
      allowed: false,
      featureName: featureKey,
      used: 0,
      limit: 0,
      remaining: 0,
      unlimited: false,
      message: `The "${featureKey}" feature is not included in your plan.`,
    };
  }

  // Feature disabled
  if (!feature.enabled) {
    return {
      allowed: false,
      featureName: feature.featureName,
      used: 0,
      limit: 0,
      remaining: 0,
      unlimited: false,
      message: `The "${feature.featureName}" feature is disabled in your plan.`,
    };
  }

  // Boolean feature (no limit)
  if (feature.limit === null || feature.limit === undefined) {
    return {
      allowed: true,
      featureName: feature.featureName,
      used: 0,
      limit: null,
      remaining: null,
      unlimited: true,
      message: 'Access granted (unlimited)',
    };
  }

  // Numeric feature — count usage in current period
  const periodStart = getBillingPeriodStart(user);
  const used = await UsageLog.countDocuments({
    userId: user._id,
    featureKey,
    action: 'used',
    createdAt: { $gte: periodStart },
  });

  const remaining = Math.max(0, feature.limit - used);
  const allowed = used < feature.limit;

  return {
    allowed,
    featureName: feature.featureName,
    used,
    limit: feature.limit,
    remaining,
    unlimited: false,
    message: allowed
      ? `${remaining} uses remaining this month`
      : `Limit reached (${used}/${feature.limit}). Please upgrade.`,
  };
};

/**
 * Get remaining usage for all features in a user's plan
 * Returns array of { featureKey, featureName, limit, used, remaining, unlimited, percentage }
 */
const getRemainingUsage = async (user) => {
  const periodStart = getBillingPeriodStart(user);

  // Use LIVE plan features as source of truth (not stale snapshot)
  let livePlanFeatures = null;
  const planId = user.planSnapshot?.planId;
  if (planId) {
    const livePlan = await Plan.findById(planId).select('features').lean();
    livePlanFeatures = livePlan?.features || null;
  }

  const sourceFeatures = livePlanFeatures || user.planSnapshot?.features || [];
  const enabledFeatures = sourceFeatures.filter((f) => f.enabled);

  const results = [];

  for (const feature of enabledFeatures) {
    const limit = feature.limit;

    // Special handling for connect_shops — count actual EtsyShop records, not UsageLog
    if (feature.featureKey === 'connect_shops') {
      const shopCount = await EtsyShop.countDocuments({
        userId: user._id,
        status: { $ne: 'disconnected' },
      });
      const isUnlimited = limit === null || limit === undefined || limit === -1;
      results.push({
        featureKey: feature.featureKey,
        featureName: feature.featureName,
        limit: isUnlimited ? null : limit,
        used: shopCount,
        remaining: isUnlimited ? null : Math.max(0, limit - shopCount),
        unlimited: isUnlimited,
        percentage: isUnlimited || !limit ? 0 : Math.round((shopCount / limit) * 100),
      });
      continue;
    }

    if (limit === null || limit === undefined) {
      results.push({
        featureKey: feature.featureKey,
        featureName: feature.featureName,
        limit: null,
        used: 0,
        remaining: null,
        unlimited: true,
        percentage: 0,
      });
    } else {
      const used = await UsageLog.countDocuments({
        userId: user._id,
        featureKey: feature.featureKey,
        action: 'used',
        createdAt: { $gte: periodStart },
      });

      results.push({
        featureKey: feature.featureKey,
        featureName: feature.featureName,
        limit,
        used,
        remaining: Math.max(0, limit - used),
        unlimited: false,
        percentage: limit > 0 ? Math.round((used / limit) * 100) : 0,
      });
    }
  }

  return results;
};

module.exports = {
  recordUsage,
  checkUsage,
  getRemainingUsage,
  getBillingPeriodStart,
};
