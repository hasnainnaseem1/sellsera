const { Feature } = require('../../models/subscription');
const { ActivityLog } = require('../../models/admin');
const { Plan } = require('../../models/subscription');
const { getClientIP } = require('../../utils/helpers/ipHelper');
const { safeSave, safeActivityLog } = require('../../utils/helpers/safeDbOps');

/**
 * List all features (paginated, filterable)
 */
const listFeatures = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      isActive,
      category,
      type,
      sort = 'displayOrder',
      order = 'asc',
      search,
    } = req.query;

    const query = {};

    // Handle multiple isActive values (e.g., "true,false" for multiselect)
    if (isActive !== undefined) {
      const activeValues = isActive.split(',').map(val => val === 'true');
      if (activeValues.length === 1) {
        query.isActive = activeValues[0];
      } else {
        query.isActive = { $in: activeValues };
      }
    }
    
    if (category) {
      query.category = { $regex: category, $options: 'i' };
    }
    
    // Handle multiple type values (e.g., "boolean,numeric" for multiselect)
    if (type) {
      const typeValues = type.split(',');
      if (typeValues.length === 1) {
        query.type = typeValues[0];
      } else {
        query.type = { $in: typeValues };
      }
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { featureKey: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = { [sort]: order === 'desc' ? -1 : 1 };

    const [features, total] = await Promise.all([
      Feature.find(query).sort(sortObj).skip(skip).limit(parseInt(limit)).lean(),
      Feature.countDocuments(query),
    ]);

    // Count how many plans use each feature
    const featuresWithUsage = await Promise.all(
      features.map(async (feature) => {
        const planCount = await Plan.countDocuments({
          'features.featureId': feature._id,
        });
        return { ...feature, planCount };
      })
    );

    res.json({
      success: true,
      features: featuresWithUsage,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('List features error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch features' });
  }
};

/**
 * Get a single feature by ID
 */
const getFeature = async (req, res) => {
  try {
    const feature = await Feature.findById(req.params.id).lean();
    if (!feature) {
      return res.status(404).json({ success: false, message: 'Feature not found' });
    }

    const planCount = await Plan.countDocuments({ 'features.featureId': feature._id });

    res.json({ success: true, feature: { ...feature, planCount } });
  } catch (error) {
    console.error('Get feature error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch feature' });
  }
};

/**
 * Create a new feature
 */
const createFeature = async (req, res) => {
  try {
    const { name, featureKey, description, type, defaultValue, unit, category, isActive, displayOrder } = req.body;

    // Check uniqueness
    const existingName = await Feature.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existingName) {
      return res.status(400).json({ success: false, message: 'A feature with this name already exists' });
    }
    const existingKey = await Feature.findOne({ featureKey: featureKey.toLowerCase() });
    if (existingKey) {
      return res.status(400).json({ success: false, message: 'A feature with this key already exists' });
    }

    const feature = new Feature({
      name,
      featureKey: featureKey.toLowerCase(),
      description: description || '',
      type: type || 'boolean',
      defaultValue: defaultValue !== undefined ? defaultValue : (type === 'numeric' ? 0 : type === 'text' ? '' : false),
      unit: unit || '',
      category: category || 'General',
      isActive: isActive !== undefined ? isActive : true,
      displayOrder: displayOrder || 0,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    await safeSave(feature);

    await safeActivityLog(ActivityLog, {
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'feature_created',
      actionType: 'create',
      targetModel: 'Feature',
      targetId: feature._id,
      targetName: feature.name,
      description: `Created feature: ${feature.name} (${feature.featureKey})`,
      metadata: { featureKey: feature.featureKey, type: feature.type },
      ipAddress: getClientIP(req),
      userAgent: req.get('user-agent'),
      status: 'success',
    });

    res.status(201).json({ success: true, message: 'Feature created successfully', feature });
  } catch (error) {
    console.error('Create feature error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Feature name or key already exists' });
    }
    res.status(500).json({ success: false, message: 'Failed to create feature' });
  }
};

/**
 * Update a feature
 */
const updateFeature = async (req, res) => {
  try {
    const feature = await Feature.findById(req.params.id);
    if (!feature) {
      return res.status(404).json({ success: false, message: 'Feature not found' });
    }

    const { name, description, type, defaultValue, unit, category, isActive, displayOrder } = req.body;

    if (name && name !== feature.name) {
      const existing = await Feature.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') }, _id: { $ne: feature._id } });
      if (existing) {
        return res.status(400).json({ success: false, message: 'A feature with this name already exists' });
      }
      feature.name = name;
    }

    // featureKey is immutable after creation
    if (description !== undefined) feature.description = description;
    if (type !== undefined) feature.type = type;
    if (defaultValue !== undefined) feature.defaultValue = defaultValue;
    if (unit !== undefined) feature.unit = unit;
    if (category !== undefined) feature.category = category;
    if (isActive !== undefined) feature.isActive = isActive;
    if (displayOrder !== undefined) feature.displayOrder = displayOrder;

    feature.updatedBy = req.user._id;
    await safeSave(feature);

    // Update denormalized feature name in all plans that reference this feature
    if (name && name !== feature.name) {
      await Plan.updateMany(
        { 'features.featureId': feature._id },
        { $set: { 'features.$[elem].featureName': feature.name } },
        { arrayFilters: [{ 'elem.featureId': feature._id }] }
      );
    }

    await safeActivityLog(ActivityLog, {
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'feature_updated',
      actionType: 'update',
      targetModel: 'Feature',
      targetId: feature._id,
      targetName: feature.name,
      description: `Updated feature: ${feature.name}`,
      metadata: { changes: req.body },
      ipAddress: getClientIP(req),
      userAgent: req.get('user-agent'),
      status: 'success',
    });

    res.json({ success: true, message: 'Feature updated successfully', feature });
  } catch (error) {
    console.error('Update feature error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Feature name already exists' });
    }
    res.status(500).json({ success: false, message: 'Failed to update feature' });
  }
};

