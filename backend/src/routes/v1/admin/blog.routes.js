const express = require('express');
const router = express.Router();
const { checkPermission } = require('../../../middleware/security');
const blogController = require('../../../controllers/admin/blogController');

router.get('/posts', checkPermission('settings.view'), blogController.listPosts);
router.get('/stats', checkPermission('settings.view'), blogController.getStats);
router.get('/categories', checkPermission('settings.view'), blogController.getCategories);
router.get('/posts/:id', checkPermission('settings.view'), blogController.getPost);
router.post('/posts', checkPermission('settings.edit'), blogController.createPost);
router.put('/posts/:id', checkPermission('settings.edit'), blogController.updatePost);
router.delete('/posts/:id', checkPermission('settings.edit'), blogController.deletePost);
router.put('/posts/:id/status', checkPermission('settings.edit'), blogController.togglePostStatus);
router.post('/posts/bulk-delete', checkPermission('settings.edit'), blogController.bulkDeletePosts);

module.exports = router;
