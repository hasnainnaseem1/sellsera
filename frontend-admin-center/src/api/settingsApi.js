import axiosInstance from './axiosInstance';

const settingsApi = {
  /**
   * GET /api/v1/admin/settings
   */
  getSettings: () =>
    axiosInstance.get('/api/v1/admin/settings').then((r) => r.data),

  /**
   * PUT /api/v1/admin/settings/general
   */
  updateGeneral: (data) =>
    axiosInstance.put('/api/v1/admin/settings/general', data).then((r) => r.data),

  /**
   * PUT /api/v1/admin/settings/email
   */
  updateEmail: (data) =>
    axiosInstance.put('/api/v1/admin/settings/email', data).then((r) => r.data),

  /**
   * POST /api/v1/admin/settings/email/test
   * Send a test email to verify SMTP configuration
   */
  testEmail: (recipientEmail) =>
    axiosInstance.post('/api/v1/admin/settings/email/test', { recipientEmail }).then((r) => r.data),

  /**
   * PUT /api/v1/admin/settings/customer
   */
  updateCustomer: (data) =>
    axiosInstance.put('/api/v1/admin/settings/customer', data).then((r) => r.data),

  /**
   * PUT /api/v1/admin/settings/security
   */
  updateSecurity: (data) =>
    axiosInstance.put('/api/v1/admin/settings/security', data).then((r) => r.data),

  /**
   * PUT /api/v1/admin/settings/notification
   */
  updateNotification: (data) =>
    axiosInstance.put('/api/v1/admin/settings/notification', data).then((r) => r.data),

  /**
   * PUT /api/v1/admin/settings/maintenance
   */
  updateMaintenance: (data) =>
    axiosInstance.put('/api/v1/admin/settings/maintenance', data).then((r) => r.data),

  /**
   * PUT /api/v1/admin/settings/features
   */
  updateFeatures: (data) =>
    axiosInstance.put('/api/v1/admin/settings/features', data).then((r) => r.data),

  /**
   * GET /api/v1/admin/settings/theme
   */
  getTheme: () =>
    axiosInstance.get('/api/v1/admin/settings/theme').then((r) => r.data),

  /**
   * PUT /api/v1/admin/settings/theme
   */
  updateTheme: (data) =>
    axiosInstance.put('/api/v1/admin/settings/theme', data).then((r) => r.data),

  /**
   * GET /api/v1/admin/settings/email-blocking/domains
   * Get list of blocked temporary email domains
   */
  getBlockedDomains: () =>
    axiosInstance.get('/api/v1/admin/settings/email-blocking/domains').then((r) => r.data),

  /**
   * PUT /api/v1/admin/settings/email-blocking/domains
   * Update the entire list of blocked temporary email domains
   */
  updateBlockedDomains: (domains) =>
    axiosInstance.put('/api/v1/admin/settings/email-blocking/domains', { domains }).then((r) => r.data),

  /**
   * POST /api/v1/admin/settings/email-blocking/domains/:domain
   * Add a single domain to the blocked list
   */
  addBlockedDomain: (domain) =>
    axiosInstance.post(`/api/v1/admin/settings/email-blocking/domains/${domain}`).then((r) => r.data),

  /**
   * DELETE /api/v1/admin/settings/email-blocking/domains/:domain
   * Remove a domain from the blocked list
   */
  removeBlockedDomain: (domain) =>
    axiosInstance.delete(`/api/v1/admin/settings/email-blocking/domains/${domain}`).then((r) => r.data),

  /**
   * PUT /api/v1/admin/settings/google-sso
   * Update Google SSO configuration (super_admin only)
   */
  updateGoogleSSO: (data) =>
    axiosInstance.put('/api/v1/admin/settings/google-sso', data).then((r) => r.data),

  /**
   * PUT /api/v1/admin/settings/stripe
   * Update Stripe integration settings (super_admin only)
   */
  updateStripe: (data) =>
    axiosInstance.put('/api/v1/admin/settings/stripe', data).then((r) => r.data),

  /**
   * PUT /api/v1/admin/settings/lemonsqueezy
   * Update LemonSqueezy integration settings (super_admin only)
   */
  updateLemonSqueezy: (data) =>
    axiosInstance.put('/api/v1/admin/settings/lemonsqueezy', data).then((r) => r.data),

  /**
   * PUT /api/v1/admin/settings/payment-gateway
   * Set the active payment gateway (super_admin only)
   */
  updatePaymentGateway: (data) =>
    axiosInstance.put('/api/v1/admin/settings/payment-gateway', data).then((r) => r.data),

  // ── Cron Jobs ──

  /**
   * GET /api/v1/admin/cron
   * Get all cron job statuses
   */
  getCronJobs: () =>
    axiosInstance.get('/api/v1/admin/cron').then((r) => r.data),

  /**
   * POST /api/v1/admin/cron
   * Create a new custom cron job
   */
  createCronJob: (data) =>
    axiosInstance.post('/api/v1/admin/cron', data).then((r) => r.data),

  /**
   * PUT /api/v1/admin/cron/:key
   * Update a custom cron job
   */
  updateCronJob: (key, data) =>
    axiosInstance.put(`/api/v1/admin/cron/${key}`, data).then((r) => r.data),

  /**
   * DELETE /api/v1/admin/cron/:key
   * Delete a custom cron job
   */
  deleteCronJob: (key) =>
    axiosInstance.delete(`/api/v1/admin/cron/${key}`).then((r) => r.data),

  /**
   * PUT /api/v1/admin/cron/:key/toggle
   * Toggle a cron job on/off
   */
  toggleCronJob: (key) =>
    axiosInstance.put(`/api/v1/admin/cron/${key}/toggle`).then((r) => r.data),

  /**
   * POST /api/v1/admin/cron/:key/trigger
   * Manually trigger a cron job
   */
  triggerCronJob: (key) =>
    axiosInstance.post(`/api/v1/admin/cron/${key}/trigger`).then((r) => r.data),

  // ── Email Templates ──

  /**
   * GET /api/v1/admin/settings/email-templates
   * Get all email templates (custom + defaults)
   */
  getEmailTemplates: () =>
    axiosInstance.get('/api/v1/admin/settings/email-templates').then((r) => r.data),

  /**
   * PUT /api/v1/admin/settings/email-templates/:key
   * Update a single email template
   */
  updateEmailTemplate: (key, data) =>
    axiosInstance.put(`/api/v1/admin/settings/email-templates/${key}`, data).then((r) => r.data),

  /**
   * DELETE /api/v1/admin/settings/email-templates/:key
   * Reset a template to default
   */
  resetEmailTemplate: (key) =>
    axiosInstance.delete(`/api/v1/admin/settings/email-templates/${key}`).then((r) => r.data),

  /**
   * POST /api/v1/admin/settings/email-templates/:key/preview
   * Preview a rendered email template
   */
  previewEmailTemplate: (key, data) =>
    axiosInstance.post(`/api/v1/admin/settings/email-templates/${key}/preview`, data).then((r) => r.data),
};

export default settingsApi;
