const express = require('express');
const router = express.Router();
const { adminAuth } = require('../../../middleware/auth');
const { checkPermission, checkFeatureEnabled } = require('../../../middleware/security');
const {
  getLogs,
  getLog,
  getUserLogs,
  deleteOldLogs,
  deleteLogsByRange,
  exportLogsCsv,
  getLogStatsSummary
} = require('../../../controllers/admin/logController');

// @route   GET /api/admin/activity-logs/export/csv
// @desc    Export activity logs as CSV
// @access  Private (Admin with logs.export permission)
router.get('/export/csv', adminAuth, checkPermission('logs.export'), checkFeatureEnabled('enableActivityLogs'), exportLogsCsv);

// @route   GET /api/admin/activity-logs/stats/summary
// @desc    Get activity log statistics summary
// @access  Private (Admin with logs.view permission)
router.get('/stats/summary', adminAuth, checkPermission('logs.view'), checkFeatureEnabled('enableActivityLogs'), getLogStatsSummary);

// @route   GET /api/admin/activity-logs/user/:userId
// @desc    Get activity logs for specific user
// @access  Private (Admin with logs.view permission)
router.get('/user/:userId', adminAuth, checkPermission('logs.view'), checkFeatureEnabled('enableActivityLogs'), getUserLogs);

// @route   GET /api/admin/activity-logs
// @desc    Get activity logs with filters
// @access  Private (Admin with logs.view permission)
router.get('/', adminAuth, checkPermission('logs.view'), checkFeatureEnabled('enableActivityLogs'), getLogs);

// @route   GET /api/admin/activity-logs/:id
// @desc    Get single activity log
// @access  Private (Admin with logs.view permission)
router.get('/:id', adminAuth, checkPermission('logs.view'), checkFeatureEnabled('enableActivityLogs'), getLog);

// @route   DELETE /api/admin/activity-logs/old
// @desc    Delete old activity logs (older than specified days)
// @access  Private (Admin with logs.delete permission)
router.delete('/old', adminAuth, checkPermission('logs.delete'), checkFeatureEnabled('enableActivityLogs'), deleteOldLogs);

// @route   DELETE /api/admin/activity-logs/range
// @desc    Delete activity logs by date range
// @access  Private (Admin with logs.delete permission)
router.delete('/range', adminAuth, checkPermission('logs.delete'), checkFeatureEnabled('enableActivityLogs'), deleteLogsByRange);

module.exports = router;
