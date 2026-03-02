/**
 * Stripe Webhook Controller
 *
 * All business logic for processing Stripe webhook events.
 * The route file handles only raw body parsing and routing.
 *
 * Events handled:
 * - checkout.session.completed → activate subscription, assign plan
 * - invoice.paid → record payment
 * - invoice.payment_failed → handle failure
 * - customer.subscription.updated → sync status
 * - customer.subscription.deleted → cancel subscription
 */
const User = require('../../models/user/User');
const Plan = require('../../models/subscription/Plan');
const Payment = require('../../models/payment/Payment');
const emailService = require('../../services/email/emailService');
const stripeService = require('../../services/stripe/stripeService');
const { notifySubscriptionChange } = require('../../services/notification/adminNotifier');
const { generateSignedInvoiceUrl } = require('../../controllers/customer/billingController');

/**
 * Handle checkout.session.completed
 * Customer completed payment → activate subscription and assign plan
 */
async function handleCheckoutComplete(session) {
  const { userId, planId, planName, billingCycle } = session.metadata || {};
  if (!userId || !planId) {
    console.error('[Stripe] checkout.session.completed missing metadata');
    return;
  }

  const user = await User.findById(userId);
  if (!user) {
    console.error('[Stripe] User not found:', userId);
    return;
  }

  const plan = await Plan.findById(planId);
  if (!plan) {
    console.error('[Stripe] Plan not found:', planId);
    return;
  }

  const oldPlanName = user.planSnapshot?.planName || user.plan || 'None';
  const isUpgradeOrDowngrade = user.subscriptionStatus === 'active' && user.subscriptionId;

  // If upgrading/downgrading, cancel on the old subscription is handled by Stripe
  // when a new subscription replaces it. We just need to update the plan.

  // Assign plan to user
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

  // Activate subscription
  user.subscriptionStatus = 'active';
  user.subscriptionStartDate = new Date();
  user.subscriptionId = session.subscription;
  user.trialWarningEmailSent = false; // Reset trial warning flag on new subscription

  // Set expiry based on billing cycle
  const expiresAt = new Date();
  if (billingCycle === 'yearly') {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }
  user.subscriptionExpiresAt = expiresAt;

  // Update analysis limits
  user.updateAnalysisLimit();
  // Reset usage on plan change
  user.analysisCount = 0;
  user.monthlyResetDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);

  await user.save();

  // Send plan change email
  emailService.sendPlanChangeEmail(user, oldPlanName, plan.name).catch(() => {});

  // Notify admins about subscription activation (respects notification settings)
  const changeType = isUpgradeOrDowngrade
    ? (plan.price?.monthly > 0 ? 'upgraded' : 'downgraded')
    : 'activated';

  notifySubscriptionChange({
    customer: user,
    oldPlan: oldPlanName,
    newPlan: plan.name,
    changeType,
    source: 'stripe',
  }).catch(() => {});

  console.log(`[Stripe] Checkout complete: ${user.email} → ${plan.name} (${changeType})`);
}

/**
 * Handle invoice.paid
 * Record the payment in our database
 */
async function handleInvoicePaid(invoice) {
  // Avoid duplicate records
  const existing = await Payment.findOne({ stripeInvoiceId: invoice.id });
  if (existing) return;

  const user = await User.findOne({ stripeCustomerId: invoice.customer });
  if (!user) return;

  const stripePayment = await Payment.create({
    userId: user._id,
    stripeInvoiceId: invoice.id,
    stripePaymentIntentId: invoice.payment_intent,
    stripeSubscriptionId: invoice.subscription,
    planId: user.currentPlan,
    planName: user.planSnapshot?.planName || 'Unknown',
    amount: (invoice.amount_paid || 0) / 100, // Convert from cents
    currency: invoice.currency || 'usd',
    status: 'succeeded',
    billingCycle: user.subscriptionExpiresAt && 
      (new Date(user.subscriptionExpiresAt) - new Date(user.subscriptionStartDate)) > 180 * 24 * 60 * 60 * 1000
        ? 'yearly' : 'monthly',
    description: invoice.description || `Payment for ${user.planSnapshot?.planName || 'subscription'}`,
    receiptUrl: invoice.hosted_invoice_url,
    invoiceUrl: invoice.invoice_pdf,
    paidAt: new Date(invoice.status_transitions?.paid_at * 1000 || Date.now()),
  });

  // Ensure subscription is active
  if (user.subscriptionStatus !== 'active') {
    user.subscriptionStatus = 'active';
    await user.save();
  }

  // Send payment confirmation email with signed invoice URL
  const stripeInvoiceUrl = generateSignedInvoiceUrl(stripePayment._id, user._id);
  emailService.sendPaymentConfirmationEmail(user, {
    planName: user.planSnapshot?.planName || 'Subscription',
    amount: (invoice.amount_paid || 0) / 100,
    currency: invoice.currency || 'usd',
    billingCycle: user.subscriptionExpiresAt && 
      (new Date(user.subscriptionExpiresAt) - new Date(user.subscriptionStartDate)) > 180 * 24 * 60 * 60 * 1000
        ? 'yearly' : 'monthly',
    receiptUrl: stripeInvoiceUrl,
    invoiceNumber: invoice.number || ('STR-' + invoice.id),
    paidAt: new Date(invoice.status_transitions?.paid_at * 1000 || Date.now()),
  }).catch(() => {});

  console.log(`[Stripe] Invoice paid: ${user.email}, $${(invoice.amount_paid || 0) / 100}`);
}

