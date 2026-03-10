/**
 * Test: Admin Marketing Pages CRUD
 */
const { request, test, skip, section, printSummary, resetResults, adminLogin } = require('./helpers');

async function run() {
  resetResults();
  section('ADMIN MARKETING PAGES');

  const token = await adminLogin();
  if (!token) return printSummary('Admin Marketing');

  // ── List pages ──────────────────────────────────────
  const listRes = await request('GET', '/api/v1/admin/marketing/pages', { token });
  test('GET /admin/marketing/pages — list all', listRes, { status: 200, success: true });

  // ── Navigation ──────────────────────────────────────
  test('GET /admin/marketing/navigation — fetch',
    await request('GET', '/api/v1/admin/marketing/navigation', { token }),
    { status: 200, success: true }
  );

  // ── Create page ─────────────────────────────────────
  const ts = Date.now();
  const createRes = await request('POST', '/api/v1/admin/marketing/pages', {
    token, body: {
      title: `Test Page ${ts}`,
      slug: `test-page-${ts}`,
      content: { sections: [] },
      status: 'draft',
      showInNavigation: false
    }
  });
  test('POST /admin/marketing/pages — create', createRes, { status: 201, success: true });
  const pageId = createRes.data?.page?._id || createRes.data?.page?.id;

  if (pageId) {
    test('GET /admin/marketing/pages/:id — get',
      await request('GET', `/api/v1/admin/marketing/pages/${pageId}`, { token }),
      { status: 200, success: true }
    );

    test('PUT /admin/marketing/pages/:id — update',
      await request('PUT', `/api/v1/admin/marketing/pages/${pageId}`, {
        token, body: { title: `Updated Page ${ts}` }
      }),
      { status: 200, success: true }
    );

    test('PUT /admin/marketing/pages/:id/status — publish',
      await request('PUT', `/api/v1/admin/marketing/pages/${pageId}/status`, {
        token, body: { status: 'published' }
      }),
      { status: 200, success: true }
    );

    // ── Clone page ──────────────────────────────────
    const cloneRes = await request('POST', `/api/v1/admin/marketing/pages/${pageId}/clone`, { token });
    test('POST /admin/marketing/pages/:id/clone — clone', cloneRes, { status: 201, success: true });
    const clonedId = cloneRes.data?.page?._id || cloneRes.data?.page?.id;

    // Delete clone
    if (clonedId) {
      await request('DELETE', `/api/v1/admin/marketing/pages/${clonedId}`, { token });
    }

    test('DELETE /admin/marketing/pages/:id — delete',
      await request('DELETE', `/api/v1/admin/marketing/pages/${pageId}`, { token }),
      { status: 200, success: true }
    );
  } else {
    skip('Marketing page CRUD operations', 'Create failed');
  }

  return printSummary('Admin Marketing');
}

if (require.main === module) run();
module.exports = { run };
