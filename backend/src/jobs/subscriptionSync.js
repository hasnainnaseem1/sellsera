/**
 * Subscription Sync Job
 *
 * Periodically reconciles local subscription states with LemonSqueezy API.
 * Catches edge cases where webhooks were missed or DB was manually edited.
 *
 * Runs daily — queries LS API for each user with a stored subscription ID
 * and forces the database to match the API truth.
 */
const User = require('../models/user/User');
const { syncSubscriptionState } = require('../services/subscription/downgradeService');
const log = require('../utils/logger')('CronSubscriptionSync');

const run = async () => {
  // Find users who have a LemonSqueezy subscription ID stored
  // and are on a paid plan (not Free) — these need verification
  const usersToSync = await User.find({
    accountType: 'customer',
    lemonSqueezySubscriptionId: { $ne: null, $exists: true },
    subscriptionStatus: { $in: ['active', 'trial', 'past_due'] },
  }).select('_id email lemonSqueezySubscriptionId subscriptionStatus planSnapshot.planName');

  if (usersToSync.length === 0) return;

  log.info(`Syncing ${usersToSync.length} subscription(s) with LemonSqueezy`);

  let synced = 0;
  let downgraded = 0;
  let errors = 0;

  for (const user of usersToSync) {
    try {
      const result = await syncSubscriptionState(user._id);

      if (result.synced) synced++;
      if (result.action === 'downgraded') downgraded++;

      // Rate limit: small delay between API calls to avoid hitting LS rate limits
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      errors++;
      log.error(`Sync failed for ${user.email}:`, err.message);
    }
  }

  log.info(`Subscription sync complete: ${synced} synced, ${downgraded} downgraded, ${errors} errors`);
};

module.exports = { run };
