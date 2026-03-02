const { User, CustomRole } = require('../../models/user');
const { ActivityLog } = require('../../models/admin');
const { Notification } = require('../../models/notification');
const { getClientIP } = require('../../utils/helpers/ipHelper');
const { formatUserResponse } = require('../../utils/helpers/userFormatter');
const { validatePassword } = require('../../utils/helpers/securityHelper');

// @route   GET /api/admin/users
// @desc    Get all users (customers + admins) with pagination and filters
// @access  Private (Admin with users.view permission)
const getUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      accountType, // 'customer' or 'admin'
      role,
      status,
      plan,
      search,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    // Build filter query
    const filter = {};
    
    if (accountType) filter.accountType = accountType;
    
    // Handle multiple roles (OR logic)
    if (role) {
      const roles = role.includes(',') ? role.split(',') : [role];
      filter.role = { $in: roles };
    }
    
    // Handle multiple statuses (OR logic)
    if (status) {
      const statuses = status.includes(',') ? status.split(',') : [status];
      filter.status = { $in: statuses };
    }
    
    if (plan) filter.plan = plan;
    
    // Search by name or email
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query
    const users = await User.find(filter)
      .select('-password -emailVerificationToken -resetPasswordToken')
      .populate('customRole', 'name permissions')
      .populate('assignedBy', 'name email')
      .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await User.countDocuments(filter);

    // Get statistics
    const stats = {
      totalUsers: await User.countDocuments(),
      totalCustomers: await User.countDocuments({ accountType: 'customer' }),
      totalAdmins: await User.countDocuments({ accountType: 'admin' }),
      activeUsers: await User.countDocuments({ status: 'active' }),
      suspendedUsers: await User.countDocuments({ status: 'suspended' }),
      pendingVerification: await User.countDocuments({ status: 'pending_verification' })
    };

    res.json({
      success: true,
      users: users.map(user => formatUserResponse(user)),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      },
      stats
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users'
    });
  }
};

