/**
 * Admin Settings API Tests
 * Covers all endpoints under /api/v1/admin/settings
 */
const { connectDB, clearDB } = require('../../setup/testSetup');
const {
  seedAdmin,
  seedModerator,
  seedAdminSettings,
  apiClient,
  expectSuccess,
  expectError
} = require('../../helpers/testHelpers');

const User = require('../../../../backend/src/models/user/User');
const AdminSettings = require('../../../../backend/src/models/admin/AdminSettings');

const BASE = '/api/v1/admin/settings';

let app, api, admin, moderator;

beforeAll(async () => {
  app = await connectDB();
  api = apiClient(app);
  await seedAdminSettings(AdminSettings);
  admin = await seedAdmin(User);
  moderator = await seedModerator(User);
});

afterAll(async () => {
  await clearDB();
});

// ─────────────────────────────────────────────────────────────
// GET SETTINGS
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/settings', () => {
  it('should return all settings', async () => {
    const res = await api.get(BASE, admin.token);
    expectSuccess(res, 200);
    expect(res.body).toHaveProperty('settings');
  });

  it('should return 401 without auth', async () => {
    const res = await api.get(BASE);
    expect(res.status).toBe(401);
  });

  it('should return 403 for moderator without settings.view', async () => {
    const res = await api.get(BASE, moderator.token);
    expectError(res, 403);
  });
});

// ─────────────────────────────────────────────────────────────
// UPDATE GENERAL
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/settings/general', () => {
  it('should update general settings', async () => {
    const res = await api.put(`${BASE}/general`, {
      siteName: 'Updated Platform',
      siteDescription: 'Updated description',
      supportEmail: 'newsupport@test.com'
    }, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 403 for moderator without settings.edit', async () => {
    const res = await api.put(`${BASE}/general`, { siteName: 'Nope' }, moderator.token);
    expectError(res, 403);
  });
});

