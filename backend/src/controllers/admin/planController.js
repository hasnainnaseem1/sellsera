const { Plan, Feature } = require('../../models/subscription');
const { ActivityLog } = require('../../models/admin');
const User = require('../../models/user/User');
const { getClientIP } = require('../../utils/helpers/ipHelper');

/**
 * List all plans (paginated, filterable)
 */
const listPlans = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      isActive,
      sort = 'displayOrder',
      order = 'asc',
      search
    } = req.query;

    const query = {};

    // Handle multiple isActive values (e.g., "true,false" for multiselect OR logic)
    if (isActive !== undefined) {
      const activeValues = isActive.split(',').map(val => val === 'true');
      if (activeValues.length === 1) {
        query.isActive = activeValues[0];
      } else {
        query.isActive = { $in: activeValues };
      }
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = { [sort]: order === 'desc' ? -1 : 1 };

    const [plans, total] = await Promise.all([
      Plan.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Plan.countDocuments(query)
    ]);

    // Attach customer counts to each plan
    const plansWithCounts = await Promise.all(
      plans.map(async (plan) => {
        const customerCount = await User.countDocuments({
          accountType: 'customer',
          currentPlan: plan._id
        });
        return { ...plan, customerCount };
      })
    );

    res.json({
      success: true,
      plans: plansWithCounts,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('List plans error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch plans' });
  }
};

/**
 * Get a single plan by ID
 */
const getPlan = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id).lean();

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    // Customer count
    const customerCount = await User.countDocuments({
      accountType: 'customer',
      currentPlan: plan._id
    });

    res.json({
      success: true,
      plan: { ...plan, customerCount }
    });
  } catch (error) {
    console.error('Get plan error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch plan' });
  }
};

/**
 * Create a new plan
 */
const createPlan = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      currency,
      billingCycle,
      isActive,
      isDefault,
      displayOrder,
      features,
      trialDays,
      metadata
    } = req.body;

    // Check uniqueness
    const existing = await Plan.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'A plan with this name already exists' });
    }

    // Build features array with denormalized data
    let planFeatures = [];
    if (features && features.length > 0) {
      const featureIds = features.map(f => f.featureId);
      const featureDocs = await Feature.find({ _id: { $in: featureIds } }).lean();
      const featureMap = {};
      featureDocs.forEach(f => { featureMap[f._id.toString()] = f; });

      planFeatures = features.map(f => {
        const doc = featureMap[f.featureId];
        if (!doc) return null;
        return {
          featureId: doc._id,
          featureKey: doc.featureKey,
          featureName: doc.name,
          enabled: f.enabled !== undefined ? f.enabled : true,
          limit: f.limit !== undefined ? f.limit : null,
          value: f.value !== undefined ? f.value : null
        };
      }).filter(Boolean);
    }

    const plan = new Plan({
      name,
      description,
      price: price || { monthly: 0, yearly: 0 },
      currency,
      billingCycle,
      isActive: isActive !== undefined ? isActive : true,
      isDefault: isDefault || false,
      displayOrder: displayOrder || 0,
      features: planFeatures,
      trialDays: trialDays || 0,
      metadata: metadata || {},
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    await plan.save();

    // Log activity
    await ActivityLog.logActivity({
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'plan_created',
      actionType: 'create',
      targetModel: 'Plan',
      targetId: plan._id,
      targetName: plan.name,
      description: `Created plan: ${plan.name} ($${plan.price.monthly}/mo)`,
      metadata: { planId: plan._id, planName: plan.name, price: plan.price },
      ipAddress: getClientIP(req),
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.status(201).json({
      success: true,
      message: 'Plan created successfully',
      plan
    });
  } catch (error) {
    console.error('Create plan error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'A plan with this name already exists' });
    }
    res.status(500).json({ success: false, message: 'Failed to create plan' });
  }
};

/**
 * Update an existing plan
 */
const updatePlan = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    const {
      name,
      description,
      price,
      currency,
      billingCycle,
      isActive,
      isDefault,
      displayOrder,
      features,
      trialDays,
      metadata
    } = req.body;

    // Check name uniqueness if name is changing
    if (name && name !== plan.name) {
      const existing = await Plan.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: plan._id }
      });
      if (existing) {
        return res.status(400).json({ success: false, message: 'A plan with this name already exists' });
      }
      plan.name = name;
    }

    if (description !== undefined) plan.description = description;
    if (price !== undefined) plan.price = price;
    if (currency !== undefined) plan.currency = currency;
    if (billingCycle !== undefined) plan.billingCycle = billingCycle;
    if (isActive !== undefined) plan.isActive = isActive;
    if (isDefault !== undefined) plan.isDefault = isDefault;
    if (displayOrder !== undefined) plan.displayOrder = displayOrder;
    if (trialDays !== undefined) plan.trialDays = trialDays;
    if (metadata !== undefined) plan.metadata = metadata;

    // Update features if provided
    if (features !== undefined) {
      const featureIds = features.map(f => f.featureId);
      const featureDocs = await Feature.find({ _id: { $in: featureIds } }).lean();
      const featureMap = {};
      featureDocs.forEach(f => { featureMap[f._id.toString()] = f; });

      plan.features = features.map(f => {
        const doc = featureMap[f.featureId];
        if (!doc) return null;
        return {
          featureId: doc._id,
          featureKey: doc.featureKey,
          featureName: doc.name,
          enabled: f.enabled !== undefined ? f.enabled : true,
          limit: f.limit !== undefined ? f.limit : null,
          value: f.value !== undefined ? f.value : null
        };
      }).filter(Boolean);
    }

    plan.updatedBy = req.user._id;
    await plan.save();

    // Log activity
    await ActivityLog.logActivity({
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'plan_updated',
      actionType: 'update',
      targetModel: 'Plan',
      targetId: plan._id,
      targetName: plan.name,
      description: `Updated plan: ${plan.name}`,
      metadata: { planId: plan._id, changes: req.body },
      ipAddress: getClientIP(req),
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      message: 'Plan updated successfully',
      plan
    });
  } catch (error) {
    console.error('Update plan error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'A plan with this name already exists' });
    }
    res.status(500).json({ success: false, message: 'Failed to update plan' });
  }
};

