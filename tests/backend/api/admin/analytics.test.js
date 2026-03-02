/**
 * Admin Analytics API Tests
 * Covers all endpoints under /api/v1/admin/analytics
 */
const { connectDB, clearDB } = require('../../setup/testSetup');
const {
  seedAdmin,
  seedCustomer,
  seedAdminSettings,
  seedPlan,
  seedFeature,
  apiClient,
  expectSuccess,
  expectError
} = require('../../helpers/testHelpers');

const User = require('../../../../backend/src/models/user/User');
const AdminSettings = require('../../../../backend/src/models/admin/AdminSettings');
const Plan = require('../../../../backend/src/models/subscription/Plan');
const Feature = require('../../../../backend/src/models/subscription/Feature');

const BASE = '/api/v1/admin/analytics';

let app, api, admin, customer;

beforeAll(async () => {
  app = await connectDB();
  api = apiClient(app);
  await seedAdminSettings(AdminSettings);
  admin = await seedAdmin(User);
  customer = await seedCustomer(User);
  await seedPlan(Plan);
  await seedFeature(Feature);
});

afterAll(async () => {
  await clearDB();
});

// ─────────────────────────────────────────────────────────────
// AUTH CHECK
// ─────────────────────────────────────────────────────────────
describe('Analytics auth', () => {
  it('should return 401 without auth token', async () => {
    const res = await api.get(`${BASE}/overview`);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// OVERVIEW
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/analytics/overview', () => {
  it('should return overview data', async () => {
    const res = await api.get(`${BASE}/overview`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// USERS GROWTH
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/analytics/users-growth', () => {
  it('should return users growth data', async () => {
    const res = await api.get(`${BASE}/users-growth`, admin.token);
    expectSuccess(res, 200);
  });

  it('should support date range query params', async () => {
    const res = await api.get(`${BASE}/users-growth?startDate=2025-01-01&endDate=2026-12-31`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// ANALYSES TREND
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/analytics/analyses-trend', () => {
  it('should return analyses trend data', async () => {
    const res = await api.get(`${BASE}/analyses-trend`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// SUBSCRIPTION DISTRIBUTION
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/analytics/subscription-distribution', () => {
  it('should return subscription distribution', async () => {
    const res = await api.get(`${BASE}/subscription-distribution`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// TOP CUSTOMERS
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/analytics/top-customers', () => {
  it('should return top customers', async () => {
    const res = await api.get(`${BASE}/top-customers`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// RECENT ACTIVITIES
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/analytics/recent-activities', () => {
  it('should return recent activities', async () => {
    const res = await api.get(`${BASE}/recent-activities`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// PLAN DISTRIBUTION
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/analytics/plan-distribution', () => {
  it('should return plan distribution', async () => {
    const res = await api.get(`${BASE}/plan-distribution`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// USAGE STATS
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/analytics/usage-stats', () => {
  it('should return usage stats', async () => {
    const res = await api.get(`${BASE}/usage-stats`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// USAGE TREND
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/analytics/usage-trend/:featureKey', () => {
  it('should return usage trend for a feature key', async () => {
    const res = await api.get(`${BASE}/usage-trend/analysis`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// CUSTOMER USAGE
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/analytics/customer-usage/:id', () => {
  it('should return customer usage data', async () => {
    const res = await api.get(`${BASE}/customer-usage/${customer.user._id}`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// REVENUE STATS
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/analytics/revenue-stats', () => {
  it('should return revenue stats', async () => {
    const res = await api.get(`${BASE}/revenue-stats`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// LOGIN ANALYTICS
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/analytics/login-analytics', () => {
  it('should return login analytics', async () => {
    const res = await api.get(`${BASE}/login-analytics`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// FEATURE ADOPTION
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/analytics/feature-adoption', () => {
  it('should return feature adoption data', async () => {
    const res = await api.get(`${BASE}/feature-adoption`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// PER-PLAN USAGE
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/analytics/per-plan-usage', () => {
  it('should return per-plan usage data', async () => {
    const res = await api.get(`${BASE}/per-plan-usage`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// REVENUE ADVANCED
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/analytics/revenue-advanced', () => {
  it('should return advanced revenue data', async () => {
    const res = await api.get(`${BASE}/revenue-advanced`, admin.token);
    expectSuccess(res, 200);
  });
});
