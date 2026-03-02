const express = require('express');
const router = express.Router();
const { checkPermission } = require('../../../middleware/security');
const seoController = require('../../../controllers/admin/seoController');

// ==========================================
// SEO SETTINGS
// ==========================================

router.get('/settings', checkPermission('settings.view'), seoController.getSettings);
router.put('/settings', checkPermission('settings.edit'), seoController.updateSettings);

// ==========================================
// REDIRECTS MANAGEMENT
// ==========================================

router.get('/redirects', checkPermission('settings.view'), seoController.getRedirects);
router.post('/redirects', checkPermission('settings.edit'), seoController.createRedirect);
router.put('/redirects/:id', checkPermission('settings.edit'), seoController.updateRedirect);
router.delete('/redirects/:id', checkPermission('settings.edit'), seoController.deleteRedirect);
router.put('/redirects/:id/toggle', checkPermission('settings.edit'), seoController.toggleRedirect);

module.exports = router;