/**
 * Delete a plan (requires reassigning customers)
 */
const deletePlan = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    // Count customers on this plan
    const customerCount = await User.countDocuments({
      accountType: 'customer',
      currentPlan: plan._id
    });

    if (customerCount > 0) {
      const { reassignToPlanId } = req.body;

      if (!reassignToPlanId) {
        // Return error with count — admin must choose a target plan
        return res.status(400).json({
          success: false,
          message: `Cannot delete plan: ${customerCount} customer(s) are currently on this plan. Provide reassignToPlanId to move them.`,
          customerCount,
          requiresReassignment: true
        });
      }

      // Validate target plan exists
      const targetPlan = await Plan.findById(reassignToPlanId);
      if (!targetPlan) {
        return res.status(400).json({ success: false, message: 'Target plan for reassignment not found' });
      }
      if (targetPlan._id.toString() === plan._id.toString()) {
        return res.status(400).json({ success: false, message: 'Cannot reassign customers to the same plan being deleted' });
      }

      // Build plan snapshot for the target plan
      const planSnapshot = {
        planId: targetPlan._id,
        planName: targetPlan.name,
        features: targetPlan.features.map(f => ({
          featureId: f.featureId,
          featureKey: f.featureKey,
          featureName: f.featureName,
          enabled: f.enabled,
          limit: f.limit,
          value: f.value
        })),
        assignedAt: new Date(),
        assignedBy: req.user._id
      };

      // Bulk reassign customers
      await User.updateMany(
        { accountType: 'customer', currentPlan: plan._id },
        {
          $set: {
            currentPlan: targetPlan._id,
            planSnapshot
          }
        }
      );
    }

    const planName = plan.name;
    await Plan.findByIdAndDelete(plan._id);

    // Log activity
    await ActivityLog.logActivity({
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'plan_deleted',
      actionType: 'delete',
      targetModel: 'Plan',
      targetId: plan._id,
      targetName: planName,
      description: `Deleted plan: ${planName}${customerCount > 0 ? ` (reassigned ${customerCount} customers)` : ''}`,
      metadata: { planName, customerCount, reassignToPlanId: req.body.reassignToPlanId },
      ipAddress: getClientIP(req),
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      message: `Plan "${planName}" deleted successfully${customerCount > 0 ? `. ${customerCount} customers reassigned.` : ''}`
    });
  } catch (error) {
    console.error('Delete plan error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete plan' });
  }
};

/**
 * Toggle plan active/inactive
 */
