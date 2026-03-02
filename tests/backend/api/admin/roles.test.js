/**
 * Admin Roles API Tests
 * Covers all endpoints under /api/v1/admin/roles
 */
const { connectDB, clearDB } = require('../../setup/testSetup');
const {
  seedAdmin,
  seedModerator,
  seedAdminSettings,
  apiClient,
  expectSuccess,
  expectError,
  makeRoleData
} = require('../../helpers/testHelpers');

const User = require('../../../../backend/src/models/user/User');
const AdminSettings = require('../../../../backend/src/models/admin/AdminSettings');
const CustomRole = require('../../../../backend/src/models/user/CustomRole');

const BASE = '/api/v1/admin/roles';

let app, api, admin, moderator;

beforeAll(async () => {
  app = await connectDB();
  api = apiClient(app);
  // Seed with enableCustomRoles: true
  await seedAdminSettings(AdminSettings, {
    features: {
      enableAnalysis: true,
      enableSubscriptions: true,
      enableCustomRoles: true,
      enableActivityLogs: true
    }
  });
  admin = await seedAdmin(User);
  moderator = await seedModerator(User);
});

afterAll(async () => {
  await clearDB();
});

// ─────────────────────────────────────────────────────────────
// LIST ROLES
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/roles', () => {
  it('should list roles', async () => {
    const res = await api.get(BASE, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 401 without auth', async () => {
    const res = await api.get(BASE);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// AVAILABLE PERMISSIONS
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/roles/permissions/available', () => {
  it('should return available permissions list', async () => {
    const res = await api.get(`${BASE}/permissions/available`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// CREATE ROLE
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/admin/roles', () => {
  it('should create a custom role', async () => {
    const data = makeRoleData();
    const res = await api.post(BASE, {
      name: data.name,
      description: data.description,
      permissions: data.permissions
    }, admin.token);
    expectSuccess(res, 201);
    expect(res.body).toHaveProperty('role');
    expect(res.body.role.name).toBe(data.name.toLowerCase().replace(/\s+/g, '_'));
  });

  it('should return 400 for missing name', async () => {
    const res = await api.post(BASE, { description: 'No name' }, admin.token);
    expectError(res, 400);
  });

  it('should return 400 for duplicate role name', async () => {
    const data = makeRoleData();
    // Create the first role
    await api.post(BASE, {
      name: data.name,
      description: data.description,
      permissions: data.permissions
    }, admin.token);
    // Try creating duplicate
    const res = await api.post(BASE, {
      name: data.name,
      description: 'Duplicate',
      permissions: data.permissions
    }, admin.token);
    expectError(res, 400);
  });

  it('should return 403 for moderator without roles.create', async () => {
    const data = makeRoleData();
    const res = await api.post(BASE, {
      name: data.name,
      description: data.description,
      permissions: data.permissions
    }, moderator.token);
    expectError(res, 403);
  });
});

// ─────────────────────────────────────────────────────────────
// GET ROLE BY ID
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/roles/:id', () => {
  let role;

  beforeAll(async () => {
    role = await CustomRole.create({...makeRoleData(), createdBy: admin.user._id});
  });

  it('should get a role by ID', async () => {
    const res = await api.get(`${BASE}/${role._id}`, admin.token);
    expectSuccess(res, 200);
    expect(res.body).toHaveProperty('role');
  });

  it('should return 404 for non-existent role', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await api.get(`${BASE}/${fakeId}`, admin.token);
    expectError(res, 404);
  });
});

// ─────────────────────────────────────────────────────────────
// UPDATE ROLE
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/roles/:id', () => {
  let role;

  beforeAll(async () => {
    role = await CustomRole.create({...makeRoleData(), createdBy: admin.user._id});
  });

  it('should update a role', async () => {
    const res = await api.put(`${BASE}/${role._id}`, {
      description: 'Updated description'
    }, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 403 for moderator without roles.edit', async () => {
    const res = await api.put(`${BASE}/${role._id}`, { description: 'Nope' }, moderator.token);
    expectError(res, 403);
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE ROLE
// ─────────────────────────────────────────────────────────────
describe('DELETE /api/v1/admin/roles/:id', () => {
  it('should delete a role', async () => {
    const role = await CustomRole.create({...makeRoleData(), createdBy: admin.user._id});
    const res = await api.delete(`${BASE}/${role._id}`, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 404 for non-existent role', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await api.delete(`${BASE}/${fakeId}`, admin.token);
    expectError(res, 404);
  });

  it('should return 403 for moderator without roles.delete', async () => {
    const role = await CustomRole.create({...makeRoleData(), createdBy: admin.user._id});
    const res = await api.delete(`${BASE}/${role._id}`, moderator.token);
    expectError(res, 403);
  });
});

// ─────────────────────────────────────────────────────────────
// BULK DELETE
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/admin/roles/bulk-delete', () => {
  it('should bulk delete roles', async () => {
    const r1 = await CustomRole.create({...makeRoleData(), createdBy: admin.user._id});
    const r2 = await CustomRole.create({...makeRoleData(), createdBy: admin.user._id});
    const res = await api.post(`${BASE}/bulk-delete`, { ids: [r1._id, r2._id] }, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// FEATURE GATE — enableCustomRoles disabled
// ─────────────────────────────────────────────────────────────
describe('Feature gate: enableCustomRoles disabled', () => {
  beforeAll(async () => {
    await AdminSettings.updateOne({}, {
      $set: { 'features.enableCustomRoles': false }
    });
  });

  afterAll(async () => {
    await AdminSettings.updateOne({}, {
      $set: { 'features.enableCustomRoles': true }
    });
  });

  it('should return 403 when custom roles feature is disabled', async () => {
    const res = await api.get(BASE, admin.token);
    expectError(res, 403);
  });
});
