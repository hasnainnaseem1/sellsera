const express = require('express');
const router = express.Router();
const { checkPermission } = require('../../../middleware/security');
const marketingController = require('../../../controllers/admin/marketingController');

router.get('/pages', checkPermission('settings.view'), marketingController.getPages);
router.get('/pages/:id', checkPermission('settings.view'), marketingController.getPage);
router.post('/pages', checkPermission('settings.edit'), marketingController.createPage);
router.put('/pages/:id', checkPermission('settings.edit'), marketingController.updatePage);
router.delete('/pages/:id', checkPermission('settings.edit'), marketingController.deletePage);
router.put('/pages/:id/status', checkPermission('settings.edit'), marketingController.updatePageStatus);
router.post('/pages/:id/clone', checkPermission('settings.edit'), marketingController.clonePage);
router.put('/pages-reorder', checkPermission('settings.edit'), marketingController.reorderPages);
router.get('/navigation', checkPermission('settings.view'), marketingController.getNavigation);
router.post('/pages/bulk-delete', checkPermission('settings.edit'), marketingController.bulkDeletePages);

module.exports = router;
