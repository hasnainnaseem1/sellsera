/**
 * Subscription Controller
 * 
 * Handles customer subscription info and usage queries.
 */
const { getRemainingUsage } = require('../../services/subscription/usageService');

/**
 * Get current customer's subscription & plan info
 */
const getSubscription = async (req, res) => {
  try {
    const user = req.user;

    const planFeatures = (user.planSnapshot?.features || [])
      .filter((f) => f.enabled)
      .map((f) => ({
        featureKey: f.featureKey,
        featureName: f.featureName,
        type: f.limit !== null && f.limit !== undefined ? 'numeric' : 'boolean',
        limit: f.limit,
      }));

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
    console.error('Get subscription error:', error);
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
    console.error('Get usage error:', error);
    res.status(500).json({ success: false, message: 'Error fetching usage info' });
  }
};

module.exports = {
  getSubscription,
  getUsage,
};
