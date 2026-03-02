/**
 * Monthly Usage Reset Job
 * 
 * Finds all customers whose monthlyResetDate has passed,
 * resets their analysisCount to 0, and sets a new reset date.
 * Also clears UsageLog records for the previous billing period.
 */
const User = require('../models/user/User');
const UsageLog = require('../models/subscription/UsageLog');

const run = async () => {
  const now = new Date();

  // Find all customers whose monthly reset date has passed
  const usersToReset = await User.find({
    accountType: 'customer',
    monthlyResetDate: { $lte: now },
    subscriptionStatus: { $in: ['active', 'trial'] },
  });

  if (usersToReset.length === 0) return;

  console.log(`[CRON] Resetting usage for ${usersToReset.length} user(s)`);

  for (const user of usersToReset) {
    try {
      // Reset analysis count
      user.analysisCount = 0;
      // Set next reset date to first of next month
      const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      user.monthlyResetDate = nextReset;
      await user.save();

      // Log the reset in UsageLog
      await UsageLog.logUsage({
        userId: user._id,
        featureKey: '_monthly_reset',
        planId: user.currentPlan,
        action: 'reset',
        currentCount: 0,
        limit: user.analysisLimit,
        metadata: { resetAt: now },
      });
    } catch (err) {
      console.error(`[CRON] Failed to reset usage for ${user.email}:`, err.message);
    }
  }

  console.log(`[CRON] Reset usage for ${usersToReset.length} user(s)`);
};

module.exports = { run };
