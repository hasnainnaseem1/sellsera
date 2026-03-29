const log = require('../../utils/logger')('Analytics');
const { User } = require('../../models/user');
const { ActivityLog } = require('../../models/admin');
const { Analysis } = require('../../models/customer');
const { Plan, UsageLog } = require('../../models/subscription');
const { Payment } = require('../../models/payment');

// ─── Helper: parse timeframe to start date ───
function getStartDate(timeframe) {
  const now = new Date();
  const ms = {
    '7d': 7 * 86400000,
    '30d': 30 * 86400000,
    '90d': 90 * 86400000,
    '1y': 365 * 86400000,
  };
  return new Date(now.getTime() - (ms[timeframe] || ms['30d']));
}

function getDays(period) {
  return { '7d': 7, '30d': 30, '90d': 90 }[period] || 30;
}

// @route   GET /api/admin/analytics/overview
// @desc    Get overview dashboard statistics
// @access  Private (Admin with analytics.view permission)
async function getOverview(req, res) {
  try {
    const { timeframe = '30d' } = req.query;
    const startDate = getStartDate(timeframe);
    const now = new Date();

    // Run all counts in parallel for performance
    const [
      totalUsers, totalCustomers, totalAdmins, activeUsers, newUsersInPeriod,
      activeCustomers, pendingVerification, suspendedCustomers,
      totalAnalyses, analysesInPeriod, completedAnalyses, failedAnalyses,
      scoreAggregation, totalLogins, failedLogins,
      totalUsageEvents, revenueAgg, previousPeriodUsers,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ accountType: 'customer' }),
      User.countDocuments({ accountType: 'admin' }),
      User.countDocuments({ status: 'active' }),
      User.countDocuments({ createdAt: { $gte: startDate } }),
      User.countDocuments({ accountType: 'customer', status: 'active' }),
      User.countDocuments({ accountType: 'customer', status: 'pending_verification' }),
      User.countDocuments({ accountType: 'customer', status: 'suspended' }),
      Analysis.countDocuments(),
      Analysis.countDocuments({ createdAt: { $gte: startDate } }),
      Analysis.countDocuments({ status: 'completed' }),
      Analysis.countDocuments({ status: 'failed' }),
      Analysis.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, avgScore: { $avg: '$score' } } },
      ]),
      ActivityLog.countDocuments({ action: 'login', createdAt: { $gte: startDate } }),
      ActivityLog.countDocuments({ action: 'login', status: 'failed', createdAt: { $gte: startDate } }),
      UsageLog.countDocuments({ createdAt: { $gte: startDate } }),
      // Real revenue from Payment model
      Payment.aggregate([
        { $match: { status: 'succeeded', paidAt: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      // Previous period users for growth %
      User.countDocuments({
        createdAt: {
          $gte: new Date(startDate.getTime() - (now.getTime() - startDate.getTime())),
          $lt: startDate,
        },
      }),
    ]);

    const averageScore = scoreAggregation.length > 0 ? scoreAggregation[0].avgScore : 0;
    // Payment amounts are already in dollars (webhook converts from cents)
    const monthlyRevenue = revenueAgg.length > 0 ? parseFloat(revenueAgg[0].total.toFixed(2)) : 0;

    const userGrowth = previousPeriodUsers > 0
      ? ((newUsersInPeriod - previousPeriodUsers) / previousPeriodUsers * 100).toFixed(2)
      : 0;

    // Subscription stats via aggregation
    const subscriptionAgg = await User.aggregate([
      { $match: { accountType: 'customer' } },
      { $group: { _id: '$plan', count: { $sum: 1 } } },
    ]);
    const subscriptionStats = {};
    subscriptionAgg.forEach((s) => { subscriptionStats[s._id || 'unknown'] = s.count; });

    const activeSubscriptions = await User.countDocuments({
      accountType: 'customer',
      subscriptionStatus: 'active',
      plan: { $ne: 'free' },
    });

    res.json({
      success: true,
      timeframe,
      overview: {
        users: {
          total: totalUsers,
          customers: totalCustomers,
          admins: totalAdmins,
          active: activeUsers,
          newInPeriod: newUsersInPeriod,
          growth: `${userGrowth}%`,
        },
        customers: {
          active: activeCustomers,
          pendingVerification,
          suspended: suspendedCustomers,
        },
        subscriptions: {
          ...subscriptionStats,
          active: activeSubscriptions,
          conversionRate: totalCustomers > 0
            ? ((activeSubscriptions / totalCustomers) * 100).toFixed(2) + '%'
            : '0%',
        },
        analyses: {
          total: totalAnalyses,
          inPeriod: analysesInPeriod,
          completed: completedAnalyses,
          failed: failedAnalyses,
          averageScore: averageScore.toFixed(2),
        },
        activity: {
          totalLogins,
          failedLogins,
          failureRate: totalLogins > 0
            ? ((failedLogins / totalLogins) * 100).toFixed(2) + '%'
            : '0%',
        },
        usage: {
          totalEvents: totalUsageEvents,
        },
        // Only expose revenue to admin/super_admin
        ...((req.user?.role === 'admin' || req.user?.role === 'super_admin') ? {
          revenue: { monthly: monthlyRevenue },
        } : {}),
      },
    });
  } catch (error) {
    log.error('Get analytics overview error:', error.message);
    res.status(500).json({ success: false, message: 'Error fetching analytics' });
  }
}

