/**
 * Customer Plans Routes
 * 
 * Public-ish listing of available plans for customer browsing.
 * Requires auth so we can show "current plan" indicators.
 */
const express = require('express');
const router = express.Router();
const { checkFeatureEnabled } = require('../../../middleware/security');
const plansController = require('../../../controllers/customer/plansController');

// @route   GET /api/v1/customer/plans
// @desc    Get all active plans (for customer plan selection / pricing page)
// @access  Private (Customer) — auth applied by parent router
router.get('/', checkFeatureEnabled('enableSubscriptions'), plansController.getPlans);

module.exports = router;
