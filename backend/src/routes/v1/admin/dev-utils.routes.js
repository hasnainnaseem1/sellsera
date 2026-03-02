const express = require('express');
const router = express.Router();
const { checkPermission } = require('../../../middleware/security/rbac');
const devUtilsController = require('../../../controllers/admin/devUtilsController');

// POST /api/v1/admin/dev-utils/verify-customer
router.post('/verify-customer', checkPermission('users.edit'), devUtilsController.verifyCustomer);

// POST /api/v1/admin/dev-utils/create-test-customer
router.post('/create-test-customer', checkPermission('users.create'), devUtilsController.createTestCustomer);

module.exports = router;
