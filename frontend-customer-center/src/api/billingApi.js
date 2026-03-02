import axiosInstance from './axiosInstance';

const billingApi = {
  /** POST /api/v1/customer/billing/checkout — create Stripe checkout session */
  createCheckout: ({ planId, billingCycle = 'monthly' }) =>
    axiosInstance
      .post('/api/v1/customer/billing/checkout', { planId, billingCycle })
      .then((r) => r.data),

  /** POST /api/v1/customer/billing/portal — open Stripe customer portal */
  createPortal: () =>
    axiosInstance
      .post('/api/v1/customer/billing/portal')
      .then((r) => r.data),

  /** GET /api/v1/customer/billing/payments — payment history */
  getPayments: (params = {}) =>
    axiosInstance
      .get('/api/v1/customer/billing/payments', { params })
      .then((r) => r.data),

  /** POST /api/v1/customer/billing/cancel — cancel subscription */
  cancelSubscription: ({ immediate = false } = {}) =>
    axiosInstance
      .post('/api/v1/customer/billing/cancel', { immediate })
      .then((r) => r.data),

  /** POST /api/v1/customer/billing/resume — resume cancelled subscription */
  resumeSubscription: () =>
    axiosInstance
      .post('/api/v1/customer/billing/resume')
      .then((r) => r.data),

  /** POST /api/v1/customer/billing/verify-session — activate subscription from session_id */
  verifySession: (sessionId) =>
    axiosInstance
      .post('/api/v1/customer/billing/verify-session', { sessionId })
      .then((r) => r.data),
};

export default billingApi;
