/**
 * Test: Admin Users CRUD
 */
const { request, test, skip, section, printSummary, resetResults, adminLogin } = require('./helpers');

async function run() {
  resetResults();
  section('ADMIN USERS');

  const token = await adminLogin();
  if (!token) return printSummary('Admin Users');

  // ── List users ──────────────────────────────────────
  const listRes = await request('GET', '/api/v1/admin/users', { token });
  test('GET /admin/users — list all', listRes, {
    status: 200, success: true
  });

  // ── Create user ─────────────────────────────────────
  const ts = Date.now();
  const createRes = await request('POST', '/api/v1/admin/users', {
    token, body: {
      name: `Test Admin ${ts}`,
      email: `testadmin_${ts}@sellsera-test.com`,
      password: 'TestPass123!',
      role: 'admin'
    }
  });
  test('POST /admin/users — create admin', createRes, { status: 201, success: true });
  const userId = createRes.data?.user?.id || createRes.data?.user?._id;

  if (userId) {
    // ── Get single user ─────────────────────────────
    test('GET /admin/users/:id — get created user',
      await request('GET', `/api/v1/admin/users/${userId}`, { token }),
      { status: 200, success: true }
    );

    // ── Update user ─────────────────────────────────
    test('PUT /admin/users/:id — update name',
      await request('PUT', `/api/v1/admin/users/${userId}`, {
        token, body: { name: `Updated Admin ${ts}` }
      }),
      { status: 200, success: true }
    );

    // ── Suspend user ────────────────────────────────
    test('POST /admin/users/:id/suspend — suspend',
      await request('POST', `/api/v1/admin/users/${userId}/suspend`, { token }),
      { status: 200, success: true }
    );

    // ── Activate user ───────────────────────────────
    test('POST /admin/users/:id/activate — activate',
      await request('POST', `/api/v1/admin/users/${userId}/activate`, { token }),
      { status: 200, success: true }
    );

    // ── Login history ───────────────────────────────
    test('GET /admin/users/:id/login-history — fetch',
      await request('GET', `/api/v1/admin/users/${userId}/login-history`, { token }),
      { status: 200, success: true }
    );

    // ── Delete user ─────────────────────────────────
    test('DELETE /admin/users/:id — delete',
      await request('DELETE', `/api/v1/admin/users/${userId}`, { token }),
      { status: 200, success: true }
    );
  } else {
    skip('User CRUD operations', 'Create failed — no user ID');
  }

  // ── Export CSV ──────────────────────────────────────
  test('GET /admin/users/export/csv — export',
    await request('GET', '/api/v1/admin/users/export/csv', { token }),
    { custom: (d, s) => s === 0 ? 'Network error' : (s >= 500 ? `Server error ${s}` : null) }
  );

  return printSummary('Admin Users');
}

if (require.main === module) run();
module.exports = { run };
