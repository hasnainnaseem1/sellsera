/**
 * LemonSqueezy Webhook Controller
 *
 * All business logic for processing LemonSqueezy webhook events,
 * including HMAC signature verification.
 * The route file handles only raw body parsing and routing.
 *
 * Events handled:
 * - subscription_created     → activate subscription, assign plan
 * - subscription_updated     → sync status changes
 * - subscription_cancelled   → mark cancellation at period end
 * - subscription_resumed     → reactivate subscription
 * - subscription_expired     → expire subscription, clear IDs
 * - subscription_paused      → pause (mapped to cancelled)
 * - subscription_unpaused    → unpause
 * - order_created            → record initial payment
 * - subscription_payment_success → record recurring payment
 * - subscription_payment_failed  → record failed payment
 */
const User = require('../../models/user/User');
const Plan = require('../../models/subscription/Plan');
const Payment = require('../../models/payment/Payment');
const emailService = require('../../services/email/emailService');
const { notifySubscriptionChange } = require('../../services/notification/adminNotifier');
const { generateSignedInvoiceUrl } = require('../../controllers/customer/billingController');
const lemonSqueezyService = require('../../services/lemonsqueezy/lemonSqueezyService');

const TAG = '[LemonSqueezy]';

// ──────────────────────────────────────────────
// Helper: find user by custom_data or subscription ID
// ──────────────────────────────────────────────
const findUser = async (customData, subscriptionId) => {
  if (customData?.user_id) {
    const user = await User.findById(customData.user_id);
    if (user) return user;
  }
  if (subscriptionId) {
    return User.findOne({ lemonSqueezySubscriptionId: subscriptionId.toString() });
  }
  return null;
};

// ──────────────────────────────────────────────
// LemonSqueezy → internal status mapping
// ──────────────────────────────────────────────
const LS_STATUS_MAP = {
  active: 'active',
  on_trial: 'trial',
  past_due: 'past_due',
  paused: 'cancelled',
  cancelled: 'cancelled',
  expired: 'expired',
  unpaid: 'expired',
};

// ──────────────────────────────────────────────
// subscription_created
// ──────────────────────────────────────────────
const handleSubscriptionCreated = async (event, customData) => {
  const attrs = event.data.attributes;
  const { user_id: userId, plan_id: planId, plan_name: planName, billing_cycle: billingCycle = 'monthly' } = customData;

  if (!userId || !planId) {
    console.error(`${TAG} subscription_created missing user_id or plan_id in custom_data`);
    return;
  }

  const user = await User.findById(userId);
  if (!user) {
    console.error(`${TAG} User not found: ${userId}`);
    return;
  }

  const plan = await Plan.findById(planId);
  if (!plan) {
    console.error(`${TAG} Plan not found: ${planId}`);
    return;
  }

  const oldPlanName = user.planSnapshot?.planName || user.plan || 'None';

  // Assign plan snapshot
  user.currentPlan = plan._id;
  user.planSnapshot = {
    planId: plan._id,
    planName: plan.name,
    features: plan.features.map((f) => ({
      featureId: f.featureId,
      featureKey: f.featureKey,
      featureName: f.featureName,
      enabled: f.enabled,
      limit: f.limit,
      value: f.value,
    })),
    assignedAt: new Date(),
  };

  // Subscription metadata
  user.subscriptionStatus = attrs.status === 'on_trial' ? 'trial' : 'active';
  user.subscriptionStartDate = new Date();
  user.lemonSqueezySubscriptionId = event.data.id.toString();
  user.lemonSqueezyCustomerId = attrs.customer_id?.toString();
  user.trialWarningEmailSent = false;

  if (attrs.trial_ends_at) user.trialEndsAt = new Date(attrs.trial_ends_at);
  if (attrs.renews_at) user.subscriptionExpiresAt = new Date(attrs.renews_at);

  // Billing cycle
  user.billingCycle = billingCycle || 'monthly';

  // Reset analysis counters
  user.updateAnalysisLimit();
  user.analysisCount = 0;
  user.monthlyResetDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);

  await user.save();

  // Async notifications (fire-and-forget)
  emailService.sendPlanChangeEmail(user, oldPlanName, plan.name).catch(() => {});
  notifySubscriptionChange({
    customer: user,
    oldPlan: oldPlanName,
    newPlan: plan.name,
    changeType: 'activated',
    source: 'lemonsqueezy',
  }).catch(() => {});

  console.log(`${TAG} Subscription created: ${user.email} → ${plan.name}`);
};

