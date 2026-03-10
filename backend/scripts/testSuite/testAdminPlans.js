/**
 * Test: Admin Plans CRUD
 */
const { request, test, skip, section, printSummary, resetResults, adminLogin } = require('./helpers');

async function run() {
  resetResults();
  section('ADMIN PLANS');

  const token = await adminLogin();
  if (!token) return printSummary('Admin Plans');

  // ── List plans ──────────────────────────────────────
  const listRes = await request('GET', '/api/v1/admin/plans', { token });
  test('GET /admin/plans — list all', listRes, { status: 200, success: true });

  // ── Get features for plan form ─────────────────────
  test('GET /admin/plans/features — list features',
    await request('GET', '/api/v1/admin/plans/features', { token }),
    { status: 200, success: true }
  );

  // ── Create plan ─────────────────────────────────────
  const ts = Date.now();
  const createRes = await request('POST', '/api/v1/admin/plans', {
    token, body: {
      name: `Test Plan ${ts}`,
      description: 'Auto-test plan',
      price: 9.99,
      billingCycle: 'monthly',
      isActive: false,
      features: {}
    }
  });
  test('POST /admin/plans — create', createRes, { status: 201, success: true });
  const planId = createRes.data?.plan?._id || createRes.data?.plan?.id;

  if (planId) {
    // ── Get single plan ─────────────────────────────
    test('GET /admin/plans/:id — get',
      await request('GET', `/api/v1/admin/plans/${planId}`, { token }),
      { status: 200, success: true }
    );

    // ── Update plan ─────────────────────────────────
    test('PUT /admin/plans/:id — update',
      await request('PUT', `/api/v1/admin/plans/${planId}`, {
        token, body: { description: 'Updated test plan' }
      }),
      { status: 200, success: true }
    );

    // ── Toggle status ───────────────────────────────
    test('PUT /admin/plans/:id/toggle-status — toggle',
      await request('PUT', `/api/v1/admin/plans/${planId}/toggle-status`, { token }),
      { status: 200, success: true }
    );

    // ── Delete plan ─────────────────────────────────
    test('DELETE /admin/plans/:id — delete',
      await request('DELETE', `/api/v1/admin/plans/${planId}`, { token }),
      { status: 200, success: true }
    );
  } else {
    skip('Plan CRUD operations', 'Create failed');
  }

  // ── Export CSV ──────────────────────────────────────
  test('GET /admin/plans/export/csv — export',
    await request('GET', '/api/v1/admin/plans/export/csv', { token }),
    { custom: (d, s) => s >= 500 ? `Server error ${s}` : null }
  );

  return printSummary('Admin Plans');
}

if (require.main === module) run();
module.exports = { run };
