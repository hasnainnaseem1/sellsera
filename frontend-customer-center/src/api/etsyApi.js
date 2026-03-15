import axiosInstance from './axiosInstance';

const etsyApi = {
  // Start OAuth flow — returns { authUrl }
  getAuthUrl:    () => axiosInstance.get('/api/v1/customer/etsy/auth').then(r => r.data),

  // Get connected shop info
  getShopInfo:   () => axiosInstance.get('/api/v1/customer/etsy/shop').then(r => r.data),

  // Disconnect Etsy shop
  disconnect:    () => axiosInstance.post('/api/v1/customer/etsy/disconnect').then(r => r.data),

  // Synced listings
  getListings:   (params = {}) => axiosInstance.get('/api/v1/customer/etsy/listings', { params }).then(r => r.data),

  // Listing audit
  auditListing:  (data) => axiosInstance.post('/api/v1/customer/listing-audit', data).then(r => r.data),
  getAuditHistory: (params = {}) => axiosInstance.get('/api/v1/customer/listing-audit/history', { params }).then(r => r.data),

  // Keywords
  searchKeywords:  (data) => axiosInstance.post('/api/v1/customer/keywords/search', data).then(r => r.data),
  deepAnalysis:    (data) => axiosInstance.post('/api/v1/customer/keywords/deep-analysis', data).then(r => r.data),
  getKeywordHistory: (params = {}) => axiosInstance.get('/api/v1/customer/keywords/history', { params }).then(r => r.data),

  // Rank checker
  checkRankings:   (data) => axiosInstance.post('/api/v1/customer/rank-checker', data).then(r => r.data),
  getRankHistory:  (params = {}) => axiosInstance.get('/api/v1/customer/rank-checker/history', { params }).then(r => r.data),

  // Tag analyzer
  analyzeTags:     (data) => axiosInstance.post('/api/v1/customer/tag-analyzer', data).then(r => r.data),

  // Competitors
  addCompetitor:      (data) => axiosInstance.post('/api/v1/customer/competitors/watch', data).then(r => r.data),
  removeCompetitor:   (id)   => axiosInstance.delete(`/api/v1/customer/competitors/watch/${id}`).then(r => r.data),
  getWatchList:       () => axiosInstance.get('/api/v1/customer/competitors/watch').then(r => r.data),
  getSnapshots:       (id, params = {}) => axiosInstance.get(`/api/v1/customer/competitors/${id}/snapshots`, { params }).then(r => r.data),
  getCompetitorSales: (id) => axiosInstance.get(`/api/v1/customer/competitors/${id}/sales`).then(r => r.data),
  refreshCompetitor:  (id) => axiosInstance.post(`/api/v1/customer/competitors/${id}/refresh`).then(r => r.data),

  // Logistics
  getDeliveryStatus:  (params = {}) => axiosInstance.get('/api/v1/customer/logistics/delivery-status', { params }).then(r => r.data),
  getSalesMap:        (params = {}) => axiosInstance.get('/api/v1/customer/logistics/sales-map', { params }).then(r => r.data),
  getSalesMapHistory: (params = {}) => axiosInstance.get('/api/v1/customer/logistics/sales-map/history', { params }).then(r => r.data),
};

export default etsyApi;