/**
 * Handle invoice.payment_failed
 */
async function handlePaymentFailed(invoice) {
  const user = await User.findOne({ stripeCustomerId: invoice.customer });
  if (!user) return;

  await Payment.create({
    userId: user._id,
    stripeInvoiceId: invoice.id,
    stripePaymentIntentId: invoice.payment_intent,
    stripeSubscriptionId: invoice.subscription,
    planId: user.currentPlan,
    planName: user.planSnapshot?.planName || 'Unknown',
    amount: (invoice.amount_due || 0) / 100,
    currency: invoice.currency || 'usd',
    status: 'failed',
    description: `Failed payment for ${user.planSnapshot?.planName || 'subscription'}`,
  });

  // Send payment failed email
  emailService.sendPaymentFailedEmail(user, {
    planName: user.planSnapshot?.planName || 'Subscription',
    amount: (invoice.amount_due || 0) / 100,
    currency: invoice.currency || 'usd',
  }).catch(() => {});

  console.log(`[Stripe] Payment failed: ${user.email}`);
}

/**
 * Handle customer.subscription.updated
 * Sync subscription status changes from Stripe
 */
async function handleSubscriptionUpdated(subscription) {
  const user = await User.findOne({ stripeCustomerId: subscription.customer });
  if (!user) return;

  // Map Stripe status to our status
  const statusMap = {
    active: 'active',
    trialing: 'trial',
    past_due: 'past_due',
    canceled: 'cancelled',
    unpaid: 'expired',
    incomplete: 'none',
    incomplete_expired: 'expired',
  };

  const newStatus = statusMap[subscription.status] || user.subscriptionStatus;
  
  // Check if plan changed via Stripe (e.g., portal upgrade/downgrade)
  const stripePlanId = subscription.items?.data?.[0]?.price?.metadata?.planId;
  if (stripePlanId && stripePlanId !== user.currentPlan?.toString()) {
    const newPlan = await Plan.findById(stripePlanId);
    if (newPlan) {
      const oldPlanName = user.planSnapshot?.planName || 'Unknown';
      user.currentPlan = newPlan._id;
      user.planSnapshot = {
        planId: newPlan._id,
        planName: newPlan.name,
        features: newPlan.features.map((f) => ({
          featureId: f.featureId,
          featureKey: f.featureKey,
          featureName: f.featureName,
          enabled: f.enabled,
          limit: f.limit,
          value: f.value,
        })),
        assignedAt: new Date(),
      };
      user.updateAnalysisLimit();
      emailService.sendPlanChangeEmail(user, oldPlanName, newPlan.name).catch(() => {});
    }
  }

  if (newStatus !== user.subscriptionStatus) {
    const oldStatus = user.subscriptionStatus;
    user.subscriptionStatus = newStatus;
    user.subscriptionId = subscription.id;
    
    if (subscription.current_period_end) {
      user.subscriptionExpiresAt = new Date(subscription.current_period_end * 1000);
    }
    
    await user.save();

    // Notify admins about subscription status change
    notifySubscriptionChange({
      customer: user,
      oldPlan: oldStatus,
      newPlan: newStatus,
      changeType: 'changed',
      source: 'stripe',
    }).catch(() => {});

    console.log(`[Stripe] Subscription updated: ${user.email} → ${newStatus}`);
  }
}

/**
 * Handle customer.subscription.deleted
 * Customer cancelled their subscription
 */
async function handleSubscriptionDeleted(subscription) {
  const user = await User.findOne({ stripeCustomerId: subscription.customer });
  if (!user) return;

  const oldPlanName = user.planSnapshot?.planName || 'Unknown';

  user.subscriptionStatus = 'cancelled';
  user.subscriptionId = null;
  await user.save();

  emailService.sendPlanChangeEmail(user, oldPlanName, 'Cancelled').catch(() => {});

  // Notify admins about subscription cancellation
  notifySubscriptionChange({
    customer: user,
    oldPlan: oldPlanName,
    newPlan: 'Cancelled',
    changeType: 'cancelled',
    source: 'stripe',
  }).catch(() => {});

  console.log(`[Stripe] Subscription deleted: ${user.email}`);
}

/**
 * Main webhook handler — called by the route after signature verification.
 * Verifies the Stripe signature, parses the event, dispatches to the correct handler.
 */
async function handleWebhook(req, res) {
  const signature = req.headers['stripe-signature'];

  let event;
  try {
    event = await stripeService.constructWebhookEvent(req.body, signature);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      default:
        console.log(`[Stripe] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error(`[Stripe] Error handling ${event.type}:`, err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}

module.exports = {
  handleWebhook,
  // Exported individually for unit testing
  handleCheckoutComplete,
  handleInvoicePaid,
  handlePaymentFailed,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
};
