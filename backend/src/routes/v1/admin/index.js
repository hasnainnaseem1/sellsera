const express = require('express');
const router = express.Router();

// Import admin routes
const usersRoutes = require('./users.routes');
const customersRoutes = require('./customers.routes');
const rolesRoutes = require('./roles.routes');
const analyticsRoutes = require('./analytics.routes');
const logsRoutes = require('./logs.routes');
const settingsRoutes = require('./settings.routes');
const departmentsRoutes = require('./departments.routes');
const plansRoutes = require('./plans.routes');
const featuresRoutes = require('./features.routes');
const devUtilsRoutes = require('./dev-utils.routes');
const marketingRoutes = require('./marketing.routes');
const blogRoutes = require('./blog.routes');
const seoRoutes = require('./seo.routes');
const uploadRoutes = require('./upload.routes');
const cronRoutes = require('./cron.routes');

// All admin routes require admin authentication
const { adminAuth } = require('../../../middleware/auth');

router.use('/users', adminAuth, usersRoutes);
router.use('/customers', adminAuth, customersRoutes);
router.use('/roles', adminAuth, rolesRoutes);
router.use('/analytics', adminAuth, analyticsRoutes);
router.use('/logs', adminAuth, logsRoutes);
router.use('/settings', adminAuth, settingsRoutes);
router.use('/departments', adminAuth, departmentsRoutes);
router.use('/plans', adminAuth, plansRoutes);
router.use('/features', adminAuth, featuresRoutes);
router.use('/dev-utils', adminAuth, devUtilsRoutes);
router.use('/marketing', adminAuth, marketingRoutes);
router.use('/blog', adminAuth, blogRoutes);
router.use('/seo', adminAuth, seoRoutes);
router.use('/upload', adminAuth, uploadRoutes);
router.use('/cron', adminAuth, cronRoutes);

module.exports = router;