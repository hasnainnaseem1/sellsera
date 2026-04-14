/**
 * Trial Expiry Job
 * 
 * Finds all users with subscriptionStatus='trial' and trialEndsAt < now,
 * sets their status to 'expired', downgrades to Free plan,
 * and sends notification emails.
 *
 * Also catches subscriptions whose period has ended
 * (subscriptionExpiresAt < now) and downgrades them.
 */
const User = require('../models/user/User');
const { downgradeToFree } = require('../services/subscription/downgradeService');
const emailService = require('../services/email/emailService');
const log = require('../utils/logger')('CronTrialExpiry');

const run = async () => {
  const now = new Date();

  // ── 1. Expire overdue trials ──
  const expiredTrials = await User.find({
    accountType: 'customer',
    subscriptionStatus: 'trial',
    trialEndsAt: { $lt: now },
  });

  if (expiredTrials.length > 0) {
    log.info(`Found ${expiredTrials.length} expired trial(s)`);

    for (const user of expiredTrials) {
      try {
        user.subscriptionStatus = 'expired';
        await downgradeToFree(user, { reason: 'trial_expired', clearSubscriptionId: true });
        emailService.sendTrialExpiredEmail(user).catch(() => {});
      } catch (err) {
        log.error(`Failed to expire trial for ${user.email}:`, err.message);
      }
    }

    log.info(`Expired & downgraded ${expiredTrials.length} trial(s)`);
  }

  // ── 2. Downgrade subscriptions past their expiration date ──
  const expiredSubscriptions = await User.find({
    accountType: 'customer',
    subscriptionStatus: { $in: ['active', 'past_due'] },
    subscriptionExpiresAt: { $lt: now, $ne: null },
  });

  if (expiredSubscriptions.length > 0) {
    log.info(`Found ${expiredSubscriptions.length} subscription(s) past expiration date`);

    for (const user of expiredSubscriptions) {
      try {
        const oldPlanName = user.planSnapshot?.planName || 'Unknown';
        user.subscriptionStatus = 'expired';
        await downgradeToFree(user, { reason: 'subscription_period_ended', clearSubscriptionId: true });
        emailService.sendPlanChangeEmail(user, oldPlanName, 'Free (Expired)').catch(() => {});
      } catch (err) {
        log.error(`Failed to downgrade expired subscription for ${user.email}:`, err.message);
      }
    }

    log.info(`Downgraded ${expiredSubscriptions.length} expired subscription(s)`);
  }
};

module.exports = { run };
