/**
 * Trial Warning Job
 * 
 * Finds users whose trial ends within 3 days and sends a warning email.
 * Only sends one warning per user (uses a flag or checks if already warned).
 */
const User = require('../models/user/User');
const emailService = require('../services/email/emailService');
const log = require('../utils/logger')('CronTrialWarn');

const run = async () => {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // Find trial users whose trial ends in the next 3 days (but hasn't ended yet)
  // Only find users who haven't been warned yet
  const warningUsers = await User.find({
    accountType: 'customer',
    subscriptionStatus: 'trial',
    trialEndsAt: { $gt: now, $lte: threeDaysFromNow },
    trialWarningEmailSent: { $ne: true },
  });

  if (warningUsers.length === 0) return;

  log.info(`Sending trial warning to ${warningUsers.length} user(s)`);

  for (const user of warningUsers) {
    try {
      const daysRemaining = Math.ceil((new Date(user.trialEndsAt) - now) / (1000 * 60 * 60 * 24));
      await emailService.sendTrialWarningEmail(user, daysRemaining);
      // Mark as warned so we don't send again
      user.trialWarningEmailSent = true;
      await user.save();
    } catch (err) {
      log.error(`Failed to send trial warning to ${user.email}:`, err.message);
    }
  }
};

module.exports = { run };
