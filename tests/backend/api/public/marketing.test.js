/**
 * Public Marketing API Tests
 * Covers: GET /api/v1/public/site, /navigation, /pages, /pages/:slug, /home
 * Also tests /api/v1/public/marketing/* aliases
 */
const { connectDB, clearDB } = require('../../setup/testSetup');
const {
  seedAdminSettings,
  makeMarketingPageData,
  apiClient,
  expectSuccess,
  expectError
} = require('../../helpers/testHelpers');

const AdminSettings = require('../../../../backend/src/models/admin/AdminSettings');
const MarketingPage = require('../../../../backend/src/models/admin/MarketingPage');

const BASE = '/api/v1/public';

let app, api, homePage, aboutPage, hiddenPage, draftPage;

beforeAll(async () => {
  app = await connectDB();
  api = apiClient(app);
  await seedAdminSettings(AdminSettings);

  // Create pages
  homePage = await MarketingPage.create({
    title: 'Home',
    slug: 'home',
    description: 'Welcome to our platform',
    status: 'published',
    isHomePage: true,
    showInNavigation: true,
    navigationOrder: 0,
    blocks: [
      {
        type: 'hero',
        title: 'Welcome',
        subtitle: 'The best platform',
        content: 'Hero content here',
        visible: true,
        order: 0
      }
    ]
  });

  aboutPage = await MarketingPage.create({
    title: 'About Us',
    slug: 'about-us',
    description: 'About our company',
    status: 'published',
    isHomePage: false,
    showInNavigation: true,
    navigationOrder: 1,
    blocks: [
      {
        type: 'text',
        title: 'About',
        content: 'We are a great company',
        visible: true,
        order: 0
      }
    ]
  });

  hiddenPage = await MarketingPage.create({
    title: 'Hidden Page',
    slug: 'hidden-page',
    description: 'Not in navigation',
    status: 'published',
    isHomePage: false,
    showInNavigation: false,
    navigationOrder: 99,
    blocks: []
  });

  draftPage = await MarketingPage.create({
    title: 'Draft Page',
    slug: 'draft-page',
    description: 'Still a draft',
    status: 'draft',
    isHomePage: false,
    showInNavigation: false,
    blocks: []
  });
});

afterAll(async () => {
  await clearDB();
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/public/site — Site Settings
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/public/site', () => {
  it('should return site settings', async () => {
    const res = await api.get(`${BASE}/site`);
    expectSuccess(res, 200);
    const data = res.body.site || res.body.data || res.body;
    expect(data).toHaveProperty('siteName');
  });

  it('should include theme/branding settings', async () => {
    const res = await api.get(`${BASE}/site`);
    expectSuccess(res, 200);
    const data = res.body.site || res.body.data || res.body;
    // Theme settings are flattened into the site object
    expect(data).toHaveProperty('primaryColor');
  });

  it('should include feature flags', async () => {
    const res = await api.get(`${BASE}/site`);
    expectSuccess(res, 200);
    const data = res.body.site || res.body.data || res.body;
    // Feature flags are flattened into the site object
    expect(data).toHaveProperty('enableAnalysis');
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/public/navigation — Navigation Items
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/public/navigation', () => {
  it('should return published pages with showInNavigation=true', async () => {
    const res = await api.get(`${BASE}/navigation`);
    expectSuccess(res, 200);
    const data = res.body.navigation || res.body.data || res.body.pages || [];
    expect(Array.isArray(data)).toBe(true);

    // Should include About Us (published + showInNavigation)
    const slugs = data.map(p => p.slug || p.path);
    expect(slugs).toContain('about-us');

    // Should NOT include Hidden Page (showInNavigation=false)
    expect(slugs).not.toContain('hidden-page');
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/public/pages — List Published Pages
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/public/pages', () => {
  it('should return all published pages', async () => {
    const res = await api.get(`${BASE}/pages`);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.pages || [];
    expect(Array.isArray(data)).toBe(true);
    // Should include published pages
    const slugs = data.map(p => p.slug);
    expect(slugs).toContain('home');
    expect(slugs).toContain('about-us');
  });

  it('should not return draft pages', async () => {
    const res = await api.get(`${BASE}/pages`);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.pages || [];
    const slugs = data.map(p => p.slug);
    expect(slugs).not.toContain('draft-page');
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/public/pages/:slug — Get Page by Slug
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/public/pages/:slug', () => {
  it('should return specific page content with blocks', async () => {
    const res = await api.get(`${BASE}/pages/about-us`);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.page || res.body;
    expect(data).toHaveProperty('title', 'About Us');
    expect(data).toHaveProperty('blocks');
    expect(Array.isArray(data.blocks)).toBe(true);
  });

  it('should return 404 for non-existent slug', async () => {
    const res = await api.get(`${BASE}/pages/nonexistent-slug`);
    expect([404, 400]).toContain(res.status);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/public/home — Home Page
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/public/home', () => {
  it('should return the page with isHomePage=true', async () => {
    const res = await api.get(`${BASE}/home`);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.page || res.body;
    expect(data).toHaveProperty('title', 'Home');
    expect(data).toHaveProperty('blocks');
  });

  it('should handle no homepage set gracefully', async () => {
    // Remove homepage flag
    await MarketingPage.updateMany({}, { isHomePage: false });

    const res = await api.get(`${BASE}/home`);
    expect([200, 404]).toContain(res.status);

    // Restore homepage
    await MarketingPage.updateOne({ slug: 'home' }, { isHomePage: true });
  });
});

// ─────────────────────────────────────────────────────────────
// ALIAS ROUTES — /api/v1/public/marketing/*
// ─────────────────────────────────────────────────────────────
describe('Marketing alias routes', () => {
  it('GET /api/v1/public/marketing/site should return site settings', async () => {
    const res = await api.get(`${BASE}/marketing/site`);
    expectSuccess(res, 200);
    const data = res.body.site || res.body.data || res.body;
    expect(data).toHaveProperty('siteName');
  });

  it('GET /api/v1/public/marketing/pages should return published pages', async () => {
    const res = await api.get(`${BASE}/marketing/pages`);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.pages || [];
    expect(Array.isArray(data)).toBe(true);
  });
});
