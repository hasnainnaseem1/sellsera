/**
 * Admin SEO API Tests
 * Covers all endpoints under /api/v1/admin/seo
 */
const { connectDB, clearDB } = require('../../setup/testSetup');
const {
  seedAdmin,
  seedModerator,
  seedAdminSettings,
  apiClient,
  expectSuccess,
  expectError,
  makeSeoRedirectData
} = require('../../helpers/testHelpers');

const User = require('../../../../backend/src/models/user/User');
const AdminSettings = require('../../../../backend/src/models/admin/AdminSettings');
const SeoRedirect = require('../../../../backend/src/models/admin/SeoRedirect');

const BASE = '/api/v1/admin/seo';

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
// SEO SETTINGS
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/seo/settings', () => {
  it('should get SEO settings', async () => {
    const res = await api.get(`${BASE}/settings`, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 401 without auth', async () => {
    const res = await api.get(`${BASE}/settings`);
    expect(res.status).toBe(401);
  });

  it('should return 403 for moderator without settings.view', async () => {
    const res = await api.get(`${BASE}/settings`, moderator.token);
    expectError(res, 403);
  });
});

describe('PUT /api/v1/admin/seo/settings', () => {
  it('should update SEO settings', async () => {
    const res = await api.put(`${BASE}/settings`, {
      metaTitle: 'Updated Title',
      metaDescription: 'Updated SEO description',
      ogImage: '/og-default.png'
    }, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 403 for moderator without settings.edit', async () => {
    const res = await api.put(`${BASE}/settings`, { metaTitle: 'Nope' }, moderator.token);
    expectError(res, 403);
  });
});

// ─────────────────────────────────────────────────────────────
// LIST REDIRECTS
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/seo/redirects', () => {
  it('should list SEO redirects', async () => {
    const res = await api.get(`${BASE}/redirects`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// CREATE REDIRECT
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/admin/seo/redirects', () => {
  it('should create a redirect', async () => {
    const data = makeSeoRedirectData();
    const res = await api.post(`${BASE}/redirects`, data, admin.token);
    expectSuccess(res, 201);
    expect(res.body).toHaveProperty('redirect');
    expect(res.body.redirect.fromPath).toBe(data.fromPath);
  });

  it('should return 400 for missing required fields', async () => {
    const res = await api.post(`${BASE}/redirects`, { note: 'No paths' }, admin.token);
    expectError(res, 400);
  });

  it('should return 400 for duplicate fromPath', async () => {
    const data = makeSeoRedirectData();
    await SeoRedirect.create(data);
    const res = await api.post(`${BASE}/redirects`, {
      fromPath: data.fromPath,
      toPath: '/another-path',
      statusCode: 301
    }, admin.token);
    expectError(res, 400);
  });
});

// ─────────────────────────────────────────────────────────────
// UPDATE REDIRECT
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/seo/redirects/:id', () => {
  let redirect;

  beforeAll(async () => {
    redirect = await SeoRedirect.create(makeSeoRedirectData());
  });

  it('should update a redirect', async () => {
    const res = await api.put(`${BASE}/redirects/${redirect._id}`, {
      toPath: '/updated-path'
    }, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 404 for non-existent redirect', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await api.put(`${BASE}/redirects/${fakeId}`, { toPath: '/nope' }, admin.token);
    expectError(res, 404);
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE REDIRECT
// ─────────────────────────────────────────────────────────────
describe('DELETE /api/v1/admin/seo/redirects/:id', () => {
  it('should delete a redirect', async () => {
    const redirect = await SeoRedirect.create(makeSeoRedirectData());
    const res = await api.delete(`${BASE}/redirects/${redirect._id}`, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 404 for non-existent redirect', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await api.delete(`${BASE}/redirects/${fakeId}`, admin.token);
    expectError(res, 404);
  });
});

// ─────────────────────────────────────────────────────────────
// TOGGLE REDIRECT
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/seo/redirects/:id/toggle', () => {
  it('should toggle redirect active/inactive', async () => {
    const redirect = await SeoRedirect.create(makeSeoRedirectData({ isActive: true }));
    const res = await api.put(`${BASE}/redirects/${redirect._id}/toggle`, {}, admin.token);
    expectSuccess(res, 200);
  });

  it('should toggle back', async () => {
    const redirect = await SeoRedirect.create(makeSeoRedirectData({ isActive: false }));
    const res = await api.put(`${BASE}/redirects/${redirect._id}/toggle`, {}, admin.token);
    expectSuccess(res, 200);
  });
});
