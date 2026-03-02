/**
 * Admin Dev Utils API Tests
 * Covers all endpoints under /api/v1/admin/dev-utils
 */
const { connectDB, clearDB } = require('../../setup/testSetup');
const {
  seedAdmin,
  seedModerator,
  seedCustomer,
  seedAdminSettings,
  apiClient,
  expectSuccess,
  expectError
} = require('../../helpers/testHelpers');

const User = require('../../../../backend/src/models/user/User');
const AdminSettings = require('../../../../backend/src/models/admin/AdminSettings');

const BASE = '/api/v1/admin/dev-utils';

let app, api, admin, moderator, customer;

beforeAll(async () => {
  app = await connectDB();
  api = apiClient(app);
  await seedAdminSettings(AdminSettings);
  admin = await seedAdmin(User);
  moderator = await seedModerator(User);
  customer = await seedCustomer(User, { isEmailVerified: false });
});

afterAll(async () => {
  await clearDB();
});

// ─────────────────────────────────────────────────────────────
// VERIFY CUSTOMER
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/admin/dev-utils/verify-customer', () => {
  it('should manually verify a customer email', async () => {
    const res = await api.post(`${BASE}/verify-customer`, {
      email: customer.user.email
    }, admin.token);
    expectSuccess(res, 200);

    // Verify the customer's email was updated
    const updatedUser = await User.findById(customer.user._id);
    expect(updatedUser.isEmailVerified).toBe(true);
  });

  it('should return 404 for non-existent customer email', async () => {
    const res = await api.post(`${BASE}/verify-customer`, {
      email: 'nonexistent@test.com'
    }, admin.token);
    expectError(res, 404);
  });

  it('should return 403 for moderator without users.edit', async () => {
    const res = await api.post(`${BASE}/verify-customer`, {
      email: customer.user.email
    }, moderator.token);
    expectError(res, 403);
  });

  it('should return 401 without auth', async () => {
    const res = await api.post(`${BASE}/verify-customer`, {
      email: customer.user.email
    });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// CREATE TEST CUSTOMER
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/admin/dev-utils/create-test-customer', () => {
  it('should create a test customer', async () => {
    const res = await api.post(`${BASE}/create-test-customer`, {
      name: 'Test Customer',
      email: `test-customer-${Date.now()}@test.com`,
      password: 'test123456'
    }, admin.token);
    expectSuccess(res, 201);
    expect(res.body).toHaveProperty('customer');
  });

  it('should return 403 for moderator without users.create', async () => {
    const res = await api.post(`${BASE}/create-test-customer`, {}, moderator.token);
    expectError(res, 403);
  });
});
