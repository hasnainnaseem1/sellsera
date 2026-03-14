import axiosInstance from './axiosInstance';

const subscriptionApi = {
  /** Get current subscription & plan info */
  getSubscription: () =>
    axiosInstance.get('/api/v1/customer/subscription').then(r => r.data),

  /** Get feature usage (remaining, used, limits) */
  getUsage: () =>
    axiosInstance.get('/api/v1/customer/subscription/usage').then(r => r.data),
};

export default subscriptionApi;
