const express = require('express');
const router = express.Router();
const { checkPermission } = require('../../../middleware/security/rbac');
const planController = require('../../../controllers/admin/planController');

// All routes are already behind adminAuth from the admin index router

// GET /admin/plans — list all plans
router.get('/', checkPermission('plans.view'), planController.listPlans);

// GET /admin/plans/features — list all features (for plan form)
router.get('/features', checkPermission('plans.view'), planController.listFeatures);

// GET /admin/plans/export/csv — export plans to CSV (MUST be before /:id)
router.get('/export/csv', checkPermission('plans.view'), planController.exportPlans);

// GET /admin/plans/:id — get single plan
router.get('/:id', checkPermission('plans.view'), planController.getPlan);

// POST /admin/plans — create new plan
router.post('/', checkPermission('plans.create'), planController.createPlan);

// PUT /admin/plans/:id — update plan
router.put('/:id', checkPermission('plans.edit'), planController.updatePlan);

// DELETE /admin/plans/:id — delete plan
router.delete('/:id', checkPermission('plans.delete'), planController.deletePlan);

// PUT /admin/plans/:id/toggle-status — activate/deactivate plan
router.put('/:id/toggle-status', checkPermission('plans.edit'), planController.togglePlanStatus);

// PUT /admin/plans/:id/set-default — set as default plan
router.put('/:id/set-default', checkPermission('plans.edit'), planController.setDefaultPlan);

// POST /admin/plans/bulk-delete — delete multiple plans
router.post('/bulk-delete', checkPermission('plans.delete'), planController.bulkDeletePlans);

module.exports = router;