// @route   GET /api/admin/analytics/users-growth
// @desc    Get user growth chart data (aggregation-based, no N+1)
// @access  Private (Admin with analytics.view permission)
async function getUsersGrowth(req, res) {
  try {
    const { period = '30d' } = req.query;
    const days = getDays(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const [allUsers, customerUsers] = await Promise.all([
      User.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      ]),
      User.aggregate([
        { $match: { accountType: 'customer', createdAt: { $gte: startDate } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      ]),
    ]);

    const usersMap = {};
    allUsers.forEach((d) => { usersMap[d._id] = d.count; });
    const customersMap = {};
    customerUsers.forEach((d) => { customersMap[d._id] = d.count; });

    // Build full date range
    const growthData = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      growthData.push({
        date: key,
        newUsers: usersMap[key] || 0,
        newCustomers: customersMap[key] || 0,
      });
    }

    res.json({ success: true, period, data: growthData });
  } catch (error) {
    log.error('Get user growth error:', error.message);
    res.status(500).json({ success: false, message: 'Error fetching user growth data' });
  }
}

// @route   GET /api/admin/analytics/analyses-trend
// @desc    Get analyses trend data (aggregation-based, no N+1)
// @access  Private (Admin with analytics.view permission)
async function getAnalysesTrend(req, res) {
  try {
    const { period = '30d' } = req.query;
    const days = getDays(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const [allAnalyses, completedAnalyses] = await Promise.all([
      Analysis.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      ]),
      Analysis.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: startDate } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      ]),
    ]);

    const allMap = {};
    allAnalyses.forEach((d) => { allMap[d._id] = d.count; });
    const completedMap = {};
    completedAnalyses.forEach((d) => { completedMap[d._id] = d.count; });

    const trendData = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      trendData.push({
        date: key,
        totalAnalyses: allMap[key] || 0,
        completed: completedMap[key] || 0,
      });
    }

    res.json({ success: true, period, data: trendData });
  } catch (error) {
    log.error('Get analyses trend error:', error.message);
    res.status(500).json({ success: false, message: 'Error fetching analyses trend data' });
  }
}

// @route   GET /api/admin/analytics/subscription-distribution
// @desc    Get subscription plan distribution (dynamic — uses Plan model)
// @access  Private (Admin with analytics.view permission)
async function getSubscriptionDistribution(req, res) {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ displayOrder: 1 }).lean();

    const distribution = await Promise.all(
      plans.map(async (plan) => {
        const count = await User.countDocuments({ accountType: 'customer', currentPlan: plan._id });
        return {
          plan: plan.name,
          planId: plan._id,
          count,
          revenue: plan.price?.monthly || 0
        };
      })
    );

    // Include customers with no plan assigned
    const unassignedCount = await User.countDocuments({
      accountType: 'customer',
      $or: [{ currentPlan: null }, { currentPlan: { $exists: false } }],
    });
    if (unassignedCount > 0) {
      distribution.push({ plan: 'Free', planId: null, count: unassignedCount, revenue: 0 });
    }

    const totalRevenue = distribution.reduce((sum, item) => sum + (item.count * item.revenue), 0);

    res.json({
      success: true,
      distribution,
      totalMonthlyRevenue: totalRevenue
    });

  } catch (error) {
    log.error('Get subscription distribution error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching subscription distribution'
    });
  }
}

