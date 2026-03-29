/**
 * Notification Controller
 *
 * Handles all notification-related operations:
 * - getUnreadCount
 * - markAllRead
 * - getNotifications
 * - markAsRead
 * - deleteNotification
 */
const { Notification } = require('../../models/notification');
const log = require('../../utils/logger')('NotifCtrl');

/**
 * Get unread notification count
 */
async function getUnreadCount(req, res) {
  try {
    const unreadCount = await Notification.countDocuments({
      recipientId: req.userId,
      isRead: false
    });

    res.json({
      success: true,
      unreadCount
    });
  } catch (error) {
    log.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching unread count'
    });
  }
}

/**
 * Mark all notifications as read
 */
async function markAllRead(req, res) {
  try {
    await Notification.updateMany(
      { recipientId: req.userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    log.error('Mark all read error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating notifications'
    });
  }
}

/**
 * Get all notifications for current user
 */
async function getNotifications(req, res) {
  try {
    const { limit = 20, skip = 0, unreadOnly = false } = req.query;

    let filter = { recipientId: req.userId };
    if (unreadOnly === 'true') {
      filter.isRead = false;
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({ recipientId: req.userId, isRead: false });

    res.json({
      success: true,
      notifications: notifications || [],
      total,
      unreadCount,
      pagination: {
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    });
  } catch (error) {
    log.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications'
    });
  }
}

/**
 * Mark notification as read
 */
async function markAsRead(req, res) {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    if (notification.recipientId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this notification'
      });
    }

    await notification.markAsRead();

    res.json({
      success: true,
      message: 'Notification marked as read',
      notification
    });
  } catch (error) {
    log.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating notification'
    });
  }
}

/**
 * Delete notification
 */
async function deleteNotification(req, res) {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    if (notification.recipientId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this notification'
      });
    }

    await Notification.deleteOne({ _id: req.params.id });

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    log.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting notification'
    });
  }
}

module.exports = {
  getUnreadCount,
  markAllRead,
  getNotifications,
  markAsRead,
  deleteNotification,
};
