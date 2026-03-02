const Department = require('../../models/admin/Department');
const User = require('../../models/user/User');
const ActivityLog = require('../../models/admin/ActivityLog');
const { getClientIP } = require('../../utils/helpers/ipHelper');

/**
 * GET /api/v1/admin/departments
 * Get all departments
 */
const getDepartments = async (req, res) => {
  try {
    const { active, search } = req.query;
    
    let query = {};
    
    // Filter by active status if specified
    if (active !== undefined) {
      query.isActive = active === 'true';
    }
    
    // Search by name
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    
    const departments = await Department.find(query)
      .sort({ name: 1 });
    
    // Get user count for each department
    const departmentsWithCounts = await Promise.all(
      departments.map(async (dept) => {
        const userCount = await User.countDocuments({ department: dept.value });
        return {
          ...dept.toJSON(),
          userCount
        };
      })
    );
    
    res.json({
      success: true,
      departments: departmentsWithCounts
    });
    
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching departments'
    });
  }
};

/**
 * GET /api/v1/admin/departments/active
 * Get active departments only
 */
const getActiveDepartments = async (req, res) => {
  try {
    const departments = await Department.getActive();
    
    res.json({
      success: true,
      departments: departments.map(dept => ({
        value: dept.value,
        label: dept.name
      }))
    });
    
  } catch (error) {
    console.error('Get active departments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching active departments'
    });
  }
};

/**
 * GET /api/v1/admin/departments/:id
 * Get department by ID
 */
const getDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }
    
    // Get count of users in this department
    const userCount = await User.countDocuments({ department: department.value });
    
    res.json({
      success: true,
      department: {
        ...department.toJSON(),
        userCount
      }
    });
    
  } catch (error) {
    console.error('Get department error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching department'
    });
  }
};

/**
 * POST /api/v1/admin/departments
 * Create new department
 */
const createDepartment = async (req, res) => {
  try {
    const { name, description } = req.body;
    const clientIP = getClientIP(req);
    
    // Validation
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Department name is required'
      });
    }
    
    // Generate value from name (lowercase, replace spaces with underscores)
    const value = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    
    // Check if department with same value already exists
    const existing = await Department.findOne({ value });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A department with similar name already exists'
      });
    }
    
    const department = new Department({
      name,
      value,
      description,
      createdBy: req.userId
    });
    
    await department.save();
    
    // Log activity
    const user = await User.findById(req.userId);
    await ActivityLog.logActivity({
      userId: req.userId,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: 'settings_updated',
      actionType: 'create',
      targetModel: 'Settings',
      targetId: department._id,
      targetName: department.name,
      description: `Created department: ${department.name}`,
      ipAddress: clientIP,
      userAgent: req.headers['user-agent'],
      status: 'success'
    });
    
    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      department: department.toJSON()
    });
    
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating department'
    });
  }
};

/**
 * PUT /api/v1/admin/departments/:id
 * Update department
 */
const updateDepartment = async (req, res) => {
  try {
    const { name, description, isActive } = req.body;
    const clientIP = getClientIP(req);
    
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }
    
    // Prevent deactivating default departments
    if (department.isDefault && isActive === false) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate default department'
      });
    }
    
    // Update fields
    if (name) {
      department.name = name;
      // Update value if name changed
      const newValue = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      
      // Check if new value conflicts with another department
      if (newValue !== department.value) {
        const existing = await Department.findOne({ value: newValue, _id: { $ne: department._id } });
        if (existing) {
          return res.status(400).json({
            success: false,
            message: 'A department with similar name already exists'
          });
        }
        
        // Update all users with old value to new value
        await User.updateMany(
          { department: department.value },
          { $set: { department: newValue } }
        );
        
        department.value = newValue;
      }
    }
    
    if (description !== undefined) department.description = description;
    if (isActive !== undefined) department.isActive = isActive;
    department.updatedBy = req.userId;
    
    await department.save();
    
    // Log activity
    const user = await User.findById(req.userId);
    await ActivityLog.logActivity({
      userId: req.userId,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: 'settings_updated',
      actionType: 'update',
      targetModel: 'Settings',
      targetId: department._id,
      targetName: department.name,
      description: `Updated department: ${department.name}`,
      ipAddress: clientIP,
      userAgent: req.headers['user-agent'],
      status: 'success'
    });
    
    res.json({
      success: true,
      message: 'Department updated successfully',
      department: department.toJSON()
    });
    
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating department'
    });
  }
};

/**
 * DELETE /api/v1/admin/departments/:id
 * Delete department
 */
const deleteDepartment = async (req, res) => {
  try {
    const clientIP = getClientIP(req);
    
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }
    
    // Prevent deleting default departments
    if (department.isDefault) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete default department'
      });
    }
    
    // Check if department is in use
    const userCount = await User.countDocuments({ department: department.value });
    if (userCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete department. ${userCount} user(s) are assigned to this department.`
      });
    }
    
    const departmentName = department.name;
    await department.deleteOne();
    
    // Log activity
    const user = await User.findById(req.userId);
    await ActivityLog.logActivity({
      userId: req.userId,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: 'settings_updated',
      actionType: 'delete',
      targetModel: 'Settings',
      targetName: departmentName,
      description: `Deleted department: ${departmentName}`,
      ipAddress: clientIP,
      userAgent: req.headers['user-agent'],
      status: 'success'
    });
    
    res.json({
      success: true,
      message: 'Department deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting department'
    });
  }
};

/**
 * POST /api/v1/admin/departments/seed/default
 * Seed default departments (one-time setup)
 */
const seedDefaultDepartments = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    // Only super admin can seed
    if (user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only super admin can seed default departments'
      });
    }
    
    const defaultDepartments = [
      { name: 'Customer Support', value: 'support', description: 'Customer service and support', isDefault: true },
      { name: 'Product Management', value: 'product', description: 'Product planning and management', isDefault: true },
      { name: 'Operations', value: 'operations', description: 'Business operations', isDefault: true },
      { name: 'Executive', value: 'executive', description: 'Executive leadership', isDefault: true },
    ];
    
    let created = 0;
    let skipped = 0;
    
    for (const dept of defaultDepartments) {
      const existing = await Department.findOne({ value: dept.value });
      if (!existing) {
        await Department.create({
          ...dept,
          createdBy: req.userId
        });
        created++;
      } else {
        skipped++;
      }
    }
    
    res.json({
      success: true,
      message: `Seeding complete. Created: ${created}, Skipped: ${skipped}`,
      stats: { created, skipped, total: defaultDepartments.length }
    });
    
  } catch (error) {
    console.error('Seed departments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error seeding departments'
    });
  }
};

module.exports = {
  getDepartments,
  getActiveDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  seedDefaultDepartments,
};
