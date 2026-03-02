const express = require('express');
const router = express.Router();
const { checkPermission } = require('../../../middleware/security/rbac');
const featureController = require('../../../controllers/admin/featureController');

// All routes are already behind adminAuth from the admin index router

// GET /admin/features — list all features
router.get('/', checkPermission('features.view'), featureController.listFeatures);

// GET /admin/features/export/csv — export features to CSV (MUST be before /:id)
router.get('/export/csv', checkPermission('features.view'), featureController.exportFeatures);

// GET /admin/features/:id — get single feature
router.get('/:id', checkPermission('features.view'), featureController.getFeature);

// POST /admin/features — create a new feature
router.post('/', checkPermission('features.create'), featureController.createFeature);

// PUT /admin/features/:id — update a feature
router.put('/:id', checkPermission('features.edit'), featureController.updateFeature);

// DELETE /admin/features/:id — delete a feature
router.delete('/:id', checkPermission('features.delete'), featureController.deleteFeature);

// PUT /admin/features/:id/toggle-status — toggle active/inactive
router.put('/:id/toggle-status', checkPermission('features.edit'), featureController.toggleFeatureStatus);

// POST /admin/features/bulk-delete — delete multiple features
router.post('/bulk-delete', checkPermission('features.delete'), featureController.bulkDeleteFeatures);

module.exports = router;