const togglePlanStatus = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    plan.isActive = !plan.isActive;
    plan.updatedBy = req.user._id;
    await plan.save();

    await ActivityLog.logActivity({
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'plan_updated',
      actionType: 'update',
      targetModel: 'Plan',
      targetId: plan._id,
      targetName: plan.name,
      description: `${plan.isActive ? 'Activated' : 'Deactivated'} plan: ${plan.name}`,
      ipAddress: getClientIP(req),
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      message: `Plan ${plan.isActive ? 'activated' : 'deactivated'} successfully`,
      plan
    });
  } catch (error) {
    console.error('Toggle plan status error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle plan status' });
  }
};

/**
 * Set a plan as the default for new signups
 */
const setDefaultPlan = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    if (!plan.isActive) {
      return res.status(400).json({ success: false, message: 'Cannot set an inactive plan as default' });
    }

    // Unset any current default
    await Plan.updateMany({ isDefault: true }, { $set: { isDefault: false } });

    plan.isDefault = true;
    plan.updatedBy = req.user._id;
    await plan.save();

    await ActivityLog.logActivity({
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'plan_updated',
      actionType: 'update',
      targetModel: 'Plan',
      targetId: plan._id,
      targetName: plan.name,
      description: `Set plan "${plan.name}" as default`,
      ipAddress: getClientIP(req),
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      message: `Plan "${plan.name}" set as default`,
      plan
    });
  } catch (error) {
    console.error('Set default plan error:', error);
    res.status(500).json({ success: false, message: 'Failed to set default plan' });
  }
};

/**
 * List all features (for plan form feature selection)
 */
const listFeatures = async (req, res) => {
  try {
    const { isActive } = req.query;
    const query = {};
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const features = await Feature.find(query)
      .sort({ displayOrder: 1, name: 1 })
      .lean();

    res.json({ success: true, features });
  } catch (error) {
    console.error('List features error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch features' });
  }
};

/**
 * Export plans to CSV
 */
const exportPlans = async (req, res) => {
  try {
    const { isActive, search } = req.query;
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

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const plans = await Plan.find(query)
      .sort({ displayOrder: 1 })
      .lean();

    // Attach customer counts
    const plansWithCounts = await Promise.all(
      plans.map(async (plan) => {
        const customerCount = await User.countDocuments({
          accountType: 'customer',
          currentPlan: plan._id
        });
        return { ...plan, customerCount };
      })
    );

    // Build CSV
    const headers = [
      'Plan Name', 'Description', 'Status', 'Price (Monthly)', 'Price (Yearly)',
      'Trial Days', 'Default', 'Display Order', 'Features Enabled', 'Total Features', 'Customers'
    ];

    const rows = plansWithCounts.map((plan) => {
      const enabledFeatures = (plan.features || []).filter((f) => f.enabled).length;
      const totalFeatures = (plan.features || []).length;

      return [
        plan.name || '',
        (plan.description || '').replace(/"/g, '""'),
        plan.isActive ? 'Active' : 'Inactive',
        plan.price?.monthly || 0,
        plan.price?.yearly || 0,
        plan.trialDays || 0,
        plan.isDefault ? 'Yes' : 'No',
        plan.displayOrder || 0,
        enabledFeatures,
        totalFeatures,
        plan.customerCount || 0
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))
    ].join('\n');

    const fileName = `plans-export-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Export plans error:', error);
    res.status(500).json({ success: false, message: 'Failed to export plans' });
  }
};

/**
 * Bulk delete plans
 */
const bulkDeletePlans = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide plan IDs to delete' });
    }
    // Check no plan has active customers
    const plansWithCustomers = await User.countDocuments({ planId: { $in: ids }, accountType: 'customer' });
    if (plansWithCustomers > 0) {
      return res.status(400).json({ success: false, message: 'Some selected plans have active customers. Reassign them first.' });
    }
    const result = await Plan.deleteMany({ _id: { $in: ids } });
    await ActivityLog.logActivity({
      userId: req.userId, userName: req.user.name, userEmail: req.user.email, userRole: req.user.role,
      action: 'plans_bulk_deleted', actionType: 'delete', targetModel: 'Plan',
      description: `Bulk deleted ${result.deletedCount} plans`,
      ipAddress: getClientIP(req), userAgent: req.get('user-agent'), status: 'success',
    });
    res.json({ success: true, message: `${result.deletedCount} plan(s) deleted successfully`, deletedCount: result.deletedCount });
  } catch (error) {
    console.error('Bulk delete plans error:', error);
    res.status(500).json({ success: false, message: 'Error deleting plans' });
  }
};

module.exports = {
  listPlans,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan,
  togglePlanStatus,
  setDefaultPlan,
  listFeatures,
  exportPlans,
  bulkDeletePlans
};
