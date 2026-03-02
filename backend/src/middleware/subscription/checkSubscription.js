/**
 * checkSubscription Middleware
 * 
 * Checks if the customer has a valid (active or trial) subscription.
 * Blocks access if subscription is expired, cancelled, or none.
 * Automatically expires trial subscriptions past their end date.
 * 
 * Usage:
 *   router.get('/some-feature', auth, checkSubscription, handler);
 */
const checkSubscription = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Admins bypass subscription checks
    if (user.accountType === 'admin') {
      return next();
    }

    const status = user.subscriptionStatus;

    // No subscription at all
    if (!status || status === 'none') {
      return res.status(403).json({
        success: false,
        code: 'NO_SUBSCRIPTION',
        message: 'You need a subscription plan to access this feature. Please choose a plan.',
        upgradeRequired: true,
      });
    }

    // Already expired or cancelled
    if (status === 'expired') {
      return res.status(403).json({
        success: false,
        code: 'SUBSCRIPTION_EXPIRED',
        message: 'Your subscription has expired. Please renew or upgrade your plan to continue.',
        upgradeRequired: true,
      });
    }

    if (status === 'cancelled') {
      return res.status(403).json({
        success: false,
        code: 'SUBSCRIPTION_CANCELLED',
        message: 'Your subscription has been cancelled. Please subscribe to a plan to continue.',
        upgradeRequired: true,
      });
    }

    // Trial — check if trial has expired
    if (status === 'trial') {
      if (user.trialEndsAt && new Date() >= new Date(user.trialEndsAt)) {
        // Auto-expire the trial
        user.subscriptionStatus = 'expired';
        await user.save();

        return res.status(403).json({
          success: false,
          code: 'TRIAL_EXPIRED',
          message: 'Your free trial has ended. Please upgrade to a paid plan to continue using the platform.',
          upgradeRequired: true,
          trialEndedAt: user.trialEndsAt,
        });
      }
      // Trial is still valid, let them through
      return next();
    }

    // Active subscription — all good
    if (status === 'active') {
      return next();
    }

    // Past due — still allow access during grace period but warn
    if (status === 'past_due') {
      return next();
    }

    // Unknown status — block
    return res.status(403).json({
      success: false,
      code: 'INVALID_SUBSCRIPTION',
      message: 'Your subscription status is invalid. Please contact support.',
    });
  } catch (error) {
    console.error('Subscription check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking subscription status',
    });
  }
};

module.exports = checkSubscription;
