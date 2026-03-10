/**
 * Test: Admin Departments CRUD
 */
const { request, test, skip, section, printSummary, resetResults, adminLogin } = require('./helpers');

async function run() {
  resetResults();
  section('ADMIN DEPARTMENTS');

  const token = await adminLogin();
  if (!token) return printSummary('Admin Departments');

  test('GET /admin/departments — list all',
    await request('GET', '/api/v1/admin/departments', { token }),
    { status: 200, success: true }
  );

  test('GET /admin/departments/active — list active',
    await request('GET', '/api/v1/admin/departments/active', { token }),
    { status: 200, success: true }
  );

  // ── Create department ───────────────────────────────
  const ts = Date.now();
  const createRes = await request('POST', '/api/v1/admin/departments', {
    token, body: { name: `Test Dept ${ts}`, description: 'Auto-test department', isActive: true }
  });
  test('POST /admin/departments — create', createRes, { status: 201, success: true });
  const deptId = createRes.data?.department?._id || createRes.data?.department?.id;

  if (deptId) {
    test('GET /admin/departments/:id — get',
      await request('GET', `/api/v1/admin/departments/${deptId}`, { token }),
      { status: 200, success: true }
    );

    test('PUT /admin/departments/:id — update',
      await request('PUT', `/api/v1/admin/departments/${deptId}`, {
        token, body: { description: 'Updated dept' }
      }),
      { status: 200, success: true }
    );

    test('DELETE /admin/departments/:id — delete',
      await request('DELETE', `/api/v1/admin/departments/${deptId}`, { token }),
      { status: 200, success: true }
    );
  } else {
    skip('Department CRUD operations', 'Create failed');
  }

  return printSummary('Admin Departments');
}

if (require.main === module) run();
module.exports = { run };
