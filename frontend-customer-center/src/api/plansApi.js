import axiosInstance from './axiosInstance';

const plansApi = {
  /** GET /api/v1/customer/plans — list plans (authenticated, shows isCurrent) */
  getPlans: () =>
    axiosInstance
      .get('/api/v1/customer/plans')
      .then((r) => r.data),

  /** GET /api/v1/public/plans — list plans (public, no auth) */
  getPublicPlans: () =>
    axiosInstance
      .get('/api/v1/public/plans')
      .then((r) => r.data),
};

export default plansApi;
