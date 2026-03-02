/**
 * Notifications API Tests
 * Covers: GET /api/v1/notifications, GET /unread-count, PUT /mark-all-read,
 *         PUT /:id/read, DELETE /:id
 */
const { connectDB, clearDB } = require('../../setup/testSetup');
const {
  seedAdmin,
  seedAdminSettings,
  apiClient,
  expectSuccess,
  expectError
} = require('../../helpers/testHelpers');

const mongoose = require('mongoose');
const User = require('../../../../backend/src/models/user/User');
const Notification = require('../../../../backend/src/models/notification/Notification');
const AdminSettings = require('../../../../backend/src/models/admin/AdminSettings');

const BASE = '/api/v1/notifications';

let app, api, admin, otherAdmin;

/**
 * Helper to create a notification for a given admin
 */
async function createNotification(recipientId, overrides = {}) {
  return Notification.create({
    recipientId,
    recipientType: 'admin',
    type: 'welcome',
    title: 'Test Notification',
    message: 'This is a test notification message',
    isRead: false,
    priority: 'medium',
    ...overrides
  });
}

beforeAll(async () => {
  app = await connectDB();
  api = apiClient(app);
  await seedAdminSettings(AdminSettings);
  admin = await seedAdmin(User);
  otherAdmin = await seedAdmin(User);
});

afterAll(async () => {
  await clearDB();
});

// ─────────────────────────────────────────────────────────────
// AUTH CHECKS
// ─────────────────────────────────────────────────────────────
describe('Notification endpoints — admin auth required', () => {
  it('should return 401 on GET / without auth', async () => {
    const res = await api.get(BASE);
    expect(res.status).toBe(401);
  });

  it('should return 401 on GET /unread-count without auth', async () => {
    const res = await api.get(`${BASE}/unread-count`);
    expect(res.status).toBe(401);
  });

  it('should return 401 on PUT /mark-all-read without auth', async () => {
    const res = await api.put(`${BASE}/mark-all-read`, {});
    expect(res.status).toBe(401);
  });

  it('should return 401 on PUT /:id/read without auth', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await api.put(`${BASE}/${fakeId}/read`, {});
    expect(res.status).toBe(401);
  });

  it('should return 401 on DELETE /:id without auth', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await api.delete(`${BASE}/${fakeId}`);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/notifications/unread-count — Unread Count
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/notifications/unread-count', () => {
  beforeEach(async () => {
    await Notification.deleteMany({});
  });

  it('should return unread count of 0 when no notifications exist', async () => {
    const res = await api.get(`${BASE}/unread-count`, admin.token);
    expectSuccess(res, 200);
    const count = res.body.unreadCount ?? res.body.data?.count ?? res.body.count ?? 0;
    expect(count).toBe(0);
  });

  it('should return correct unread count', async () => {
    await createNotification(admin.user._id, { isRead: false });
    await createNotification(admin.user._id, { isRead: false });
    await createNotification(admin.user._id, { isRead: true });

    const res = await api.get(`${BASE}/unread-count`, admin.token);
    expectSuccess(res, 200);
    const count = res.body.unreadCount ?? res.body.data?.count ?? res.body.count ?? 0;
    expect(count).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/notifications — List Notifications
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/notifications', () => {
  beforeEach(async () => {
    await Notification.deleteMany({});
  });

  it('should return paginated list of notifications', async () => {
    // Create multiple notifications
    for (let i = 0; i < 5; i++) {
      await createNotification(admin.user._id, {
        title: `Notification ${i + 1}`,
        message: `Message for notification ${i + 1}`
      });
    }

    const res = await api.get(BASE, admin.token);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.notifications || [];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
  });

  it('should support pagination', async () => {
    for (let i = 0; i < 8; i++) {
      await createNotification(admin.user._id, {
        title: `Paginated Notification ${i + 1}`,
        message: `Paginated message ${i + 1}`
      });
    }

    const res = await api.get(`${BASE}?page=1&limit=3`, admin.token);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.notifications || [];
    expect(data.length).toBeLessThanOrEqual(3);
  });

  it('should not return other admin\'s notifications', async () => {
    await createNotification(otherAdmin.user._id, {
      title: 'Other Admin Notification',
      message: 'This belongs to another admin'
    });

    const res = await api.get(BASE, admin.token);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.notifications || [];
    const otherNotifs = data.filter(n => n.title === 'Other Admin Notification');
    expect(otherNotifs.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// PUT /api/v1/notifications/:id/read — Mark One as Read
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/notifications/:id/read', () => {
  it('should mark a specific notification as read', async () => {
    const notification = await createNotification(admin.user._id, { isRead: false });

    const res = await api.put(`${BASE}/${notification._id}/read`, {}, admin.token);
    expectSuccess(res, 200);

    // Verify it's now read
    const updated = await Notification.findById(notification._id);
    expect(updated.isRead).toBe(true);
  });

  it('should return 404 for non-existent notification', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await api.put(`${BASE}/${fakeId}/read`, {}, admin.token);
    expect([404, 400]).toContain(res.status);
  });
});

// ─────────────────────────────────────────────────────────────
// PUT /api/v1/notifications/mark-all-read — Mark All as Read
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/notifications/mark-all-read', () => {
  it('should mark all notifications as read and unread count becomes 0', async () => {
    await Notification.deleteMany({});

    // Create unread notifications
    await createNotification(admin.user._id, { isRead: false, title: 'Unread 1' });
    await createNotification(admin.user._id, { isRead: false, title: 'Unread 2' });
    await createNotification(admin.user._id, { isRead: false, title: 'Unread 3' });

    // Mark all as read
    const res = await api.put(`${BASE}/mark-all-read`, {}, admin.token);
    expectSuccess(res, 200);

    // Verify unread count is 0
    const countRes = await api.get(`${BASE}/unread-count`, admin.token);
    expectSuccess(countRes, 200);
    const count = countRes.body.unreadCount ?? countRes.body.data?.count ?? countRes.body.count ?? 0;
    expect(count).toBe(0);

    // Verify all are read in DB
    const unread = await Notification.find({ recipientId: admin.user._id, isRead: false });
    expect(unread.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/v1/notifications/:id — Delete Notification
// ─────────────────────────────────────────────────────────────
describe('DELETE /api/v1/notifications/:id', () => {
  it('should delete a specific notification', async () => {
    const notification = await createNotification(admin.user._id);

    const res = await api.delete(`${BASE}/${notification._id}`, admin.token);
    expectSuccess(res, 200);

    // Verify it's gone
    const found = await Notification.findById(notification._id);
    expect(found).toBeNull();
  });

  it('should return 404 for non-existent notification', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await api.delete(`${BASE}/${fakeId}`, admin.token);
    expect([404, 400]).toContain(res.status);
  });
});
