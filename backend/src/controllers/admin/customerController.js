const mongoose = require('mongoose');
const { User } = require('../../models/user');
const { ActivityLog } = require('../../models/admin');
const { Analysis } = require('../../models/customer');
const { Notification } = require('../../models/notification');
const { Plan } = require('../../models/subscription');
const escapeRegex = require('../../utils/helpers/escapeRegex');
const { Payment } = require('../../models/payment');
const { getClientIP } = require('../../utils/helpers/ipHelper');
const { notifySubscriptionChange, notifyCustomerStatusChange } = require('../../services/notification/adminNotifier');
const { safeSave, safeActivityLog, safeNotification } = require('../../utils/helpers/safeDbOps');

// @route   GET /api/admin/customers
// @desc    Get all customers with detailed info
const getCustomers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      plan,
      subscriptionStatus,
      search,
      sortBy = 'createdAt',
      order = 'desc',
      isEmailVerified
    } = req.query;

    // Build filter for customers only
    const filter = { accountType: 'customer' };
    
    // Handle multiple status values (e.g., "active,suspended" for multiselect)
    if (status) {
      const statusValues = status.split(',');
      if (statusValues.length === 1) {
        filter.status = statusValues[0];
      } else {
        filter.status = { $in: statusValues };
      }
    }
    
    // Handle plan filter — accepts ObjectIds (dynamic plans) or legacy strings
    if (plan) {
      const planValues = plan.split(',');
      const isObjectId = planValues.every(v => mongoose.Types.ObjectId.isValid(v));
      if (isObjectId) {
        filter.currentPlan = planValues.length === 1
          ? new mongoose.Types.ObjectId(planValues[0])
          : { $in: planValues.map(v => new mongoose.Types.ObjectId(v)) };
      } else {
        filter.plan = planValues.length === 1 ? planValues[0] : { $in: planValues };
      }
    }
    
    if (subscriptionStatus) filter.subscriptionStatus = subscriptionStatus;
    if (isEmailVerified !== undefined) filter.isEmailVerified = isEmailVerified === 'true';
    
    if (search) {
      const safe = escapeRegex(search);
      filter.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { email: { $regex: safe, $options: 'i' } }
      ];
    }

    const customers = await User.find(filter)
      .select('-password -emailVerificationToken -resetPasswordToken')
      .populate('currentPlan', 'name')
      .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await User.countDocuments(filter);

    // Get customer statistics (dynamic plans)
    const allPlans = await Plan.find({ isActive: true }).select('_id name').lean();
    const planStats = {};
    for (const p of allPlans) {
      planStats[p.name] = await User.countDocuments({ accountType: 'customer', currentPlan: p._id });
    }

    const stats = {
      totalCustomers: await User.countDocuments({ accountType: 'customer' }),
      activeCustomers: await User.countDocuments({ accountType: 'customer', status: 'active' }),
      pendingVerification: await User.countDocuments({ accountType: 'customer', status: 'pending_verification' }),
      suspendedCustomers: await User.countDocuments({ accountType: 'customer', status: 'suspended' }),
      planStats,
      activeSubscriptions: await User.countDocuments({ 
        accountType: 'customer', 
        subscriptionStatus: 'active' 
      })
    };

    res.json({
      success: true,
      customers: customers.map(customer => ({
        id: customer._id,
        name: customer.name,
        email: customer.email,
        status: customer.status,
        plan: customer.currentPlan?.name || customer.planSnapshot?.planName || customer.plan,
        analysisCount: customer.analysisCount,
        analysisLimit: customer.analysisLimit,
        subscriptionStatus: customer.subscriptionStatus,
        subscriptionStartDate: customer.subscriptionStartDate,
        subscriptionEndDate: customer.subscriptionEndDate,
        isEmailVerified: customer.isEmailVerified,
        lastLogin: customer.lastLogin,
        createdAt: customer.createdAt
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      },
      stats
    });

  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customers'
    });
  }
};

