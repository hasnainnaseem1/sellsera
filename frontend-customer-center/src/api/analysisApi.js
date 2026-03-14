import axiosInstance from './axiosInstance';

const analysisApi = {
  /** Run a new listing audit */
  analyze: (data) =>
    axiosInstance.post('/api/v1/customer/analysis/analyze', data).then(r => r.data),

  /** Get analysis history (paginated) */
  getHistory: (params = {}) =>
    axiosInstance.get('/api/v1/customer/history', { params }).then(r => r.data),

  /** Get single analysis by ID */
  getById: (id) =>
    axiosInstance.get(`/api/v1/customer/history/${id}`).then(r => r.data),

  /** Delete an analysis */
  deleteAnalysis: (id) =>
    axiosInstance.delete(`/api/v1/customer/history/${id}`).then(r => r.data),

  /** Delete all analyses */
  deleteAll: () =>
    axiosInstance.delete('/api/v1/customer/history').then(r => r.data),
};

export default analysisApi;
