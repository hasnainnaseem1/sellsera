/**
 * Customer Subscription & Usage Routes
 * 
 * Endpoints for customers to check their own subscription, plan, and feature usage.
 */
const express = require('express');
const router = express.Router();
const { checkFeatureEnabled } = require('../../../middleware/security');
const subscriptionController = require('../../../controllers/customer/subscriptionController');

// @route   GET /api/v1/customer/subscription
// @desc    Get current customer's subscription & plan info
// @access  Private (Customer) — auth applied by parent router
router.get('/', checkFeatureEnabled('enableSubscriptions'), subscriptionController.getSubscription);

// @route   GET /api/v1/customer/subscription/usage
// @desc    Get current customer's feature usage (remaining, used, limits)
// @access  Private (Customer)
router.get('/usage', checkFeatureEnabled('enableSubscriptions'), subscriptionController.getUsage);

module.exports = router;