// @route   GET /api/admin/users/export/csv
// @desc    Export users to CSV with filters
// @access  Private (Admin with users.view permission)
const exportUsersCSV = async (req, res) => {
  try {
    const {
      accountType,
      role,
      status,
      plan,
      search,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    // Build filter query (same as main GET route)
    const filter = {};
    
    if (accountType) filter.accountType = accountType;
    
    // Handle multiple roles (OR logic)
    if (role) {
      const roles = role.includes(',') ? role.split(',') : [role];
      filter.role = { $in: roles };
    }
    
    // Handle multiple statuses (OR logic)
    if (status) {
      const statuses = status.includes(',') ? status.split(',') : [status];
      filter.status = { $in: statuses };
    }
    
    if (plan) filter.plan = plan;
    
    // Search by name or email
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Get all users matching filter (no pagination for export)
    const users = await User.find(filter)
      .select('-password -emailVerificationToken -resetPasswordToken')
      .populate('customRole', 'name')
      .populate('assignedBy', 'name email')
      .sort({ [sortBy]: order === 'desc' ? -1 : 1 });

    // Build CSV
    const headers = [
      'ID',
      'Name',
      'Email',
      'Account Type',
      'Role',
      'Status',
      'Department',
      'Email Verified',
      'Last Login',
      'Last Login IP',
      'Assigned By',
      'Created At'
    ];

    // Add subscription headers only for customer data
    const hasCustomers = users.some(u => u.accountType === 'customer');
    if (hasCustomers) {
      headers.splice(7, 0, 'Plan', 'Analysis Count', 'Analysis Limit', 'Subscription Status');
    }

    const csvRows = [headers.join(',')];

    users.forEach(user => {
      const formatDate = (date) => {
        if (!date) return 'Never';
        const d = new Date(date);
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      };

      const baseRow = [
        user._id,
        `"${user.name}"`,
        user.email,
        user.accountType,
        user.customRole ? user.customRole.name : user.role,
        user.status,
        user.department || 'N/A',
        user.isEmailVerified ? 'Yes' : 'No',
        formatDate(user.lastLogin),
        user.lastLoginIP || 'N/A',
        user.assignedBy ? `"${user.assignedBy.name}"` : 'N/A',
        formatDate(user.createdAt)
      ];

      // Insert subscription fields for customer accounts
      if (hasCustomers) {
        if (user.accountType === 'customer') {
          baseRow.splice(7, 0, user.plan || 'N/A', user.analysisCount || 0, user.analysisLimit || 0, user.subscriptionStatus || 'N/A');
        } else {
          // For admin accounts, add empty values for subscription columns
          baseRow.splice(7, 0, 'N/A', 'N/A', 'N/A', 'N/A');
        }
      }

      csvRows.push(baseRow.join(','));
    });

    const csv = csvRows.join('\n');
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `users-export-${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);

  } catch (error) {
    console.error('Export users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting users'
    });
  }
};

// @route   GET /api/admin/users/:id/login-history
// @desc    Get login history for a specific user
// @access  Private (Admin with logs.view permission OR viewing own profile)
const getLoginHistory = async (req, res) => {
  try {
    const userId = req.params.id;
    const { limit = 20 } = req.query;

    // Check if user has permission to view login history
    const currentUser = await User.findById(req.userId);
    let currentUserPermissions = [];
    if (currentUser.role === 'super_admin') {
      currentUserPermissions = ['*'];
    } else if (currentUser.role === 'custom' && currentUser.customRole) {
      currentUserPermissions = currentUser.customRole.permissions || [];
    } else {
      const builtInPerms = {
        admin: [
          'users.view', 'users.create', 'users.edit', 'users.delete',
          'customers.view', 'customers.edit', 'customers.plans',
          'analytics.view', 'logs.view', 'settings.edit'
        ],
        moderator: [
          'users.view', 'customers.view', 'customers.edit',
          'analytics.view'
        ],
        viewer: [
          'users.view', 'customers.view', 'analytics.view'
        ]
      };
      currentUserPermissions = builtInPerms[currentUser.role] || [];
    }

    // Allow access if user has logs.view permission or is viewing their own profile
    const isOwnProfile = req.userId.toString() === userId;
    const canViewLogs = currentUserPermissions.includes('*') || currentUserPermissions.includes('logs.view');
    
    if (!canViewLogs && !isOwnProfile) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view login history for this user'
      });
    }

    // Validate MongoDB ObjectId format
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    // Get login activity logs
    const loginHistory = await ActivityLog.find({
      userId,
      action: 'login',
      actionType: 'auth'
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('ipAddress userAgent createdAt status description');

    res.json({
      success: true,
      loginHistory
    });

  } catch (error) {
    console.error('Get login history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching login history'
    });
  }
};

// @route   GET /api/admin/users/:id
// @desc    Get single user by ID
// @access  Private (Admin with users.view permission)
const getUserById = async (req, res) => {
  try {
    // Validate MongoDB ObjectId format
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('customRole', 'name permissions description')
      .populate('assignedBy', 'name email');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's permissions (safely handle custom role)
    let permissions = [];
    if (user.role === 'super_admin') {
      permissions = ['*'];
    } else if (user.role === 'custom' && user.customRole) {
      permissions = user.customRole.permissions || [];
    } else {
      // Built-in role permissions
      const builtInPermissions = {
        admin: [
          'users.view', 'users.create', 'users.edit', 'users.delete',
          'customers.view', 'customers.edit', 'customers.plans',
          'analytics.view', 'logs.view', 'settings.edit'
        ],
        moderator: [
          'users.view', 'customers.view', 'customers.edit',
          'analytics.view'
        ],
        viewer: [
          'users.view', 'customers.view', 'analytics.view'
        ]
      };
      permissions = builtInPermissions[user.role] || [];
    }

    // Get current user's permissions to check if they can view logs
    const currentUser = await User.findById(req.userId);
    let currentUserPermissions = [];
    if (currentUser.role === 'super_admin') {
      currentUserPermissions = ['*'];
    } else if (currentUser.role === 'custom' && currentUser.customRole) {
      currentUserPermissions = currentUser.customRole.permissions || [];
    } else {
      const builtInPerms = {
        admin: [
          'users.view', 'users.create', 'users.edit', 'users.delete',
          'customers.view', 'customers.edit', 'customers.plans',
          'analytics.view', 'logs.view', 'settings.edit'
        ],
        moderator: [
          'users.view', 'customers.view', 'customers.edit',
          'analytics.view'
        ],
        viewer: [
          'users.view', 'customers.view', 'analytics.view'
        ]
      };
      currentUserPermissions = builtInPerms[currentUser.role] || [];
    }

    // Only fetch activity logs if:
    // 1. Current user has logs.view permission (admin/viewer), OR
    // 2. Current user is viewing their own profile
    let recentActivity = [];
    const isOwnProfile = req.userId.toString() === req.params.id;
    const canViewLogs = currentUserPermissions.includes('*') || currentUserPermissions.includes('logs.view');
    if (canViewLogs || isOwnProfile) {
      recentActivity = await ActivityLog.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('action description ipAddress createdAt status');
    }

    // Build user response with conditional activity information
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      accountType: user.accountType,
      role: user.role,
      customRole: user.customRole,
      permissions: permissions,
      status: user.status,
      isEmailVerified: user.isEmailVerified
    };

    // Only include subscription fields for customer accounts
    if (user.accountType === 'customer') {
      userResponse.plan = user.plan;
      userResponse.analysisCount = user.analysisCount;
      userResponse.analysisLimit = user.analysisLimit;
      userResponse.monthlyResetDate = user.monthlyResetDate;
      userResponse.stripeCustomerId = user.stripeCustomerId;
      userResponse.subscriptionStatus = user.subscriptionStatus;
      userResponse.subscriptionId = user.subscriptionId;
      userResponse.subscriptionStartDate = user.subscriptionStartDate;
      userResponse.subscriptionEndDate = user.subscriptionEndDate;
    }

    // Add admin-specific fields
    if (user.accountType === 'admin') {
      userResponse.department = user.department;
    }

    // Only include sensitive activity information for admin/super_admin
    const canViewActivityInfo = currentUserPermissions.includes('*') || 
                                currentUserPermissions.includes('logs.view') || 
                                isOwnProfile;
    if (canViewActivityInfo) {
      userResponse.lastLogin = user.lastLogin;
      userResponse.lastLoginIP = user.lastLoginIP;
      userResponse.loginAttempts = user.loginAttempts;
      userResponse.lockUntil = user.lockUntil;
      userResponse.assignedBy = user.assignedBy;
      userResponse.createdAt = user.createdAt;
      userResponse.updatedAt = user.updatedAt;
    }

    res.json({
      success: true,
      user: userResponse,
      recentActivity
    });

  } catch (error) {
    console.error('Get user error:', error);
    console.error('User ID:', req.params.id);
    console.error('Error details:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @route   GET /api/admin/users/:id/activity/export
// @desc    Export user activity logs to CSV with date range filter
// @access  Private (Admin with users.view permission)
const exportUserActivityCSV = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const userId = req.params.id;

    // Validate MongoDB ObjectId format
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    // Build filter query
    const filter = { userId };

    // Add date range filter if provided
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Get all activity logs matching filter
    const activities = await ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .select('action description ipAddress status createdAt');

    // Get user name for filename
    const user = await User.findById(userId).select('name');

    // Build CSV
    const headers = [
      'Date & Time',
      'Action',
      'Description',
      'Status',
      'IP Address'
    ];

    const csvRows = [headers.join(',')];

    const formatDate = (date) => {
      if (!date) return 'N/A';
      const d = new Date(date);
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    };

    activities.forEach(activity => {
      const row = [
        formatDate(activity.createdAt),
        `"${activity.action}"`,
        `"${activity.description || 'N/A'}"`,
        activity.status || 'N/A',
        activity.ipAddress || 'N/A'
      ];
      csvRows.push(row.join(','));
    });

    const csv = csvRows.join('\n');
    const timestamp = new Date().toISOString().split('T')[0];
    const username = user ? user.name.replace(/\s+/g, '-').toLowerCase() : 'user';
    const filename = `activity-${username}-${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);

  } catch (error) {
    console.error('Export activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting activity logs'
    });
  }
};

