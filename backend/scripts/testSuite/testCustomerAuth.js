/**
 * Test: Customer Auth (signup, login, profile, password)
 */
const { request, test, skip, section, printSummary, resetResults, customerLogin } = require('./helpers');
const cfg = require('./config');

async function run() {
  resetResults();
  section('CUSTOMER AUTH');

  // ── Login ───────────────────────────────────────────
  const loginRes = await request('POST', '/api/v1/auth/customer/login', {
    body: { email: cfg.CUSTOMER_EMAIL, password: cfg.CUSTOMER_PASSWORD }
  });
  test('POST /auth/customer/login — valid credentials', loginRes, {
    status: 200, success: true, hasFields: ['token']
  });
  const token = loginRes.data?.token;
  if (!token) {
    console.error('Customer login failed. Skipping remaining tests.');
    skip('All customer auth tests', 'No token');
    return printSummary('Customer Auth');
  }

  // ── Get profile ─────────────────────────────────────
  test('GET /auth/customer/me — get profile',
    await request('GET', '/api/v1/auth/customer/me', { token }),
    { status: 200, success: true, hasFields: ['user'] }
  );

  // ── Update profile ──────────────────────────────────
  test('PUT /auth/customer/me — update profile',
    await request('PUT', '/api/v1/auth/customer/me', {
      token, body: { name: 'Test Customer' }
    }),
    { status: 200, success: true }
  );

  // ── No token → 401 ─────────────────────────────────
  test('GET /auth/customer/me — no token (should 401)',
    await request('GET', '/api/v1/auth/customer/me'),
    { status: 401 }
  );

  // ── Wrong password login ────────────────────────────
  test('POST /auth/customer/login — wrong password (should fail)',
    await request('POST', '/api/v1/auth/customer/login', {
      body: { email: cfg.CUSTOMER_EMAIL, password: 'definitelywrong' }
    }),
    { success: false }
  );

  // ── Forgot password endpoint ────────────────────────
  test('POST /auth/customer/forgot-password — endpoint responds',
    await request('POST', '/api/v1/auth/customer/forgot-password', {
      body: { email: 'nonexistent@nowhere.com' }
    }),
    { custom: (d, s) => s === 0 ? 'Network error' : null }
  );

  // ── Resend verification endpoint ────────────────────
  test('POST /auth/customer/resend-verification — endpoint responds',
    await request('POST', '/api/v1/auth/customer/resend-verification', {
      body: { email: cfg.CUSTOMER_EMAIL }
    }),
    { custom: (d, s) => s === 0 ? 'Network error' : null }
  );

  return printSummary('Customer Auth');
}

if (require.main === module) run();
module.exports = { run };
