const express = require('express');
const router = express.Router();

const analysisRoutes = require('./analysis.routes');
const historyRoutes = require('./history.routes');
const subscriptionRoutes = require('./subscription.routes');
const billingRoutes = require('./billing.routes');
const plansRoutes = require('./plans.routes');

// All customer routes require authentication
const { auth } = require('../../../middleware/auth');

router.use('/analysis', auth, analysisRoutes);
router.use('/history', auth, historyRoutes);
router.use('/subscription', auth, subscriptionRoutes);
router.use('/billing', auth, billingRoutes);
router.use('/plans', auth, plansRoutes);

module.exports = router;