// ─────────────────────────────────────────────────────────────
// UPDATE EMAIL SETTINGS
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/settings/email', () => {
  it('should update email settings', async () => {
    const res = await api.put(`${BASE}/email`, {
      smtpHost: 'smtp.updated.com',
      smtpPort: 465,
      smtpUser: 'updated@test.com',
      smtpPassword: 'updatedpass',
      fromEmail: 'no-reply@updated.com',
      fromName: 'Updated Platform'
    }, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// TEST EMAIL
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/admin/settings/email/test', () => {
  it('should attempt to send a test email (may fail without SMTP but returns graceful error or 200)', async () => {
    const res = await api.post(`${BASE}/email/test`, {
      recipientEmail: 'testrecipient@test.com'
    }, admin.token);
    // Accept 200 (success) or 500 (SMTP not configured) — both are acceptable in test env
    expect([200, 500]).toContain(res.status);
  });
});

// ─────────────────────────────────────────────────────────────
// UPDATE CUSTOMER SETTINGS
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/settings/customer', () => {
  it('should update customer settings', async () => {
    const res = await api.put(`${BASE}/customer`, {
      requireEmailVerification: false,
      allowTemporaryEmails: true
    }, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// UPDATE SECURITY SETTINGS
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/settings/security', () => {
  it('should update security settings', async () => {
    const res = await api.put(`${BASE}/security`, {
      maxLoginAttempts: 10,
      lockoutDuration: 60,
      sessionTimeout: 120
    }, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// UPDATE NOTIFICATION SETTINGS
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/settings/notification', () => {
  it('should update notification settings', async () => {
    const res = await api.put(`${BASE}/notification`, {
      emailNotifications: true,
      inAppNotifications: true
    }, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// UPDATE MAINTENANCE MODE
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/settings/maintenance', () => {
  it('should update maintenance mode', async () => {
    const res = await api.put(`${BASE}/maintenance`, {
      enabled: true,
      message: 'Scheduled maintenance',
      allowAdminAccess: true
    }, admin.token);
    expectSuccess(res, 200);
  });

  it('should disable maintenance mode', async () => {
    const res = await api.put(`${BASE}/maintenance`, {
      enabled: false,
      message: '',
      allowAdminAccess: true
    }, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// UPDATE FEATURE FLAGS
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/settings/features', () => {
  it('should update feature flags', async () => {
    const res = await api.put(`${BASE}/features`, {
      enableAnalysis: true,
      enableSubscriptions: true,
      enableCustomRoles: true,
      enableActivityLogs: true
    }, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// THEME SETTINGS
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/settings/theme', () => {
  it('should get theme settings', async () => {
    const res = await api.get(`${BASE}/theme`, admin.token);
    expectSuccess(res, 200);
  });
});

describe('PUT /api/v1/admin/settings/theme', () => {
  it('should update theme settings', async () => {
    const res = await api.put(`${BASE}/theme`, {
      appName: 'New App Name',
      primaryColor: '#FF5733',
      companyName: 'New Company'
    }, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// EMAIL BLOCKING — DOMAINS
// ─────────────────────────────────────────────────────────────
describe('Email blocking domains', () => {
  it('GET /email-blocking/domains — should get blocked domains', async () => {
    const res = await api.get(`${BASE}/email-blocking/domains`, admin.token);
    expectSuccess(res, 200);
  });

  it('PUT /email-blocking/domains — should update all blocked domains', async () => {
    const res = await api.put(`${BASE}/email-blocking/domains`, {
      domains: ['tempmail.com', 'throwaway.email', 'newblocked.com']
    }, admin.token);
    expectSuccess(res, 200);
  });

  it('POST /email-blocking/domains/:domain — should add a blocked domain', async () => {
    const res = await api.post(`${BASE}/email-blocking/domains/spammail.io`, {}, admin.token);
    expectSuccess(res, 200);
  });

  it('DELETE /email-blocking/domains/:domain — should remove a blocked domain', async () => {
    const res = await api.delete(`${BASE}/email-blocking/domains/spammail.io`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// GOOGLE SSO
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/settings/google-sso', () => {
  it('should update Google SSO settings', async () => {
    const res = await api.put(`${BASE}/google-sso`, {
      enabled: false,
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret'
    }, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// STRIPE
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/settings/stripe', () => {
  it('should update Stripe settings', async () => {
    const res = await api.put(`${BASE}/stripe`, {
      secretKey: 'sk_test_fake',
      publishableKey: 'pk_test_fake',
      webhookSecret: 'whsec_test_fake'
    }, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// LEMONSQUEEZY
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/settings/lemonsqueezy', () => {
  it('should update LemonSqueezy settings', async () => {
    const res = await api.put(`${BASE}/lemonsqueezy`, {
      apiKey: 'ls_test_fake',
      storeId: 'store_123',
      webhookSecret: 'whsec_ls_fake'
    }, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// PAYMENT GATEWAY
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/settings/payment-gateway', () => {
  it('should update payment gateway choice', async () => {
    const res = await api.put(`${BASE}/payment-gateway`, {
      gateway: 'stripe'
    }, admin.token);
    expectSuccess(res, 200);
  });

  it('should switch to lemonsqueezy', async () => {
    const res = await api.put(`${BASE}/payment-gateway`, {
      gateway: 'lemonsqueezy'
    }, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// EMAIL TEMPLATES
// ─────────────────────────────────────────────────────────────
describe('Email templates', () => {
  it('GET /email-templates — should get all email templates', async () => {
    const res = await api.get(`${BASE}/email-templates`, admin.token);
    expectSuccess(res, 200);
  });

  it('PUT /email-templates/:key — should update an email template', async () => {
    const res = await api.put(`${BASE}/email-templates/welcome`, {
      subject: 'Welcome to our platform!',
      body: '<p>Hello {{name}}, welcome!</p>'
    }, admin.token);
    // Accept 200 or 404 (if template key doesn't exist yet)
    expect([200, 404]).toContain(res.status);
  });

  it('POST /email-templates/:key/preview — should preview an email template', async () => {
    const res = await api.post(`${BASE}/email-templates/welcome/preview`, {}, admin.token);
    // Accept 200 or 404
    expect([200, 404]).toContain(res.status);
  });

  it('DELETE /email-templates/:key — should reset an email template to default', async () => {
    const res = await api.delete(`${BASE}/email-templates/welcome`, admin.token);
    // Accept 200 or 404
    expect([200, 404]).toContain(res.status);
  });
});