// @route   POST /api/admin/users
// @desc    Create new admin user
// @access  Private (Super Admin or Admin with users.create permission)
const createUser = async (req, res) => {
  try {
    const { name, email, password, role, customRoleId, department } = req.body;
    const clientIP = getClientIP(req);

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

    // Validate password against dynamic security settings
    const pwdCheck = await validatePassword(password);
    if (!pwdCheck.valid) {
      return res.status(400).json({
        success: false,
        message: pwdCheck.message
      });
    }

    // Only super admin can create super admin
    if (role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only super admin can create another super admin'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Validate custom role if provided
    let customRole = null;
    if (role === 'custom' && customRoleId) {
      customRole = await CustomRole.findById(customRoleId);
      if (!customRole) {
        return res.status(400).json({
          success: false,
          message: 'Custom role not found'
        });
      }
    }

    // Create new admin user
    const user = new User({
      name,
      email,
      password,
      accountType: 'admin',
      role: role || 'viewer',
      customRole: customRoleId || null,
      department,
      status: 'active',
      isEmailVerified: true, // Admins don't need email verification
      assignedBy: req.userId,
      createdBy: req.userId,
      // Non-super-admin users must change password on first login
      passwordChangeRequired: role !== 'super_admin'
    });

    await user.save();

    // Log activity
    await ActivityLog.logActivity({
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'user_created',
      actionType: 'create',
      targetModel: 'User',
      targetId: user._id,
      targetName: user.name,
      description: `Created new admin user: ${user.email}`,
      metadata: { userRole: user.role, department: user.department },
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    // Create notification for new admin
    await Notification.createNotification({
      recipientId: user._id,
      recipientType: 'admin',
      type: 'welcome',
      title: 'Welcome to Admin Panel',
      message: `Your admin account has been created by ${req.user.name}. Your role is: ${user.role}`,
      priority: 'high'
    });

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        status: user.status
      }
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating user'
    });
  }
};

