import axiosInstance from './axiosInstance';
import { buildQueryParams } from '../utils/helpers';

const featuresApi = {
  /**
   * GET /api/v1/admin/features
   */
  getFeatures: (params = {}) =>
    axiosInstance
      .get('/api/v1/admin/features', { params: buildQueryParams(params) })
      .then((r) => r.data),

  /**
   * GET /api/v1/admin/features/:id
   */
  getFeature: (id) =>
    axiosInstance.get(`/api/v1/admin/features/${id}`).then((r) => r.data),

  /**
   * POST /api/v1/admin/features
   */
  createFeature: (data) =>
    axiosInstance.post('/api/v1/admin/features', data).then((r) => r.data),

  /**
   * PUT /api/v1/admin/features/:id
   */
  updateFeature: (id, data) =>
    axiosInstance.put(`/api/v1/admin/features/${id}`, data).then((r) => r.data),

  /**
   * DELETE /api/v1/admin/features/:id
   */
  deleteFeature: (id) =>
    axiosInstance.delete(`/api/v1/admin/features/${id}`).then((r) => r.data),

  /**
   * PUT /api/v1/admin/features/:id/toggle-status
   */
  toggleFeatureStatus: (id) =>
    axiosInstance.put(`/api/v1/admin/features/${id}/toggle-status`).then((r) => r.data),

  /**
   * GET /api/v1/admin/features/export/csv
   * Export features to CSV with current filters
   */
  exportFeatures: (params = {}) => {
    const queryParams = buildQueryParams(params);
    const queryString = new URLSearchParams(queryParams).toString();
    const url = `/api/v1/admin/features/export/csv${queryString ? '?' + queryString : ''}`;
    
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
          : `features-export-${new Date().toISOString().split('T')[0]}.csv`;
        
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
        
        return { success: true };
      });
  },

  /**
   * POST /api/v1/admin/features/bulk-delete
   */
  bulkDeleteFeatures: (ids) =>
    axiosInstance.post('/api/v1/admin/features/bulk-delete', { ids }).then((r) => r.data),
};

export default featuresApi;
