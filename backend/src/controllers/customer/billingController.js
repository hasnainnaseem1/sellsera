/**
 * Billing Controller
 * 
 * Handles checkout, customer portal, payment history,
 * subscription cancel/resume — gateway-aware (Stripe or LemonSqueezy).
 */
const jwt = require('jsonwebtoken');
const stripeService = require('../../services/stripe/stripeService');
const lemonSqueezyService = require('../../services/lemonsqueezy/lemonSqueezyService');
const AdminSettings = require('../../models/admin/AdminSettings');
const Payment = require('../../models/payment/Payment');
const Plan = require('../../models/subscription/Plan');
const User = require('../../models/user/User');
const emailService = require('../../services/email/emailService');
const { notifySubscriptionChange } = require('../../services/notification/adminNotifier');
const { getBaseUrlFromEnv } = require('../../utils/helpers/urlHelper');
const { safeSave } = require('../../utils/helpers/safeDbOps');

/**
 * Helper: get the active payment gateway from AdminSettings
 */
const getActiveGateway = async () => {
  const settings = await AdminSettings.findOne().sort({ _id: 1 });
  return settings?.activePaymentGateway || 'stripe';
};

/**
 * Create a Checkout session for a plan (Stripe or LemonSqueezy)
 */
const createCheckout = async (req, res) => {
  try {
    const { planId, billingCycle = 'monthly' } = req.body;

    if (!planId) {
      return res.status(400).json({ success: false, message: 'Plan ID is required' });
    }

    // Pre-check: is a payment gateway configured?
    const gwSettings = await AdminSettings.findOne().sort({ _id: 1 }).select('activePaymentGateway stripeSettings lemonSqueezySettings').lean();
    const gw = gwSettings?.activePaymentGateway || 'stripe';
    if (gw === 'stripe' && !gwSettings?.stripeSettings?.secretKey) {
      return res.status(503).json({ success: false, message: 'Payment gateway (Stripe) is not configured. Contact admin.' });
    }
    if (gw === 'lemonsqueezy' && !gwSettings?.lemonSqueezySettings?.apiKey) {
      return res.status(503).json({ success: false, message: 'Payment gateway (LemonSqueezy) is not configured. Contact admin.' });
    }

    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({ success: false, message: 'Plan not found or inactive' });
    }

    const price = billingCycle === 'yearly' ? plan.price.yearly : plan.price.monthly;
    if (!price || price <= 0) {
      return res.status(400).json({ success: false, message: 'This is a free plan. No payment needed.' });
    }

    const gateway = await getActiveGateway();
    const baseUrl = process.env.CUSTOMER_FRONTEND_URL || 'http://localhost:3002';
    const cancelUrl = `${baseUrl}/checkout/cancel`;

    // Stripe uses {CHECKOUT_SESSION_ID} placeholder; LemonSqueezy doesn't need it
    const successUrl = gateway === 'lemonsqueezy'
      ? `${baseUrl}/checkout/success`
      : `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;

    if (gateway === 'lemonsqueezy') {
      const checkout = await lemonSqueezyService.createCheckout({
        user: req.user,
        plan,
        billingCycle,
        successUrl,
        cancelUrl,
      });

      return res.json({ success: true, url: checkout.url, gateway: 'lemonsqueezy' });
    }

    // Default: Stripe
    const session = await stripeService.createCheckoutSession({
      user: req.user,
      plan,
      billingCycle,
      successUrl,
      cancelUrl,
    });

    res.json({ success: true, url: session.url, sessionId: session.id, gateway: 'stripe' });
  } catch (error) {
    console.error('Checkout session error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create checkout session' });
  }
};

/**
 * Create a Customer Portal session (Stripe) or get portal URL (LemonSqueezy)
 */
const createPortal = async (req, res) => {
  try {
    // Pre-check: is a payment gateway configured?
    const gwSettings = await AdminSettings.findOne().sort({ _id: 1 }).select('activePaymentGateway stripeSettings lemonSqueezySettings').lean();
    const gwCheck = gwSettings?.activePaymentGateway || 'stripe';
    if (gwCheck === 'stripe' && !gwSettings?.stripeSettings?.secretKey) {
      return res.status(503).json({ success: false, message: 'Payment gateway (Stripe) is not configured. Contact admin.' });
    }
    if (gwCheck === 'lemonsqueezy' && !gwSettings?.lemonSqueezySettings?.apiKey) {
      return res.status(503).json({ success: false, message: 'Payment gateway (LemonSqueezy) is not configured. Contact admin.' });
    }

    const gateway = await getActiveGateway();

    if (gateway === 'lemonsqueezy') {
      const portalUrl = await lemonSqueezyService.getCustomerPortalUrl(req.user);
      return res.json({ success: true, url: portalUrl, gateway: 'lemonsqueezy' });
    }

    // Default: Stripe
    const session = await stripeService.createPortalSession(
      req.user,
      `${process.env.CUSTOMER_FRONTEND_URL || 'http://localhost:3002'}/subscription`
    );

    res.json({ success: true, url: session.url, gateway: 'stripe' });
  } catch (error) {
    console.error('Portal session error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create portal session' });
  }
};

/**
 * Get customer's payment history
 */
const getPayments = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [payments, total] = await Promise.all([
      Payment.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Payment.countDocuments({ userId: req.user._id }),
    ]);

    res.json({
      success: true,
      payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payment history' });
  }
};

/**
 * Cancel current subscription (Stripe or LemonSqueezy)
 */
const cancelSubscription = async (req, res) => {
  try {
    const user = req.user;
    const { immediate = false } = req.body;
    const gateway = await getActiveGateway();

    // Check if user has an active subscription on the appropriate gateway
    if (gateway === 'lemonsqueezy') {
      if (!user.lemonSqueezySubscriptionId) {
        return res.status(400).json({ success: false, message: 'No active subscription to cancel.' });
      }

      if (!['active', 'past_due', 'trial'].includes(user.subscriptionStatus)) {
        return res.status(400).json({ success: false, message: 'Subscription is not active.' });
      }

      await lemonSqueezyService.cancelSubscription(user.lemonSqueezySubscriptionId);

      res.json({
        success: true,
        message: 'Subscription will be cancelled at the end of your current billing period.',
        immediate: false,
        gateway: 'lemonsqueezy',
      });
    } else {
      // Stripe
      if (!user.subscriptionId) {
        return res.status(400).json({ success: false, message: 'No active subscription to cancel.' });
      }

      if (!['active', 'past_due', 'trial'].includes(user.subscriptionStatus)) {
        return res.status(400).json({ success: false, message: 'Subscription is not active.' });
      }

      await stripeService.cancelSubscription(user.subscriptionId, immediate);

      if (immediate) {
        user.subscriptionStatus = 'cancelled';
        user.subscriptionId = null;
        await safeSave(user);
      }

      res.json({
        success: true,
        message: immediate
          ? 'Subscription cancelled immediately.'
          : 'Subscription will be cancelled at the end of your current billing period.',
        immediate,
        gateway: 'stripe',
      });
    }
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to cancel subscription' });
  }
};

/**
 * Resume a subscription set to cancel at period end (Stripe or LemonSqueezy)
 */
const resumeSubscription = async (req, res) => {
  try {
    const user = req.user;
    const gateway = await getActiveGateway();

    if (gateway === 'lemonsqueezy') {
      if (!user.lemonSqueezySubscriptionId) {
        return res.status(400).json({ success: false, message: 'No subscription to resume.' });
      }

      await lemonSqueezyService.resumeSubscription(user.lemonSqueezySubscriptionId);

      // Update local status immediately (don't wait for webhook)
      user.subscriptionStatus = 'active';
      await safeSave(user);

      return res.json({
        success: true,
        message: 'Subscription resumed successfully.',
        gateway: 'lemonsqueezy',
      });
    }

    // Stripe
    if (!user.subscriptionId) {
      return res.status(400).json({ success: false, message: 'No subscription to resume.' });
    }

    await stripeService.resumeSubscription(user.subscriptionId);

    // Update local status immediately (don't wait for webhook)
    user.subscriptionStatus = 'active';
    await safeSave(user);

    res.json({
      success: true,
      message: 'Subscription resumed. It will no longer be cancelled at the end of the billing period.',
      gateway: 'stripe',
    });
  } catch (error) {
    console.error('Resume subscription error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to resume subscription' });
  }
};

/**
 * Verify a completed Stripe Checkout session and activate the subscription.
 * Called by the frontend success page with ?session_id=... as a fallback for
 * cases where the webhook has not yet been delivered (e.g. local dev).
 */
const verifyCheckoutSession = async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId is required' });
    }

    // Retrieve session from Stripe
    let session;
    try {
      session = await stripeService.retrieveCheckoutSession(sessionId);
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Invalid or expired session ID' });
    }

    // Must be paid and complete
    if (session.payment_status !== 'paid' || session.status !== 'complete') {
      return res.status(400).json({ success: false, message: 'Payment not completed' });
    }

    const { userId, planId, planName, billingCycle } = session.metadata || {};
    if (!userId || !planId) {
      return res.status(400).json({ success: false, message: 'Session metadata missing' });
    }

    // Only the authenticated user can verify their own session
    if (req.user._id.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Idempotency: if subscription already activated for this session, just return current user
    const subscriptionId = typeof session.subscription === 'object'
      ? session.subscription?.id
      : session.subscription;

    if (user.subscriptionStatus === 'active' && user.subscriptionId === subscriptionId) {
      const fresh = await User.findById(userId).lean();
      return res.json({ success: true, alreadyActivated: true, user: fresh });
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    const oldPlanName = user.planSnapshot?.planName || user.plan || 'None';

    // Activate subscription (mirrors handleCheckoutComplete)
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
    user.subscriptionStatus = 'active';
    user.subscriptionStartDate = new Date();
    user.subscriptionId = subscriptionId;
    user.trialWarningEmailSent = false;

    const expiresAt = new Date();
    if (billingCycle === 'yearly') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }
    user.subscriptionExpiresAt = expiresAt;
    user.updateAnalysisLimit();
    user.analysisCount = 0;
    user.monthlyResetDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);

    // Save stripeCustomerId if not already set
    if (session.customer && !user.stripeCustomerId) {
      user.stripeCustomerId = typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id;
    }

    await safeSave(user);

    // Create Payment record if not already exists (mirrors handleInvoicePaid)
    const invoice = typeof session.subscription === 'object'
      ? session.subscription?.latest_invoice
      : null;

    if (invoice && typeof invoice === 'object' && invoice.id) {
      const existing = await Payment.findOne({ stripeInvoiceId: invoice.id });
      if (!existing) {
        await Payment.create({
          userId: user._id,
          stripeInvoiceId: invoice.id,
          stripePaymentIntentId: invoice.payment_intent || null,
          stripeSubscriptionId: subscriptionId || null,
          planId: plan._id,
          planName: plan.name,
          amount: (invoice.amount_paid || 0) / 100,
          currency: invoice.currency || 'usd',
          status: 'succeeded',
          billingCycle: billingCycle === 'yearly' ? 'yearly' : 'monthly',
          description: `Payment for ${plan.name}`,
          receiptUrl: invoice.hosted_invoice_url || null,
          invoiceUrl: invoice.invoice_pdf || null,
          paidAt: invoice.status_transitions?.paid_at
            ? new Date(invoice.status_transitions.paid_at * 1000)
            : new Date(),
        });
      }
    } else {
      // Fallback: use payment_intent from session directly
      const paymentIntentId = session.payment_intent;
      if (paymentIntentId) {
        const existing = await Payment.findOne({ stripePaymentIntentId: paymentIntentId });
        if (!existing) {
          await Payment.create({
            userId: user._id,
            stripePaymentIntentId: paymentIntentId,
            stripeSubscriptionId: subscriptionId || null,
            planId: plan._id,
            planName: plan.name,
            amount: (session.amount_total || 0) / 100,
            currency: session.currency || 'usd',
            status: 'succeeded',
            billingCycle: billingCycle === 'yearly' ? 'yearly' : 'monthly',
            description: `Payment for ${plan.name}`,
            paidAt: new Date(),
          });
        }
      }
    }

    // Send plan change email, payment confirmation, and notify admins
    emailService.sendPlanChangeEmail(user, oldPlanName, plan.name).catch(() => {});

    // Find the payment we just created (or the latest one) for the signed invoice URL
    const latestPayment = await Payment.findOne({ userId: user._id }).sort({ createdAt: -1 }).lean();
    const verifyInvoiceUrl = latestPayment ? generateSignedInvoiceUrl(latestPayment._id, user._id) : null;

    emailService.sendPaymentConfirmationEmail(user, {
      planName: plan.name,
      amount: (session.amount_total || 0) / 100,
      currency: session.currency || 'usd',
      billingCycle: billingCycle === 'yearly' ? 'yearly' : 'monthly',
      receiptUrl: verifyInvoiceUrl,
      invoiceNumber: 'STR-' + (session.payment_intent || session.id),
      paidAt: new Date(),
    }).catch(() => {});
    notifySubscriptionChange({
      customer: user,
      oldPlan: oldPlanName,
      newPlan: plan.name,
      changeType: 'activated',
      source: 'stripe',
    }).catch(() => {});

    console.log(`[VerifySession] Activated: ${user.email} → ${plan.name}`);

    const fresh = await User.findById(userId).lean();
    res.json({ success: true, alreadyActivated: false, user: fresh });
  } catch (error) {
    console.error('verifyCheckoutSession error:', error);
    res.status(500).json({ success: false, message: error.message || 'Verification failed' });
  }
};

/**
 * Download a branded PDF invoice for a payment (authenticated)
 */
const downloadInvoice = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.id || req.user._id;

    const payment = await Payment.findById(paymentId).lean();
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    // Ensure users can only download their own invoices
    if (payment.userId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { generateInvoicePDF } = require('../../services/invoice/invoiceService');

    const invoiceNo = payment.metadata?.lemonSqueezyOrderId
      ? 'LS-' + payment.metadata.lemonSqueezyOrderId
      : payment.stripeInvoiceId
        ? 'STR-' + payment.stripeInvoiceId
        : 'INV-' + payment._id.toString().slice(-8).toUpperCase();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoiceNo}.pdf"`);

    await generateInvoicePDF(payment, user, res);
  } catch (error) {
    console.error('downloadInvoice error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to generate invoice' });
    }
  }
};

