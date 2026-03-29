/**
 * LemonSqueezy Service
 *
 * Handles all LemonSqueezy API interactions.
 * Initializes lazily with keys from AdminSettings and caches them
 * until explicitly cleared via clearCache().
 *
 * LemonSqueezy API: https://docs.lemonsqueezy.com/api
 */
const crypto = require('crypto');
const { AdminSettings } = require('../../models/admin');
const log = require('../../utils/logger')('LemonSqueezy');

const LEMONSQUEEZY_API_BASE = 'https://api.lemonsqueezy.com/v1';

class LemonSqueezyService {
  constructor() {
    this._initialized = false;
    this.apiKey = null;
    this.storeId = null;
  }

  // ────────────────────────────────────────────
  // Lifecycle
  // ────────────────────────────────────────────

  /**
   * Lazy-initialize: reads keys from DB once and caches them.
   * Subsequent calls are no-ops until clearCache() is invoked.
   */
  async initialize() {
    if (this._initialized) return this;

    const settings = await AdminSettings.getSettings();
    const config = settings.lemonSqueezySettings;

    if (!config || !config.apiKey) {
      throw new Error(
        'LemonSqueezy is not configured. Please add API key in Admin → Settings → Integrations.'
      );
    }

    this.apiKey = config.apiKey;
    this.storeId = config.storeId;
    this._initialized = true;
    return this;
  }

  /**
   * Clear cached credentials.
   * Called when admin updates LemonSqueezy settings so the service
   * re-reads from DB on the next request.
   */
  clearCache() {
    this._initialized = false;
    this.apiKey = null;
    this.storeId = null;
  }

  // ────────────────────────────────────────────
  // HTTP helper
  // ────────────────────────────────────────────

  /**
   * Make an authenticated JSON:API request to LemonSqueezy.
   */
  async request(method, path, body = null) {
    await this.initialize();

    const url = `${LEMONSQUEEZY_API_BASE}${path}`;
    const headers = {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${this.apiKey}`,
    };

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      log.error('API error:', {
        status: response.status,
        url,
        errors: data.errors,
        body: body ? JSON.stringify(body).substring(0, 500) : null,
      });
      const errorMsg =
        data.errors?.[0]?.detail ||
        data.message ||
        `LemonSqueezy API error (${response.status})`;
      throw new Error(errorMsg);
    }

    return data;
  }

  // ────────────────────────────────────────────
  // Checkout
  // ────────────────────────────────────────────

  /**
   * Create a checkout session for a plan.
   * Requires variant IDs in plan.metadata.lemonSqueezy.
   */
  async createCheckout({ user, plan, billingCycle, successUrl, cancelUrl }) {
    await this.initialize();

    if (!this.storeId) {
      throw new Error('LemonSqueezy Store ID is not configured.');
    }

    const price = billingCycle === 'yearly' ? plan.price.yearly : plan.price.monthly;
    if (!price || price <= 0) {
      throw new Error('This plan has no price configured for the selected billing cycle.');
    }

    const variantId =
      billingCycle === 'yearly'
        ? plan.metadata?.lemonSqueezy?.yearlyVariantId
        : plan.metadata?.lemonSqueezy?.monthlyVariantId;

    if (!variantId) {
      throw new Error(
        `LemonSqueezy variant ID not configured for ${plan.name} (${billingCycle}). ` +
          "Please set it in the plan's metadata under lemonSqueezy.monthlyVariantId / yearlyVariantId."
      );
    }

    log.info('createCheckout →', {
      storeId: this.storeId,
      variantId,
      planName: plan.name,
      billingCycle,
      metadata: plan.metadata?.lemonSqueezy,
    });

    const checkoutData = {
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: {
            email: user.email,
            name: user.name,
            custom: {
              user_id: user._id.toString(),
              plan_id: plan._id.toString(),
              plan_name: plan.name,
              billing_cycle: billingCycle,
            },
          },
          checkout_options: {
            embed: false,
            media: false,
            button_color: '#6C63FF',
          },
          product_options: {
            enabled_variants: [parseInt(variantId)],
            redirect_url:
              successUrl ||
              `${process.env.CUSTOMER_FRONTEND_URL || 'http://localhost:3002'}/checkout/success`,
            receipt_button_text: 'Go to Dashboard',
            receipt_link_url: `${process.env.CUSTOMER_FRONTEND_URL || 'http://localhost:3002'}/dashboard`,
          },
        },
        relationships: {
          store: { data: { type: 'stores', id: this.storeId.toString() } },
          variant: { data: { type: 'variants', id: variantId.toString() } },
        },
      },
    };

    const result = await this.request('POST', '/checkouts', checkoutData);
    return {
      url: result.data.attributes.url,
      checkoutId: result.data.id,
    };
  }

  // ────────────────────────────────────────────
  // Customer Portal
  // ────────────────────────────────────────────

  /**
   * Get customer portal URL from the customer resource.
   */
  async getCustomerPortalUrl(user) {
    if (!user.lemonSqueezyCustomerId) {
      throw new Error('No LemonSqueezy customer found for this user.');
    }

    const result = await this.request('GET', `/customers/${user.lemonSqueezyCustomerId}`);
    const portalUrl = result.data.attributes.urls?.customer_portal;

    if (!portalUrl) {
      throw new Error('Customer portal URL not available.');
    }

    return portalUrl;
  }

  // ────────────────────────────────────────────
  // Subscription management
  // ────────────────────────────────────────────

  /** Cancel a subscription (ends at period end). */
  async cancelSubscription(subscriptionId) {
    return this.request('DELETE', `/subscriptions/${subscriptionId}`);
  }

  /** Resume a paused / cancelled subscription. */
  async resumeSubscription(subscriptionId) {
    return this.request('PATCH', `/subscriptions/${subscriptionId}`, {
      data: {
        type: 'subscriptions',
        id: subscriptionId.toString(),
        attributes: { cancelled: false },
      },
    });
  }

  /** Pause a subscription. */
  async pauseSubscription(subscriptionId) {
    return this.request('PATCH', `/subscriptions/${subscriptionId}`, {
      data: {
        type: 'subscriptions',
        id: subscriptionId.toString(),
        attributes: { pause: { mode: 'void' } },
      },
    });
  }

  /** Get subscription details. */
  async getSubscription(subscriptionId) {
    return this.request('GET', `/subscriptions/${subscriptionId}`);
  }

  // ────────────────────────────────────────────
  // Webhook utilities
  // ────────────────────────────────────────────

  /**
   * Verify LemonSqueezy webhook signature (HMAC SHA-256).
   * Uses timing-safe comparison to prevent timing attacks.
   */
  verifyWebhookSignature(payload, signature, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(payload).digest('hex');
    const sigBuf = Buffer.from(signature);
    const digBuf = Buffer.from(digest);
    // timingSafeEqual requires identical byte lengths — return false if mismatch
    if (sigBuf.length !== digBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, digBuf);
  }

  /**
   * Retrieve webhook secret from AdminSettings.
   * (Does NOT require full initialization — only needs the secret.)
   */
  async getWebhookSecret() {
    const settings = await AdminSettings.getSettings();
    return settings.lemonSqueezySettings?.webhookSecret;
  }
}

module.exports = new LemonSqueezyService();
