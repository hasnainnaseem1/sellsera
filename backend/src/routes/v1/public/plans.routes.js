const express = require('express');
const router = express.Router();
const plansController = require('../../../controllers/customer/plansController');

// GET /api/v1/public/plans — list all active plans (no auth required)
router.get('/', plansController.getPublicPlans);

module.exports = router;