// @route   GET /api/admin/analytics/top-customers
// @desc    Get top performing customers (by analyses or activity)
// @access  Private (Admin with analytics.view permission)
async function getTopCustomers(req, res) {
  try {
    const { limit = 10 } = req.query;

    // Get customers with most analyses
    const topCustomers = await Analysis.aggregate([
      {
        $group: {
          _id: '$userId',
          totalAnalyses: { $sum: 1 },
          averageScore: { $avg: '$score' }
        }
      },
      { $sort: { totalAnalyses: -1 } },
      { $limit: parseInt(limit) }
    ]);

    let customersWithDetails = [];

    if (topCustomers.length > 0) {
      // If we have analysis data, use that
      customersWithDetails = await Promise.all(
        topCustomers.map(async (customer) => {
          const user = await User.findById(customer._id).select('name email plan');
          return {
            customer: user,
            totalAnalyses: customer.totalAnalyses,
            averageScore: customer.averageScore.toFixed(2)
          };
        })
      );
      customersWithDetails = customersWithDetails.filter(s => s.customer !== null);
    } else {
      // No analyses yet - show active customers ordered by subscription status and creation date
      const customers = await User.find({ accountType: 'customer', status: 'active' })
        .select('name email plan subscriptionStatus createdAt')
        .sort({ subscriptionStatus: -1, createdAt: -1 })
        .limit(parseInt(limit))
        .lean();

      customersWithDetails = customers.map(user => ({
        customer: {
          _id: user._id,
          name: user.name,
          email: user.email,
          plan: user.plan || 'free',
        },
        totalAnalyses: 0,
        averageScore: '0.00'
      }));
    }

    res.json({
      success: true,
      topCustomers: customersWithDetails
    });

  } catch (error) {
    log.error('Get top customers error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching top customers'
    });
  }
}

// @route   GET /api/admin/analytics/recent-activities
// @desc    Get recent admin activities
// @access  Private (Admin with analytics.view permission)
async function getRecentActivities(req, res) {
  try {
    const { limit = 20 } = req.query;

    const activities = await ActivityLog.find({ userRole: { $ne: 'customer' } })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('userName action description createdAt status');

    res.json({
      success: true,
      activities
    });

  } catch (error) {
    log.error('Get recent activities error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching recent activities'
    });
  }
}

// @route   GET /api/admin/analytics/plan-distribution
// @desc    Get dynamic plan distribution (uses Plan model)
// @access  Private (Admin with analytics.view permission)
async function getPlanDistribution(req, res) {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ displayOrder: 1 }).lean();

    const distribution = await Promise.all(
      plans.map(async (plan) => {
        const count = await User.countDocuments({ accountType: 'customer', currentPlan: plan._id });
        return {
          planId: plan._id,
          planName: plan.name,
          count,
          priceMonthly: plan.price?.monthly || 0,
          priceYearly: plan.price?.yearly || 0,
          revenue: count * (plan.price?.monthly || 0),
        };
      })
    );

    // Also count customers with no dynamic plan assigned
    const unassignedCount = await User.countDocuments({
      accountType: 'customer',
      $or: [{ currentPlan: null }, { currentPlan: { $exists: false } }],
    });

    if (unassignedCount > 0) {
      distribution.push({
        planId: null,
        planName: 'Unassigned (Legacy)',
        count: unassignedCount,
        priceMonthly: 0,
        priceYearly: 0,
        revenue: 0,
      });
    }

    const totalRevenue = distribution.reduce((sum, item) => sum + item.revenue, 0);

    res.json({
      success: true,
      distribution,
      totalMonthlyRevenue: totalRevenue,
    });
  } catch (error) {
    log.error('Get plan distribution error:', error.message);
    res.status(500).json({ success: false, message: 'Error fetching plan distribution' });
  }
}

// @route   GET /api/admin/analytics/usage-stats
// @desc    Get platform-wide feature usage statistics
// @access  Private (Admin with analytics.view permission)
async function getUsageStats(req, res) {
  try {
    const { period = '30d' } = req.query;
    const startDate = getStartDate(period);

    const usageStats = await UsageLog.getPlatformUsageStats(startDate, new Date());
    const totalUsageEvents = usageStats.reduce((sum, s) => sum + s.totalUsage, 0);

    res.json({ success: true, period, usageStats, totalUsageEvents });
  } catch (error) {
    log.error('Get usage stats error:', error.message);
    res.status(500).json({ success: false, message: 'Error fetching usage stats' });
  }
}

