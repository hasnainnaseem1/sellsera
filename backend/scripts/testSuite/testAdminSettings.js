/**
 * Test: Admin Settings — All settings CRUD
 * Tests: general, email, customer, security, notification, maintenance,
 *        features, theme/branding, Google SSO, Stripe, blocked domains,
 *        email templates, LemonSqueezy, payment gateway
 */
const { request, test, skip, section, printSummary, resetResults, adminLogin } = require('./helpers');

async function run() {
  resetResults();
  section('ADMIN SETTINGS');

  const token = await adminLogin();
  if (!token) return printSummary('Admin Settings');

  // ── GET all settings ────────────────────────────────
  const settingsRes = await request('GET', '/api/v1/admin/settings', { token });
  test('GET /admin/settings — fetch all', settingsRes, {
    status: 200, success: true, hasFields: ['settings']
  });

  // ── General settings ────────────────────────────────
  test('PUT /admin/settings/general — update site name',
    await request('PUT', '/api/v1/admin/settings/general', {
      token, body: { siteName: 'Sellsera', siteDescription: 'SaaS Platform' }
    }),
    { status: 200, success: true }
  );

  // ── Email / SMTP settings ──────────────────────────
  test('PUT /admin/settings/email — update SMTP',
    await request('PUT', '/api/v1/admin/settings/email', {
      token, body: { smtpHost: 'smtp.example.com', smtpPort: 587, fromEmail: 'noreply@sellsera.com', fromName: 'Sellsera' }
    }),
    { status: 200, success: true }
  );

  // ── Send test email (will fail if SMTP not configured, but endpoint should respond) ──
  test('POST /admin/settings/email/test — endpoint responds',
    await request('POST', '/api/v1/admin/settings/email/test', {
      token, body: { recipientEmail: 'test@example.com' }
    }),
    { custom: (d, s) => s === 0 ? 'Network error' : null }
  );

  // ── Customer settings ──────────────────────────────
  test('PUT /admin/settings/customer — update',
    await request('PUT', '/api/v1/admin/settings/customer', {
      token, body: { requireEmailVerification: true, freeTrialDays: 7 }
    }),
    { status: 200, success: true }
  );

  // ── Security settings ──────────────────────────────
  test('PUT /admin/settings/security — update',
    await request('PUT', '/api/v1/admin/settings/security', {
      token, body: { maxLoginAttempts: 5, passwordMinLength: 8 }
    }),
    { status: 200, success: true }
  );

  // ── Notification settings ──────────────────────────
  test('PUT /admin/settings/notification — update',
    await request('PUT', '/api/v1/admin/settings/notification', {
      token, body: { enableEmailNotifications: true }
    }),
    { status: 200, success: true }
  );

  // ── Feature flags ──────────────────────────────────
  test('PUT /admin/settings/features — update',
    await request('PUT', '/api/v1/admin/settings/features', {
      token, body: { enableCustomerSignup: true, enableLogin: true, enableAnalysis: true, enableSubscriptions: true }
    }),
    { status: 200, success: true }
  );

  // ── Maintenance mode ───────────────────────────────
  test('PUT /admin/settings/maintenance — disable',
    await request('PUT', '/api/v1/admin/settings/maintenance', {
      token, body: { enabled: false, message: 'Under maintenance' }
    }),
    { status: 200, success: true }
  );

  // ── Theme / Branding ───────────────────────────────
  const origTheme = settingsRes.data?.settings?.themeSettings || {};
  
  test('GET /admin/settings/theme — fetch theme',
    await request('GET', '/api/v1/admin/settings/theme', { token }),
    { status: 200, success: true, hasFields: ['themeSettings'] }
  );

  // Save a branding change
  const testColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
  test('PUT /admin/settings/theme — update branding',
    await request('PUT', '/api/v1/admin/settings/theme', {
      token, body: { primaryColor: testColor, companyName: 'Sellsera' }
    }),
    { status: 200, success: true }
  );

  // Verify branding reflects on public endpoint
  const publicSite = await request('GET', '/api/v1/public/marketing/site');
  test('GET /public/marketing/site — branding change reflected', publicSite, {
    status: 200, success: true,
    custom: (d) => {
      if (d?.site?.primaryColor !== testColor) {
        return `Expected primaryColor ${testColor}, got ${d?.site?.primaryColor}`;
      }
      return null;
    }
  });

  // Restore original color if available
  if (origTheme.primaryColor) {
    await request('PUT', '/api/v1/admin/settings/theme', {
      token, body: { primaryColor: origTheme.primaryColor }
    });
  }

  // ── Google SSO ─────────────────────────────────────
  test('PUT /admin/settings/google-sso — update',
    await request('PUT', '/api/v1/admin/settings/google-sso', {
      token, body: { enabled: false, clientId: '' }
    }),
    { status: 200, success: true }
  );

  // ── Stripe settings ────────────────────────────────
  test('PUT /admin/settings/stripe — update',
    await request('PUT', '/api/v1/admin/settings/stripe', {
      token, body: { publicKey: '' }
    }),
    { status: 200, success: true }
  );

  // ── LemonSqueezy settings ─────────────────────────
  test('PUT /admin/settings/lemonsqueezy — update',
    await request('PUT', '/api/v1/admin/settings/lemonsqueezy', {
      token, body: { enabled: false }
    }),
    { custom: (d, s) => s === 0 ? 'Network error' : null }
  );

  // ── Payment gateway ────────────────────────────────
  test('PUT /admin/settings/payment-gateway — set',
    await request('PUT', '/api/v1/admin/settings/payment-gateway', {
      token, body: { gateway: 'stripe' }
    }),
    { custom: (d, s) => s === 0 ? 'Network error' : null }
  );

  // ── Blocked domains ────────────────────────────────
  test('GET /admin/settings/email-blocking/domains — fetch',
    await request('GET', '/api/v1/admin/settings/email-blocking/domains', { token }),
    { status: 200, success: true }
  );

  test('PUT /admin/settings/email-blocking/domains — update list',
    await request('PUT', '/api/v1/admin/settings/email-blocking/domains', {
      token, body: { domains: ['tempmail.com', 'throwaway.email'] }
    }),
    { status: 200, success: true }
  );

  test('POST /admin/settings/email-blocking/domains/testblock.com — add',
    await request('POST', '/api/v1/admin/settings/email-blocking/domains/testblock.com', { token }),
    { status: 200, success: true }
  );

  test('DELETE /admin/settings/email-blocking/domains/testblock.com — remove',
    await request('DELETE', '/api/v1/admin/settings/email-blocking/domains/testblock.com', { token }),
    { status: 200, success: true }
  );

  // ── Email templates ────────────────────────────────
  const templatesRes = await request('GET', '/api/v1/admin/settings/email-templates', { token });
  test('GET /admin/settings/email-templates — fetch', templatesRes, {
    status: 200, success: true, hasFields: ['templates']
  });

  // Get a template key to test with
  const templateKeys = Object.keys(templatesRes.data?.templates || {});
  if (templateKeys.length > 0) {
    const testKey = templateKeys[0];
    test(`PUT /admin/settings/email-templates/${testKey} — update`,
      await request('PUT', `/api/v1/admin/settings/email-templates/${testKey}`, {
        token, body: { subject: '', body: '' }  // Reset to default
      }),
      { status: 200, success: true }
    );

    test(`POST /admin/settings/email-templates/${testKey}/preview — preview`,
      await request('POST', `/api/v1/admin/settings/email-templates/${testKey}/preview`, { token }),
      { status: 200, success: true }
    );

    test(`DELETE /admin/settings/email-templates/${testKey} — reset`,
      await request('DELETE', `/api/v1/admin/settings/email-templates/${testKey}`, { token }),
      { status: 200, success: true }
    );
  }

  return printSummary('Admin Settings');
}

if (require.main === module) run();
module.exports = { run };
