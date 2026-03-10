const { User, CustomRole } = require('../../models/user');
const { ActivityLog } = require('../../models/admin');
const { getClientIP } = require('../../utils/helpers/ipHelper');
const { safeSave, safeActivityLog } = require('../../utils/helpers/safeDbOps');

// @desc    Get all custom roles
const getRoles = async (req, res) => {
  try {
    const roles = await CustomRole.find()
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ createdAt: -1 });

    // Get built-in roles info
    const builtInRoles = [
      {
        name: 'super_admin',
        description: 'Full system access with all permissions',
        permissions: ['*'],
        isBuiltIn: true,
        isActive: true
      },
      {
        name: 'admin',
        description: 'Administrative access (cannot manage roles)',
        permissions: [
          'users.view', 'users.create', 'users.edit', 'users.delete',
          'customers.view', 'customers.edit', 'customers.suspend',
          'analytics.view', 'logs.view',
          'settings.view', 'settings.edit'
        ],
        isBuiltIn: true,
        isActive: true
      },
      {
        name: 'moderator',
        description: 'Can manage customers and view analytics',
        permissions: [
          'users.view', 'customers.view', 'customers.edit',
          'analytics.view'
        ],
        isBuiltIn: true,
        isActive: true
      },
      {
        name: 'viewer',
        description: 'Read-only access to users, customers, and analytics',
        permissions: [
          'users.view', 'customers.view', 'analytics.view'
        ],
        isBuiltIn: true,
        isActive: true
      }
    ];

    res.json({
      success: true,
      builtInRoles,
      customRoles: roles.map(role => ({
        id: role._id,
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        isActive: role.isActive,
        createdBy: role.createdBy,
        updatedBy: role.updatedBy,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt
      })),
      availablePermissions: CustomRole.availablePermissions
    });

  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching roles'
    });
  }
};

// @desc    Get single custom role
const getRole = async (req, res) => {
  try {
    const role = await CustomRole.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Get users with this role
    const usersWithRole = await User.find({ customRole: role._id })
      .select('name email accountType status')
      .limit(10);

    const totalUsersWithRole = await User.countDocuments({ customRole: role._id });

    res.json({
      success: true,
      role: {
        id: role._id,
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        isActive: role.isActive,
        createdBy: role.createdBy,
        updatedBy: role.updatedBy,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt
      },
      usersWithRole,
      totalUsersWithRole
    });

  } catch (error) {
    console.error('Get role error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching role'
    });
  }
};

// @desc    Create custom role
const createRole = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    const clientIP = getClientIP(req);

    if (!name || !permissions || !Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide role name and permissions array'
      });
    }

    // Validate permissions
    const validPermissions = CustomRole.availablePermissions;
    const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));
    
    if (invalidPermissions.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid permissions',
        invalidPermissions
      });
    }

    // Check if role name already exists
    const existingRole = await CustomRole.findOne({ 
      name: name.toLowerCase().replace(/\s+/g, '_') 
    });
    
    if (existingRole) {
      return res.status(400).json({
        success: false,
        message: 'Role with this name already exists'
      });
    }

    const role = new CustomRole({
      name: name.toLowerCase().replace(/\s+/g, '_'),
      description,
      permissions,
      createdBy: req.userId
    });

    await safeSave(role);

    // Log activity
    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'role_created',
      actionType: 'create',
      targetModel: 'CustomRole',
      targetId: role._id,
      targetName: role.name,
      description: `Created custom role: ${role.name}`,
      metadata: { permissions: role.permissions },
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.status(201).json({
      success: true,
      message: 'Custom role created successfully',
      role: {
        id: role._id,
        name: role.name,
        description: role.description,
        permissions: role.permissions
      }
    });

  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating role'
    });
  }
};

