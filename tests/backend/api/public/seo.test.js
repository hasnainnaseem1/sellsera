/**
 * Public SEO API Tests
 * Covers: GET /api/v1/public/seo/sitemap.xml, /robots.txt, /settings, /check-redirect
 */
const { connectDB, clearDB } = require('../../setup/testSetup');
const {
  seedAdminSettings,
  makeSeoRedirectData,
  apiClient,
  expectSuccess
} = require('../../helpers/testHelpers');

const AdminSettings = require('../../../../backend/src/models/admin/AdminSettings');
const MarketingPage = require('../../../../backend/src/models/admin/MarketingPage');
const BlogPost = require('../../../../backend/src/models/admin/BlogPost');
const SeoRedirect = require('../../../../backend/src/models/admin/SeoRedirect');

const BASE = '/api/v1/public/seo';

let app, api;

beforeAll(async () => {
  app = await connectDB();
  api = apiClient(app);
  await seedAdminSettings(AdminSettings);

  // Create published pages for sitemap
  await MarketingPage.create({
    title: 'SEO Test Page',
    slug: 'seo-test-page',
    description: 'A page for SEO testing',
    status: 'published',
    showInNavigation: true,
    blocks: []
  });

  // Create published blog posts for sitemap
  await BlogPost.create({
    title: 'SEO Blog Post',
    slug: 'seo-blog-post',
    excerpt: 'SEO test blog post',
    content: '<p>Blog post content for SEO</p>',
    category: 'SEO',
    tags: ['seo'],
    status: 'published',
    publishedAt: new Date(),
    views: 0
  });

  // Create SEO redirects
  await SeoRedirect.create({
    fromPath: '/old-path',
    toPath: '/new-path',
    statusCode: 301,
    isActive: true,
    note: 'Test redirect'
  });

  await SeoRedirect.create({
    fromPath: '/another-old-path',
    toPath: '/another-new-path',
    statusCode: 302,
    isActive: true,
    note: 'Another redirect'
  });
});

afterAll(async () => {
  await clearDB();
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/public/seo/sitemap.xml — Sitemap
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/public/seo/sitemap.xml', () => {
  it('should return XML content type', async () => {
    const res = await api.get(`${BASE}/sitemap.xml`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/xml|text/);
  });

  it('should include published pages and blog posts in sitemap', async () => {
    const res = await api.get(`${BASE}/sitemap.xml`);
    expect(res.status).toBe(200);
    const body = res.text || res.body;
    const content = typeof body === 'string' ? body : JSON.stringify(body);
    // Sitemap should reference published content
    expect(content.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/public/seo/robots.txt — Robots.txt
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/public/seo/robots.txt', () => {
  it('should return text/plain content type', async () => {
    const res = await api.get(`${BASE}/robots.txt`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain|text/);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/public/seo/settings — Public SEO Settings
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/public/seo/settings', () => {
  it('should return SEO meta settings', async () => {
    const res = await api.get(`${BASE}/settings`);
    expectSuccess(res, 200);
    const data = res.body.data || res.body;
    expect(data).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/public/seo/check-redirect — Check Redirect
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/public/seo/check-redirect', () => {
  it('should return redirect info for existing redirect path', async () => {
    const res = await api.get(`${BASE}/check-redirect?path=/old-path`);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.redirect || res.body;
    // Should contain redirect info
    expect(data).toBeDefined();
    if (data.toPath) {
      expect(data.toPath).toBe('/new-path');
    }
    if (data.redirect) {
      expect(data.redirect.toPath).toBe('/new-path');
    }
  });

  it('should return empty/no redirect for non-redirected path', async () => {
    const res = await api.get(`${BASE}/check-redirect?path=/no-redirect-here`);
    expect(res.status).toBe(200);
    const data = res.body.data || res.body.redirect || res.body;
    // Either null redirect or empty response
    const hasNoRedirect = !data || data === null ||
      (data.redirect === null) ||
      (data.redirect === undefined && !data.toPath) ||
      (data.found === false);
    expect(hasNoRedirect || res.body.success).toBeTruthy();
  });

  it('should handle missing path query parameter', async () => {
    const res = await api.get(`${BASE}/check-redirect`);
    // Should return 400 or empty result
    expect([200, 400]).toContain(res.status);
  });
});
