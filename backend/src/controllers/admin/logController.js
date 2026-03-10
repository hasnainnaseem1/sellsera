const { ActivityLog } = require('../../models/admin');
const { getClientIP } = require('../../utils/helpers/ipHelper');
const { safeActivityLog } = require('../../utils/helpers/safeDbOps');
const escapeRegex = require('../../utils/helpers/escapeRegex');

// @desc    Get activity logs with filters
const getLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      actionType,
      userId,
      status,
      startDate,
      endDate,
      search
    } = req.query;

    // Build filter
    const filter = {};
    
    if (action) filter.action = action;
    if (userId) filter.userId = userId;
    
    // Handle multi-select filters (actionType and status with OR conditions)
    if (actionType) {
      const actionTypes = actionType.split(',').map(t => t.trim()).filter(t => t);
      if (actionTypes.length > 0) {
        filter.actionType = { $in: actionTypes };
      }
    }

    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(s => s);
      if (statuses.length > 0) {
        filter.status = { $in: statuses };
      }
    }
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    if (search) {
      const safe = escapeRegex(search);
      filter.$or = [
        { userName: { $regex: safe, $options: 'i' } },
        { userEmail: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
        { action: { $regex: safe, $options: 'i' } }
      ];
    }

    const logs = await ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('userId', 'name email accountType role');

    const total = await ActivityLog.countDocuments(filter);

    // Get statistics
    const stats = {
      totalLogs: await ActivityLog.countDocuments(),
      successLogs: await ActivityLog.countDocuments({ status: 'success' }),
      failedLogs: await ActivityLog.countDocuments({ status: 'failed' }),
      warningLogs: await ActivityLog.countDocuments({ status: 'warning' })
    };

    res.json({
      success: true,
      logs: logs.map(log => ({
        id: log._id,
        user: log.userId,
        userName: log.userName,
        userEmail: log.userEmail,
        userRole: log.userRole,
        action: log.action,
        actionType: log.actionType,
        targetModel: log.targetModel,
        targetId: log.targetId,
        targetName: log.targetName,
        description: log.description,
        metadata: log.metadata,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        status: log.status,
        errorMessage: log.errorMessage,
        createdAt: log.createdAt
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
    console.error('Get activity logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching activity logs'
    });
  }
};

// @desc    Get single activity log
const getLog = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid log ID format' });
    }

    const log = await ActivityLog.findById(req.params.id)
      .populate('userId', 'name email accountType role status');

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Activity log not found'
      });
    }

    res.json({
      success: true,
      log: {
        id: log._id,
        user: log.userId,
        userName: log.userName,
        userEmail: log.userEmail,
        userRole: log.userRole,
        action: log.action,
        actionType: log.actionType,
        targetModel: log.targetModel,
        targetId: log.targetId,
        targetName: log.targetName,
        description: log.description,
        metadata: log.metadata,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        status: log.status,
        errorMessage: log.errorMessage,
        createdAt: log.createdAt
      }
    });

  } catch (error) {
    console.error('Get activity log error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching activity log'
    });
  }
};

// @desc    Get activity logs for specific user
const getUserLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const logs = await ActivityLog.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await ActivityLog.countDocuments({ userId: req.params.userId });

    res.json({
      success: true,
      logs: logs.map(log => ({
        id: log._id,
        action: log.action,
        actionType: log.actionType,
        description: log.description,
        ipAddress: log.ipAddress,
        status: log.status,
        createdAt: log.createdAt
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get user activity logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user activity logs'
    });
  }
};

// @desc    Delete old activity logs (older than specified days)
const deleteOldLogs = async (req, res) => {
  try {
    const { days = 90 } = req.body;
    const clientIP = getClientIP(req);

    if (days < 30) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete logs newer than 30 days'
      });
    }

    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await ActivityLog.deleteMany({
      createdAt: { $lt: cutoffDate }
    });

    // Log this action
    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'data_exported',
      actionType: 'delete',
      targetModel: 'ActivityLog',
      description: `Deleted ${result.deletedCount} old activity logs (older than ${days} days)`,
      metadata: { days, deletedCount: result.deletedCount },
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} old activity logs`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('Delete old logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting old logs'
    });
  }
};

// @desc    Delete activity logs by date range
const deleteLogsByRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const clientIP = getClientIP(req);

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both startDate and endDate'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be before end date'
      });
    }

    const result = await ActivityLog.deleteMany({
      createdAt: { $gte: start, $lte: end }
    });

    // Log this action
    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'data_deleted',
      actionType: 'delete',
      targetModel: 'ActivityLog',
      description: `Deleted ${result.deletedCount} activity logs from ${startDate} to ${endDate}`,
      metadata: { 
        startDate, 
        endDate, 
        deletedCount: result.deletedCount 
      },
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} activity logs from the specified date range`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('Delete logs by date range error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting logs'
    });
  }
};

// @desc    Export activity logs as CSV
const exportLogsCsv = async (req, res) => {
  try {
    const { startDate, endDate, actionType, status, search } = req.query;
    const clientIP = getClientIP(req);

    const filter = {};
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Handle multi-select filters (OR conditions)
    if (actionType) {
      const actionTypes = actionType.split(',').map(t => t.trim()).filter(t => t);
      if (actionTypes.length > 0) {
        filter.actionType = { $in: actionTypes };
      }
    }

    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(s => s);
      if (statuses.length > 0) {
        filter.status = { $in: statuses };
      }
    }

    if (search) {
      const safe = escapeRegex(search);
      filter.$or = [
        { userName: { $regex: safe, $options: 'i' } },
        { userEmail: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
        { action: { $regex: safe, $options: 'i' } }
      ];
    }

    const logs = await ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(10000); // Limit to prevent memory issues

    // Convert to CSV
    const csvHeaders = 'Date,User Name,User Email,User Role,Action,Action Type,Description,Status,IP Address\n';
    const csvRows = logs.map(log => {
      return `${log.createdAt.toISOString()},"${log.userName}","${log.userEmail}",${log.userRole},"${log.action}",${log.actionType},"${log.description}",${log.status},${log.ipAddress}`;
    }).join('\n');

    const csv = csvHeaders + csvRows;

    // Log export activity
    await ActivityLog.logActivity({
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'data_exported',
      actionType: 'export',
      targetModel: 'ActivityLog',
      description: `Exported ${logs.length} activity logs`,
      metadata: { exportedCount: logs.length, format: 'CSV', filters: { startDate, endDate, actionType, status } },
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=activity-logs-${Date.now()}.csv`);
    res.send(csv);

  } catch (error) {
    console.error('Export logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting logs'
    });
  }
};

// @desc    Get activity log statistics summary
const getLogStatsSummary = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    let days;
    switch(period) {
      case '7d': days = 7; break;
      case '30d': days = 30; break;
      case '90d': days = 90; break;
      default: days = 30;
    }

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get action type distribution
    const actionTypes = await ActivityLog.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: '$actionType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get top actions
    const topActions = await ActivityLog.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get status distribution
    const statusDistribution = await ActivityLog.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Get failed actions
    const failedActions = await ActivityLog.aggregate([
      { 
        $match: { 
          createdAt: { $gte: startDate },
          status: 'failed'
        } 
      },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      success: true,
      period,
      summary: {
        actionTypes,
        topActions,
        statusDistribution,
        failedActions
      }
    });

  } catch (error) {
    console.error('Get log stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching log statistics'
    });
  }
};

module.exports = {
  getLogs,
  getLog,
  getUserLogs,
  deleteOldLogs,
  deleteLogsByRange,
  exportLogsCsv,
  getLogStatsSummary
};
