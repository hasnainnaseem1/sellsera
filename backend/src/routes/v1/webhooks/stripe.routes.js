/**
 * Stripe Webhook Routes
 *
 * Thin routing layer — delegates all business logic to stripeWebhookController.
 *
 * IMPORTANT: This route must use express.raw() body parser, NOT express.json().
 * It is mounted separately in app.js before JSON middleware.
 */
const express = require('express');
const router = express.Router();
const { handleWebhook } = require('../../../controllers/webhooks/stripeWebhookController');

// @route   POST /api/v1/webhooks/stripe
// @desc    Handle Stripe webhook events
// @access  Public (verified via Stripe signature)
router.post('/', handleWebhook);

module.exports = router;
