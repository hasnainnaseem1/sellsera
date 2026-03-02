/**
 * Admin Departments API Tests
 * Covers all endpoints under /api/v1/admin/departments
 */
const { connectDB, clearDB } = require('../../setup/testSetup');
const {
  seedAdmin,
  seedModerator,
  seedAdminSettings,
  apiClient,
  expectSuccess,
  expectError,
  makeDepartmentData
} = require('../../helpers/testHelpers');

const User = require('../../../../backend/src/models/user/User');
const AdminSettings = require('../../../../backend/src/models/admin/AdminSettings');
const Department = require('../../../../backend/src/models/admin/Department');

const BASE = '/api/v1/admin/departments';

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
// LIST DEPARTMENTS
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/departments', () => {
  it('should list departments', async () => {
    const res = await api.get(BASE, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 401 without auth', async () => {
    const res = await api.get(BASE);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// ACTIVE DEPARTMENTS
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/departments/active', () => {
  it('should list only active departments', async () => {
    await Department.create(makeDepartmentData({ isActive: true }));
    await Department.create(makeDepartmentData({ isActive: false }));
    const res = await api.get(`${BASE}/active`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// CREATE DEPARTMENT
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/admin/departments', () => {
  it('should create a department', async () => {
    const data = makeDepartmentData();
    const res = await api.post(BASE, data, admin.token);
    expectSuccess(res, 201);
    expect(res.body).toHaveProperty('department');
    expect(res.body.department.name).toBe(data.name);
  });

  it('should return 400 for missing name', async () => {
    const res = await api.post(BASE, { description: 'No name' }, admin.token);
    expectError(res, 400);
  });

  it('should return 400 for duplicate department name', async () => {
    const data = makeDepartmentData();
    // Create via API first so the controller-generated value matches
    await api.post(BASE, { name: data.name, description: data.description }, admin.token);
    const res = await api.post(BASE, {
      name: data.name,
      description: 'Duplicate'
    }, admin.token);
    expectError(res, 400);
  });

  it('should return 403 for moderator without settings.edit', async () => {
    const data = makeDepartmentData();
    const res = await api.post(BASE, data, moderator.token);
    expectError(res, 403);
  });
});

// ─────────────────────────────────────────────────────────────
// GET DEPARTMENT BY ID
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/departments/:id', () => {
  let dept;

  beforeAll(async () => {
    dept = await Department.create(makeDepartmentData());
  });

  it('should get a department by ID', async () => {
    const res = await api.get(`${BASE}/${dept._id}`, admin.token);
    expectSuccess(res, 200);
    expect(res.body).toHaveProperty('department');
  });

  it('should return 404 for non-existent department', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await api.get(`${BASE}/${fakeId}`, admin.token);
    expectError(res, 404);
  });
});

// ─────────────────────────────────────────────────────────────
// UPDATE DEPARTMENT
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/departments/:id', () => {
  let dept;

  beforeAll(async () => {
    dept = await Department.create(makeDepartmentData());
  });

  it('should update a department', async () => {
    const res = await api.put(`${BASE}/${dept._id}`, { description: 'Updated desc' }, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 403 for moderator without settings.edit', async () => {
    const res = await api.put(`${BASE}/${dept._id}`, { description: 'Nope' }, moderator.token);
    expectError(res, 403);
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE DEPARTMENT
// ─────────────────────────────────────────────────────────────
describe('DELETE /api/v1/admin/departments/:id', () => {
  it('should delete a department', async () => {
    const dept = await Department.create(makeDepartmentData());
    const res = await api.delete(`${BASE}/${dept._id}`, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 404 for non-existent department', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await api.delete(`${BASE}/${fakeId}`, admin.token);
    expectError(res, 404);
  });
});

// ─────────────────────────────────────────────────────────────
// SEED DEFAULT DEPARTMENTS (super_admin only)
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/admin/departments/seed/default', () => {
  it('should seed default departments (super_admin)', async () => {
    const res = await api.post(`${BASE}/seed/default`, {}, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 403 for moderator on seed defaults', async () => {
    const res = await api.post(`${BASE}/seed/default`, {}, moderator.token);
    expectError(res, 403);
  });
});
