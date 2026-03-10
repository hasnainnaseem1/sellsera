/**
 * Test: Admin Features CRUD
 */
const { request, test, skip, section, printSummary, resetResults, adminLogin } = require('./helpers');

async function run() {
  resetResults();
  section('ADMIN FEATURES');

  const token = await adminLogin();
  if (!token) return printSummary('Admin Features');

  // ── List features ───────────────────────────────────
  test('GET /admin/features — list all',
    await request('GET', '/api/v1/admin/features', { token }),
    { status: 200, success: true }
  );

  // ── Create feature ──────────────────────────────────
  const ts = Date.now();
  const createRes = await request('POST', '/api/v1/admin/features', {
    token, body: {
      name: `test_feature_${ts}`,
      displayName: `Test Feature ${ts}`,
      description: 'Auto-test feature',
      type: 'boolean',
      category: 'testing',
      isActive: false
    }
  });
  test('POST /admin/features — create', createRes, { status: 201, success: true });
  const featureId = createRes.data?.feature?._id || createRes.data?.feature?.id;

  if (featureId) {
    test('GET /admin/features/:id — get',
      await request('GET', `/api/v1/admin/features/${featureId}`, { token }),
      { status: 200, success: true }
    );

    test('PUT /admin/features/:id — update',
      await request('PUT', `/api/v1/admin/features/${featureId}`, {
        token, body: { description: 'Updated feature' }
      }),
      { status: 200, success: true }
    );

    test('PUT /admin/features/:id/toggle-status — toggle',
      await request('PUT', `/api/v1/admin/features/${featureId}/toggle-status`, { token }),
      { status: 200, success: true }
    );

    test('DELETE /admin/features/:id — delete',
      await request('DELETE', `/api/v1/admin/features/${featureId}`, { token }),
      { status: 200, success: true }
    );
  } else {
    skip('Feature CRUD operations', 'Create failed');
  }

  test('GET /admin/features/export/csv — export',
    await request('GET', '/api/v1/admin/features/export/csv', { token }),
    { custom: (d, s) => s >= 500 ? `Server error ${s}` : null }
  );

  return printSummary('Admin Features');
}

if (require.main === module) run();
module.exports = { run };