// @route   PUT /api/admin/users/:id
// @desc    Update user
// @access  Private (Admin with users.edit permission)
const updateUser = async (req, res) => {
  try {
    const { name, role, customRoleId, department, status, plan, avatar } = req.body;
    const clientIP = getClientIP(req);

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent editing super admin by non-super admin
    if (user.role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only super admin can edit another super admin'
      });
    }

    // Only super admin can assign super admin role
    if (role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only super admin can assign super admin role'
      });
    }

    // Validate custom role if provided
    if (role === 'custom' && customRoleId) {
      const customRole = await CustomRole.findById(customRoleId);
      if (!customRole) {
        return res.status(400).json({
          success: false,
          message: 'Custom role not found'
        });
      }
      user.customRole = customRoleId;
    }

    // Update fields
    if (name) user.name = name;
    if (role) user.role = role;
    if (department !== undefined) user.department = department;
    if (status) user.status = status;
    if (avatar !== undefined) user.avatar = avatar || null;
    if (plan && user.accountType === 'customer') {
      user.plan = plan;
      user.updateAnalysisLimit();
    }

    await user.save();

    // Log activity
    await ActivityLog.logActivity({
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'user_updated',
      actionType: 'update',
      targetModel: 'User',
      targetId: user._id,
      targetName: user.name,
      description: `Updated user: ${user.email}`,
      metadata: req.body,
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    // Notify user of changes
    await Notification.createNotification({
      recipientId: user._id,
      type: 'admin_message',
      title: 'Account Updated',
      message: `Your account has been updated by ${req.user.name}`,
      priority: 'medium'
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        plan: user.plan
      }
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user'
    });
  }
};

// @route   DELETE /api/admin/users/:id
// @desc    Delete user
// @access  Private (Super Admin or Admin with users.delete permission)
const deleteUser = async (req, res) => {
  try {
    const clientIP = getClientIP(req);

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deleting super admin by non-super admin
    if (user.role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only super admin can delete another super admin'
      });
    }

    // Prevent self-deletion
    if (user._id.toString() === req.userId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    const userName = user.name;
    const userEmail = user.email;

    await user.deleteOne();

    // Log activity
    await ActivityLog.logActivity({
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'user_deleted',
      actionType: 'delete',
      targetModel: 'User',
      targetId: req.params.id,
      targetName: userName,
      description: `Deleted user: ${userEmail}`,
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user'
    });
  }
};

