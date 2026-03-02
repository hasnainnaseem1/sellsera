/**
 * Admin Features API Tests
 * Covers all endpoints under /api/v1/admin/features
 */
const { connectDB, clearDB } = require('../../setup/testSetup');
const {
  seedAdmin,
  seedModerator,
  seedAdminSettings,
  seedFeature,
  apiClient,
  expectSuccess,
  expectError,
  makeFeatureData
} = require('../../helpers/testHelpers');

const User = require('../../../../backend/src/models/user/User');
const AdminSettings = require('../../../../backend/src/models/admin/AdminSettings');
const Feature = require('../../../../backend/src/models/subscription/Feature');

const BASE = '/api/v1/admin/features';

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
// LIST FEATURES
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/features', () => {
  it('should list features', async () => {
    const res = await api.get(BASE, admin.token);
    expectSuccess(res, 200);
    expect(res.body).toHaveProperty('features');
    expect(Array.isArray(res.body.features)).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await api.get(BASE);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// EXPORT CSV
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/features/export/csv', () => {
  it('should export features as CSV', async () => {
    const res = await api.get(`${BASE}/export/csv`, admin.token);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv|application\/octet-stream/);
  });
});

// ─────────────────────────────────────────────────────────────
// CREATE FEATURE
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/admin/features', () => {
  it('should create a feature', async () => {
    const data = makeFeatureData();
    const res = await api.post(BASE, {
      name: data.name,
      featureKey: data.featureKey,
      type: data.type,
      description: data.description
    }, admin.token);
    expectSuccess(res, 201);
    expect(res.body).toHaveProperty('feature');
    expect(res.body.feature.featureKey).toBe(data.featureKey);
  });

  it('should return 500 for missing required fields', async () => {
    const res = await api.post(BASE, { description: 'No name or key' }, admin.token);
    expectError(res, 500);
  });

  it('should return 400 for duplicate featureKey', async () => {
    const existing = await seedFeature(Feature);
    const data = makeFeatureData({ featureKey: existing.featureKey });
    const res = await api.post(BASE, {
      name: data.name,
      featureKey: data.featureKey,
      type: data.type,
      description: data.description
    }, admin.token);
    expectError(res, 400);
  });

  it('should return 403 for moderator without features.create', async () => {
    const data = makeFeatureData();
    const res = await api.post(BASE, {
      name: data.name,
      featureKey: data.featureKey,
      type: data.type,
      description: data.description
    }, moderator.token);
    expectError(res, 403);
  });
});

// ─────────────────────────────────────────────────────────────
// GET FEATURE BY ID
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/features/:id', () => {
  let feature;

  beforeAll(async () => {
    feature = await seedFeature(Feature);
  });

  it('should get a feature by ID', async () => {
    const res = await api.get(`${BASE}/${feature._id}`, admin.token);
    expectSuccess(res, 200);
    expect(res.body).toHaveProperty('feature');
  });

  it('should return 404 for non-existent feature', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await api.get(`${BASE}/${fakeId}`, admin.token);
    expectError(res, 404);
  });
});

// ─────────────────────────────────────────────────────────────
// UPDATE FEATURE
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/features/:id', () => {
  let feature;

  beforeAll(async () => {
    feature = await seedFeature(Feature);
  });

  it('should update a feature', async () => {
    const res = await api.put(`${BASE}/${feature._id}`, { name: 'Updated Feature Name' }, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 403 for moderator without features.edit', async () => {
    const res = await api.put(`${BASE}/${feature._id}`, { name: 'Nope' }, moderator.token);
    expectError(res, 403);
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE FEATURE
// ─────────────────────────────────────────────────────────────
describe('DELETE /api/v1/admin/features/:id', () => {
  it('should delete a feature', async () => {
    const feature = await seedFeature(Feature);
    const res = await api.delete(`${BASE}/${feature._id}`, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 404 for non-existent feature', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await api.delete(`${BASE}/${fakeId}`, admin.token);
    expectError(res, 404);
  });

  it('should return 403 for moderator without features.delete', async () => {
    const feature = await seedFeature(Feature);
    const res = await api.delete(`${BASE}/${feature._id}`, moderator.token);
    expectError(res, 403);
  });
});

// ─────────────────────────────────────────────────────────────
// TOGGLE STATUS
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/features/:id/toggle-status', () => {
  it('should toggle feature active/inactive', async () => {
    const feature = await seedFeature(Feature, { isActive: true });
    const res = await api.put(`${BASE}/${feature._id}/toggle-status`, {}, admin.token);
    expectSuccess(res, 200);
    expect(res.body.feature.isActive).toBe(false);
  });

  it('should toggle back to active', async () => {
    const feature = await seedFeature(Feature, { isActive: false });
    const res = await api.put(`${BASE}/${feature._id}/toggle-status`, {}, admin.token);
    expectSuccess(res, 200);
    expect(res.body.feature.isActive).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// BULK DELETE
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/admin/features/bulk-delete', () => {
  it('should bulk delete features', async () => {
    const f1 = await seedFeature(Feature);
    const f2 = await seedFeature(Feature);
    const res = await api.post(`${BASE}/bulk-delete`, { ids: [f1._id, f2._id] }, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 403 for moderator on bulk-delete', async () => {
    const res = await api.post(`${BASE}/bulk-delete`, { ids: [] }, moderator.token);
    expectError(res, 403);
  });
});