// @desc    Update custom role
const updateRole = async (req, res) => {
  try {
    const { name, description, permissions, isActive } = req.body;
    const clientIP = getClientIP(req);

    const role = await CustomRole.findById(req.params.id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Validate permissions if provided
    if (permissions && Array.isArray(permissions)) {
      const validPermissions = CustomRole.availablePermissions;
      const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));
      
      if (invalidPermissions.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid permissions',
          invalidPermissions
        });
      }
      role.permissions = permissions;
    }

    if (name) role.name = name.toLowerCase().replace(/\s+/g, '_');
    if (description !== undefined) role.description = description;
    if (isActive !== undefined) role.isActive = isActive;
    role.updatedBy = req.userId;

    await safeSave(role);

    // Log activity
    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'role_updated',
      actionType: 'update',
      targetModel: 'CustomRole',
      targetId: role._id,
      targetName: role.name,
      description: `Updated custom role: ${role.name}`,
      metadata: req.body,
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      message: 'Role updated successfully',
      role: {
        id: role._id,
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        isActive: role.isActive
      }
    });

  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating role'
    });
  }
};

// @desc    Delete custom role
const deleteRole = async (req, res) => {
  try {
    const clientIP = getClientIP(req);

    const role = await CustomRole.findById(req.params.id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Check if any users have this role
    const usersWithRole = await User.countDocuments({ customRole: role._id });
    
    if (usersWithRole > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete role. ${usersWithRole} user(s) currently have this role.`,
        usersWithRole
      });
    }

    const roleName = role.name;
    await role.deleteOne();

    // Log activity
    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'role_deleted',
      actionType: 'delete',
      targetModel: 'CustomRole',
      targetId: req.params.id,
      targetName: roleName,
      description: `Deleted custom role: ${roleName}`,
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      message: 'Role deleted successfully'
    });

  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting role'
    });
  }
};

// @desc    Get all available permissions
const getAvailablePermissions = async (req, res) => {
  try {
    const permissions = CustomRole.availablePermissions;
    
    // Group permissions by category
    const groupedPermissions = {
      users: permissions.filter(p => p.startsWith('users.')),
      customers: permissions.filter(p => p.startsWith('customers.')),
      roles: permissions.filter(p => p.startsWith('roles.')),
      analytics: permissions.filter(p => p.startsWith('analytics.')),
      logs: permissions.filter(p => p.startsWith('logs.')),
      settings: permissions.filter(p => p.startsWith('settings.')),
      notifications: permissions.filter(p => p.startsWith('notifications.')),
      system: permissions.filter(p => p.startsWith('system.'))
    };

    res.json({
      success: true,
      permissions,
      groupedPermissions
    });

  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching permissions'
    });
  }
};

// @desc    Delete multiple custom roles at once
const bulkDeleteRoles = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide role IDs to delete' });
    }
    // Only delete custom roles (not built-in)
    const roles = await CustomRole.find({ _id: { $in: ids } });
    if (roles.length === 0) {
      return res.status(404).json({ success: false, message: 'No custom roles found with provided IDs' });
    }
    // Check no users are assigned to these roles
    const usersWithRoles = await User.countDocuments({ customRoleId: { $in: ids } });
    if (usersWithRoles > 0) {
      return res.status(400).json({ success: false, message: 'Some selected roles have users assigned. Reassign them first.' });
    }
    const roleIds = roles.map(r => r._id);
    await CustomRole.deleteMany({ _id: { $in: roleIds } });
    await safeActivityLog(ActivityLog, {
      userId: req.userId, userName: req.user.name, userEmail: req.user.email, userRole: req.user.role,
      action: 'roles_bulk_deleted', actionType: 'delete', targetModel: 'CustomRole',
      description: `Bulk deleted ${roles.length} custom roles`,
      ipAddress: getClientIP(req), userAgent: req.get('user-agent'), status: 'success',
    });
    res.json({ success: true, message: `${roles.length} role(s) deleted successfully`, deletedCount: roles.length });
  } catch (error) {
    console.error('Bulk delete roles error:', error);
    res.status(500).json({ success: false, message: 'Error deleting roles' });
  }
};

module.exports = {
  getRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  getAvailablePermissions,
  bulkDeleteRoles
};
