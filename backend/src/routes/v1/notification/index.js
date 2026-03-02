const express = require('express');
const router = express.Router();
const { adminAuth } = require('../../../middleware/auth');
const {
  getUnreadCount,
  markAllRead,
  getNotifications,
  markAsRead,
  deleteNotification,
} = require('../../../controllers/notification/notificationController');

// @route   GET /api/v1/notifications/unread-count
// @desc    Get unread notification count
// @access  Private
router.get('/unread-count', adminAuth, getUnreadCount);

// @route   PUT /api/v1/notifications/mark-all-read
// @desc    Mark all notifications as read
// @access  Private
router.put('/mark-all-read', adminAuth, markAllRead);

// @route   GET /api/v1/notifications
// @desc    Get all notifications for current user
// @access  Private
router.get('/', adminAuth, getNotifications);

// @route   PUT /api/v1/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put('/:id/read', adminAuth, markAsRead);

// @route   DELETE /api/v1/notifications/:id
// @desc    Delete notification
// @access  Private
router.delete('/:id', adminAuth, deleteNotification);

module.exports = router;