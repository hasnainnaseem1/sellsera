/**
 * Subscription Controller
 * 
 * Handles customer subscription info and usage queries.
 */
const { getRemainingUsage } = require('../../services/subscription/usageService');
const { Plan } = require('../../models/subscription');
const log = require('../../utils/logger')('SubCtrl');

/**
 * Get current customer's subscription & plan info
 */
const getSubscription = async (req, res) => {
  try {
    const user = req.user;

    // Fetch live plan for up-to-date limits
    let livePlanFeatures = null;
    const planId = user.planSnapshot?.planId;
    if (planId) {
      const livePlan = await Plan.findById(planId).select('features').lean();
      livePlanFeatures = livePlan?.features || null;
    }

    const planFeatures = (user.planSnapshot?.features || [])
      .filter((f) => f.enabled)
      .map((f) => {
        // Use live plan limit if available
        const liveFeature = livePlanFeatures?.find(lf => lf.featureKey === f.featureKey);
        const limit = liveFeature?.limit !== undefined ? liveFeature.limit : f.limit;
        return {
          featureKey: f.featureKey,
          featureName: f.featureName,
          type: limit !== null && limit !== undefined ? 'numeric' : 'boolean',
          limit,
        };
      });

    res.json({
      success: true,
      subscription: {
        status: user.subscriptionStatus || 'none',
        planName: user.planSnapshot?.planName || user.plan || 'None',
        planId: user.planSnapshot?.planId || user.currentPlan || null,
        assignedAt: user.planSnapshot?.assignedAt || null,
        startDate: user.subscriptionStartDate || null,
        expiresAt: user.subscriptionExpiresAt || null,
        trialEndsAt: user.trialEndsAt || null,
        isTrialing: user.subscriptionStatus === 'trial',
        isActive: user.subscriptionStatus === 'active' || user.subscriptionStatus === 'past_due' ||
          (user.subscriptionStatus === 'trial' && user.trialEndsAt && new Date() < new Date(user.trialEndsAt)),
        monthlyResetDate: user.monthlyResetDate || null,
      },
      features: planFeatures,
    });
  } catch (error) {
    log.error('Get subscription error:', error);
    res.status(500).json({ success: false, message: 'Error fetching subscription info' });
  }
};

/**
 * Get current customer's feature usage (remaining, used, limits)
 */
const getUsage = async (req, res) => {
  try {
    const user = req.user;
    const usage = await getRemainingUsage(user);

    res.json({
      success: true,
      planName: user.planSnapshot?.planName || user.plan || 'None',
      monthlyResetDate: user.monthlyResetDate || null,
      usage,
    });
  } catch (error) {
    log.error('Get usage error:', error);
    res.status(500).json({ success: false, message: 'Error fetching usage info' });
  }
};

module.exports = {
  getSubscription,
  getUsage,
};
