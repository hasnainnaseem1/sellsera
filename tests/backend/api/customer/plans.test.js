/**
 * Customer Plans API Tests
 * Covers: GET /api/v1/customer/plans
 */
const { connectDB, clearDB } = require('../../setup/testSetup');
const {
  seedCustomer,
  seedAdminSettings,
  apiClient,
  expectSuccess,
  expectError
} = require('../../helpers/testHelpers');

const User = require('../../../../backend/src/models/user/User');
const Plan = require('../../../../backend/src/models/subscription/Plan');
const AdminSettings = require('../../../../backend/src/models/admin/AdminSettings');

const BASE = '/api/v1/customer/plans';

let app, api, customer;

beforeAll(async () => {
  app = await connectDB();
  api = apiClient(app);
  await seedAdminSettings(AdminSettings);
  customer = await seedCustomer(User);

  // Create active and inactive plans
  await Plan.create({
    name: 'Active Starter',
    slug: 'active-starter',
    description: 'Active starter plan',
    price: { monthly: 9.99, yearly: 99.99 },
    billingCycle: 'both',
    isActive: true,
    displayOrder: 1,
    features: [{
      featureId: new (require('mongoose').Types.ObjectId)(),
      featureKey: 'listing_audit',
      featureName: 'Listing Audit',
      enabled: true,
      limit: 10
    }]
  });

  await Plan.create({
    name: 'Active Pro',
    slug: 'active-pro',
    description: 'Active pro plan',
    price: { monthly: 29.99, yearly: 299.99 },
    billingCycle: 'both',
    isActive: true,
    displayOrder: 2,
    features: [{
      featureId: new (require('mongoose').Types.ObjectId)(),
      featureKey: 'listing_audit',
      featureName: 'Listing Audit',
      enabled: true,
      limit: 100
    }]
  });

  await Plan.create({
    name: 'Inactive Legacy',
    slug: 'inactive-legacy',
    description: 'An inactive plan',
    price: { monthly: 4.99, yearly: 49.99 },
    billingCycle: 'both',
    isActive: false,
    displayOrder: 99,
    features: []
  });
});

afterAll(async () => {
  await clearDB();
});

// ─────────────────────────────────────────────────────────────
// AUTH CHECK
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/customer/plans — auth required', () => {
  it('should return 401 without auth', async () => {
    const res = await api.get(BASE);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// LIST PLANS
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/customer/plans', () => {
  it('should return active plans with auth', async () => {
    const res = await api.get(BASE, customer.token);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.plans || [];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(2);
  });

  it('should include features array in plans', async () => {
    const res = await api.get(BASE, customer.token);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.plans || [];
    const planWithFeatures = data.find(p => p.features && p.features.length > 0);
    expect(planWithFeatures).toBeDefined();
    expect(Array.isArray(planWithFeatures.features)).toBe(true);
  });

  it('should only return active plans (not inactive)', async () => {
    const res = await api.get(BASE, customer.token);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.plans || [];
    const inactivePlan = data.find(p => p.name === 'Inactive Legacy');
    expect(inactivePlan).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
// FEATURE GATE — enableSubscriptions
// ─────────────────────────────────────────────────────────────
describe('Feature gate: enableSubscriptions', () => {
  it('should return 403 when enableSubscriptions is disabled', async () => {
    await seedAdminSettings(AdminSettings, {
      features: {
        enableAnalysis: true,
        enableSubscriptions: false,
        enableCustomRoles: true,
        enableActivityLogs: true
      }
    });

    const res = await api.get(BASE, customer.token);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);

    // Re-enable for other tests
    await seedAdminSettings(AdminSettings);
  });
});
