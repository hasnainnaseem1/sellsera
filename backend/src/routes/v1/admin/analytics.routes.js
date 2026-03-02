const express = require('express');
const router = express.Router();
const { adminAuth } = require('../../../middleware/auth');
const { checkPermission } = require('../../../middleware/security');
const analyticsController = require('../../../controllers/admin/analyticsController');

// @route   GET /api/admin/analytics/overview
router.get('/overview', adminAuth, checkPermission('analytics.view'), analyticsController.getOverview);

// @route   GET /api/admin/analytics/users-growth
router.get('/users-growth', adminAuth, checkPermission('analytics.view'), analyticsController.getUsersGrowth);

// @route   GET /api/admin/analytics/analyses-trend
router.get('/analyses-trend', adminAuth, checkPermission('analytics.view'), analyticsController.getAnalysesTrend);

// @route   GET /api/admin/analytics/subscription-distribution
router.get('/subscription-distribution', adminAuth, checkPermission('analytics.view'), analyticsController.getSubscriptionDistribution);

// @route   GET /api/admin/analytics/top-customers
router.get('/top-customers', adminAuth, checkPermission('analytics.view'), analyticsController.getTopCustomers);

// @route   GET /api/admin/analytics/recent-activities
router.get('/recent-activities', adminAuth, checkPermission('analytics.view'), analyticsController.getRecentActivities);

// @route   GET /api/admin/analytics/plan-distribution
router.get('/plan-distribution', adminAuth, checkPermission('analytics.view'), analyticsController.getPlanDistribution);

// @route   GET /api/admin/analytics/usage-stats
router.get('/usage-stats', adminAuth, checkPermission('analytics.view'), analyticsController.getUsageStats);

// @route   GET /api/admin/analytics/usage-trend/:featureKey
router.get('/usage-trend/:featureKey', adminAuth, checkPermission('analytics.view'), analyticsController.getUsageTrend);

// @route   GET /api/admin/analytics/customer-usage/:id
router.get('/customer-usage/:id', adminAuth, checkPermission('analytics.view'), analyticsController.getCustomerUsage);

// @route   GET /api/admin/analytics/revenue-stats
router.get('/revenue-stats', adminAuth, checkPermission('analytics.view'), analyticsController.getRevenueStats);

// @route   GET /api/admin/analytics/login-analytics
router.get('/login-analytics', adminAuth, checkPermission('analytics.view'), analyticsController.getLoginAnalytics);

// @route   GET /api/admin/analytics/feature-adoption
router.get('/feature-adoption', adminAuth, checkPermission('analytics.view'), analyticsController.getFeatureAdoption);

// @route   GET /api/admin/analytics/per-plan-usage
router.get('/per-plan-usage', adminAuth, checkPermission('analytics.view'), analyticsController.getPerPlanUsage);

// @route   GET /api/admin/analytics/revenue-advanced
router.get('/revenue-advanced', adminAuth, checkPermission('analytics.view'), analyticsController.getRevenueAdvanced);

module.exports = router;
