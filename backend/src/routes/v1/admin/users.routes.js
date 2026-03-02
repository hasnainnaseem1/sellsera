const express = require('express');
const router = express.Router();
const { adminAuth } = require('../../../middleware/auth');
const { checkPermission } = require('../../../middleware/security');
const userController = require('../../../controllers/admin/userController');

// @route   GET /api/admin/users
router.get('/', adminAuth, checkPermission('users.view'), userController.getUsers);

// @route   GET /api/admin/users/export/csv
router.get('/export/csv', adminAuth, checkPermission('users.view'), userController.exportUsersCSV);

// @route   POST /api/admin/users/bulk-delete
router.post('/bulk-delete', adminAuth, checkPermission('users.delete'), userController.bulkDeleteUsers);

// @route   GET /api/admin/users/:id/login-history
router.get('/:id/login-history', adminAuth, userController.getLoginHistory);

// @route   GET /api/admin/users/:id/activity/export
router.get('/:id/activity/export', adminAuth, checkPermission('users.view'), userController.exportUserActivityCSV);

// @route   GET /api/admin/users/:id
router.get('/:id', adminAuth, checkPermission('users.view'), userController.getUserById);

// @route   POST /api/admin/users
router.post('/', adminAuth, checkPermission('users.create'), userController.createUser);

// @route   PUT /api/admin/users/:id
router.put('/:id', adminAuth, checkPermission('users.edit'), userController.updateUser);

// @route   DELETE /api/admin/users/:id
router.delete('/:id', adminAuth, checkPermission('users.delete'), userController.deleteUser);

// @route   POST /api/admin/users/:id/suspend
router.post('/:id/suspend', adminAuth, checkPermission('users.suspend'), userController.suspendUser);

// @route   POST /api/admin/users/:id/activate
router.post('/:id/activate', adminAuth, checkPermission('users.activate'), userController.activateUser);

module.exports = router;