// ──────────────────────────────────────────────
// subscription_updated
// ──────────────────────────────────────────────
const handleSubscriptionUpdated = async (event, customData) => {
  const attrs = event.data.attributes;

  const user = await findUser(customData, event.data.id);
  if (!user) return;

  const newStatus = LS_STATUS_MAP[attrs.status] || user.subscriptionStatus;

  if (newStatus !== user.subscriptionStatus) {
    const oldStatus = user.subscriptionStatus;
    user.subscriptionStatus = newStatus;

    if (attrs.renews_at) user.subscriptionExpiresAt = new Date(attrs.renews_at);
    if (attrs.trial_ends_at) user.trialEndsAt = new Date(attrs.trial_ends_at);

    await user.save();

    notifySubscriptionChange({
      customer: user,
      oldPlan: oldStatus,
      newPlan: newStatus,
      changeType: 'changed',
      source: 'lemonsqueezy',
    }).catch(() => {});

    console.log(`${TAG} Subscription updated: ${user.email} → ${newStatus}`);
  }
};

// ──────────────────────────────────────────────
// subscription_cancelled  (ends at period end)
// ──────────────────────────────────────────────
const handleSubscriptionCancelled = async (event, customData) => {
  const user = await findUser(customData, event.data.id);
  if (!user) return;

  const oldPlanName = user.planSnapshot?.planName || 'Unknown';
  const endsAt = event.data.attributes.ends_at;

  if (endsAt) user.subscriptionExpiresAt = new Date(endsAt);
  await user.save();

  emailService.sendPlanChangeEmail(user, oldPlanName, 'Cancelled (at period end)').catch(() => {});
  notifySubscriptionChange({
    customer: user,
    oldPlan: oldPlanName,
    newPlan: 'Cancelled',
    changeType: 'cancelled',
    source: 'lemonsqueezy',
  }).catch(() => {});

  console.log(`${TAG} Subscription cancelled: ${user.email}`);
};

// ──────────────────────────────────────────────
// subscription_resumed
// ──────────────────────────────────────────────
const handleSubscriptionResumed = async (event, customData) => {
  const user = await findUser(customData, event.data.id);
  if (!user) return;

  user.subscriptionStatus = 'active';
  if (event.data.attributes.renews_at) {
    user.subscriptionExpiresAt = new Date(event.data.attributes.renews_at);
  }
  await user.save();

  console.log(`${TAG} Subscription resumed: ${user.email}`);
};

// ──────────────────────────────────────────────
// subscription_expired
// ──────────────────────────────────────────────
const handleSubscriptionExpired = async (event, customData) => {
  const user = await findUser(customData, event.data.id);
  if (!user) return;

  const oldPlanName = user.planSnapshot?.planName || 'Unknown';
  user.subscriptionStatus = 'expired';
  user.lemonSqueezySubscriptionId = null;
  await user.save();

  emailService.sendPlanChangeEmail(user, oldPlanName, 'Expired').catch(() => {});
  notifySubscriptionChange({
    customer: user,
    oldPlan: oldPlanName,
    newPlan: 'Expired',
    changeType: 'expired',
    source: 'lemonsqueezy',
  }).catch(() => {});

  console.log(`${TAG} Subscription expired: ${user.email}`);
};

// ──────────────────────────────────────────────
// subscription_paused
// ──────────────────────────────────────────────
const handleSubscriptionPaused = async (event, customData) => {
  const user = await findUser(customData, event.data.id);
  if (!user) return;

  user.subscriptionStatus = 'cancelled';
  await user.save();

  console.log(`${TAG} Subscription paused: ${user.email}`);
};

