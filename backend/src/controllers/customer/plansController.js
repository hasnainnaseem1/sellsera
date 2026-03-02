/**
 * Plans Controller
 * 
 * Handles customer-facing plan listing.
 */
const Plan = require('../../models/subscription/Plan');

/**
 * Get all active plans for customer browsing
 */
const getPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true })
      .sort({ displayOrder: 1 })
      .lean();

    // Mark which plan is the user's current plan
    const currentPlanId = req.user.currentPlan?.toString() || null;

    const plansWithCurrent = plans.map((plan) => ({
      _id: plan._id,
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      price: plan.price,
      currency: plan.currency,
      billingCycle: plan.billingCycle,
      trialDays: plan.trialDays,
      isDefault: plan.isDefault,
      isPopular: plan.metadata?.popular || false,
      features: (plan.features || []).map((f) => ({
        featureKey: f.featureKey,
        featureName: f.featureName,
        enabled: f.enabled,
        limit: f.limit,
        value: f.value,
      })),
      isCurrent: plan._id.toString() === currentPlanId,
    }));

    res.json({ success: true, plans: plansWithCurrent });
  } catch (error) {
    console.error('Get customer plans error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch plans' });
  }
};

/**
 * Get all active plans (public / no auth)
 */
const getPublicPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true })
      .sort({ displayOrder: 1 })
      .select('name slug description price currency billingCycle features trialDays displayOrder isDefault metadata')
      .lean();

    const publicPlans = plans.map((p) => ({
      _id: p._id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: p.price,
      currency: p.currency,
      billingCycle: p.billingCycle,
      trialDays: p.trialDays,
      isDefault: p.isDefault,
      isPopular: p.metadata?.popular || false,
      features: (p.features || []).map((f) => ({
        featureKey: f.featureKey,
        featureName: f.featureName,
        enabled: f.enabled,
        limit: f.limit,
        value: f.value,
      })),
    }));

    res.json({ success: true, plans: publicPlans });
  } catch (error) {
    console.error('Get public plans error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch plans' });
  }
};

module.exports = {
  getPlans,
  getPublicPlans,
};
