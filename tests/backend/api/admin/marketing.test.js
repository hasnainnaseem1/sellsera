/**
 * Admin Marketing Pages API Tests
 * Covers all endpoints under /api/v1/admin/marketing
 */
const { connectDB, clearDB } = require('../../setup/testSetup');
const {
  seedAdmin,
  seedModerator,
  seedAdminSettings,
  apiClient,
  expectSuccess,
  expectError,
  makeMarketingPageData
} = require('../../helpers/testHelpers');

const User = require('../../../../backend/src/models/user/User');
const AdminSettings = require('../../../../backend/src/models/admin/AdminSettings');
const MarketingPage = require('../../../../backend/src/models/admin/MarketingPage');

const BASE = '/api/v1/admin/marketing';

let app, api, admin, moderator;

beforeAll(async () => {
  app = await connectDB();
  api = apiClient(app);
  await seedAdminSettings(AdminSettings);
  admin = await seedAdmin(User);
  moderator = await seedModerator(User);
});

afterAll(async () => {
  await clearDB();
});

// ─────────────────────────────────────────────────────────────
// LIST PAGES
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/marketing/pages', () => {
  it('should list marketing pages', async () => {
    const res = await api.get(`${BASE}/pages`, admin.token);
    expectSuccess(res, 200);
    expect(res.body).toHaveProperty('pages');
    expect(Array.isArray(res.body.pages)).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await api.get(`${BASE}/pages`);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// CREATE PAGE
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/admin/marketing/pages', () => {
  it('should create a marketing page', async () => {
    const data = makeMarketingPageData();
    const res = await api.post(`${BASE}/pages`, data, admin.token);
    expectSuccess(res, 201);
    expect(res.body).toHaveProperty('page');
    expect(res.body.page.title).toBe(data.title);
  });

  it('should return 500 for missing title', async () => {
    const res = await api.post(`${BASE}/pages`, { description: 'No title' }, admin.token);
    expectError(res, 500);
  });

  it('should return 403 for moderator without settings.edit', async () => {
    const data = makeMarketingPageData();
    const res = await api.post(`${BASE}/pages`, data, moderator.token);
    expectError(res, 403);
  });
});

// ─────────────────────────────────────────────────────────────
// GET PAGE BY ID
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/marketing/pages/:id', () => {
  let page;

  beforeAll(async () => {
    page = await MarketingPage.create(makeMarketingPageData());
  });

  it('should get a page by ID', async () => {
    const res = await api.get(`${BASE}/pages/${page._id}`, admin.token);
    expectSuccess(res, 200);
    expect(res.body).toHaveProperty('page');
  });

  it('should return 404 for non-existent page', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await api.get(`${BASE}/pages/${fakeId}`, admin.token);
    expectError(res, 404);
  });
});

// ─────────────────────────────────────────────────────────────
// UPDATE PAGE
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/marketing/pages/:id', () => {
  let page;

  beforeAll(async () => {
    page = await MarketingPage.create(makeMarketingPageData());
  });

  it('should update a page', async () => {
    const res = await api.put(`${BASE}/pages/${page._id}`, { title: 'Updated Page Title' }, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 403 for moderator without settings.edit', async () => {
    const res = await api.put(`${BASE}/pages/${page._id}`, { title: 'Nope' }, moderator.token);
    expectError(res, 403);
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE PAGE
// ─────────────────────────────────────────────────────────────
describe('DELETE /api/v1/admin/marketing/pages/:id', () => {
  it('should delete a page', async () => {
    const page = await MarketingPage.create(makeMarketingPageData());
    const res = await api.delete(`${BASE}/pages/${page._id}`, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 404 for non-existent page', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await api.delete(`${BASE}/pages/${fakeId}`, admin.token);
    expectError(res, 404);
  });
});

// ─────────────────────────────────────────────────────────────
// UPDATE PAGE STATUS
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/marketing/pages/:id/status', () => {
  it('should update page status to draft', async () => {
    const page = await MarketingPage.create(makeMarketingPageData({ status: 'published' }));
    const res = await api.put(`${BASE}/pages/${page._id}/status`, { status: 'draft' }, admin.token);
    expectSuccess(res, 200);
  });

  it('should update page status to published', async () => {
    const page = await MarketingPage.create(makeMarketingPageData({ status: 'draft' }));
    const res = await api.put(`${BASE}/pages/${page._id}/status`, { status: 'published' }, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// CLONE PAGE
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/admin/marketing/pages/:id/clone', () => {
  it('should clone an existing page', async () => {
    const page = await MarketingPage.create(makeMarketingPageData());
    const res = await api.post(`${BASE}/pages/${page._id}/clone`, {}, admin.token);
    expectSuccess(res, 201);
    expect(res.body).toHaveProperty('page');
    expect(res.body.page._id.toString()).not.toBe(page._id.toString());
  });

  it('should return 404 for cloning non-existent page', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await api.post(`${BASE}/pages/${fakeId}/clone`, {}, admin.token);
    expectError(res, 404);
  });
});

// ─────────────────────────────────────────────────────────────
// REORDER PAGES
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/marketing/pages-reorder', () => {
  it('should reorder pages', async () => {
    const page1 = await MarketingPage.create(makeMarketingPageData());
    const page2 = await MarketingPage.create(makeMarketingPageData());
    const res = await api.put(`${BASE}/pages-reorder`, {
      pages: [
        { id: page1._id, displayOrder: 2 },
        { id: page2._id, displayOrder: 1 }
      ]
    }, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/marketing/navigation', () => {
  it('should return navigation items', async () => {
    // Create a published page with showInNavigation=true
    await MarketingPage.create(makeMarketingPageData({ status: 'published', showInNavigation: true }));
    const res = await api.get(`${BASE}/navigation`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// BULK DELETE
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/admin/marketing/pages/bulk-delete', () => {
  it('should bulk delete pages', async () => {
    const p1 = await MarketingPage.create(makeMarketingPageData());
    const p2 = await MarketingPage.create(makeMarketingPageData());
    const res = await api.post(`${BASE}/pages/bulk-delete`, { ids: [p1._id, p2._id] }, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 403 for moderator on bulk-delete', async () => {
    const res = await api.post(`${BASE}/pages/bulk-delete`, { ids: [] }, moderator.token);
    expectError(res, 403);
  });
});
