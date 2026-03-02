/**
 * Admin Upload API Tests
 * Covers all endpoints under /api/v1/admin/upload
 */
const path = require('path');
const fs = require('fs');
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

const BASE = '/api/v1/admin/upload';

let app, api, admin, moderator;

// Create a tiny test image file for upload tests
const TEST_IMAGE_PATH = path.join(__dirname, '__test_upload_image.png');

beforeAll(async () => {
  app = await connectDB();
  api = apiClient(app);
  await seedAdminSettings(AdminSettings);
  admin = await seedAdmin(User);
  moderator = await seedModerator(User);

  // Create a minimal 1x1 PNG for upload testing
  const PNG_1x1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  fs.writeFileSync(TEST_IMAGE_PATH, PNG_1x1);
});

afterAll(async () => {
  await clearDB();
  // Clean up test image
  if (fs.existsSync(TEST_IMAGE_PATH)) {
    fs.unlinkSync(TEST_IMAGE_PATH);
  }
});

// ─────────────────────────────────────────────────────────────
// UPLOAD FILE
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/admin/upload/:folder', () => {
  it('should upload an image to a valid folder', async () => {
    const res = await api.upload(`${BASE}/general`, 'file', TEST_IMAGE_PATH, admin.token);
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 for invalid folder name', async () => {
    const res = await api.upload(`${BASE}/invalidfolder`, 'file', TEST_IMAGE_PATH, admin.token);
    expectError(res, 400);
  });

  it('should return 401 without auth token', async () => {
    try {
      const res = await api.upload(`${BASE}/general`, 'file', TEST_IMAGE_PATH);
      expect(res.status).toBe(401);
    } catch (err) {
      // ECONNRESET may occur if the server closes the connection before the upload finishes
      // This is acceptable behavior — the server rejected the unauthenticated upload
      expect(err.code || err.message).toMatch(/ECONNRESET|ECONNABORTED|socket hang up/i);
    }
  });

  it('should return 403 for moderator without settings.edit', async () => {
    const res = await api.upload(`${BASE}/general`, 'file', TEST_IMAGE_PATH, moderator.token);
    expectError(res, 403);
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE FILE
// ─────────────────────────────────────────────────────────────
describe('DELETE /api/v1/admin/upload/:folder/:filename', () => {
  it('should return 404 for non-existent file', async () => {
    const res = await api.delete(`${BASE}/general/nonexistent-file.png`, admin.token);
    expectError(res, 404);
  });

  it('should return 401 without auth', async () => {
    const res = await api.delete(`${BASE}/general/somefile.png`);
    expect(res.status).toBe(401);
  });
});
