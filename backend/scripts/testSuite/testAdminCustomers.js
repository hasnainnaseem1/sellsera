/**
 * Test: Admin Customers Management
 */
const { request, test, skip, section, printSummary, resetResults, adminLogin } = require('./helpers');

async function run() {
  resetResults();
  section('ADMIN CUSTOMERS');

  const token = await adminLogin();
  if (!token) return printSummary('Admin Customers');

  // ── List customers ──────────────────────────────────
  const listRes = await request('GET', '/api/v1/admin/customers', { token });
  test('GET /admin/customers — list all', listRes, {
    status: 200, success: true, hasFields: ['customers']
  });

  const customers = listRes.data?.customers || [];
  const custId = customers[0]?.id || customers[0]?._id;

  if (custId) {
    // ── Get single ──────────────────────────────────
    test('GET /admin/customers/:id — get customer',
      await request('GET', `/api/v1/admin/customers/${custId}`, { token }),
      { status: 200, success: true }
    );

    // ── Activity logs ───────────────────────────────
    test('GET /admin/customers/:id/activity — fetch',
      await request('GET', `/api/v1/admin/customers/${custId}/activity`, { token }),
      { status: 200, success: true }
    );

    // ── Login history ───────────────────────────────
    test('GET /admin/customers/:id/login-history — fetch',
      await request('GET', `/api/v1/admin/customers/${custId}/login-history`, { token }),
      { status: 200, success: true }
    );

    // ── Usage analytics ─────────────────────────────
    test('GET /admin/customers/:id/usage-analytics — fetch',
      await request('GET', `/api/v1/admin/customers/${custId}/usage-analytics`, { token }),
      { status: 200, success: true }
    );

    // ── Payments ────────────────────────────────────
    test('GET /admin/customers/:id/payments — fetch',
      await request('GET', `/api/v1/admin/customers/${custId}/payments`, { token }),
      { status: 200 }
    );

    // ── Analyses ────────────────────────────────────
    test('GET /admin/customers/:id/analyses — fetch',
      await request('GET', `/api/v1/admin/customers/${custId}/analyses`, { token }),
      { status: 200 }
    );

    // ── Update status ───────────────────────────────
    test('PUT /admin/customers/:id/status — set active',
      await request('PUT', `/api/v1/admin/customers/${custId}/status`, {
        token, body: { status: 'active' }
      }),
      { status: 200, success: true }
    );

    // ── Reset usage ─────────────────────────────────
    test('POST /admin/customers/:id/reset-usage — reset',
      await request('POST', `/api/v1/admin/customers/${custId}/reset-usage`, { token }),
      { status: 200, success: true }
    );

    // ── Verify email ────────────────────────────────
    test('POST /admin/customers/:id/verify-email — verify',
      await request('POST', `/api/v1/admin/customers/${custId}/verify-email`, { token }),
      { custom: (d, s) => s >= 500 ? `Server error ${s}` : null }
    );

    // ── Export activity CSV ─────────────────────────
    test('GET /admin/customers/:id/activity/export — CSV',
      await request('GET', `/api/v1/admin/customers/${custId}/activity/export`, { token }),
      { custom: (d, s) => s === 0 ? 'Network error' : (s >= 500 ? `Server error ${s}` : null) }
    );
  } else {
    skip('Customer detail operations', 'No customers found to test with');
  }

  // ── Export CSV ──────────────────────────────────────
  test('GET /admin/customers/export/csv — export all',
    await request('GET', '/api/v1/admin/customers/export/csv', { token }),
    { custom: (d, s) => s === 0 ? 'Network error' : (s >= 500 ? `Server error ${s}` : null) }
  );

  return printSummary('Admin Customers');
}

if (require.main === module) run();
module.exports = { run };
