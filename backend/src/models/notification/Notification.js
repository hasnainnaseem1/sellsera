const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Who should receive this notification
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  recipientType: {
    type: String,
    enum: ['customer', 'admin', 'all'],
    default: 'customer'
  },
  
  // Notification details
  type: {
    type: String,
    enum: [
      'welcome',
      'email_verification',
      'password_reset',
      'subscription_activated',
      'subscription_expired',
      'subscription_cancelled',
      'plan_upgraded',
      'plan_downgraded',
      'analysis_limit_reached',
      'account_suspended',
      'account_activated',
      'new_feature',
      'system_alert',
      'admin_message',
      'security_alert'
    ],
    required: true
  },
  
  title: {
    type: String,
    required: true
  },
  
  message: {
    type: String,
    required: true
  },
  
  // Action button (optional)
  action: {
    label: {
      type: String,
      default: null
    },
    url: {
      type: String,
      default: null
    }
  },
  
  // Priority
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Status
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date,
    default: null
  },
  
  // Sender info (for admin messages)
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  senderName: {
    type: String,
    default: 'System'
  },
  
  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Expiry
  expiresAt: {
    type: Date,
    default: null
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false
});

// Indexes
notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, type: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Mark as read
notificationSchema.methods.markAsRead = async function() {
  this.isRead = true;
  this.readAt = new Date();
  return await this.save();
};

// Static method to create notification
notificationSchema.statics.createNotification = async function({
  recipientId,
  recipientType = 'customer',
  type,
  title,
  message,
  action = null,
  priority = 'medium',
  senderId = null,
  senderName = 'System',
  metadata = {},
  expiresAt = null
}) {
  try {
    const notification = new this({
      recipientId,
      recipientType,
      type,
      title,
      message,
      action,
      priority,
      senderId,
      senderName,
      metadata,
      expiresAt
    });
    
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

// Get unread count
notificationSchema.statics.getUnreadCount = async function(userId) {
  return await this.countDocuments({ 
    recipientId: userId, 
    isRead: false 
  });
};

module.exports = mongoose.model('Notification', notificationSchema);
