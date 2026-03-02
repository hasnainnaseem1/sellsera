const express = require('express');
const router = express.Router();
const { adminAuth } = require('../../../middleware/auth');
const { checkPermission, superAdminOnly, checkFeatureEnabled } = require('../../../middleware/security');
const {
  getRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  getAvailablePermissions,
  bulkDeleteRoles
} = require('../../../controllers/admin/roleController');

// @route   GET /api/admin/roles
// @desc    Get all custom roles
// @access  Private (Admin with roles.view permission)
router.get('/', adminAuth, checkPermission('roles.view'), checkFeatureEnabled('enableCustomRoles'), getRoles);

// @route   GET /api/admin/roles/permissions/available
// @desc    Get all available permissions
// @access  Private (Admin with roles.view permission)
router.get('/permissions/available', adminAuth, checkPermission('roles.view'), checkFeatureEnabled('enableCustomRoles'), getAvailablePermissions);

// @route   GET /api/admin/roles/:id
// @desc    Get single custom role
// @access  Private (Admin with roles.view permission)
router.get('/:id', adminAuth, checkPermission('roles.view'), checkFeatureEnabled('enableCustomRoles'), getRole);

// @route   POST /api/admin/roles
// @desc    Create custom role
// @access  Private (Super Admin or Admin with roles.create permission)
router.post('/', adminAuth, checkPermission('roles.create'), checkFeatureEnabled('enableCustomRoles'), createRole);

// @route   POST /api/admin/roles/bulk-delete
// @desc    Delete multiple custom roles at once
// @access  Private (Admin with roles.delete permission)
router.post('/bulk-delete', adminAuth, checkPermission('roles.delete'), checkFeatureEnabled('enableCustomRoles'), bulkDeleteRoles);

// @route   PUT /api/admin/roles/:id
// @desc    Update custom role
// @access  Private (Super Admin or Admin with roles.edit permission)
router.put('/:id', adminAuth, checkPermission('roles.edit'), checkFeatureEnabled('enableCustomRoles'), updateRole);

// @route   DELETE /api/admin/roles/:id
// @desc    Delete custom role
// @access  Private (Super Admin or Admin with roles.delete permission)
router.delete('/:id', adminAuth, checkPermission('roles.delete'), checkFeatureEnabled('enableCustomRoles'), deleteRole);

module.exports = router;
