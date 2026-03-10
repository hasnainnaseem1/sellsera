/**
 * Test: Admin Roles CRUD
 */
const { request, test, skip, section, printSummary, resetResults, adminLogin } = require('./helpers');

async function run() {
  resetResults();
  section('ADMIN ROLES');

  const token = await adminLogin();
  if (!token) return printSummary('Admin Roles');

  // ── List roles ──────────────────────────────────────
  test('GET /admin/roles — list all',
    await request('GET', '/api/v1/admin/roles', { token }),
    { status: 200, success: true }
  );

  // ── Available permissions ───────────────────────────
  test('GET /admin/roles/permissions/available — list',
    await request('GET', '/api/v1/admin/roles/permissions/available', { token }),
    { status: 200, success: true }
  );

  // ── Create role ─────────────────────────────────────
  const ts = Date.now();
  const createRes = await request('POST', '/api/v1/admin/roles', {
    token, body: {
      name: `test_role_${ts}`,
      description: 'Auto-test role',
      permissions: ['users.view', 'analytics.view'],
      isActive: true
    }
  });
  test('POST /admin/roles — create', createRes, { status: 201, success: true });
  const roleId = createRes.data?.role?._id || createRes.data?.role?.id;

  if (roleId) {
    test('GET /admin/roles/:id — get',
      await request('GET', `/api/v1/admin/roles/${roleId}`, { token }),
      { status: 200, success: true }
    );

    test('PUT /admin/roles/:id — update',
      await request('PUT', `/api/v1/admin/roles/${roleId}`, {
        token, body: { description: 'Updated role', permissions: ['users.view'] }
      }),
      { status: 200, success: true }
    );

    test('DELETE /admin/roles/:id — delete',
      await request('DELETE', `/api/v1/admin/roles/${roleId}`, { token }),
      { status: 200, success: true }
    );
  } else {
    skip('Role CRUD operations', 'Create failed');
  }

  return printSummary('Admin Roles');
}

if (require.main === module) run();
module.exports = { run };
