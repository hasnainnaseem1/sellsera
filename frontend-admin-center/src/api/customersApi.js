import axiosInstance from './axiosInstance';
import { buildQueryParams } from '../utils/helpers';

const customersApi = {
  /**
   * GET /api/v1/admin/customers
   */
  getCustomers: (params = {}) =>
    axiosInstance
      .get('/api/v1/admin/customers', { params: buildQueryParams(params) })
      .then((r) => r.data),

  /**
   * GET /api/v1/admin/customers/:id
   */
  getCustomer: (id) =>
    axiosInstance.get(`/api/v1/admin/customers/${id}`).then((r) => r.data),

  /**
   * PUT /api/v1/admin/customers/:id/plan (legacy)
   */
  changePlan: (id, plan, reason) =>
    axiosInstance.put(`/api/v1/admin/customers/${id}/plan`, { plan, reason }).then((r) => r.data),

  /**
   * PUT /api/v1/admin/customers/:id/assign-plan (dynamic)
   */
  assignPlan: (id, planId, reason) =>
    axiosInstance.put(`/api/v1/admin/customers/${id}/assign-plan`, { planId, reason }).then((r) => r.data),

  /**
   * POST /api/v1/admin/customers/:id/reset-usage
   */
  resetUsage: (id) =>
    axiosInstance.post(`/api/v1/admin/customers/${id}/reset-usage`).then((r) => r.data),

  /**
   * POST /api/v1/admin/customers/:id/verify-email
   */
  verifyEmail: (id) =>
    axiosInstance.post(`/api/v1/admin/customers/${id}/verify-email`).then((r) => r.data),

  /**
   * PUT /api/v1/admin/customers/:id/status
   */
  updateStatus: (id, status, reason) =>
    axiosInstance.put(`/api/v1/admin/customers/${id}/status`, { status, reason }).then((r) => r.data),

  /**
   * GET /api/v1/admin/customers/:id/analyses
   */
  getAnalyses: (id, params = {}) =>
    axiosInstance
      .get(`/api/v1/admin/customers/${id}/analyses`, { params: buildQueryParams(params) })
      .then((r) => r.data),

  /**
   * GET /api/v1/admin/customers/export/csv
   */
  exportCustomers: (params = {}) =>
    axiosInstance
      .get('/api/v1/admin/customers/export/csv', {
        params: buildQueryParams(params),
        responseType: 'blob',
      })
      .then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;

        const contentDisposition = response.headers['content-disposition'];
        let fileName = 'customers.csv';
        if (contentDisposition) {
          const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/);
          if (fileNameMatch && fileNameMatch.length === 2) {
            fileName = fileNameMatch[1];
          }
        }

        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);
      }),

  /**
   * GET /api/v1/admin/customers/:id/activity
   */
  getCustomerActivity: (id, params = {}) =>
    axiosInstance
      .get(`/api/v1/admin/customers/${id}/activity`, { params: buildQueryParams(params) })
      .then((r) => r.data),

  /**
   * GET /api/v1/admin/customers/:id/login-history
   */
  getLoginHistory: (id, limit = 10) =>
    axiosInstance
      .get(`/api/v1/admin/customers/${id}/login-history`, { params: { limit } })
      .then((r) => r.data),

  /**
   * GET /api/v1/admin/customers/:id/usage-analytics
   */
  getUsageAnalytics: (id) =>
    axiosInstance
      .get(`/api/v1/admin/customers/${id}/usage-analytics`)
      .then((r) => r.data),

  /**
   * GET /api/v1/admin/customers/:id/activity/export
   */
  exportCustomerActivity: (params = {}) =>
    axiosInstance
      .get(`/api/v1/admin/customers/${params.customerId}/activity/export`, {
        params: buildQueryParams(params),
        responseType: 'blob',
      })
      .then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;

        const contentDisposition = response.headers['content-disposition'];
        let fileName = 'customer_activity.csv';
        if (contentDisposition) {
          const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/);
          if (fileNameMatch && fileNameMatch.length === 2) {
            fileName = fileNameMatch[1];
          }
        }

        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);
      }),

  /**
   * DELETE /api/v1/admin/customers/:id
   */
  deleteCustomer: (id) =>
    axiosInstance.delete(`/api/v1/admin/customers/${id}`).then((r) => r.data),

  /**
   * GET /api/v1/admin/customers/:id/payments
   */
  getCustomerPayments: (id, params = {}) =>
    axiosInstance
      .get(`/api/v1/admin/customers/${id}/payments`, { params })
      .then((r) => r.data),

  /**
   * POST /api/v1/admin/customers/bulk-delete
   */
  bulkDeleteCustomers: (ids) =>
    axiosInstance.post('/api/v1/admin/customers/bulk-delete', { ids }).then((r) => r.data),
};

export default customersApi;
