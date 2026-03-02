const mongoose = require('mongoose');

const customRoleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Role name is required'],
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  permissions: [{
    type: String,
    required: true
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp
customRoleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Available permissions
customRoleSchema.statics.availablePermissions = [
  // User Management
  'users.view', 'users.create', 'users.edit', 'users.delete',
  'users.suspend', 'users.activate',
  
  // Customer Management
  'customers.view', 'customers.create', 'customers.edit', 'customers.delete',
  'customers.suspend', 'customers.activate', 'customers.verify', 'customers.plans',
  
  // Role Management
  'roles.view', 'roles.create', 'roles.edit', 'roles.delete',
  
  // Analytics
  'analytics.view', 'analytics.export',
  
  // Plan Management
  'plans.view', 'plans.create', 'plans.edit', 'plans.delete',
  
  // Feature Management
  'features.view', 'features.create', 'features.edit', 'features.delete',
  
  // Subscription Management
  'subscriptions.view', 'subscriptions.manage',
  
  // Activity Logs
  'logs.view', 'logs.export', 'logs.delete',
  
  // Settings
  'settings.view', 'settings.edit',
  
  // Notifications
  'notifications.view', 'notifications.send', 'notifications.delete',
  
  // System
  'system.backup', 'system.restore', 'system.maintenance'
];

const CustomRole = mongoose.model('CustomRole', customRoleSchema);

module.exports = CustomRole;