// @route   GET /api/admin/customers/export/csv
// @desc    Export customers to CSV
const exportCustomersCsv = async (req, res) => {
  try {
    const {
      status,
      plan,
      subscriptionStatus,
      search,
      isEmailVerified
    } = req.query;

    // Build filter for customers only
    const filter = { accountType: 'customer' };
    
    // Handle multiple status values (e.g., "active,suspended")
    if (status) {
      const statusValues = status.split(',');
      if (statusValues.length === 1) {
        filter.status = statusValues[0];
      } else {
        filter.status = { $in: statusValues };
      }
    }
    
    // Handle plan filter — accepts ObjectIds (dynamic plans) or legacy strings
    if (plan) {
      const planValues = plan.split(',');
      const isObjectId = planValues.every(v => mongoose.Types.ObjectId.isValid(v));
      if (isObjectId) {
        filter.currentPlan = planValues.length === 1
          ? new mongoose.Types.ObjectId(planValues[0])
          : { $in: planValues.map(v => new mongoose.Types.ObjectId(v)) };
      } else {
        filter.plan = planValues.length === 1 ? planValues[0] : { $in: planValues };
      }
    }
    
    if (subscriptionStatus) filter.subscriptionStatus = subscriptionStatus;
    if (isEmailVerified !== undefined) filter.isEmailVerified = isEmailVerified === 'true';
    
    if (search) {
      const safe = escapeRegex(search);
      filter.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { email: { $regex: safe, $options: 'i' } }
      ];
    }

    const customers = await User.find(filter)
      .select('-password -emailVerificationToken -resetPasswordToken')
      .populate('currentPlan', 'name')
      .sort({ createdAt: -1 })
      .lean();

    // Build CSV
    const headers = [
      'Name', 'Email', 'Plan', 'Status', 'Subscription Status', 'Usage Count', 
      'Usage Limit', 'Email Verified', 'Last Login', 'Created At'
    ];

    const rows = customers.map((customer) => [
      customer.name || '',
      customer.email || '',
      customer.currentPlan?.name || customer.planSnapshot?.planName || customer.plan || 'Free',
      customer.status || '',
      customer.subscriptionStatus || '',
      customer.analysisCount || 0,
      customer.analysisLimit || 0,
      customer.isEmailVerified ? 'Yes' : 'No',
      customer.lastLogin ? new Date(customer.lastLogin).toISOString() : '',
      customer.createdAt ? new Date(customer.createdAt).toISOString() : ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))
    ].join('\n');

    const fileName = `customers-export-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export customers error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting customers'
    });
  }
};

// @route   GET /api/admin/customers/:id/activity
// @desc    Get customer activity logs with pagination and date filtering
const getCustomerActivity = async (req, res) => {
  try {
    const { page = 1, limit = 50, startDate, endDate } = req.query;

    const customer = await User.findOne({
      _id: req.params.id,
      accountType: 'customer'
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }

    const filter = { userId: customer._id };
    if (Object.keys(dateFilter).length > 0) {
      filter.createdAt = dateFilter;
    }

    const activityLogs = await ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    const total = await ActivityLog.countDocuments(filter);

    res.json({
      success: true,
      activityLogs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get customer activity error:', error);
    res.status(500).json({ success: false, message: 'Error fetching customer activity' });
  }
};

// @route   GET /api/admin/customers/:id/login-history
// @desc    Get customer login history
const getCustomerLoginHistory = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const customer = await User.findOne({
      _id: req.params.id,
      accountType: 'customer'
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Get login-related activity logs
    const loginHistory = await ActivityLog.find({
      userId: customer._id,
      action: { $in: ['login', 'customer_login', 'failed_login', 'logout'] }
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('action description ipAddress createdAt status userAgent')
      .lean();

    res.json({
      success: true,
      loginHistory,
      customerName: customer.name,
      customerEmail: customer.email
    });
  } catch (error) {
    console.error('Get customer login history error:', error);
    res.status(500).json({ success: false, message: 'Error fetching login history' });
  }
};

// @route   GET /api/admin/customers/:id/activity/export
// @desc    Export customer activity logs to CSV
const exportCustomerActivity = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const customer = await User.findOne({
      _id: req.params.id,
      accountType: 'customer'
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }

    const filter = { userId: customer._id };
    if (Object.keys(dateFilter).length > 0) {
      filter.createdAt = dateFilter;
    }

    const activityLogs = await ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    // Generate CSV
    const headers = ['Action', 'Description', 'IP Address', 'User Agent', 'Status', 'Created At'];
    const csvRows = [headers.join(',')];

    activityLogs.forEach((log) => {
      const row = [
        log.action || '',
        `"${(log.description || '').replace(/"/g, '""')}"`,
        log.ipAddress || '',
        `"${(log.userAgent || '').replace(/"/g, '""')}"`,
        log.status || '',
        new Date(log.createdAt).toISOString()
      ];
      csvRows.push(row.join(','));
    });

    const csv = csvRows.join('\n');
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `customer_${ customer.name.replace(/\s+/g, '_')}_activity_${dateStr}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('Export customer activity error:', error);
    res.status(500).json({ success: false, message: 'Error exporting customer activity' });
  }
};

// @route   GET /api/admin/customers/:id/usage-analytics
// @desc    Get customer feature usage analytics from UsageLog
const getCustomerUsageAnalytics = async (req, res) => {
  try {
    const customer = await User.findOne({
      _id: req.params.id,
      accountType: 'customer'
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const { UsageLog } = require('../../models/subscription');

    // Per-feature usage summary (how many times each feature was used)
    const featureUsageSummary = await UsageLog.getCustomerUsageSummary(customer._id);

    // Feature usage by month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const usageByMonth = await UsageLog.aggregate([
      { $match: { userId: customer._id, createdAt: { $gte: sixMonthsAgo }, action: 'used' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Usage actions breakdown (used, limit_reached, exceeded, reset)
    const usageByAction = await UsageLog.aggregate([
      { $match: { userId: customer._id } },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Feature usage with plan limits — use LIVE plan features (not stale snapshot)
    let planFeatures = customer.planSnapshot?.features || [];
    if (customer.currentPlan) {
      const livePlan = await Plan.findById(customer.currentPlan).select('features').lean();
      if (livePlan?.features) planFeatures = livePlan.features;
    }
    const featureUsageDetails = planFeatures
      .filter(f => f.enabled)
      .map(f => {
        const usageData = featureUsageSummary.find(u => u._id === f.featureKey);
        return {
          featureKey: f.featureKey,
          featureName: f.featureName,
          limit: f.limit,
          used: usageData ? usageData.totalUsage : 0,
          lastUsed: usageData ? usageData.lastUsed : null,
          limitReached: usageData ? usageData.limitReached : 0,
          remaining: f.limit !== null && f.limit !== undefined
            ? Math.max(0, f.limit - (usageData ? usageData.totalUsage : 0))
            : null, // null = unlimited
          percentage: f.limit !== null && f.limit !== undefined && f.limit > 0
            ? Math.round(((usageData ? usageData.totalUsage : 0) / f.limit) * 100)
            : 0,
        };
      });

    // Activity logs count by action type  
    const activityByType = await ActivityLog.aggregate([
      { $match: { userId: customer._id } },
      {
        $group: {
          _id: '$actionType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Total feature usage count
    const totalFeatureUsage = featureUsageSummary.reduce((sum, u) => sum + u.totalUsage, 0);

    res.json({
      success: true,
      analytics: {
        featureUsageDetails, // per-feature usage vs limit
        featureUsageSummary: featureUsageSummary.map(u => ({
          featureKey: u._id,
          featureName: u.featureName,
          totalUsage: u.totalUsage,
          lastUsed: u.lastUsed,
          limitReached: u.limitReached,
        })),
        usageByMonth: usageByMonth.map(a => ({
          month: `${a._id.year}-${String(a._id.month).padStart(2, '0')}`,
          count: a.count
        })),
        usageByAction: usageByAction.map(a => ({
          action: a._id || 'Unknown',
          count: a.count
        })),
        activityByType: activityByType.map(a => ({
          type: a._id || 'Unknown',
          count: a.count
        })),
        summary: {
          totalFeatureUsage,
          totalFeaturesEnabled: planFeatures.filter(f => f.enabled).length,
          totalLimitReaches: featureUsageSummary.reduce((sum, u) => sum + u.limitReached, 0),
        }
      }
    });
  } catch (error) {
    console.error('Get customer usage analytics error:', error);
    res.status(500).json({ success: false, message: 'Error fetching usage analytics' });
  }
};

// @route   GET /api/admin/customers/:id/payments
// @desc    Get payment history & billing stats for a specific customer
const getCustomerPayments = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    // Verify customer exists
    const customer = await User.findOne({ _id: id, accountType: 'customer' }).select('name email plan').lean();
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Build filter
    const filter = { userId: id };
    if (status && ['succeeded', 'pending', 'failed', 'refunded', 'cancelled'].includes(status)) {
      filter.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch payments with pagination
    const [payments, totalCount] = await Promise.all([
      Payment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Payment.countDocuments(filter),
    ]);

    // Aggregate billing stats
    const [stats] = await Payment.aggregate([
      { $match: { userId: customer._id } },
      {
        $group: {
          _id: null,
          totalSpent: {
            $sum: { $cond: [{ $eq: ['$status', 'succeeded'] }, '$amount', 0] }
          },
          totalPayments: {
            $sum: { $cond: [{ $eq: ['$status', 'succeeded'] }, 1, 0] }
          },
          totalRefunded: {
            $sum: { $cond: [{ $eq: ['$status', 'refunded'] }, '$amount', 0] }
          },
          refundCount: {
            $sum: { $cond: [{ $eq: ['$status', 'refunded'] }, 1, 0] }
          },
          failedPayments: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          pendingPayments: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          lastPaymentDate: { $max: '$paidAt' },
          firstPaymentDate: { $min: '$paidAt' },
          avgPaymentAmount: {
            $avg: { $cond: [{ $eq: ['$status', 'succeeded'] }, '$amount', null] }
          },
        },
      },
    ]);

    // Monthly spending trend (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const monthlyTrend = await Payment.aggregate([
      {
        $match: {
          userId: customer._id,
          status: 'succeeded',
          createdAt: { $gte: twelveMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          amount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const formattedTrend = monthlyTrend.map((m) => ({
      month: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
      amount: parseFloat(m.amount.toFixed(2)),
      count: m.count,
    }));

    // Payment method / billing cycle breakdown
    const billingBreakdown = await Payment.aggregate([
      { $match: { userId: customer._id, status: 'succeeded' } },
      {
        $group: {
          _id: '$billingCycle',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      payments: payments.map((p) => ({
        id: p._id,
        amount: parseFloat(p.amount.toFixed(2)),
        currency: p.currency,
        status: p.status,
        planName: p.planName,
        billingCycle: p.billingCycle,
        description: p.description,
        receiptUrl: p.receiptUrl,
        invoiceUrl: p.invoiceUrl,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit)),
      },
      stats: {
        totalSpent: stats ? parseFloat(stats.totalSpent.toFixed(2)) : 0,
        totalPayments: stats?.totalPayments || 0,
        totalRefunded: stats ? parseFloat(stats.totalRefunded.toFixed(2)) : 0,
        refundCount: stats?.refundCount || 0,
        failedPayments: stats?.failedPayments || 0,
        pendingPayments: stats?.pendingPayments || 0,
        lastPaymentDate: stats?.lastPaymentDate || null,
        firstPaymentDate: stats?.firstPaymentDate || null,
        avgPaymentAmount: stats?.avgPaymentAmount ? parseFloat(stats.avgPaymentAmount.toFixed(2)) : 0,
        netRevenue: stats ? parseFloat((stats.totalSpent - stats.totalRefunded).toFixed(2)) : 0,
      },
      monthlyTrend: formattedTrend,
      billingBreakdown: billingBreakdown.map((b) => ({
        cycle: b._id || 'unknown',
        total: parseFloat(b.total.toFixed(2)),
        count: b.count,
      })),
    });
  } catch (error) {
    console.error('Get customer payments error:', error);
    res.status(500).json({ success: false, message: 'Error fetching customer payments' });
  }
};

// @route   GET /api/admin/customers/:id
// @desc    Get single customer with detailed analytics
const getCustomerById = async (req, res) => {
  try {
    const customer = await User.findOne({
      _id: req.params.id,
      accountType: 'customer'
    }).select('-password');

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Get customer's analyses
    const analyses = await Analysis.find({ userId: customer._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('originalListing.title score status createdAt');

    const totalAnalyses = await Analysis.countDocuments({ userId: customer._id });

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

    // Get customer's activity logs - only if user has logs.view permission
    let recentActivity = [];
    const canViewLogs = currentUserPermissions.includes('*') || currentUserPermissions.includes('logs.view');
    if (canViewLogs) {
      recentActivity = await ActivityLog.find({ userId: customer._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('action description ipAddress createdAt status');
    }

    // Build customer response with conditional activity information
    const customerResponse = {
      id: customer._id,
      name: customer.name,
      email: customer.email,
      status: customer.status,
      plan: customer.plan,
      currentPlan: customer.currentPlan,
      planSnapshot: customer.planSnapshot,
      analysisCount: customer.analysisCount,
      analysisLimit: customer.analysisLimit,
      monthlyResetDate: customer.monthlyResetDate,
      stripeCustomerId: customer.stripeCustomerId,
      subscriptionStatus: customer.subscriptionStatus,
      subscriptionId: customer.subscriptionId,
      subscriptionStartDate: customer.subscriptionStartDate,
      subscriptionExpiresAt: customer.subscriptionExpiresAt,
      trialEndsAt: customer.trialEndsAt,
      isEmailVerified: customer.isEmailVerified,
      // Always include these for UI display
      lastLogin: customer.lastLogin,
      lastLoginIP: customer.lastLoginIP,
      loginAttempts: customer.loginAttempts,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };

    // Get feature usage from UsageLog
    let featureUsage = [];
    try {
      const { UsageLog } = require('../../models/subscription');
      const usageSummary = await UsageLog.getCustomerUsageSummary(customer._id);

      // Use LIVE plan features as source of truth (not stale snapshot)
      let planFeatures = customer.planSnapshot?.features || [];
      if (customer.currentPlan) {
        const livePlan = await Plan.findById(customer.currentPlan).select('features').lean();
        if (livePlan?.features) planFeatures = livePlan.features;
      }

      featureUsage = planFeatures
        .filter(f => f.enabled)
        .map(f => {
          const usage = usageSummary.find(u => u._id === f.featureKey);
          return {
            featureKey: f.featureKey,
            featureName: f.featureName,
            limit: f.limit,
            used: usage ? usage.totalUsage : 0,
            remaining: f.limit !== null && f.limit !== undefined
              ? Math.max(0, f.limit - (usage ? usage.totalUsage : 0))
              : null,
            percentage: f.limit !== null && f.limit !== undefined && f.limit > 0
              ? Math.round(((usage ? usage.totalUsage : 0) / f.limit) * 100)
              : 0,
          };
        });
    } catch (usageErr) {
      console.error('Error fetching feature usage:', usageErr);
    }

    // Populate dynamic plan name if available
    if (customer.currentPlan) {
      try {
        const dynPlan = await Plan.findById(customer.currentPlan).select('name price slug').lean();
        if (dynPlan) {
          customerResponse.currentPlanDetails = dynPlan;
        }
      } catch { /* ignore */ }
    }

    res.json({
      success: true,
      customer: customerResponse,
      featureUsage,
      analytics: {
        totalAnalyses,
        recentAnalyses: analyses
      },
      recentActivity
    });

  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customer'
    });
  }
};

// @route   PUT /api/admin/customers/:id/plan
// @desc    Change customer's subscription plan
const updateCustomerPlan = async (req, res) => {
  try {
    const { plan, reason } = req.body;
    const clientIP = getClientIP(req);

    if (!plan || !['free', 'starter', 'pro', 'unlimited'].includes(plan)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan'
      });
    }

    const customer = await User.findOne({
      _id: req.params.id,
      accountType: 'customer'
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const oldPlan = customer.plan;
    customer.plan = plan;
    customer.updateAnalysisLimit();
    
    // Any plan assignment = active subscription
    customer.subscriptionStatus = 'active';
    customer.subscriptionStartDate = new Date();
    const now = new Date();
    customer.monthlyResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    await safeSave(customer);

    // Log activity
    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'customer_plan_changed',
      actionType: 'update',
      targetModel: 'User',
      targetId: customer._id,
      targetName: customer.name,
      description: `Changed customer plan from ${oldPlan} to ${plan}${reason ? ` - Reason: ${reason}` : ''}`,
      metadata: { oldPlan, newPlan: plan, reason },
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    // Notify customer
    const notificationType = plan === 'free' ? 'plan_downgraded' : 'plan_upgraded';
    await safeNotification(Notification, {
      recipientId: customer._id,
      type: notificationType,
      title: `Plan ${plan === 'free' ? 'Downgraded' : 'Upgraded'}`,
      message: `Your plan has been changed to ${plan.toUpperCase()} by admin.`,
      action: {
        label: 'View Dashboard',
        url: '/dashboard'
      },
      priority: 'high'
    });

    // Notify admins about subscription change (respects notification settings)
    notifySubscriptionChange({
      customer,
      oldPlan,
      newPlan: plan,
      changeType: plan === 'free' ? 'downgraded' : 'upgraded',
      source: 'admin',
    }).catch(() => {});

    res.json({
      success: true,
      message: 'Customer plan updated successfully',
      customer: {
        id: customer._id,
        plan: customer.plan,
        analysisLimit: customer.analysisLimit,
        subscriptionStatus: customer.subscriptionStatus
      }
    });

  } catch (error) {
    console.error('Update customer plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating customer plan'
    });
  }
};

// @route   POST /api/admin/customers/:id/reset-usage
// @desc    Reset ALL feature usage counters for a customer
const resetCustomerUsage = async (req, res) => {
  try {
    const clientIP = getClientIP(req);
    const { UsageLog } = require('../../models/subscription');

    const customer = await User.findOne({
      _id: req.params.id,
      accountType: 'customer'
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Delete all 'used' UsageLog records for this customer (resets per-feature counters)
    const deleteResult = await UsageLog.deleteMany({
      userId: customer._id,
      action: 'used'
    });

    // Reset legacy analysis count and save
    customer.analysisCount = 0;
    await customer.save();

    // Log the reset in UsageLog for audit trail
    await UsageLog.logUsage({
      userId: customer._id,
      featureKey: '_admin_reset',
      planId: customer.currentPlan,
      planName: customer.planSnapshot?.planName || '',
      action: 'reset',
      currentCount: 0,
      limit: null,
      metadata: {
        resetBy: req.userId,
        resetByEmail: req.user.email,
        deletedRecords: deleteResult.deletedCount
      },
    });

    // Log activity
    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'customer_updated',
      actionType: 'update',
      targetModel: 'User',
      targetId: customer._id,
      targetName: customer.name,
      description: `Reset usage counts for customer: ${customer.email} (${deleteResult.deletedCount} records cleared)`,
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    // Notify customer
    await safeNotification(Notification, {
      recipientId: customer._id,
      type: 'admin_message',
      title: 'Usage Reset',
      message: `Your feature usage has been reset by admin.`,
      priority: 'medium'
    });

    // Build zeroed-out feature usage from plan snapshot
    const planFeatures = customer.planSnapshot?.features || [];
    const updatedUsage = planFeatures
      .filter(f => f.enabled)
      .map(f => ({
        featureKey: f.featureKey,
        featureName: f.featureName,
        limit: f.limit,
        used: 0,
        remaining: f.limit !== null && f.limit !== undefined ? f.limit : null,
        percentage: 0,
      }));

    res.json({
      success: true,
      message: 'Customer usage reset successfully',
      deletedRecords: deleteResult.deletedCount,
      customer: {
        id: customer._id,
        analysisCount: customer.analysisCount,
        analysisLimit: customer.analysisLimit,
        monthlyResetDate: customer.monthlyResetDate
      },
      updatedUsage,
    });

  } catch (error) {
    console.error('Reset customer usage error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting customer usage'
    });
  }
};

// @route   POST /api/admin/customers/:id/verify-email
// @desc    Manually verify customer's email
const verifyCustomerEmail = async (req, res) => {
  try {
    const clientIP = getClientIP(req);

    const customer = await User.findOne({
      _id: req.params.id,
      accountType: 'customer'
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    if (customer.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    customer.isEmailVerified = true;
    customer.status = 'active';
    // Keep the verification token so the email link still works
    // (it will return "already verified" instead of "invalid")
    await safeSave(customer);

    // Log activity
    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'customer_verified',
      actionType: 'update',
      targetModel: 'User',
      targetId: customer._id,
      targetName: customer.name,
      description: `Manually verified email for customer: ${customer.email}`,
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    // Notify customer
    await safeNotification(Notification, {
      recipientId: customer._id,
      type: 'email_verification',
      title: 'Email Verified',
      message: 'Your email has been verified by admin. You can now access all features.',
      priority: 'high'
    });

    res.json({
      success: true,
      message: 'Customer email verified successfully'
    });

  } catch (error) {
    console.error('Verify customer email error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying customer email'
    });
  }
};

// @route   GET /api/admin/customers/:id/analyses
// @desc    Get all analyses for a specific customer
const getCustomerAnalyses = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const customer = await User.findOne({
      _id: req.params.id,
      accountType: 'customer'
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const analyses = await Analysis.find({ userId: customer._id })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Analysis.countDocuments({ userId: customer._id });

    res.json({
      success: true,
      analyses: analyses.map(analysis => ({
        id: analysis._id,
        title: analysis.originalListing.title,
        category: analysis.originalListing.category,
        score: analysis.score,
        status: analysis.status,
        createdAt: analysis.createdAt
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get customer analyses error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customer analyses'
    });
  }
};

// @route   PUT /api/admin/customers/:id/assign-plan
// @desc    Assign a dynamic plan to a customer
const assignCustomerPlan = async (req, res) => {
  try {
    const { planId, reason } = req.body;
    const clientIP = getClientIP(req);

    if (!planId) {
      return res.status(400).json({ success: false, message: 'planId is required' });
    }

    const customer = await User.findOne({ _id: req.params.id, accountType: 'customer' });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }
    if (!plan.isActive) {
      return res.status(400).json({ success: false, message: 'Cannot assign an inactive plan' });
    }

    const oldPlanName = customer.planSnapshot?.planName || customer.plan || 'None';

    // Set the dynamic plan
    customer.currentPlan = plan._id;
    customer.planSnapshot = {
      planId: plan._id,
      planName: plan.name,
      features: plan.features.map(f => ({
        featureId: f.featureId,
        featureKey: f.featureKey,
        featureName: f.featureName,
        enabled: f.enabled,
        limit: f.limit,
        value: f.value,
      })),
      assignedAt: new Date(),
      assignedBy: req.user._id,
    };

    // Also update the legacy plan field to closest match
    const slug = plan.slug || plan.name.toLowerCase();
    if (['free', 'starter', 'pro', 'unlimited'].includes(slug)) {
      customer.plan = slug;
    }

    // Update analysis limit from snapshot
    customer.updateAnalysisLimit();

    // Set subscription status — ANY assigned plan = a subscription
    const now = new Date();
    customer.subscriptionStartDate = now;
    customer.monthlyResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Admin-assigned plans are always immediately active — no trial period.
    // Trials are only for user-initiated signups via the payment gateway.
    customer.subscriptionStatus = plan.price?.monthly === 0 ? 'active' : 'active';
    customer.trialEndsAt = null;
    customer.trialWarningEmailSent = false;
    // For free plans set no expiry; for paid plans expiry is handled by payment system.
    customer.subscriptionExpiresAt = plan.price?.monthly === 0 ? null : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    await safeSave(customer);

    // Log activity
    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'subscription_assigned',
      actionType: 'update',
      targetModel: 'User',
      targetId: customer._id,
      targetName: customer.name,
      description: `Assigned plan "${plan.name}" to customer ${customer.email} (was: ${oldPlanName})${reason ? ` - Reason: ${reason}` : ''}`,
      metadata: { oldPlan: oldPlanName, newPlan: plan.name, planId: plan._id, reason },
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success',
    });

    // Notify customer
    await safeNotification(Notification, {
      recipientId: customer._id,
      type: 'plan_upgraded',
      title: 'Plan Updated',
      message: `Your plan has been changed to ${plan.name} by admin.`,
      action: { label: 'View Dashboard', url: '/dashboard' },
      priority: 'high',
    });

    // Notify admins about dynamic plan assignment
    notifySubscriptionChange({
      customer,
      oldPlan: oldPlanName,
      newPlan: plan.name,
      changeType: 'changed',
      source: 'admin',
    }).catch(() => {});

    res.json({
      success: true,
      message: `Plan changed to "${plan.name}" successfully`,
      customer: {
        id: customer._id,
        currentPlan: customer.currentPlan,
        planSnapshot: customer.planSnapshot,
        plan: customer.plan,
        analysisLimit: customer.analysisLimit,
        subscriptionStatus: customer.subscriptionStatus,
      },
    });
  } catch (error) {
    console.error('Assign plan error:', error);
    res.status(500).json({ success: false, message: 'Error assigning plan' });
  }
};

// @route   PUT /api/admin/customers/:id/status
// @desc    Update customer status (activate/suspend)
const updateCustomerStatus = async (req, res) => {
  try {
    const { status, reason } = req.body;
    const clientIP = getClientIP(req);

    if (!status || !['active', 'suspended', 'pending_verification'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Valid values: active, suspended, pending_verification'
      });
    }

    const customer = await User.findOne({
      _id: req.params.id,
      accountType: 'customer'
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const oldStatus = customer.status;
    if (oldStatus === status) {
      return res.json({
        success: true,
        message: `Customer is already ${status}`,
        customer: { _id: customer._id, name: customer.name, email: customer.email, status: customer.status }
      });
    }

    customer.status = status;
    await safeSave(customer);

    // Log activity
    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'customer_status_changed',
      actionType: 'update',
      targetModel: 'User',
      targetId: customer._id,
      targetName: customer.name,
      description: `Changed customer status from ${oldStatus} to ${status}${reason ? ` - Reason: ${reason}` : ''}`,
      metadata: { oldStatus, newStatus: status, reason },
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    // Notify customer
    let notificationMessage = '';
    if (status === 'suspended') {
      notificationMessage = 'Your account has been suspended. Please contact support for assistance.';
    } else if (status === 'active') {
      notificationMessage = 'Your account has been activated. You can now access all features.';
    }

    if (notificationMessage) {
      await safeNotification(Notification, {
        recipientId: customer._id,
        type: status === 'suspended' ? 'account_suspended' : 'account_activated',
        title: 'Account Status Updated',
        message: notificationMessage,
        action: { label: 'View Dashboard', url: '/dashboard' },
        priority: 'high',
      });
    }

    // Notify all admins about customer status change
    notifyCustomerStatusChange({
      customer,
      oldStatus,
      newStatus: status,
      changedBy: req.user.name,
      reason,
    }).catch(() => {});

    res.json({
      success: true,
      message: `Customer status changed to ${status} successfully`,
      customer: {
        id: customer._id,
        status: customer.status,
        name: customer.name,
        email: customer.email,
      },
    });
  } catch (error) {
    console.error('Update customer status error:', error);
    res.status(500).json({ success: false, message: 'Error updating customer status' });
  }
};

// @route   DELETE /api/admin/customers/:id
// @desc    Delete a customer permanently
const deleteCustomer = async (req, res) => {
  try {
    // Hard super_admin check — not permission-based
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only Super Admin can delete customers' });
    }

    const customer = await User.findById(req.params.id);
    if (!customer || customer.accountType !== 'customer') {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const custName = customer.name;
    const custEmail = customer.email;

    // Delete related data
    await Analysis.deleteMany({ userId: customer._id });
    await Notification.deleteMany({ userId: customer._id });
    await customer.deleteOne();

    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'customer_deleted',
      actionType: 'delete',
      targetModel: 'User',
      targetId: req.params.id,
      targetName: custName,
      description: `Permanently deleted customer: ${custEmail}`,
      ipAddress: getClientIP(req),
      userAgent: req.get('user-agent'),
      status: 'success',
    });

    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ success: false, message: 'Error deleting customer' });
  }
};

// @route   POST /api/admin/customers/bulk-delete
// @desc    Delete multiple customers permanently
const bulkDeleteCustomers = async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only Super Admin can delete customers' });
    }

    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide customer IDs to delete' });
    }

    const customers = await User.find({ _id: { $in: ids }, accountType: 'customer' });
    if (customers.length === 0) {
      return res.status(404).json({ success: false, message: 'No customers found with provided IDs' });
    }

    const customerIds = customers.map(c => c._id);
    await Analysis.deleteMany({ userId: { $in: customerIds } });
    await Notification.deleteMany({ userId: { $in: customerIds } });
    await User.deleteMany({ _id: { $in: customerIds } });

    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'customers_bulk_deleted',
      actionType: 'delete',
      targetModel: 'User',
      description: `Bulk deleted ${customers.length} customers`,
      metadata: { deletedCount: customers.length, emails: customers.map(c => c.email) },
      ipAddress: getClientIP(req),
      userAgent: req.get('user-agent'),
      status: 'success',
    });

    res.json({ success: true, message: `${customers.length} customer(s) deleted successfully`, deletedCount: customers.length });
  } catch (error) {
    console.error('Bulk delete customers error:', error);
    res.status(500).json({ success: false, message: 'Error deleting customers' });
  }
};

module.exports = {
  getCustomers,
  exportCustomersCsv,
  getCustomerActivity,
  getCustomerLoginHistory,
  exportCustomerActivity,
  getCustomerUsageAnalytics,
  getCustomerPayments,
  getCustomerById,
  updateCustomerPlan,
  resetCustomerUsage,
  verifyCustomerEmail,
  getCustomerAnalyses,
  assignCustomerPlan,
  updateCustomerStatus,
  deleteCustomer,
  bulkDeleteCustomers,
};
