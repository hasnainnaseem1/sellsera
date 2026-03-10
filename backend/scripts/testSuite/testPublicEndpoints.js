/**
 * Test: Public / Marketing Endpoints (no auth required)
 */
const { request, test, skip, section, printSummary, resetResults } = require('./helpers');

async function run() {
  resetResults();
  section('PUBLIC / MARKETING ENDPOINTS');

  // ── Site Settings & Branding ────────────────────────
  const siteRes = await request('GET', '/api/v1/public/marketing/site');
  test('GET /public/marketing/site — site settings & branding', siteRes, {
    status: 200, success: true
  });

  // Verify Cache-Control header prevents caching
  test('Site settings has no-cache header', siteRes, {
    custom: (d, s, h) => {
      const cc = h?.['cache-control'] || '';
      return cc.includes('no-store') ? null : `Expected Cache-Control: no-store, got: "${cc}"`;
    }
  });

  // Verify branding data present
  test('Site settings contains themeSettings', siteRes, {
    custom: (d) => {
      const settings = d?.settings || d?.data || d;
      if (settings?.themeSettings || settings?.theme) return null;
      return 'themeSettings missing from response';
    }
  });

  // ── Navigation ──────────────────────────────────────
  test('GET /public/marketing/navigation — nav items',
    await request('GET', '/api/v1/public/marketing/navigation'),
    { status: 200, success: true }
  );

  // ── Marketing Pages ─────────────────────────────────
  const pagesRes = await request('GET', '/api/v1/public/marketing/pages');
  test('GET /public/marketing/pages — all pages', pagesRes, {
    status: 200, success: true
  });

  const pages = pagesRes.data?.pages || pagesRes.data || [];
  if (pages[0]) {
    const slug = pages[0].slug || pages[0].path;
    if (slug) {
      test(`GET /public/marketing/pages/${slug} — single page`,
        await request('GET', `/api/v1/public/marketing/pages/${slug}`),
        { status: 200, success: true }
      );
    }
  } else {
    skip('GET /public/marketing/pages/:slug', 'No pages found');
  }

  // ── Home Page Data ──────────────────────────────────
  test('GET /public/marketing/home — home page data',
    await request('GET', '/api/v1/public/marketing/home'),
    { custom: (d, s) => s === 0 ? 'Network error' : (s >= 500 ? `Server error ${s}` : null) }
  );

  // ── Blog Posts ──────────────────────────────────────
  const blogRes = await request('GET', '/api/v1/public/blog/posts');
  test('GET /public/blog/posts — list blog posts', blogRes, {
    status: 200, success: true
  });

  const posts = blogRes.data?.posts || blogRes.data || [];
  if (posts[0]) {
    const slug = posts[0].slug;
    if (slug) {
      test(`GET /public/blog/posts/${slug} — single post`,
        await request('GET', `/api/v1/public/blog/posts/${slug}`),
        { status: 200, success: true }
      );
    }
  } else {
    skip('GET /public/blog/posts/:slug', 'No published blog posts');
  }

  test('GET /public/blog/popular — popular posts',
    await request('GET', '/api/v1/public/blog/popular'),
    { status: 200, success: true }
  );

  test('GET /public/blog/categories — blog categories',
    await request('GET', '/api/v1/public/blog/categories'),
    { status: 200, success: true }
  );

  // ── SEO Endpoints ───────────────────────────────────
  test('GET /public/seo/settings — SEO settings',
    await request('GET', '/api/v1/public/seo/settings'),
    { status: 200, success: true }
  );

  const sitemapRes = await request('GET', '/api/v1/public/seo/sitemap.xml', { raw: true });
  test('GET /public/seo/sitemap.xml — returns XML', sitemapRes, {
    custom: (d, s) => {
      if (s === 0) return 'Network error';
      if (s >= 500) return `Server error ${s}`;
      if (s === 200) return null;
      return `Unexpected status ${s}`;
    }
  });

  const robotsRes = await request('GET', '/api/v1/public/seo/robots.txt', { raw: true });
  test('GET /public/seo/robots.txt — returns text', robotsRes, {
    custom: (d, s) => {
      if (s === 0) return 'Network error';
      if (s >= 500) return `Server error ${s}`;
      if (s === 200) return null;
      return `Unexpected status ${s}`;
    }
  });

  test('GET /public/seo/check-redirect — redirect checker',
    await request('GET', '/api/v1/public/seo/check-redirect?path=/test-path'),
    { custom: (d, s) => s === 0 ? 'Network error' : (s >= 500 ? `Server error ${s}` : null) }
  );

  // ── Public Plans ────────────────────────────────────
  test('GET /public/plans — active plans (pricing page)',
    await request('GET', '/api/v1/public/plans'),
    { status: 200, success: true }
  );

  // ── Health Check ────────────────────────────────────
  test('GET /health — server health',
    await request('GET', '/health'),
    { status: 200 }
  );

  return printSummary('Public Endpoints');
}

if (require.main === module) run();
module.exports = { run };
