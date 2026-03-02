/**
 * Customer Billing Routes
 * 
 * Endpoints for customers to manage their billing:
 * - Create Stripe Checkout session (upgrade)
 * - Create Stripe Portal session (manage billing)
 * - Get payment history
 * - Cancel / Resume subscription
 */
const express = require('express');
const router = express.Router();
const { checkFeatureEnabled } = require('../../../middleware/security');
const billingController = require('../../../controllers/customer/billingController');

// @route   POST /api/v1/customer/billing/checkout
// @desc    Create a Stripe Checkout session for a plan
// @access  Private (Customer) — auth applied by parent router
router.post('/checkout', checkFeatureEnabled('enableSubscriptions'), billingController.createCheckout);

// @route   POST /api/v1/customer/billing/portal
// @desc    Create a Stripe Customer Portal session
// @access  Private (Customer)
router.post('/portal', checkFeatureEnabled('enableSubscriptions'), billingController.createPortal);

// @route   GET /api/v1/customer/billing/payments
// @desc    Get customer's payment history
// @access  Private (Customer)
router.get('/payments', checkFeatureEnabled('enableSubscriptions'), billingController.getPayments);

// @route   POST /api/v1/customer/billing/cancel
// @desc    Cancel current subscription (at period end by default)
// @access  Private (Customer)
router.post('/cancel', checkFeatureEnabled('enableSubscriptions'), billingController.cancelSubscription);

// @route   POST /api/v1/customer/billing/resume
// @desc    Resume a subscription that was set to cancel at period end
// @access  Private (Customer)
router.post('/resume', checkFeatureEnabled('enableSubscriptions'), billingController.resumeSubscription);

// @route   POST /api/v1/customer/billing/verify-session
// @desc    Verify a completed Stripe Checkout session and activate the subscription
//          (fallback for when webhooks are delayed / not running in local dev)
// @access  Private (Customer)
router.post('/verify-session', checkFeatureEnabled('enableSubscriptions'), billingController.verifyCheckoutSession);

// @route   GET /api/v1/customer/billing/invoice/:paymentId
// @desc    Download a branded PDF invoice for a specific payment
// @access  Private (Customer)
router.get('/invoice/:paymentId', checkFeatureEnabled('enableSubscriptions'), billingController.downloadInvoice);

module.exports = router;
