const express = require('express');
const router = express.Router();
const etsyKeysController = require('../../../controllers/admin/etsyKeysController');
const { checkRole } = require('../../../middleware/security');

// All routes require super_admin role
router.use(checkRole('super_admin'));

// @route   GET /api/v1/admin/etsy-keys
router.get('/', etsyKeysController.listKeys);

// @route   POST /api/v1/admin/etsy-keys
router.post('/', etsyKeysController.addKey);

// @route   PUT /api/v1/admin/etsy-keys/:id
router.put('/:id', etsyKeysController.updateKey);

// @route   DELETE /api/v1/admin/etsy-keys/:id
router.delete('/:id', etsyKeysController.deleteKey);

// @route   POST /api/v1/admin/etsy-keys/:id/toggle
router.post('/:id/toggle', etsyKeysController.toggleKey);

module.exports = router;
