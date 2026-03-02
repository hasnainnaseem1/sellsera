/**
 * Stripe Service
 * 
 * Handles all Stripe API interactions. Initializes lazily with keys from AdminSettings.
 */
const { AdminSettings } = require('../../models/admin');

class StripeService {
  constructor() {
    this.stripe = null;
  }

  /**
   * Initialize Stripe with keys from AdminSettings
   */
  async initialize() {
    const settings = await AdminSettings.getSettings();
    const stripeConfig = settings.stripeSettings;

    if (!stripeConfig || !stripeConfig.secretKey) {
      throw new Error('Stripe is not configured. Please add Stripe keys in Admin → Settings.');
    }

    const Stripe = require('stripe');
    this.stripe = Stripe(stripeConfig.secretKey);
    return this.stripe;
  }

  /**
   * Get or create a Stripe customer for a user
   */
  async getOrCreateCustomer(user) {
    await this.initialize();

    if (user.stripeCustomerId) {
      try {
        const customer = await this.stripe.customers.retrieve(user.stripeCustomerId);
        if (!customer.deleted) return customer;
      } catch (err) {
        // Customer doesn't exist in Stripe anymore, create new one
      }
    }

    const customer = await this.stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: user._id.toString() },
    });

    // Save Stripe customer ID to user
    user.stripeCustomerId = customer.id;
    await user.save();

    return customer;
  }

  /**
   * Create a Checkout Session for a plan upgrade
   */
  async createCheckoutSession({ user, plan, billingCycle, successUrl, cancelUrl }) {
    await this.initialize();

    const customer = await this.getOrCreateCustomer(user);

    const price = billingCycle === 'yearly' ? plan.price.yearly : plan.price.monthly;
    if (!price || price <= 0) {
      throw new Error('This plan has no price configured for the selected billing cycle.');
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: (plan.currency || 'USD').toLowerCase(),
          product_data: {
            name: plan.name,
            description: plan.description || `${plan.name} Plan — ${billingCycle}`,
          },
          unit_amount: Math.round(price * 100), // Stripe uses cents
          recurring: {
            interval: billingCycle === 'yearly' ? 'year' : 'month',
          },
        },
        quantity: 1,
      }],
      metadata: {
        userId: user._id.toString(),
        planId: plan._id.toString(),
        planName: plan.name,
        billingCycle,
      },
      success_url: successUrl || `${process.env.CUSTOMER_FRONTEND_URL || 'http://localhost:3002'}/dashboard?checkout=success`,
      cancel_url: cancelUrl || `${process.env.CUSTOMER_FRONTEND_URL || 'http://localhost:3002'}/plans?checkout=cancelled`,
      allow_promotion_codes: true,
    });

    return session;
  }

  /**
   * Create a Customer Portal session (for managing billing, cancellation, etc.)
   */
  async createPortalSession(user, returnUrl) {
    await this.initialize();

    if (!user.stripeCustomerId) {
      throw new Error('No Stripe customer found for this user.');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl || `${process.env.CUSTOMER_FRONTEND_URL || 'http://localhost:3002'}/subscription`,
    });

    return session;
  }

  /**
   * Cancel a subscription in Stripe
   * @param {string} subscriptionId - Stripe subscription ID
   * @param {boolean} immediate - If true, cancel immediately; if false, cancel at period end
   */
  async cancelSubscription(subscriptionId, immediate = false) {
    await this.initialize();

    if (immediate) {
      return this.stripe.subscriptions.cancel(subscriptionId);
    }

    return this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  /**
   * Resume a subscription that was set to cancel at period end
   */
  async resumeSubscription(subscriptionId) {
    await this.initialize();

    return this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  }

  /**
   * Retrieve a Checkout Session (with line_items and subscription expanded)
   */
  async retrieveCheckoutSession(sessionId) {
    await this.initialize();
    return this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'subscription.latest_invoice'],
    });
  }

  /**
   * Retrieve an Invoice
   */
  async retrieveInvoice(invoiceId) {
    await this.initialize();
    return this.stripe.invoices.retrieve(invoiceId);
  }

  /**
   * Get webhook secret from settings
   */
  async getWebhookSecret() {
    const settings = await AdminSettings.getSettings();
    return settings.stripeSettings?.webhookSecret;
  }

  /**
   * Construct event from webhook payload
   */
  async constructWebhookEvent(payload, signature) {
    await this.initialize();
    const webhookSecret = await this.getWebhookSecret();

    if (!webhookSecret) {
      throw new Error('Stripe webhook secret is not configured.');
    }

    return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }
}

module.exports = new StripeService();