// ──────────────────────────────────────────────
// subscription_unpaused
// ──────────────────────────────────────────────
const handleSubscriptionUnpaused = async (event, customData) => {
  const user = await findUser(customData, event.data.id);
  if (!user) return;

  user.subscriptionStatus = 'active';
  if (event.data.attributes.renews_at) {
    user.subscriptionExpiresAt = new Date(event.data.attributes.renews_at);
  }
  await user.save();

  console.log(`${TAG} Subscription unpaused: ${user.email}`);
};

// ──────────────────────────────────────────────
// order_created — initial payment
// ──────────────────────────────────────────────
const handleOrderCreated = async (event, customData) => {
  const attrs = event.data.attributes;
  const userId = customData.user_id;
  if (!userId) return;

  const user = await User.findById(userId);
  if (!user) return;

  // Idempotency: skip if already recorded
  const exists = await Payment.findOne({ 'metadata.lemonSqueezyOrderId': event.data.id.toString() });
  if (exists) return;

  const orderPayment = await Payment.create({
    userId: user._id,
    planId: user.currentPlan,
    planName: customData.plan_name || user.planSnapshot?.planName || 'Unknown',
    amount: (attrs.total || 0) / 100, // LS amounts are in cents
    currency: attrs.currency || 'usd',
    status: attrs.status === 'paid' ? 'succeeded' : 'pending',
    billingCycle: customData.billing_cycle || 'monthly',
    description: `Payment for ${customData.plan_name || 'subscription'} via LemonSqueezy`,
    receiptUrl: attrs.urls?.receipt,
    metadata: {
      lemonSqueezyOrderId: event.data.id.toString(),
      gateway: 'lemonsqueezy',
    },
    paidAt: attrs.created_at ? new Date(attrs.created_at) : new Date(),
  });

  // Send payment confirmation email with signed invoice URL
  const orderInvoiceUrl = generateSignedInvoiceUrl(orderPayment._id, user._id);
  emailService.sendPaymentConfirmationEmail(user, {
    planName: customData.plan_name || user.planSnapshot?.planName || 'Subscription',
    amount: (attrs.total || 0) / 100,
    currency: attrs.currency || 'usd',
    billingCycle: customData.billing_cycle || 'monthly',
    receiptUrl: orderInvoiceUrl,
    invoiceNumber: 'LS-' + event.data.id.toString(),
    paidAt: attrs.created_at ? new Date(attrs.created_at) : new Date(),
  }).catch(() => {});

  console.log(`${TAG} Order created: ${user.email}, $${(attrs.total || 0) / 100}`);
};

// ──────────────────────────────────────────────
// subscription_payment_success — recurring
// ──────────────────────────────────────────────
const handlePaymentSuccess = async (event, customData) => {
  const attrs = event.data.attributes;
  const subscriptionId = attrs.subscription_id?.toString();

  const user = await findUser(customData, subscriptionId);
  if (!user) return;

  // Idempotency
  const exists = await Payment.findOne({ 'metadata.lemonSqueezyInvoiceId': event.data.id.toString() });
  if (exists) return;

  const recurringPayment = await Payment.create({
    userId: user._id,
    planId: user.currentPlan,
    planName: user.planSnapshot?.planName || 'Unknown',
    amount: (attrs.subtotal || 0) / 100,
    currency: attrs.currency || 'usd',
    status: 'succeeded',
    billingCycle: 'monthly',
    description: `Recurring payment for ${user.planSnapshot?.planName || 'subscription'}`,
    receiptUrl: attrs.urls?.receipt,
    metadata: {
      lemonSqueezyInvoiceId: event.data.id.toString(),
      gateway: 'lemonsqueezy',
    },
    paidAt: new Date(),
  });

  // Send payment confirmation email with signed invoice URL
  const recurringInvoiceUrl = generateSignedInvoiceUrl(recurringPayment._id, user._id);
  emailService.sendPaymentConfirmationEmail(user, {
    planName: user.planSnapshot?.planName || 'Subscription',
    amount: (attrs.subtotal || 0) / 100,
    currency: attrs.currency || 'usd',
    billingCycle: user.billingCycle || 'monthly',
    receiptUrl: recurringInvoiceUrl,
    invoiceNumber: 'LS-' + event.data.id.toString(),
    paidAt: new Date(),
  }).catch(() => {});

  // Ensure subscription is active after successful payment
  if (user.subscriptionStatus !== 'active') {
    user.subscriptionStatus = 'active';
    await user.save();
  }

  console.log(`${TAG} Payment success: ${user.email}`);
};

