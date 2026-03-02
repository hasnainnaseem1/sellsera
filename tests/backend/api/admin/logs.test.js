/**
 * Admin Activity Logs API Tests
 * Covers all endpoints under /api/v1/admin/logs
 */
const { connectDB, clearDB } = require('../../setup/testSetup');
const {
  seedAdmin,
  seedModerator,
  seedAdminSettings,
  apiClient,
  expectSuccess,
  expectError
} = require('../../helpers/testHelpers');

const User = require('../../../../backend/src/models/user/User');
const AdminSettings = require('../../../../backend/src/models/admin/AdminSettings');
const ActivityLog = require('../../../../backend/src/models/admin/ActivityLog');

const BASE = '/api/v1/admin/logs';

let app, api, admin, moderator;

beforeAll(async () => {
  app = await connectDB();
  api = apiClient(app);
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

  // Seed some activity logs
  await ActivityLog.create([
    {
      userId: admin.user._id,
      userName: admin.user.name,
      userEmail: admin.user.email,
      userRole: admin.user.role || 'super_admin',
      action: 'login',
      actionType: 'auth',
      description: 'Admin logged in',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
      createdAt: new Date()
    },
    {
      userId: admin.user._id,
      userName: admin.user.name,
      userEmail: admin.user.email,
      userRole: admin.user.role || 'super_admin',
      action: 'settings_updated',
      actionType: 'update',
      description: 'Settings updated',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
      createdAt: new Date(Date.now() - 86400000) // 1 day ago
    },
    {
      userId: admin.user._id,
      userName: admin.user.name,
      userEmail: admin.user.email,
      userRole: admin.user.role || 'super_admin',
      action: 'user_created',
      actionType: 'create',
      description: 'User created',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
      createdAt: new Date(Date.now() - 172800000) // 2 days ago
    }
  ]);
});

afterAll(async () => {
  await clearDB();
});

// ─────────────────────────────────────────────────────────────
// LIST LOGS
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/logs', () => {
  it('should list activity logs', async () => {
    const res = await api.get(BASE, admin.token);
    expectSuccess(res, 200);
    expect(res.body).toHaveProperty('logs');
    expect(Array.isArray(res.body.logs)).toBe(true);
  });

  it('should support pagination', async () => {
    const res = await api.get(`${BASE}?page=1&limit=2`, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 401 without auth', async () => {
    const res = await api.get(BASE);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// STATS SUMMARY
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/logs/stats/summary', () => {
  it('should return log stats summary', async () => {
    const res = await api.get(`${BASE}/stats/summary`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// USER-SPECIFIC LOGS
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/logs/user/:userId', () => {
  it('should return logs for a specific user', async () => {
    const res = await api.get(`${BASE}/user/${admin.user._id}`, admin.token);
    expectSuccess(res, 200);
    expect(res.body).toHaveProperty('logs');
  });
});

// ─────────────────────────────────────────────────────────────
// GET SINGLE LOG
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/logs/:id', () => {
  it('should get a single log by ID', async () => {
    const log = await ActivityLog.findOne({});
    if (log) {
      const res = await api.get(`${BASE}/${log._id}`, admin.token);
      expectSuccess(res, 200);
    }
  });

  it('should return 404 for non-existent log', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await api.get(`${BASE}/${fakeId}`, admin.token);
    expectError(res, 404);
  });
});

// ─────────────────────────────────────────────────────────────
// EXPORT CSV
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/logs/export/csv', () => {
  it('should export logs as CSV', async () => {
    const res = await api.get(`${BASE}/export/csv`, admin.token);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv|application\/octet-stream/);
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE OLD LOGS
// ─────────────────────────────────────────────────────────────
describe('DELETE /api/v1/admin/logs/old', () => {
  it('should delete logs older than specified days', async () => {
    const res = await api.delete(`${BASE}/old`, admin.token);
    // Send days in query or body depending on implementation
    // Using the request builder which sends body for delete — try as query
    const res2 = await api.get(`${BASE}/export/csv`, admin.token); // just to keep valid
    // Actually let's use post-style delete with body
    const agent = require('supertest')(app);
    const delRes = await agent
      .delete(`${BASE}/old`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ days: 30 });
    expect([200, 204]).toContain(delRes.status);
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE BY DATE RANGE
// ─────────────────────────────────────────────────────────────
describe('DELETE /api/v1/admin/logs/range', () => {
  it('should delete logs within a date range', async () => {
    const agent = require('supertest')(app);
    const res = await agent
      .delete(`${BASE}/range`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        startDate: '2025-01-01',
        endDate: '2025-06-01'
      });
    expect([200, 204]).toContain(res.status);
  });
});

// ─────────────────────────────────────────────────────────────
// FEATURE GATE — enableActivityLogs disabled
// ─────────────────────────────────────────────────────────────
describe('Feature gate: enableActivityLogs disabled', () => {
  beforeAll(async () => {
    await AdminSettings.updateOne({}, {
      $set: { 'features.enableActivityLogs': false }
    });
  });

  afterAll(async () => {
    await AdminSettings.updateOne({}, {
      $set: { 'features.enableActivityLogs': true }
    });
  });

  it('should return 403 when activity logs feature is disabled', async () => {
    const res = await api.get(BASE, admin.token);
    expectError(res, 403);
  });
});
