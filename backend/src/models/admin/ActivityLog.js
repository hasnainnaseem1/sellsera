const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  // Who performed the action
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  userName: {
    type: String,
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  userRole: {
    type: String,
    required: true
  },
  
  // What action was performed
  action: {
    type: String,
    required: true,
    enum: [
      // Authentication
      'login', 'logout', 'signup', 'password_reset', 'password_reset_request',
      'email_verification', 'resend_verification', 'unauthorized_access',
      'profile_update',
      
      // User Management
      'user_created', 'user_updated', 'user_deleted', 'user_suspended', 'user_activated',
      
      // Customer Management
      'customer_created', 'customer_updated', 'customer_deleted', 'customer_suspended', 
      'customer_activated', 'customer_plan_changed', 'customer_verified',
      'customer_status_changed', 'customer_verified_manually',
      
      // Role Management
      'role_created', 'role_updated', 'role_deleted', 'role_assigned',
      
      // Plan Management
      'plan_created', 'plan_updated', 'plan_deleted',
      
      // Feature Management
      'feature_created', 'feature_updated', 'feature_deleted',
      
      // Subscription Management
      'subscription_assigned', 'subscription_cancelled',
      
      // Settings
      'settings_updated', 'system_config_changed',
      
      // Email
      'test_email_sent', 'test_email_failed',
      
      // Analysis
      'analysis_performed', 'analysis_deleted',
      
      // Bulk Operations
      'customers_bulk_deleted', 'users_bulk_deleted', 'roles_bulk_deleted',
      'plans_bulk_deleted', 'features_bulk_deleted', 'pages_bulk_deleted',
      'blog_posts_bulk_deleted',
      
      // Dev / Testing
      'test_customer_created',
      
      // Data Management
      'data_deleted',
      
      // Legacy / Migration
      'customer_verified', 'customer_plan_changed', 'customer_updated',
      
      // Other
      'data_exported', 'backup_created', 'system_maintenance'
    ]
  },
  
  // Action details
  actionType: {
    type: String,
    enum: ['create', 'read', 'update', 'delete', 'auth', 'export', 'system'],
    required: true
  },
  
  // What entity was affected
  targetModel: {
    type: String,
    enum: ['User', 'CustomRole', 'Analysis', 'Settings', 'Notification', 'System', 'Plan', 'Feature', 'ActivityLog'],
    required: false
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  targetName: {
    type: String,
    required: false
  },
  
  // Additional details
  description: {
    type: String,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Request info
  ipAddress: {
    type: String,
    required: false
  },
  userAgent: {
    type: String,
    required: false
  },
  
  // Status
  status: {
    type: String,
    enum: ['success', 'failed', 'warning', 'error'],
    default: 'success'
  },
  errorMessage: {
    type: String,
    default: null
  },
  
  // Timestamp
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false // We only need createdAt
});

// Indexes for faster queries
activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ actionType: 1, createdAt: -1 });
activityLogSchema.index({ status: 1, createdAt: -1 });
activityLogSchema.index({ targetModel: 1, targetId: 1 });

// Static method to log activity
activityLogSchema.statics.logActivity = async function({
  userId,
  userName,
  userEmail,
  userRole,
  action,
  actionType,
  targetModel = null,
  targetId = null,
  targetName = null,
  description,
  metadata = {},
  ipAddress = null,
  userAgent = null,
  status = 'success',
  errorMessage = null
}) {
  try {
    // Check if activity logging is enabled
    const AdminSettings = require('./AdminSettings');
    const settings = await AdminSettings.getSettings();
    if (settings.features?.enableActivityLogs === false) {
      return null; // Silently skip logging when disabled
    }

    // Build log object, only including fields that have values
    const logData = {
      userId,
      userName,
      userEmail,
      userRole,
      action,
      actionType,
      description,
      metadata,
      status
    };

    // Only add optional fields if they have values
    if (targetModel) logData.targetModel = targetModel;
    if (targetId) logData.targetId = targetId;
    if (targetName) logData.targetName = targetName;
    if (ipAddress) logData.ipAddress = ipAddress;
    if (userAgent) logData.userAgent = userAgent;
    if (errorMessage) logData.errorMessage = errorMessage;

    const log = new this(logData);
    
    await log.save();
    return log;
  } catch (error) {
    console.error('Error logging activity:', error);
    // Don't throw error - logging should never break the main flow
    return null;
  }
};

module.exports = mongoose.model('ActivityLog', activityLogSchema);
