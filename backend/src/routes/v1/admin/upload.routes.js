const express = require('express');
const router = express.Router();
const { adminAuth } = require('../../../middleware/auth');
const { checkPermission } = require('../../../middleware/security');
const { upload, uploadFile, deleteFile, handleMulterError } = require('../../../controllers/admin/uploadController');

// POST /api/v1/admin/upload/:folder
router.post(
  '/:folder',
  adminAuth,
  checkPermission('settings.edit'),
  upload.single('file'),
  uploadFile
);

// DELETE /api/v1/admin/upload/:folder/:filename
router.delete(
  '/:folder/:filename',
  adminAuth,
  checkPermission('settings.edit'),
  deleteFile
);

// Error handler for multer errors
router.use(handleMulterError);

module.exports = router;
