/**
 * Admin Customers API Tests
 * Covers all endpoints under /api/v1/admin/customers
 */
const { connectDB, clearDB } = require('../../setup/testSetup');
const {
  seedAdmin,
  seedModerator,
  seedCustomer,
  seedAdminSettings,
  seedPlan,
  apiClient,
  expectSuccess,
  expectError,
  makeCustomerData
} = require('../../helpers/testHelpers');

const User = require('../../../../backend/src/models/user/User');
const AdminSettings = require('../../../../backend/src/models/admin/AdminSettings');
const Plan = require('../../../../backend/src/models/subscription/Plan');

const BASE = '/api/v1/admin/customers';

let app, api, admin, moderator, customer;

beforeAll(async () => {
  app = await connectDB();
  api = apiClient(app);
  await seedAdminSettings(AdminSettings);
  admin = await seedAdmin(User);
  moderator = await seedModerator(User);
  customer = await seedCustomer(User);
});

afterAll(async () => {
  await clearDB();
});

// ─────────────────────────────────────────────────────────────
// LIST CUSTOMERS
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/customers', () => {
  it('should list customers', async () => {
    const res = await api.get(BASE, admin.token);
    expectSuccess(res, 200);
    expect(res.body).toHaveProperty('customers');
    expect(Array.isArray(res.body.customers)).toBe(true);
  });

  it('should support pagination', async () => {
    const res = await api.get(`${BASE}?page=1&limit=5`, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 401 without auth', async () => {
    const res = await api.get(BASE);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// EXPORT CSV
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/customers/export/csv', () => {
  it('should export customers as CSV', async () => {
    const res = await api.get(`${BASE}/export/csv`, admin.token);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv|application\/octet-stream/);
  });
});

// ─────────────────────────────────────────────────────────────
// GET CUSTOMER BY ID
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/customers/:id', () => {
  it('should get a customer by ID', async () => {
    const res = await api.get(`${BASE}/${customer.user._id}`, admin.token);
    expectSuccess(res, 200);
    expect(res.body).toHaveProperty('customer');
  });

  it('should return 404 for non-existent customer', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await api.get(`${BASE}/${fakeId}`, admin.token);
    expectError(res, 404);
  });
});

// ─────────────────────────────────────────────────────────────
// CUSTOMER ACTIVITY
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/customers/:id/activity', () => {
  it('should get customer activity', async () => {
    const res = await api.get(`${BASE}/${customer.user._id}/activity`, admin.token);
    expectSuccess(res, 200);
  });

  it('should support date range filtering', async () => {
    const res = await api.get(
      `${BASE}/${customer.user._id}/activity?startDate=2025-01-01&endDate=2026-12-31`,
      admin.token
    );
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// EXPORT CUSTOMER ACTIVITY CSV
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/customers/:id/activity/export', () => {
  it('should export customer activity as CSV', async () => {
    const res = await api.get(`${BASE}/${customer.user._id}/activity/export`, admin.token);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv|application\/octet-stream/);
  });
});

// ─────────────────────────────────────────────────────────────
// LOGIN HISTORY
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/customers/:id/login-history', () => {
  it('should get customer login history', async () => {
    const res = await api.get(`${BASE}/${customer.user._id}/login-history`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// USAGE ANALYTICS
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/customers/:id/usage-analytics', () => {
  it('should get customer usage analytics', async () => {
    const res = await api.get(`${BASE}/${customer.user._id}/usage-analytics`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// CUSTOMER PAYMENTS
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/customers/:id/payments', () => {
  it('should get customer payments', async () => {
    const res = await api.get(`${BASE}/${customer.user._id}/payments`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// CUSTOMER ANALYSES
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/customers/:id/analyses', () => {
  it('should get customer analyses', async () => {
    const res = await api.get(`${BASE}/${customer.user._id}/analyses`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// UPDATE CUSTOMER PLAN
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/customers/:id/plan', () => {
  it('should update customer plan', async () => {
    const res = await api.put(`${BASE}/${customer.user._id}/plan`, {
      plan: 'starter'
    }, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// ASSIGN PLAN
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/customers/:id/assign-plan', () => {
  it('should assign a plan to customer', async () => {
    const plan = await seedPlan(Plan);
    const res = await api.put(`${BASE}/${customer.user._id}/assign-plan`, {
      planId: plan._id
    }, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// UPDATE CUSTOMER STATUS
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/customers/:id/status', () => {
  it('should update customer status to suspended', async () => {
    const c = await seedCustomer(User);
    const res = await api.put(`${BASE}/${c.user._id}/status`, {
      status: 'suspended'
    }, admin.token);
    expectSuccess(res, 200);
  });

  it('should update customer status to active', async () => {
    const c = await seedCustomer(User, { status: 'suspended' });
    const res = await api.put(`${BASE}/${c.user._id}/status`, {
      status: 'active'
    }, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// RESET USAGE
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/admin/customers/:id/reset-usage', () => {
  it('should reset customer usage', async () => {
    const res = await api.post(`${BASE}/${customer.user._id}/reset-usage`, {}, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// VERIFY EMAIL
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/admin/customers/:id/verify-email', () => {
  it('should manually verify customer email', async () => {
    const unverified = await seedCustomer(User, { isEmailVerified: false });
    const res = await api.post(`${BASE}/${unverified.user._id}/verify-email`, {}, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE CUSTOMER (super_admin only)
// ─────────────────────────────────────────────────────────────
describe('DELETE /api/v1/admin/customers/:id', () => {
  it('should delete a customer (super_admin)', async () => {
    const c = await seedCustomer(User);
    const res = await api.delete(`${BASE}/${c.user._id}`, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 403 for moderator trying to delete', async () => {
    const c = await seedCustomer(User);
    const res = await api.delete(`${BASE}/${c.user._id}`, moderator.token);
    expectError(res, 403);
  });

  it('should return 404 for non-existent customer', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await api.delete(`${BASE}/${fakeId}`, admin.token);
    expectError(res, 404);
  });
});

// ─────────────────────────────────────────────────────────────
// BULK DELETE (super_admin only)
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/admin/customers/bulk-delete', () => {
  it('should bulk delete customers (super_admin)', async () => {
    const c1 = await seedCustomer(User);
    const c2 = await seedCustomer(User);
    const res = await api.post(`${BASE}/bulk-delete`, {
      ids: [c1.user._id, c2.user._id]
    }, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 403 for moderator on bulk-delete', async () => {
    const res = await api.post(`${BASE}/bulk-delete`, { ids: [] }, moderator.token);
    expectError(res, 403);
  });
});