// @route   POST /api/admin/users/:id/suspend
// @desc    Suspend user
// @access  Private (Admin with users.suspend permission)
const suspendUser = async (req, res) => {
  try {
    const { reason } = req.body;
    const clientIP = getClientIP(req);
    
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent suspending super admin
    if (user.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot suspend super admin'
      });
    }

    user.status = 'suspended';
    await user.save();

    // Log activity
    await ActivityLog.logActivity({
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'user_suspended',
      actionType: 'update',
      targetModel: 'User',
      targetId: user._id,
      targetName: user.name,
      description: `Suspended user: ${user.email}${reason ? ` - Reason: ${reason}` : ''}`,
      metadata: { reason },
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    // Notify user
    await Notification.createNotification({
      recipientId: user._id,
      type: 'account_suspended',
      title: 'Account Suspended',
      message: reason || 'Your account has been suspended. Please contact support for more information.',
      priority: 'urgent'
    });

    res.json({
      success: true,
      message: 'User suspended successfully'
    });

  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error suspending user'
    });
  }
};

// @route   POST /api/admin/users/:id/activate
// @desc    Activate user
// @access  Private (Admin with users.activate permission)
const activateUser = async (req, res) => {
  try {
    const clientIP = getClientIP(req);

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.status = 'active';
    await user.save();

    // Log activity
    await ActivityLog.logActivity({
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'user_activated',
      actionType: 'update',
      targetModel: 'User',
      targetId: user._id,
      targetName: user.name,
      description: `Activated user: ${user.email}`,
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    // Notify user
    await Notification.createNotification({
      recipientId: user._id,
      type: 'account_activated',
      title: 'Account Activated',
      message: 'Your account has been activated. You can now access all features.',
      priority: 'high'
    });

    res.json({
      success: true,
      message: 'User activated successfully'
    });

  } catch (error) {
    console.error('Activate user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error activating user'
    });
  }
};

// @route   POST /api/admin/users/bulk-delete
// @desc    Delete multiple admin users at once
// @access  Private (Admin with users.delete permission)
const bulkDeleteUsers = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide user IDs to delete' });
    }

    const clientIP = getClientIP(req);

    // Filter out: self, super_admins (if requester is not super_admin)
    const users = await User.find({ _id: { $in: ids } });
    const toDelete = users.filter(u => {
      if (u._id.toString() === req.userId.toString()) return false; // no self-delete
      if (u.role === 'super_admin' && req.user.role !== 'super_admin') return false;
      return true;
    });

    if (toDelete.length === 0) {
      return res.status(400).json({ success: false, message: 'No eligible users to delete' });
    }

    const deleteIds = toDelete.map(u => u._id);
    await User.deleteMany({ _id: { $in: deleteIds } });

    await ActivityLog.logActivity({
      userId: req.userId, userName: req.user.name, userEmail: req.user.email, userRole: req.user.role,
      action: 'users_bulk_deleted', actionType: 'delete', targetModel: 'User',
      description: `Bulk deleted ${toDelete.length} users`,
      metadata: { deletedCount: toDelete.length, emails: toDelete.map(u => u.email) },
      ipAddress: clientIP, userAgent: req.get('user-agent'), status: 'success',
    });

    res.json({ success: true, message: `${toDelete.length} user(s) deleted successfully`, deletedCount: toDelete.length });
  } catch (error) {
    console.error('Bulk delete users error:', error);
    res.status(500).json({ success: false, message: 'Error deleting users' });
  }
};

module.exports = {
  getUsers,
  exportUsersCSV,
  getLoginHistory,
  getUserById,
  exportUserActivityCSV,
  createUser,
  updateUser,
  deleteUser,
  suspendUser,
  activateUser,
  bulkDeleteUsers
};
