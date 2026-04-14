/**
 * Subscription Downgrade Service
 *
 * Handles downgrading users to the Free plan when their subscription
 * expires, is cancelled (past period end), or payment fails permanently.
 *
 * Also provides syncSubscriptionState() to reconcile the local DB
 * with the true LemonSqueezy subscription status.
 */
const User = require('../../models/user/User');
const Plan = require('../../models/subscription/Plan');
const lemonSqueezyService = require('../lemonsqueezy/lemonSqueezyService');
const log = require('../../utils/logger')('Downgrade');

// LemonSqueezy → internal status mapping (same as webhook controller)
const LS_STATUS_MAP = {
  active: 'active',
  on_trial: 'trial',
  past_due: 'past_due',
  paused: 'cancelled',
  cancelled: 'cancelled',
  expired: 'expired',
  unpaid: 'expired',
};

/**
 * Find the Free plan in the database.
 * Falls back to creating a minimal snapshot if not found.
 */
const getFreePlan = async () => {
  // Try exact match first
  let freePlan = await Plan.findOne({
    slug: 'free',
    isActive: true,
  });
  if (!freePlan) {
    freePlan = await Plan.findOne({
      name: { $regex: /^free$/i },
      isActive: true,
    });
  }
  return freePlan;
};

/**
 * Downgrade a user to the Free plan.
 * Resets plan, quota, and clears subscription metadata.
 *
 * @param {Object} user - Mongoose User document
 * @param {Object} [options]
 * @param {string} [options.reason] - Why the downgrade happened
 * @param {boolean} [options.clearSubscriptionId=true] - Clear LemonSqueezy subscription ID
 * @returns {Object} user - The saved user document
 */
const downgradeToFree = async (user, options = {}) => {
  const { reason = 'expired', clearSubscriptionId = true } = options;

  const freePlan = await getFreePlan();

  if (freePlan) {
    user.currentPlan = freePlan._id;
    user.planSnapshot = {
      planId: freePlan._id,
      planName: freePlan.name,
      features: freePlan.features.map((f) => ({
        featureId: f.featureId,
        featureKey: f.featureKey,
        featureName: f.featureName,
        enabled: f.enabled,
        limit: f.limit,
        value: f.value,
      })),
      assignedAt: new Date(),
      assignedBy: null,
    };

    // Update legacy plan field
    const slug = freePlan.slug || freePlan.name.toLowerCase();
    if (['free', 'starter', 'pro', 'unlimited'].includes(slug)) {
      user.plan = slug;
    } else {
      user.plan = 'free';
    }
  } else {
    // No Free plan in DB — set minimal free snapshot
    log.warn(`No Free plan found in DB. Setting minimal free snapshot for ${user.email}`);
    user.currentPlan = null;
    user.planSnapshot = {
      planId: null,
      planName: 'Free',
      features: [],
      assignedAt: new Date(),
      assignedBy: null,
    };
    user.plan = 'free';
  }

  // Reset quota counters
  user.analysisCount = 0;
  user.analysisLimit = 0;
  user.updateAnalysisLimit();

  // Set billing fields
  user.billingCycle = 'none';

  // Clear subscription IDs if requested
  if (clearSubscriptionId) {
    user.lemonSqueezySubscriptionId = null;
  }

  await user.save();

  log.info(`Downgraded to Free: ${user.email} (reason: ${reason})`);
  return user;
};

/**
 * Sync a user's subscription state with LemonSqueezy API truth.
 *
 * Queries LS for the real subscription status, then aligns the local DB:
 * - If LS says active/on_trial → ensure user is on the correct plan
 * - If LS says expired/cancelled/unpaid → downgrade to Free
 * - If no subscription ID stored → nothing to sync
 *
 * @param {string} userId - The user's _id
 * @returns {Object} { synced, action, details }
 */
const syncSubscriptionState = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    return { synced: false, action: 'none', details: 'User not found' };
  }

  // No subscription to sync
  if (!user.lemonSqueezySubscriptionId) {
    // If they claim to be on a paid plan but have no subscription ID,
    // and are not active/trial → downgrade
    if (
      user.subscriptionStatus !== 'active' &&
      user.subscriptionStatus !== 'trial' &&
      user.subscriptionStatus !== 'none' &&
      user.planSnapshot?.planName &&
      user.planSnapshot.planName.toLowerCase() !== 'free'
    ) {
      await downgradeToFree(user, { reason: 'no_subscription_id', clearSubscriptionId: false });
      return { synced: true, action: 'downgraded', details: 'No subscription ID but claimed paid plan' };
    }
    return { synced: false, action: 'none', details: 'No LemonSqueezy subscription ID' };
  }

  try {
    const lsResult = await lemonSqueezyService.getSubscription(user.lemonSqueezySubscriptionId);
    const lsStatus = lsResult.data?.attributes?.status;
    const internalStatus = LS_STATUS_MAP[lsStatus] || 'expired';

    // LS says active or on_trial → ensure user is correctly active
    if (internalStatus === 'active' || internalStatus === 'trial') {
      if (user.subscriptionStatus !== internalStatus) {
        user.subscriptionStatus = internalStatus;
        if (lsResult.data.attributes.renews_at) {
          user.subscriptionExpiresAt = new Date(lsResult.data.attributes.renews_at);
        }
        if (lsResult.data.attributes.trial_ends_at) {
          user.trialEndsAt = new Date(lsResult.data.attributes.trial_ends_at);
        }
        await user.save();
        return { synced: true, action: 'reactivated', details: `LS status: ${lsStatus}, synced to ${internalStatus}` };
      }
      return { synced: true, action: 'none', details: `Already in sync: ${internalStatus}` };
    }

    // LS says past_due → update status but don't downgrade yet (grace period)
    if (internalStatus === 'past_due') {
      if (user.subscriptionStatus !== 'past_due') {
        user.subscriptionStatus = 'past_due';
        await user.save();
        return { synced: true, action: 'past_due', details: 'Marked as past_due from LS' };
      }
      return { synced: true, action: 'none', details: 'Already past_due' };
    }

    // LS says expired/cancelled/unpaid → downgrade to Free
    user.subscriptionStatus = internalStatus;
    await downgradeToFree(user, { reason: `ls_sync_${lsStatus}`, clearSubscriptionId: internalStatus === 'expired' });
    return { synced: true, action: 'downgraded', details: `LS status: ${lsStatus}, downgraded to Free` };
  } catch (err) {
    log.error(`syncSubscriptionState failed for ${user.email}:`, err.message);
    return { synced: false, action: 'error', details: err.message };
  }
};

module.exports = {
  downgradeToFree,
  getFreePlan,
  syncSubscriptionState,
};
