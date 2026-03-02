const express = require('express');
const router = express.Router();
const { adminAuth } = require('../../../middleware/auth');
const { checkPermission, checkRole } = require('../../../middleware/security');
const {
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
} = require('../../../controllers/admin/customerController');

// Static paths MUST come before parameterized /:id routes

// @route   GET /api/admin/customers
// @desc    Get all customers with detailed info
// @access  Private (Admin with customers.view permission)
router.get('/', adminAuth, checkPermission('customers.view'), getCustomers);

// @route   GET /api/admin/customers/export/csv
// @desc    Export customers to CSV
// @access  Private (Admin with customers.view permission)
router.get('/export/csv', adminAuth, checkPermission('customers.view'), exportCustomersCsv);

// @route   POST /api/admin/customers/bulk-delete
// @desc    Delete multiple customers permanently
// @access  Private (Super Admin ONLY)
router.post('/bulk-delete', adminAuth, checkRole('super_admin'), bulkDeleteCustomers);

// Parameterized /:id routes

// @route   GET /api/admin/customers/:id/activity/export
// @desc    Export customer activity logs to CSV
// @access  Private (Admin with customers.view permission)
router.get('/:id/activity/export', adminAuth, checkPermission('customers.view'), exportCustomerActivity);

// @route   GET /api/admin/customers/:id/activity
// @desc    Get customer activity logs with pagination and date filtering
// @access  Private (Admin with customers.view permission)
router.get('/:id/activity', adminAuth, checkPermission('customers.view'), getCustomerActivity);

// @route   GET /api/admin/customers/:id/login-history
// @desc    Get customer login history
// @access  Private (Admin with customers.view permission)
router.get('/:id/login-history', adminAuth, checkPermission('customers.view'), getCustomerLoginHistory);

// @route   GET /api/admin/customers/:id/usage-analytics
// @desc    Get customer feature usage analytics from UsageLog
// @access  Private (Admin with customers.view permission)
router.get('/:id/usage-analytics', adminAuth, checkPermission('customers.view'), getCustomerUsageAnalytics);

// @route   GET /api/admin/customers/:id/payments
// @desc    Get payment history & billing stats for a specific customer
// @access  Private (Admin with customers.view permission)
router.get('/:id/payments', adminAuth, checkPermission('customers.view'), getCustomerPayments);

// @route   GET /api/admin/customers/:id/analyses
// @desc    Get all analyses for a specific customer
// @access  Private (Admin with customers.view permission)
router.get('/:id/analyses', adminAuth, checkPermission('customers.view'), getCustomerAnalyses);

// @route   GET /api/admin/customers/:id
// @desc    Get single customer with detailed analytics
// @access  Private (Admin with customers.view permission)
router.get('/:id', adminAuth, checkPermission('customers.view'), getCustomerById);

// @route   PUT /api/admin/customers/:id/plan
// @desc    Change customer's subscription plan
// @access  Private (Admin with customers.plans permission)
router.put('/:id/plan', adminAuth, checkPermission('customers.plans'), updateCustomerPlan);

// @route   PUT /api/admin/customers/:id/assign-plan
// @desc    Assign a dynamic plan to a customer
// @access  Private (Admin with customers.plans permission)
router.put('/:id/assign-plan', adminAuth, checkPermission('customers.plans'), assignCustomerPlan);

// @route   PUT /api/admin/customers/:id/status
// @desc    Update customer status (activate/suspend)
// @access  Private (Admin with customers.edit permission)
router.put('/:id/status', adminAuth, checkPermission('customers.edit'), updateCustomerStatus);

// @route   POST /api/admin/customers/:id/reset-usage
// @desc    Reset customer's monthly analysis count
// @access  Private (Admin with customers.edit permission)
router.post('/:id/reset-usage', adminAuth, checkPermission('customers.edit'), resetCustomerUsage);

// @route   POST /api/admin/customers/:id/verify-email
// @desc    Manually verify customer's email
// @access  Private (Admin with customers.verify permission)
router.post('/:id/verify-email', adminAuth, checkPermission('customers.verify'), verifyCustomerEmail);

// @route   DELETE /api/admin/customers/:id
// @desc    Delete a customer permanently
// @access  Private (Super Admin ONLY — no role/permission override)
router.delete('/:id', adminAuth, checkRole('super_admin'), deleteCustomer);

module.exports = router;
