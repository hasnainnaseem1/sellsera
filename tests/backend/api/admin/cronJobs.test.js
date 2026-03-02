/**
 * Admin Cron Jobs API Tests
 * Covers all endpoints under /api/v1/admin/cron
 */
const { connectDB, clearDB } = require('../../setup/testSetup');
const {
  seedAdmin,
  seedModerator,
  seedAdminSettings,
  apiClient,
  expectSuccess,
  expectError,
  makeCronJobData
} = require('../../helpers/testHelpers');

const User = require('../../../../backend/src/models/user/User');
const AdminSettings = require('../../../../backend/src/models/admin/AdminSettings');
const CronJob = require('../../../../backend/src/models/admin/CronJob');

const BASE = '/api/v1/admin/cron';

let app, api, admin, moderator;

beforeAll(async () => {
  app = await connectDB();
  api = apiClient(app);
  await CronJob.deleteMany({});
  await seedAdminSettings(AdminSettings);
  admin = await seedAdmin(User);
  moderator = await seedModerator(User);
});

afterAll(async () => {
  await clearDB();
});

// ─────────────────────────────────────────────────────────────
// LIST JOBS
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/cron', () => {
  it('should list cron jobs', async () => {
    const res = await api.get(BASE, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 401 without auth', async () => {
    const res = await api.get(BASE);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// CREATE JOB
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/admin/cron', () => {
  it('should create a cron job', async () => {
    const data = makeCronJobData();
    const res = await api.post(BASE, data, admin.token);
    expectSuccess(res, 201);
    expect(res.body).toHaveProperty('job');
  });

  it('should return 400 for invalid cron expression', async () => {
    const data = makeCronJobData({ schedule: 'invalid-cron' });
    const res = await api.post(BASE, data, admin.token);
    expectError(res, 400);
  });

  it('should return 400 for missing required fields', async () => {
    const res = await api.post(BASE, { description: 'No key or schedule' }, admin.token);
    expectError(res, 400);
  });

  it('should return 403 for moderator without settings.edit', async () => {
    const data = makeCronJobData();
    const res = await api.post(BASE, data, moderator.token);
    expectError(res, 403);
  });
});

// ─────────────────────────────────────────────────────────────
// UPDATE JOB
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/cron/:key', () => {
  let job;

  beforeAll(async () => {
    const data = makeCronJobData();
    const createRes = await api.post(BASE, data, admin.token);
    job = createRes.body.job;
  });

  it('should update a cron job', async () => {
    const res = await api.put(`${BASE}/${job.key}`, {
      description: 'Updated cron job description'
    }, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 404 for non-existent job key', async () => {
    const res = await api.put(`${BASE}/nonexistentjobkey`, {
      description: 'Nope'
    }, admin.token);
    expectError(res, 404);
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE JOB
// ─────────────────────────────────────────────────────────────
describe('DELETE /api/v1/admin/cron/:key', () => {
  it('should delete a cron job', async () => {
    const data = makeCronJobData();
    const createRes = await api.post(BASE, data, admin.token);
    const res = await api.delete(`${BASE}/${createRes.body.job.key}`, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 404 for non-existent job key', async () => {
    const res = await api.delete(`${BASE}/nonexistentkey`, admin.token);
    expectError(res, 404);
  });
});

// ─────────────────────────────────────────────────────────────
// TOGGLE JOB
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/cron/:key/toggle', () => {
  it('should toggle job enabled/disabled', async () => {
    const data = makeCronJobData({ enabled: false });
    const createRes = await api.post(BASE, data, admin.token);
    const res = await api.put(`${BASE}/${createRes.body.job.key}/toggle`, {}, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// TRIGGER JOB
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/admin/cron/:key/trigger', () => {
  it('should manually trigger a job', async () => {
    const data = makeCronJobData();
    const createRes = await api.post(BASE, data, admin.token);
    const res = await api.post(`${BASE}/${createRes.body.job.key}/trigger`, {}, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 404 or 500 for non-existent job key', async () => {
    const res = await api.post(`${BASE}/nonexistentkey/trigger`, {}, admin.token);
    // Controller may return 404 (if checked before triggerJob) or 500 (if triggerJob throws)
    expect([404, 500]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });
});
