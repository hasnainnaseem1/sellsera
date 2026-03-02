const express = require('express');
const router = express.Router();
const { adminAuth } = require('../../../middleware/auth');
const { checkPermission, checkRole } = require('../../../middleware/security');
const departmentController = require('../../../controllers/admin/departmentController');

router.get('/', adminAuth, checkPermission('settings.view'), departmentController.getDepartments);
router.get('/active', adminAuth, departmentController.getActiveDepartments);
router.get('/:id', adminAuth, checkPermission('settings.view'), departmentController.getDepartment);
router.post('/', adminAuth, checkPermission('settings.edit'), departmentController.createDepartment);
router.put('/:id', adminAuth, checkPermission('settings.edit'), departmentController.updateDepartment);
router.delete('/:id', adminAuth, checkPermission('settings.edit'), departmentController.deleteDepartment);
router.post('/seed/default', adminAuth, checkRole('super_admin'), departmentController.seedDefaultDepartments);

module.exports = router;