/**
 * Delete a feature
 */
const deleteFeature = async (req, res) => {
  try {
    const feature = await Feature.findById(req.params.id);
    if (!feature) {
      return res.status(404).json({ success: false, message: 'Feature not found' });
    }

    // Check if any plans use this feature
    const planCount = await Plan.countDocuments({ 'features.featureId': feature._id });
    if (planCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete feature: it is used in ${planCount} plan(s). Remove it from all plans first.`,
        planCount,
      });
    }

    const featureName = feature.name;
    await Feature.findByIdAndDelete(feature._id);

    await safeActivityLog(ActivityLog, {
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'feature_deleted',
      actionType: 'delete',
      targetModel: 'Feature',
      targetId: feature._id,
      targetName: featureName,
      description: `Deleted feature: ${featureName}`,
      ipAddress: getClientIP(req),
      userAgent: req.get('user-agent'),
      status: 'success',
    });

    res.json({ success: true, message: `Feature "${featureName}" deleted successfully` });
  } catch (error) {
    console.error('Delete feature error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete feature' });
  }
};

/**
 * Toggle feature active/inactive
 */
const toggleFeatureStatus = async (req, res) => {
  try {
    const feature = await Feature.findById(req.params.id);
    if (!feature) {
      return res.status(404).json({ success: false, message: 'Feature not found' });
    }

    feature.isActive = !feature.isActive;
    feature.updatedBy = req.user._id;
    await safeSave(feature);

    await safeActivityLog(ActivityLog, {
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'feature_updated',
      actionType: 'update',
      targetModel: 'Feature',
      targetId: feature._id,
      targetName: feature.name,
      description: `${feature.isActive ? 'Activated' : 'Deactivated'} feature: ${feature.name}`,
      ipAddress: getClientIP(req),
      userAgent: req.get('user-agent'),
      status: 'success',
    });

    res.json({ success: true, message: `Feature ${feature.isActive ? 'activated' : 'deactivated'} successfully`, feature });
  } catch (error) {
    console.error('Toggle feature status error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle feature status' });
  }
};

/**
 * Export features to CSV
 */
const exportFeatures = async (req, res) => {
  try {
    const { isActive, type, search } = req.query;
    const query = {};

    // Handle multiple isActive values (e.g., "true,false" for multiselect)
    if (isActive !== undefined) {
      const activeValues = isActive.split(',').map(val => val === 'true');
      if (activeValues.length === 1) {
        query.isActive = activeValues[0];
      } else {
        query.isActive = { $in: activeValues };
      }
    }

    // Handle multiple type values (e.g., "boolean,numeric" for multiselect)
    if (type) {
      const typeValues = type.split(',');
      if (typeValues.length === 1) {
        query.type = typeValues[0];
      } else {
        query.type = { $in: typeValues };
      }
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { featureKey: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const features = await Feature.find(query)
      .sort({ displayOrder: 1, name: 1 })
      .lean();

    // Attach plan counts
    const featuresWithCounts = await Promise.all(
      features.map(async (feature) => {
        const planCount = await Plan.countDocuments({ 'features.featureId': feature._id });
        return { ...feature, planCount };
      })
    );

    // Build CSV
    const headers = [
      'Feature Name', 'Feature Key', 'Type', 'Category', 'Description', 'Unit',
      'Default Value', 'Display Order', 'Status', 'Plans Using'
    ];

    const rows = featuresWithCounts.map((feature) => [
      feature.name || '',
      feature.featureKey || '',
      feature.type || '',
      feature.category || '',
      (feature.description || '').replace(/"/g, '""'),
      feature.unit || '',
      feature.defaultValue !== undefined ? feature.defaultValue : '',
      feature.displayOrder || 0,
      feature.isActive ? 'Active' : 'Inactive',
      feature.planCount || 0
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))
    ].join('\n');

    const fileName = `features-export-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Export features error:', error);
    res.status(500).json({ success: false, message: 'Failed to export features' });
  }
};

/**
 * Bulk delete features
 */
const bulkDeleteFeatures = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide feature IDs to delete' });
    }
    const result = await Feature.deleteMany({ _id: { $in: ids } });
    await safeActivityLog(ActivityLog, {
      userId: req.userId, userName: req.user.name, userEmail: req.user.email, userRole: req.user.role,
      action: 'features_bulk_deleted', actionType: 'delete', targetModel: 'Feature',
      description: `Bulk deleted ${result.deletedCount} features`,
      ipAddress: getClientIP(req), userAgent: req.get('user-agent'), status: 'success',
    });
    res.json({ success: true, message: `${result.deletedCount} feature(s) deleted successfully`, deletedCount: result.deletedCount });
  } catch (error) {
    console.error('Bulk delete features error:', error);
    res.status(500).json({ success: false, message: 'Error deleting features' });
  }
};

module.exports = {
  listFeatures,
  getFeature,
  createFeature,
  updateFeature,
  deleteFeature,
  toggleFeatureStatus,
  exportFeatures,
  bulkDeleteFeatures,
};
