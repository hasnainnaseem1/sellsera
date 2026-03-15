import axiosInstance from './axiosInstance';

const etsyKeysApi = {
  list:    () => axiosInstance.get('/api/v1/admin/etsy-keys').then(r => r.data),
  add:     (data) => axiosInstance.post('/api/v1/admin/etsy-keys', data).then(r => r.data),
  update:  (id, data) => axiosInstance.put(`/api/v1/admin/etsy-keys/${id}`, data).then(r => r.data),
  remove:  (id) => axiosInstance.delete(`/api/v1/admin/etsy-keys/${id}`).then(r => r.data),
  toggle:  (id) => axiosInstance.post(`/api/v1/admin/etsy-keys/${id}/toggle`).then(r => r.data),
};

export default etsyKeysApi;