// ──────────────────────────────────────────────
// subscription_payment_failed
// ──────────────────────────────────────────────
const handlePaymentFailed = async (event, customData) => {
  const attrs = event.data.attributes;
  const subscriptionId = attrs.subscription_id?.toString();

  const user = await findUser(customData, subscriptionId);
  if (!user) return;

  await Payment.create({
    userId: user._id,
    planId: user.currentPlan,
    planName: user.planSnapshot?.planName || 'Unknown',
    amount: (attrs.subtotal || 0) / 100,
    currency: attrs.currency || 'usd',
    status: 'failed',
    description: `Failed payment for ${user.planSnapshot?.planName || 'subscription'}`,
    metadata: {
      lemonSqueezyInvoiceId: event.data.id.toString(),
      gateway: 'lemonsqueezy',
    },
  });

  // Send payment failed email
  emailService.sendPaymentFailedEmail(user, {
    planName: user.planSnapshot?.planName || 'Subscription',
    amount: (attrs.subtotal || 0) / 100,
    currency: attrs.currency || 'usd',
  }).catch(() => {});

  console.log(`${TAG} Payment failed: ${user.email}`);
};

// ──────────────────────────────────────────────
// Event router map
// ──────────────────────────────────────────────
const EVENT_HANDLERS = {
  subscription_created: handleSubscriptionCreated,
  subscription_updated: handleSubscriptionUpdated,
  subscription_cancelled: handleSubscriptionCancelled,
  subscription_resumed: handleSubscriptionResumed,
  subscription_expired: handleSubscriptionExpired,
  subscription_paused: handleSubscriptionPaused,
  subscription_unpaused: handleSubscriptionUnpaused,
  order_created: handleOrderCreated,
  subscription_payment_success: handlePaymentSuccess,
  subscription_payment_failed: handlePaymentFailed,
};

/**
 * Main webhook handler — called directly by the route.
 * Performs HMAC signature verification, parses the event, dispatches to the correct handler.
 */
const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing webhook signature' });
    }

    // Extract raw payload for signature verification
    let payload;
    try {
      payload = typeof req.body === 'string' ? req.body : req.body.toString('utf8');
    } catch {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // Verify HMAC signature
    const webhookSecret = await lemonSqueezyService.getWebhookSecret();
    if (!webhookSecret) {
      console.error('[LemonSqueezy] Webhook secret not configured in Admin Settings');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    let isValid = false;
    try {
      isValid = lemonSqueezyService.verifyWebhookSignature(payload, signature, webhookSecret);
    } catch (err) {
      console.error('[LemonSqueezy] Signature check threw:', err.message);
      return res.status(400).json({ error: 'Signature verification failed' });
    }

    if (!isValid) {
      console.error('[LemonSqueezy] Invalid signature — check that the webhook secret in Admin Settings matches LemonSqueezy dashboard');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Parse event from verified payload
    let event;
    try {
      event = JSON.parse(payload);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    const eventName = event.meta?.event_name;
    const customData = event.meta?.custom_data || {};

    try {
      const handler = EVENT_HANDLERS[eventName];
      if (handler) {
        await handler(event, customData);
      } else {
        console.log(`${TAG} Unhandled event: ${eventName}`);
      }

      res.json({ received: true });
    } catch (err) {
      console.error(`${TAG} Error handling ${eventName}:`, err);
      res.status(500).json({ error: 'Webhook handler failed' });
    }
  } catch (err) {
    console.error('[LemonSqueezy] Unhandled controller error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

module.exports = {
  handleWebhook,
  // Exported individually for unit testing
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionCancelled,
  handleSubscriptionResumed,
  handleSubscriptionExpired,
  handleSubscriptionPaused,
  handleSubscriptionUnpaused,
  handleOrderCreated,
  handlePaymentSuccess,
  handlePaymentFailed,
};
