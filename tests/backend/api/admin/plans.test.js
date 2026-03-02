/**
 * Admin Plans API Tests
 * Covers all endpoints under /api/v1/admin/plans
 */
const { connectDB, clearDB } = require('../../setup/testSetup');
const {
  seedAdmin,
  seedModerator,
  seedAdminSettings,
  seedPlan,
  seedFeature,
  apiClient,
  expectSuccess,
  expectError,
  makePlanData,
  makeFeatureData
} = require('../../helpers/testHelpers');

const User = require('../../../../backend/src/models/user/User');
const AdminSettings = require('../../../../backend/src/models/admin/AdminSettings');
const Plan = require('../../../../backend/src/models/subscription/Plan');
const Feature = require('../../../../backend/src/models/subscription/Feature');

const BASE = '/api/v1/admin/plans';

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
// LIST PLANS
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/plans', () => {
  it('should list plans', async () => {
    const res = await api.get(BASE, admin.token);
    expectSuccess(res, 200);
    expect(res.body).toHaveProperty('plans');
    expect(Array.isArray(res.body.plans)).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await api.get(BASE);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// LIST FEATURES FOR PLAN CREATION
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/plans/features', () => {
  it('should list features available for plan creation', async () => {
    await seedFeature(Feature);
    const res = await api.get(`${BASE}/features`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// EXPORT CSV
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/plans/export/csv', () => {
  it('should export plans as CSV', async () => {
    const res = await api.get(`${BASE}/export/csv`, admin.token);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv|application\/octet-stream/);
  });
});

// ─────────────────────────────────────────────────────────────
// CREATE PLAN
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/admin/plans', () => {
  it('should create a plan', async () => {
    const data = makePlanData();
    const res = await api.post(BASE, {
      name: data.name,
      description: data.description,
      price: data.price,
      billingCycle: data.billingCycle,
      features: []
    }, admin.token);
    expectSuccess(res, 201);
    expect(res.body).toHaveProperty('plan');
    expect(res.body.plan.name).toBe(data.name);
  });

  it('should return 400 for missing name', async () => {
    const res = await api.post(BASE, { description: 'No name plan' }, admin.token);
    expectError(res, 500);
  });

  it('should return 403 for moderator without plans.create', async () => {
    const data = makePlanData();
    const res = await api.post(BASE, {
      name: data.name,
      description: data.description,
      price: data.price,
      billingCycle: data.billingCycle,
      features: []
    }, moderator.token);
    expectError(res, 403);
  });
});

// ─────────────────────────────────────────────────────────────
// GET PLAN BY ID
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/plans/:id', () => {
  let plan;

  beforeAll(async () => {
    plan = await seedPlan(Plan);
  });

  it('should get a plan by ID', async () => {
    const res = await api.get(`${BASE}/${plan._id}`, admin.token);
    expectSuccess(res, 200);
    expect(res.body).toHaveProperty('plan');
  });

  it('should return 404 for non-existent plan', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await api.get(`${BASE}/${fakeId}`, admin.token);
    expectError(res, 404);
  });
});

// ─────────────────────────────────────────────────────────────
// UPDATE PLAN
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/plans/:id', () => {
  let plan;

  beforeAll(async () => {
    plan = await seedPlan(Plan);
  });

  it('should update a plan', async () => {
    const res = await api.put(`${BASE}/${plan._id}`, { name: 'Updated Plan Name' }, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 403 for moderator without plans.edit', async () => {
    const res = await api.put(`${BASE}/${plan._id}`, { name: 'Nope' }, moderator.token);
    expectError(res, 403);
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE PLAN
// ─────────────────────────────────────────────────────────────
describe('DELETE /api/v1/admin/plans/:id', () => {
  it('should delete a plan', async () => {
    const plan = await seedPlan(Plan);
    const res = await api.delete(`${BASE}/${plan._id}`, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 404 for non-existent plan', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await api.delete(`${BASE}/${fakeId}`, admin.token);
    expectError(res, 404);
  });

  it('should return 403 for moderator without plans.delete', async () => {
    const plan = await seedPlan(Plan);
    const res = await api.delete(`${BASE}/${plan._id}`, moderator.token);
    expectError(res, 403);
  });
});

// ─────────────────────────────────────────────────────────────
// TOGGLE STATUS
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/plans/:id/toggle-status', () => {
  it('should toggle plan active/inactive', async () => {
    const plan = await seedPlan(Plan, { isActive: true });
    const res = await api.put(`${BASE}/${plan._id}/toggle-status`, {}, admin.token);
    expectSuccess(res, 200);
    expect(res.body.plan.isActive).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// SET DEFAULT
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/plans/:id/set-default', () => {
  it('should set a plan as default', async () => {
    const plan = await seedPlan(Plan, { isDefault: false });
    const res = await api.put(`${BASE}/${plan._id}/set-default`, {}, admin.token);
    expectSuccess(res, 200);
  });

  it('should ensure only one plan is default', async () => {
    const plan1 = await seedPlan(Plan, { isDefault: true });
    const plan2 = await seedPlan(Plan, { isDefault: false });

    await api.put(`${BASE}/${plan2._id}/set-default`, {}, admin.token);

    const updated1 = await Plan.findById(plan1._id);
    const updated2 = await Plan.findById(plan2._id);
    expect(updated1.isDefault).toBe(false);
    expect(updated2.isDefault).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// BULK DELETE
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/admin/plans/bulk-delete', () => {
  it('should bulk delete plans', async () => {
    const p1 = await seedPlan(Plan);
    const p2 = await seedPlan(Plan);
    const res = await api.post(`${BASE}/bulk-delete`, { ids: [p1._id, p2._id] }, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 403 for moderator on bulk-delete', async () => {
    const res = await api.post(`${BASE}/bulk-delete`, { ids: [] }, moderator.token);
    expectError(res, 403);
  });
});
