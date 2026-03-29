/**
 * Trial Expiry Job
 * 
 * Finds all users with subscriptionStatus='trial' and trialEndsAt < now,
 * sets their status to 'expired', and sends notification emails.
 */
const User = require('../models/user/User');
const emailService = require('../services/email/emailService');
const log = require('../utils/logger')('CronTrialExpiry');

const run = async () => {
  const now = new Date();

  // Find all trial users whose trial has expired
  const expiredUsers = await User.find({
    accountType: 'customer',
    subscriptionStatus: 'trial',
    trialEndsAt: { $lt: now },
  });

  if (expiredUsers.length === 0) return;

  log.info(`Found ${expiredUsers.length} expired trial(s)`);

  for (const user of expiredUsers) {
    try {
      user.subscriptionStatus = 'expired';
      await user.save();

      // Send trial expired email (fire and forget)
      emailService.sendTrialExpiredEmail(user).catch(() => {});
    } catch (err) {
      log.error(`Failed to expire trial for ${user.email}:`, err.message);
    }
  }

  log.info(`Expired ${expiredUsers.length} trial(s)`);
};

module.exports = { run };