// @route   GET /api/admin/analytics/usage-trend/:featureKey
// @desc    Get usage trend for a specific feature
// @access  Private (Admin with analytics.view permission)
async function getUsageTrend(req, res) {
  try {
    const { featureKey } = req.params;
    const { days = 30 } = req.query;

    const trend = await UsageLog.getFeatureUsageTrend(featureKey, parseInt(days));

    res.json({
      success: true,
      featureKey,
      trend,
    });
  } catch (error) {
    log.error('Get usage trend error:', error.message);
    res.status(500).json({ success: false, message: 'Error fetching usage trend' });
  }
}

// @route   GET /api/admin/analytics/customer-usage/:id
// @desc    Get usage summary for a specific customer
// @access  Private (Admin with analytics.view permission)
async function getCustomerUsage(req, res) {
  try {
    const { period = '30d' } = req.query;
    const startDate = getStartDate(period);
    const usageSummary = await UsageLog.getCustomerUsageSummary(req.params.id, startDate, new Date());
    res.json({ success: true, customerId: req.params.id, period, usageSummary });
  } catch (error) {
    log.error('Get customer usage error:', error.message);
    res.status(500).json({ success: false, message: 'Error fetching customer usage' });
  }
}

// @route   GET /api/admin/analytics/revenue-stats
// @desc    Get revenue statistics from Payment model (admin/super_admin only)
// @access  Private (Admin with analytics.view + admin/super_admin role)
async function getRevenueStats(req, res) {
  try {
    // RBAC: Only admin / super_admin can see revenue
    const userRole = req.user?.role;
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Revenue data is restricted' });
    }

    const { period = '30d' } = req.query;
    const days = getDays(period);
    const now = new Date();
    const startDate = getStartDate(period);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      mrrAgg, prevMrrAgg, revenueTrend, revenueByPlan,
      paymentStatusAgg, recentPayments, totalRevenueAll,
    ] = await Promise.all([
      // Current month revenue (MRR)
      Payment.aggregate([
        { $match: { status: 'succeeded', paidAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      // Previous month revenue for growth comparison
      Payment.aggregate([
        { $match: { status: 'succeeded', paidAt: { $gte: prevMonthStart, $lt: monthStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      // Revenue trend (daily for the period)
      Payment.aggregate([
        { $match: { status: 'succeeded', paidAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt' } },
            revenue: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // Revenue by plan
      Payment.aggregate([
        { $match: { status: 'succeeded', paidAt: { $gte: startDate } } },
        {
          $group: {
            _id: '$planName',
            revenue: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { revenue: -1 } },
      ]),
      // Payment status breakdown
      Payment.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      ]),
      // Recent payments
      Payment.find({ status: 'succeeded' })
        .sort({ paidAt: -1 })
        .limit(10)
        .populate('userId', 'name email')
        .lean(),
      // All-time revenue
      Payment.aggregate([
        { $match: { status: 'succeeded' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);

    // Payment amounts are already in dollars (webhook converts from cents)
    const mrr = mrrAgg.length > 0 ? parseFloat(mrrAgg[0].total.toFixed(2)) : 0;
    const prevMrr = prevMrrAgg.length > 0 ? parseFloat(prevMrrAgg[0].total.toFixed(2)) : 0;
    const mrrGrowth = prevMrr > 0 ? (((mrr - prevMrr) / prevMrr) * 100).toFixed(1) : 0;
    const totalAllTime = totalRevenueAll.length > 0 ? parseFloat(totalRevenueAll[0].total.toFixed(2)) : 0;
    const totalPayments = totalRevenueAll.length > 0 ? totalRevenueAll[0].count : 0;

    // Active paying customers for ARPU
    const payingCustomers = await User.countDocuments({
      accountType: 'customer',
      subscriptionStatus: 'active',
      plan: { $ne: 'free' },
    });
    const arpu = payingCustomers > 0 ? parseFloat((mrr / payingCustomers).toFixed(2)) : 0;

    // Fill revenue trend gaps
    const trendMap = {};
    revenueTrend.forEach((d) => { trendMap[d._id] = { revenue: parseFloat(d.revenue.toFixed(2)), count: d.count }; });
    const trendData = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      trendData.push({
        date: key,
        revenue: trendMap[key]?.revenue || 0,
        transactions: trendMap[key]?.count || 0,
      });
    }

    res.json({
      success: true,
      period,
      revenue: {
        mrr,
        arr: mrr * 12,
        arpu,
        mrrGrowth: `${mrrGrowth}%`,
        totalAllTime,
        totalPayments,
        trend: trendData,
        byPlan: revenueByPlan.map((p) => ({
          plan: p._id || 'Unknown',
          revenue: parseFloat(p.revenue.toFixed(2)),
          count: p.count,
        })),
        paymentStatus: paymentStatusAgg.map((s) => ({
          status: s._id,
          count: s.count,
          total: parseFloat(s.total.toFixed(2)),
        })),
        recentPayments: recentPayments.map((p) => ({
          _id: p._id,
          user: p.userId ? { name: p.userId.name, email: p.userId.email } : null,
          amount: parseFloat(p.amount.toFixed(2)),
          planName: p.planName,
          billingCycle: p.billingCycle,
          paidAt: p.paidAt,
        })),
      },
    });
  } catch (error) {
    log.error('Get revenue stats error:', error.message);
    res.status(500).json({ success: false, message: 'Error fetching revenue stats' });
  }
}

// @route   GET /api/admin/analytics/login-analytics
// @desc    Get login analytics — most active users, login trend
// @access  Private (Admin with analytics.view permission)
async function getLoginAnalytics(req, res) {
  try {
    const { period = '30d' } = req.query;
    const days = getDays(period);
    const startDate = getStartDate(period);

    const [loginTrend, topLoginUsers, loginStats] = await Promise.all([
      // Daily login trend
      ActivityLog.aggregate([
        { $match: { action: 'login', status: 'success', createdAt: { $gte: startDate } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      // Top users by login count
      ActivityLog.aggregate([
        { $match: { action: 'login', status: 'success', createdAt: { $gte: startDate } } },
        { $group: { _id: '$userId', userName: { $first: '$userName' }, loginCount: { $sum: 1 }, lastLogin: { $max: '$createdAt' } } },
        { $sort: { loginCount: -1 } },
        { $limit: 10 },
      ]),
      // Success vs failed logins
      ActivityLog.aggregate([
        { $match: { action: 'login', createdAt: { $gte: startDate } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    // Fill login trend gaps
    const trendMap = {};
    loginTrend.forEach((d) => { trendMap[d._id] = d.count; });
    const trend = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      trend.push({ date: key, logins: trendMap[key] || 0 });
    }

    res.json({
      success: true,
      period,
      loginAnalytics: {
        trend,
        topUsers: topLoginUsers,
        stats: loginStats.reduce((acc, s) => { acc[s._id || 'unknown'] = s.count; return acc; }, {}),
      },
    });
  } catch (error) {
    log.error('Get login analytics error:', error.message);
    res.status(500).json({ success: false, message: 'Error fetching login analytics' });
  }
}

// @route   GET /api/admin/analytics/feature-adoption
// @desc    Get feature adoption rates — % of users using each feature
// @access  Private (Admin with analytics.view permission)
async function getFeatureAdoption(req, res) {
  try {
    const { period = '30d' } = req.query;
    const startDate = getStartDate(period);

    const totalCustomers = await User.countDocuments({ accountType: 'customer' });

    const adoption = await UsageLog.aggregate([
      { $match: { createdAt: { $gte: startDate }, action: 'used' } },
      {
        $group: {
          _id: '$featureKey',
          featureName: { $first: '$featureName' },
          uniqueUsers: { $addToSet: '$userId' },
          totalUsage: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 1,
          featureName: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          totalUsage: 1,
        },
      },
      { $sort: { uniqueUsers: -1 } },
    ]);

    const adoptionWithRate = adoption.map((f) => ({
      featureKey: f._id,
      featureName: f.featureName || f._id,
      uniqueUsers: f.uniqueUsers,
      totalUsage: f.totalUsage,
      adoptionRate: totalCustomers > 0
        ? parseFloat(((f.uniqueUsers / totalCustomers) * 100).toFixed(1))
        : 0,
    }));

    res.json({
      success: true,
      period,
      totalCustomers,
      features: adoptionWithRate,
    });
  } catch (error) {
    log.error('Get feature adoption error:', error.message);
    res.status(500).json({ success: false, message: 'Error fetching feature adoption' });
  }
}

// @route   GET /api/admin/analytics/per-plan-usage
// @desc    Get feature usage grouped by plan with limit comparison
// @access  Private (Admin with analytics.view permission)
async function getPerPlanUsage(req, res) {
  try {
    const { period = '30d' } = req.query;
    const startDate = getStartDate(period);

    // Get usage grouped by plan + feature
    const usageByPlan = await UsageLog.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { planName: '$planName', featureKey: '$featureKey' },
          featureName: { $first: '$featureName' },
          totalUsage: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          limitReached: { $sum: { $cond: [{ $eq: ['$action', 'limit_reached'] }, 1, 0] } },
          avgLimit: { $avg: '$limit' },
        },
      },
      {
        $project: {
          _id: 0,
          planName: '$_id.planName',
          featureKey: '$_id.featureKey',
          featureName: 1,
          totalUsage: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          limitReached: 1,
          avgLimit: 1,
        },
      },
      { $sort: { planName: 1, totalUsage: -1 } },
    ]);

    // Group by plan for easier frontend consumption
    const byPlan = {};
    usageByPlan.forEach((item) => {
      const plan = item.planName || 'Unknown';
      if (!byPlan[plan]) byPlan[plan] = [];
      byPlan[plan].push({
        featureKey: item.featureKey,
        featureName: item.featureName || item.featureKey,
        totalUsage: item.totalUsage,
        uniqueUsers: item.uniqueUsers,
        limitReached: item.limitReached,
        avgLimit: item.avgLimit ? Math.round(item.avgLimit) : null,
      });
    });

    res.json({
      success: true,
      period,
      perPlanUsage: byPlan,
    });
  } catch (error) {
    log.error('Get per-plan usage error:', error.message);
    res.status(500).json({ success: false, message: 'Error fetching per-plan usage' });
  }
}

// @route   GET /api/admin/analytics/revenue-advanced
// @desc    Advanced revenue metrics — churn, LTV, refunds, top payers, revenue by cycle
// @access  Private (Admin with analytics.view + admin/super_admin role)
async function getRevenueAdvanced(req, res) {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Revenue data is restricted' });
    }

    const { period = '30d' } = req.query;
    const startDate = getStartDate(period);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      // Refund totals
      refundAgg,
      // Revenue by billing cycle
      revenueByCycle,
      // Top paying customers (all time)
      topPayers,
      // Monthly revenue per month trend (last 12 months)
      monthlyRevenueTrend,
      // Failed payments this period
      failedPayments,
      // All succeeded payments this period
      succeededPayments,
      // Churned customers (cancelled in period)
      churnedCustomers,
      // Active paying customers at start of period
      activePayingStart,
      // Current active paying customers
      activePayingNow,
      // Average revenue per transaction
      avgTransaction,
    ] = await Promise.all([
      // Refunds
      Payment.aggregate([
        { $match: { status: 'refunded' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      // Revenue by billing cycle
      Payment.aggregate([
        { $match: { status: 'succeeded', paidAt: { $gte: startDate } } },
        {
          $group: {
            _id: '$billingCycle',
            revenue: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { revenue: -1 } },
      ]),
      // Top 10 paying customers all-time
      Payment.aggregate([
        { $match: { status: 'succeeded' } },
        {
          $group: {
            _id: '$userId',
            totalSpent: { $sum: '$amount' },
            payments: { $sum: 1 },
            lastPayment: { $max: '$paidAt' },
            planName: { $last: '$planName' },
          },
        },
        { $sort: { totalSpent: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'userInfo',
          },
        },
        { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            totalSpent: 1,
            payments: 1,
            lastPayment: 1,
            planName: 1,
            name: '$userInfo.name',
            email: '$userInfo.email',
          },
        },
      ]),
      // Monthly revenue trend (last 12 months)
      Payment.aggregate([
        {
          $match: {
            status: 'succeeded',
            paidAt: { $gte: new Date(now.getFullYear() - 1, now.getMonth(), 1) },
          },
        },
        {
          $group: {
            _id: { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } },
            revenue: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      // Failed count this period
      Payment.countDocuments({ status: 'failed', createdAt: { $gte: startDate } }),
      // Succeeded count this period
      Payment.countDocuments({ status: 'succeeded', paidAt: { $gte: startDate } }),
      // Customers who cancelled in this period
      User.countDocuments({
        accountType: 'customer',
        subscriptionStatus: { $in: ['cancelled', 'expired'] },
        updatedAt: { $gte: startDate },
      }),
      // Paying customers at start of period (approximation)
      User.countDocuments({
        accountType: 'customer',
        subscriptionStatus: 'active',
        plan: { $ne: 'free' },
        subscriptionStartDate: { $lt: startDate },
      }),
      // Currently active paying
      User.countDocuments({
        accountType: 'customer',
        subscriptionStatus: 'active',
        plan: { $ne: 'free' },
      }),
      // Average transaction amount
      Payment.aggregate([
        { $match: { status: 'succeeded' } },
        { $group: { _id: null, avg: { $avg: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);

    // Churn rate = churned / (active at start of period + new in period) * 100
    const churnBase = activePayingStart > 0 ? activePayingStart : activePayingNow;
    const churnRate = churnBase > 0
      ? parseFloat(((churnedCustomers / churnBase) * 100).toFixed(1))
      : 0;

    // Estimated LTV = ARPU / (churn rate / 100), capped at sensible max
    const arpu = activePayingNow > 0
      ? (await Payment.aggregate([
          { $match: { status: 'succeeded', paidAt: { $gte: monthStart } } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ])).reduce((_, a) => parseFloat((a.total / activePayingNow).toFixed(2)), 0)
      : 0;
    const monthlyChurnDecimal = churnRate / 100;
    const ltv = monthlyChurnDecimal > 0
      ? parseFloat((arpu / monthlyChurnDecimal).toFixed(2))
      : arpu > 0 ? arpu * 24 : 0; // If no churn, estimate 24 months

    const refundTotal = refundAgg.length > 0 ? parseFloat(refundAgg[0].total.toFixed(2)) : 0;
    const refundCount = refundAgg.length > 0 ? refundAgg[0].count : 0;

    // Payment success rate
    const totalAttempts = succeededPayments + failedPayments;
    const paymentSuccessRate = totalAttempts > 0
      ? parseFloat(((succeededPayments / totalAttempts) * 100).toFixed(1))
      : 100;

    // Net revenue (all-time succeeded - refunded)
    const allTimeRevenue = await Payment.aggregate([
      { $match: { status: 'succeeded' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const grossRevenue = allTimeRevenue.length > 0 ? parseFloat(allTimeRevenue[0].total.toFixed(2)) : 0;
    const netRevenue = parseFloat((grossRevenue - refundTotal).toFixed(2));

    const avgTxn = avgTransaction.length > 0 ? parseFloat(avgTransaction[0].avg.toFixed(2)) : 0;

    // Format monthly trend
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedMonthlyTrend = monthlyRevenueTrend.map((m) => ({
      month: `${monthNames[m._id.month - 1]} ${m._id.year}`,
      revenue: parseFloat(m.revenue.toFixed(2)),
      transactions: m.count,
    }));

    res.json({
      success: true,
      period,
      advanced: {
        churnRate,
        churnedCustomers,
        ltv,
        netRevenue,
        grossRevenue,
        refunds: { total: refundTotal, count: refundCount },
        paymentSuccessRate,
        failedPayments,
        succeededPayments,
        activePayingCustomers: activePayingNow,
        averageTransaction: avgTxn,
        revenueByCycle: revenueByCycle.map((c) => ({
          cycle: c._id || 'unknown',
          revenue: parseFloat(c.revenue.toFixed(2)),
          count: c.count,
        })),
        topPayers: topPayers.map((p) => ({
          userId: p._id,
          name: p.name || 'Unknown',
          email: p.email || 'unknown',
          totalSpent: parseFloat(p.totalSpent.toFixed(2)),
          payments: p.payments,
          lastPayment: p.lastPayment,
          planName: p.planName,
        })),
        monthlyRevenueTrend: formattedMonthlyTrend,
      },
    });
  } catch (error) {
    log.error('Get advanced revenue stats error:', error.message);
    res.status(500).json({ success: false, message: 'Error fetching advanced revenue stats' });
  }
}

module.exports = {
  getOverview,
  getUsersGrowth,
  getAnalysesTrend,
  getSubscriptionDistribution,
  getTopCustomers,
  getRecentActivities,
  getPlanDistribution,
  getUsageStats,
  getUsageTrend,
  getCustomerUsage,
  getRevenueStats,
  getLoginAnalytics,
  getFeatureAdoption,
  getPerPlanUsage,
  getRevenueAdvanced,
};
