/**
 * LemonSqueezy Webhook Routes
 *
 * Thin routing layer — delegates all business logic (including signature
 * verification) to lemonSqueezyWebhookController.
 *
 * IMPORTANT: This route must use express.raw() body parser, NOT express.json().
 * It is mounted separately in app.js before JSON middleware.
 */
const express = require('express');
const router = express.Router();
const { handleWebhook } = require('../../../controllers/webhooks/lemonSqueezyWebhookController');

// @route   POST /api/v1/webhooks/lemonsqueezy
// @desc    Handle LemonSqueezy webhook events
// @access  Public (verified via HMAC signature)
router.post('/', handleWebhook);

module.exports = router;
