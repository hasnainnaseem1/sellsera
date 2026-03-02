const express = require('express');
const router = express.Router();
const { checkPermission } = require('../../../middleware/security');
const settingsController = require('../../../controllers/admin/settingsController');
const lsController = require('../../../controllers/admin/lemonSqueezySettingsController');

// @route   GET /api/admin/settings
// @desc    Get all admin settings
// @access  Private (Admin with settings.view permission)
router.get('/', checkPermission('settings.view'), settingsController.getSettings);

// @route   PUT /api/admin/settings/general
// @desc    Update general settings
// @access  Private (Admin with settings.edit permission)
router.put('/general', checkPermission('settings.edit'), settingsController.updateGeneralSettings);

// @route   PUT /api/admin/settings/email
// @desc    Update email settings
// @access  Private (Super Admin or Admin with settings.edit permission)
router.put('/email', checkPermission('settings.edit'), settingsController.updateEmailSettings);

// @route   POST /api/admin/settings/email/test
// @desc    Send a test email to verify SMTP configuration
// @access  Private (Admin with settings.edit permission)
router.post('/email/test', checkPermission('settings.edit'), settingsController.sendTestEmail);

// @route   PUT /api/admin/settings/customer
// @desc    Update customer settings
// @access  Private (Admin with settings.edit permission)
router.put('/customer', checkPermission('settings.edit'), settingsController.updateCustomerSettings);

// @route   PUT /api/admin/settings/security
// @desc    Update security settings
// @access  Private (Super Admin)
router.put('/security', checkPermission('settings.edit'), settingsController.updateSecuritySettings);

// @route   PUT /api/admin/settings/notification
// @desc    Update notification settings
// @access  Private (Admin with settings.edit permission)
router.put('/notification', checkPermission('settings.edit'), settingsController.updateNotificationSettings);

// @route   PUT /api/admin/settings/maintenance
// @desc    Toggle maintenance mode
// @access  Private (Super Admin)
router.put('/maintenance', checkPermission('settings.edit'), settingsController.updateMaintenanceMode);

// @route   PUT /api/admin/settings/features
// @desc    Toggle feature flags
// @access  Private (Super Admin or Admin with settings.edit permission)
router.put('/features', checkPermission('settings.edit'), settingsController.updateFeatureFlags);

// @route   GET /api/v1/admin/settings/theme
// @desc    Get theme/branding settings
// @access  Private (Admin with settings.view permission)
router.get('/theme', checkPermission('settings.view'), settingsController.getThemeSettings);

// @route   PUT /api/v1/admin/settings/theme
// @desc    Update theme/branding settings
// @access  Private (Admin with settings.edit permission)
router.put('/theme', checkPermission('settings.edit'), settingsController.updateThemeSettings);

// @route   GET /api/admin/settings/email-blocking/domains
// @desc    Get blocked temporary email domains
// @access  Private (Admin with settings.view permission)
router.get('/email-blocking/domains', checkPermission('settings.view'), settingsController.getBlockedDomains);

// @route   PUT /api/admin/settings/email-blocking/domains
// @desc    Update blocked temporary email domains
// @access  Private (Admin with settings.edit permission)
router.put('/email-blocking/domains', checkPermission('settings.edit'), settingsController.updateBlockedDomains);

// @route   POST /api/admin/settings/email-blocking/domains/:domain
// @desc    Add a single blocked temporary email domain
// @access  Private (Admin with settings.edit permission)
router.post('/email-blocking/domains/:domain', checkPermission('settings.edit'), settingsController.addBlockedDomain);

// @route   DELETE /api/admin/settings/email-blocking/domains/:domain
// @desc    Remove a blocked temporary email domain
// @access  Private (Admin with settings.edit permission)
router.delete('/email-blocking/domains/:domain', checkPermission('settings.edit'), settingsController.removeBlockedDomain);

// @route   PUT /api/v1/admin/settings/google-sso
// @desc    Update Google SSO settings
// @access  Private (Super Admin only)
router.put('/google-sso', checkPermission('settings.edit'), settingsController.updateGoogleSSO);

// @route   PUT /api/v1/admin/settings/stripe
// @desc    Update Stripe integration settings
// @access  Private (Super Admin only)
router.put('/stripe', checkPermission('settings.edit'), settingsController.updateStripeSettings);

// @route   PUT /api/v1/admin/settings/lemonsqueezy
// @desc    Update LemonSqueezy integration settings
// @access  Private (Super Admin only)
router.put('/lemonsqueezy', checkPermission('settings.edit'), lsController.updateLemonSqueezy);

// @route   PUT /api/v1/admin/settings/payment-gateway
// @desc    Set the active payment gateway (stripe or lemonsqueezy)
// @access  Private (Super Admin only)
router.put('/payment-gateway', checkPermission('settings.edit'), lsController.updatePaymentGateway);

// ==========================================
// EMAIL TEMPLATES
// ==========================================

// @route   GET /api/v1/admin/settings/email-templates
// @desc    Get all email templates (custom + defaults)
// @access  Private (Admin with settings.view)
router.get('/email-templates', checkPermission('settings.view'), settingsController.getEmailTemplates);

// @route   PUT /api/v1/admin/settings/email-templates/:key
// @desc    Update a single email template
// @access  Private (Admin with settings.edit)
router.put('/email-templates/:key', checkPermission('settings.edit'), settingsController.updateEmailTemplate);

// @route   DELETE /api/v1/admin/settings/email-templates/:key
// @desc    Reset a template to default (clear custom)
// @access  Private (Admin with settings.edit)
router.delete('/email-templates/:key', checkPermission('settings.edit'), settingsController.resetEmailTemplate);

// @route   POST /api/v1/admin/settings/email-templates/:key/preview
// @desc    Preview a template with sample data
// @access  Private (Admin with settings.view)
router.post('/email-templates/:key/preview', checkPermission('settings.view'), settingsController.previewEmailTemplate);

module.exports = router;
