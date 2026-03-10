/**
 * Test: Admin Authentication
 */
const { request, test, section, printSummary, resetResults, adminLogin } = require('./helpers');
const cfg = require('./config');

async function run() {
  resetResults();
  section('ADMIN AUTH');

  // 1 — Login
  const loginRes = await request('POST', '/api/v1/auth/admin/login', {
    body: { email: cfg.ADMIN_EMAIL, password: cfg.ADMIN_PASSWORD }
  });
  test('POST /auth/admin/login — valid credentials', loginRes, {
    status: 200, success: true, hasFields: ['token']
  });
  const token = loginRes.data?.token;
  if (!token) { console.error('Cannot continue without token'); return printSummary('Admin Auth'); }

  // 2 — Get profile
  test('GET /auth/admin/me — get profile',
    await request('GET', '/api/v1/auth/admin/me', { token }),
    { status: 200, success: true, hasFields: ['user'] }
  );

  // 3 — Update profile
  test('PUT /auth/admin/profile — update profile',
    await request('PUT', '/api/v1/auth/admin/profile', { token, body: { name: 'Super Admin' } }),
    { status: 200, success: true }
  );

  // 4 — Login with wrong password
  test('POST /auth/admin/login — wrong password (should fail)',
    await request('POST', '/api/v1/auth/admin/login', { body: { email: cfg.ADMIN_EMAIL, password: 'wrongpassword' } }),
    { success: false }
  );

  // 5 — Access without token
  test('GET /auth/admin/me — no token (should 401)',
    await request('GET', '/api/v1/auth/admin/me'),
    { status: 401 }
  );

  // 6 — Forgot password (just verify endpoint works)
  test('POST /auth/admin/forgot-password — endpoint responds',
    await request('POST', '/api/v1/auth/admin/forgot-password', { body: { email: 'nonexistent@test.com' } }),
    { custom: (d, s) => s === 0 ? 'Network error' : null }
  );

  return printSummary('Admin Auth');
}

if (require.main === module) run();
module.exports = { run };
