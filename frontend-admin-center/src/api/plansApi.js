import axiosInstance from './axiosInstance';
import { buildQueryParams } from '../utils/helpers';

const plansApi = {
  /**
   * GET /api/v1/admin/plans
   */
  getPlans: (params = {}) =>
    axiosInstance
      .get('/api/v1/admin/plans', { params: buildQueryParams(params) })
      .then((r) => r.data),

  /**
   * GET /api/v1/admin/plans/features — list available features
   */
  getFeatures: (params = {}) =>
    axiosInstance
      .get('/api/v1/admin/plans/features', { params })
      .then((r) => r.data),

  /**
   * GET /api/v1/admin/plans/:id
   */
  getPlan: (id) =>
    axiosInstance.get(`/api/v1/admin/plans/${id}`).then((r) => r.data),

  /**
   * POST /api/v1/admin/plans
   */
  createPlan: (data) =>
    axiosInstance.post('/api/v1/admin/plans', data).then((r) => r.data),

  /**
   * PUT /api/v1/admin/plans/:id
   */
  updatePlan: (id, data) =>
    axiosInstance.put(`/api/v1/admin/plans/${id}`, data).then((r) => r.data),

  /**
   * DELETE /api/v1/admin/plans/:id
   */
  deletePlan: (id, reassignToPlanId = null) =>
    axiosInstance
      .delete(`/api/v1/admin/plans/${id}`, {
        data: reassignToPlanId ? { reassignToPlanId } : {}
      })
      .then((r) => r.data),

  /**
   * PUT /api/v1/admin/plans/:id/toggle-status
   */
  togglePlanStatus: (id) =>
    axiosInstance.put(`/api/v1/admin/plans/${id}/toggle-status`).then((r) => r.data),

  /**
   * PUT /api/v1/admin/plans/:id/set-default
   */
  setDefaultPlan: (id) =>
    axiosInstance.put(`/api/v1/admin/plans/${id}/set-default`).then((r) => r.data),

  /**
   * GET /api/v1/admin/plans/export/csv
   * Export plans to CSV with current filters
   */
  exportPlans: (params = {}) => {
    const queryParams = buildQueryParams(params);
    const queryString = new URLSearchParams(queryParams).toString();
    const url = `/api/v1/admin/plans/export/csv${queryString ? '?' + queryString : ''}`;
    
    return axiosInstance
      .get(url, {
        responseType: 'blob',
      })
      .then((response) => {
        // Create download link
        const blob = new Blob([response.data], { type: 'text/csv' });
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        
        // Extract filename from header or use default
        const contentDisposition = response.headers['content-disposition'];
        const filename = contentDisposition
          ? contentDisposition.split('filename=')[1].replace(/"/g, '')
          : `plans-export-${new Date().toISOString().split('T')[0]}.csv`;
        
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
        
        return { success: true };
      });
  },

  /**
   * POST /api/v1/admin/plans/bulk-delete
   */
  bulkDeletePlans: (ids) =>
    axiosInstance.post('/api/v1/admin/plans/bulk-delete', { ids }).then((r) => r.data),
};

export default plansApi;
