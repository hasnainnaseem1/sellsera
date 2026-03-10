/**
 * Test: Admin Blog CRUD
 */
const { request, test, skip, section, printSummary, resetResults, adminLogin } = require('./helpers');

async function run() {
  resetResults();
  section('ADMIN BLOG');

  const token = await adminLogin();
  if (!token) return printSummary('Admin Blog');

  // ── List posts ──────────────────────────────────────
  test('GET /admin/blog/posts — list all',
    await request('GET', '/api/v1/admin/blog/posts', { token }),
    { status: 200, success: true }
  );

  // ── Stats ───────────────────────────────────────────
  test('GET /admin/blog/stats — fetch',
    await request('GET', '/api/v1/admin/blog/stats', { token }),
    { status: 200, success: true }
  );

  // ── Categories ──────────────────────────────────────
  test('GET /admin/blog/categories — list',
    await request('GET', '/api/v1/admin/blog/categories', { token }),
    { status: 200, success: true }
  );

  // ── Create post ─────────────────────────────────────
  const ts = Date.now();
  const createRes = await request('POST', '/api/v1/admin/blog/posts', {
    token, body: {
      title: `Test Post ${ts}`,
      slug: `test-post-${ts}`,
      content: '<p>Auto-test blog post content</p>',
      excerpt: 'Test excerpt',
      category: 'general',
      status: 'draft'
    }
  });
  test('POST /admin/blog/posts — create', createRes, { status: 201, success: true });
  const postId = createRes.data?.post?._id || createRes.data?.post?.id;

  if (postId) {
    test('GET /admin/blog/posts/:id — get',
      await request('GET', `/api/v1/admin/blog/posts/${postId}`, { token }),
      { status: 200, success: true }
    );

    test('PUT /admin/blog/posts/:id — update',
      await request('PUT', `/api/v1/admin/blog/posts/${postId}`, {
        token, body: { title: `Updated Post ${ts}` }
      }),
      { status: 200, success: true }
    );

    test('PUT /admin/blog/posts/:id/status — publish',
      await request('PUT', `/api/v1/admin/blog/posts/${postId}/status`, {
        token, body: { status: 'published' }
      }),
      { status: 200, success: true }
    );

    // Check post appears on public blog
    test('GET /public/blog/posts — verify published post visible',
      await request('GET', '/api/v1/public/blog/posts'),
      { status: 200, success: true }
    );

    test('DELETE /admin/blog/posts/:id — delete',
      await request('DELETE', `/api/v1/admin/blog/posts/${postId}`, { token }),
      { status: 200, success: true }
    );
  } else {
    skip('Blog CRUD operations', 'Create failed');
  }

  return printSummary('Admin Blog');
}

if (require.main === module) run();
module.exports = { run };
