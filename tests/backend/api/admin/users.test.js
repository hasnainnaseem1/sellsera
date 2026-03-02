/**
 * Admin Users API Tests
 * Covers all endpoints under /api/v1/admin/users
 */
const { connectDB, clearDB } = require('../../setup/testSetup');
const {
  seedAdmin,
  seedModerator,
  seedAdminSettings,
  apiClient,
  expectSuccess,
  expectError,
  makeAdminData,
  makeCustomerData
} = require('../../helpers/testHelpers');

const User = require('../../../../backend/src/models/user/User');
const AdminSettings = require('../../../../backend/src/models/admin/AdminSettings');

const BASE = '/api/v1/admin/users';

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
// LIST USERS
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/users', () => {
  it('should list users with valid admin token', async () => {
    const res = await api.get(BASE, admin.token);
    expectSuccess(res, 200);
    expect(res.body).toHaveProperty('users');
    expect(Array.isArray(res.body.users)).toBe(true);
  });

  it('should support pagination query params', async () => {
    const res = await api.get(`${BASE}?page=1&limit=5`, admin.token);
    expectSuccess(res, 200);
    expect(res.body).toHaveProperty('users');
  });

  it('should return 401 without auth token', async () => {
    const res = await api.get(BASE);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// EXPORT CSV
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/users/export/csv', () => {
  it('should export users as CSV', async () => {
    const res = await api.get(`${BASE}/export/csv`, admin.token);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv|application\/octet-stream/);
  });

  it('should return 401 without auth', async () => {
    const res = await api.get(`${BASE}/export/csv`);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// CREATE USER
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/admin/users', () => {
  it('should create a new admin user', async () => {
    const body = {
      name: 'New Admin User',
      email: 'newadmin@test.com',
      password: 'StrongPass123!',
      role: 'moderator'
    };
    const res = await api.post(BASE, body, admin.token);
    expectSuccess(res, 201);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe(body.email);
  });

  it('should return 400 for missing required fields', async () => {
    const res = await api.post(BASE, { name: 'No Email' }, admin.token);
    expectError(res, 400);
  });

  it('should return 400 for duplicate email', async () => {
    const body = {
      name: 'Duplicate',
      email: admin.user.email,
      password: 'StrongPass123!',
      role: 'moderator'
    };
    const res = await api.post(BASE, body, admin.token);
    expectError(res, 400);
  });

  it('should return 403 for moderator without users.create permission', async () => {
    const body = {
      name: 'Forbidden User',
      email: 'forbidden@test.com',
      password: 'StrongPass123!',
      role: 'moderator'
    };
    const res = await api.post(BASE, body, moderator.token);
    expectError(res, 403);
  });
});

// ─────────────────────────────────────────────────────────────
// GET USER BY ID
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/users/:id', () => {
  it('should get user by ID', async () => {
    const res = await api.get(`${BASE}/${admin.user._id}`, admin.token);
    expectSuccess(res, 200);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe(admin.user.email);
  });

  it('should return 404 for non-existent user ID', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await api.get(`${BASE}/${fakeId}`, admin.token);
    expectError(res, 404);
  });
});

// ─────────────────────────────────────────────────────────────
// UPDATE USER
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/users/:id', () => {
  let targetUser;

  beforeAll(async () => {
    targetUser = await User.create({
      ...makeAdminData(),
      name: 'Update Target',
      email: 'updatetarget@test.com',
      password: '$2a$10$somehash123456789012345678901234567890123456',
      role: 'moderator'
    });
  });

  it('should update user name', async () => {
    const res = await api.put(`${BASE}/${targetUser._id}`, { name: 'Updated Name' }, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 403 for moderator without users.edit permission', async () => {
    const res = await api.put(`${BASE}/${targetUser._id}`, { name: 'Nope' }, moderator.token);
    expectError(res, 403);
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE USER
// ─────────────────────────────────────────────────────────────
describe('DELETE /api/v1/admin/users/:id', () => {
  let userToDelete;

  beforeAll(async () => {
    userToDelete = await User.create({
      ...makeAdminData(),
      name: 'Delete Me',
      email: 'deleteme@test.com',
      password: '$2a$10$somehash123456789012345678901234567890123456',
      role: 'moderator'
    });
  });

  it('should delete a user', async () => {
    const res = await api.delete(`${BASE}/${userToDelete._id}`, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 404 for deleting non-existent user', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await api.delete(`${BASE}/${fakeId}`, admin.token);
    expectError(res, 404);
  });

  it('should return 403 for moderator without users.delete permission', async () => {
    const another = await User.create({
      ...makeAdminData(),
      name: 'Another Target',
      email: 'anothertarget@test.com',
      password: '$2a$10$somehash123456789012345678901234567890123456',
      role: 'moderator'
    });
    const res = await api.delete(`${BASE}/${another._id}`, moderator.token);
    expectError(res, 403);
  });
});

// ─────────────────────────────────────────────────────────────
// SUSPEND / ACTIVATE
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/admin/users/:id/suspend & activate', () => {
  let targetUser;

  beforeAll(async () => {
    targetUser = await User.create({
      ...makeAdminData(),
      name: 'Suspend Target',
      email: 'suspendtarget@test.com',
      password: '$2a$10$somehash123456789012345678901234567890123456',
      role: 'moderator',
      status: 'active'
    });
  });

  it('should suspend an active user', async () => {
    const res = await api.post(`${BASE}/${targetUser._id}/suspend`, {}, admin.token);
    expectSuccess(res, 200);
  });

  it('should activate a suspended user', async () => {
    const res = await api.post(`${BASE}/${targetUser._id}/activate`, {}, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 403 for moderator on suspend', async () => {
    const res = await api.post(`${BASE}/${targetUser._id}/suspend`, {}, moderator.token);
    expectError(res, 403);
  });

  it('should return 403 for moderator on activate', async () => {
    const res = await api.post(`${BASE}/${targetUser._id}/activate`, {}, moderator.token);
    expectError(res, 403);
  });
});

// ─────────────────────────────────────────────────────────────
// BULK DELETE
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/admin/users/bulk-delete', () => {
  it('should bulk delete users by IDs', async () => {
    const u1 = await User.create({
      ...makeAdminData(),
      email: 'bulkdel1@test.com',
      password: '$2a$10$somehash123456789012345678901234567890123456',
      role: 'moderator'
    });
    const u2 = await User.create({
      ...makeAdminData(),
      email: 'bulkdel2@test.com',
      password: '$2a$10$somehash123456789012345678901234567890123456',
      role: 'moderator'
    });

    const res = await api.post(`${BASE}/bulk-delete`, { ids: [u1._id, u2._id] }, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 403 for moderator on bulk-delete', async () => {
    const res = await api.post(`${BASE}/bulk-delete`, { ids: [] }, moderator.token);
    expectError(res, 403);
  });
});

// ─────────────────────────────────────────────────────────────
// LOGIN HISTORY
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/users/:id/login-history', () => {
  it('should return login history for a user', async () => {
    const res = await api.get(`${BASE}/${admin.user._id}/login-history`, admin.token);
    expectSuccess(res, 200);
  });

  it('should support pagination', async () => {
    const res = await api.get(`${BASE}/${admin.user._id}/login-history?page=1&limit=10`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// EXPORT USER ACTIVITY CSV
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/users/:id/activity/export', () => {
  it('should export user activity as CSV', async () => {
    const res = await api.get(`${BASE}/${admin.user._id}/activity/export`, admin.token);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv|application\/octet-stream/);
  });
});