/**
 * Generate a signed invoice URL for use in emails (no login needed)
 * Token expires in 30 days.
 *
 * @param {string} paymentId  – Payment document _id
 * @param {string} userId     – User _id
 * @returns {string} public URL with ?token=<jwt>
 */
const generateSignedInvoiceUrl = (paymentId, userId) => {
  const secret = process.env.JWT_SECRET;
  const token = jwt.sign({ paymentId: paymentId.toString(), userId: userId.toString(), type: 'invoice' }, secret, { expiresIn: '30d' });
  const base = getBaseUrlFromEnv();
  return `${base}/api/v1/public/invoice/${paymentId}?token=${token}`;
};

/**
 * Download invoice using a signed token (public — no auth middleware needed).
 * Used by email "View Receipt" links.
 */
const downloadInvoicePublic = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { token } = req.query;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Token required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    if (decoded.type !== 'invoice' || decoded.paymentId !== paymentId) {
      return res.status(403).json({ success: false, message: 'Token does not match' });
    }

    const payment = await Payment.findById(paymentId).lean();
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    const user = await User.findById(decoded.userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { generateInvoicePDF } = require('../../services/invoice/invoiceService');

    const invoiceNo = payment.metadata?.lemonSqueezyOrderId
      ? 'LS-' + payment.metadata.lemonSqueezyOrderId
      : payment.stripeInvoiceId
        ? 'STR-' + payment.stripeInvoiceId
        : 'INV-' + payment._id.toString().slice(-8).toUpperCase();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${invoiceNo}.pdf"`);

    await generateInvoicePDF(payment, user, res);
  } catch (error) {
    console.error('downloadInvoicePublic error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to generate invoice' });
    }
  }
};

module.exports = {
  createCheckout,
  createPortal,
  getPayments,
  cancelSubscription,
  resumeSubscription,
  verifyCheckoutSession,
  downloadInvoice,
  downloadInvoicePublic,
  generateSignedInvoiceUrl,
};
