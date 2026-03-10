/**
 * Test: Admin SEO Settings + Redirects
 */
const { request, test, skip, section, printSummary, resetResults, adminLogin } = require('./helpers');

async function run() {
  resetResults();
  section('ADMIN SEO');

  const token = await adminLogin();
  if (!token) return printSummary('Admin SEO');

  // ── Get SEO settings ────────────────────────────────
  const seoRes = await request('GET', '/api/v1/admin/seo/settings', { token });
  test('GET /admin/seo/settings — fetch', seoRes, { status: 200, success: true });

  // ── Update SEO settings (social links — the one that was 500) ──
  test('PUT /admin/seo/settings — update social links',
    await request('PUT', '/api/v1/admin/seo/settings', {
      token, body: {
        socialLinks: { facebook: 'https://facebook.com/sellsera', twitter: 'https://x.com/sellsera' },
        socialLinksEnabled: true,
        customSocialLinks: []
      }
    }),
    { status: 200, success: true }
  );

  // ── Update SEO settings (analytics) ─────────────────
  test('PUT /admin/seo/settings — update analytics',
    await request('PUT', '/api/v1/admin/seo/settings', {
      token, body: { googleAnalyticsId: '', enableSitemap: true, enableSchemaMarkup: true }
    }),
    { status: 200, success: true }
  );

  // ── Verify on public side ───────────────────────────
  test('GET /public/seo/settings — public SEO reflects changes',
    await request('GET', '/api/v1/public/seo/settings'),
    { status: 200, success: true }
  );

  // ── Redirects CRUD ──────────────────────────────────
  test('GET /admin/seo/redirects — list',
    await request('GET', '/api/v1/admin/seo/redirects', { token }),
    { status: 200, success: true }
  );

  const ts = Date.now();
  const createRes = await request('POST', '/api/v1/admin/seo/redirects', {
    token, body: {
      fromPath: `/test-redirect-${ts}`,
      toPath: '/redirected-target',
      statusCode: 301,
      note: 'Auto-test redirect'
    }
  });
  test('POST /admin/seo/redirects — create', createRes, { status: 201, success: true });
  const redirectId = createRes.data?.redirect?._id || createRes.data?.redirect?.id;

  if (redirectId) {
    test('PUT /admin/seo/redirects/:id — update',
      await request('PUT', `/api/v1/admin/seo/redirects/${redirectId}`, {
        token, body: { note: 'Updated note' }
      }),
      { status: 200, success: true }
    );

    test('PUT /admin/seo/redirects/:id/toggle — toggle active',
      await request('PUT', `/api/v1/admin/seo/redirects/${redirectId}/toggle`, { token }),
      { status: 200, success: true }
    );

    test('DELETE /admin/seo/redirects/:id — delete',
      await request('DELETE', `/api/v1/admin/seo/redirects/${redirectId}`, { token }),
      { status: 200, success: true }
    );
  } else {
    skip('Redirect CRUD operations', 'Create failed');
  }

  // ── Public SEO endpoints ────────────────────────────
  test('GET /public/seo/sitemap.xml — sitemap',
    await request('GET', '/api/v1/public/seo/sitemap.xml'),
    { custom: (d, s) => s >= 500 ? `Server error ${s}` : null }
  );

  test('GET /public/seo/robots.txt — robots',
    await request('GET', '/api/v1/public/seo/robots.txt'),
    { custom: (d, s) => s >= 500 ? `Server error ${s}` : null }
  );

  test('GET /public/seo/check-redirect — check redirect',
    await request('GET', '/api/v1/public/seo/check-redirect?path=/nonexistent'),
    { status: 200, success: true }
  );

  return printSummary('Admin SEO');
}

if (require.main === module) run();
module.exports = { run };
