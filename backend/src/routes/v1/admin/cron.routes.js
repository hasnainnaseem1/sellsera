/**
 * Admin Cron Jobs Routes
 */
const express = require('express');
const router = express.Router();
const { checkPermission } = require('../../../middleware/security');
const cronController = require('../../../controllers/admin/cronController');

// GET /api/v1/admin/cron
router.get('/', checkPermission('settings.view'), cronController.listJobs);

// POST /api/v1/admin/cron
router.post('/', checkPermission('settings.edit'), cronController.createJob);

// PUT /api/v1/admin/cron/:key
router.put('/:key', checkPermission('settings.edit'), cronController.updateJob);

// DELETE /api/v1/admin/cron/:key
router.delete('/:key', checkPermission('settings.edit'), cronController.deleteJob);

// PUT /api/v1/admin/cron/:key/toggle
router.put('/:key/toggle', checkPermission('settings.edit'), cronController.toggleJobHandler);

// POST /api/v1/admin/cron/:key/trigger
router.post('/:key/trigger', checkPermission('settings.edit'), cronController.triggerJobHandler);

module.exports = router;
