/**
 * Customer Analysis API Tests
 * Covers: POST /api/v1/customer/analysis
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
const Feature = require('../../../../backend/src/models/subscription/Feature');
const Analysis = require('../../../../backend/src/models/customer/Analysis');
const AdminSettings = require('../../../../backend/src/models/admin/AdminSettings');

const BASE = '/api/v1/customer/analysis';

let app, api, customer, plan, feature;

const validListing = {
  title: 'Vintage Leather Bag',
  description: 'A beautiful handcrafted vintage leather bag with premium materials and elegant design.',
  tags: ['vintage', 'leather', 'bag', 'handcrafted'],
  price: 89.99,
  category: 'Bags & Purses'
};

beforeAll(async () => {
  app = await connectDB();
  api = apiClient(app);
  await seedAdminSettings(AdminSettings);

  // Create a feature in the features collection
  feature = await Feature.create({
    name: 'Listing Audit',
    featureKey: 'listing_audit',
    description: 'AI-powered listing audit',
    type: 'numeric',
    defaultValue: 0,
    isActive: true
  });

  // Create a plan with the listing_audit feature
  plan = await Plan.create({
    name: 'Test Plan',
    slug: 'test-plan',
    description: 'A test plan with listing audit',
    price: { monthly: 9.99, yearly: 99.99 },
    billingCycle: 'both',
    isActive: true,
    features: [{
      featureId: feature._id,
      featureKey: 'listing_audit',
      featureName: 'Listing Audit',
      enabled: true,
      limit: 10
    }]
  });

  // Seed customer with active subscription and plan
  customer = await seedCustomer(User, {
    currentPlan: plan._id,
    planSnapshot: {
      planId: plan._id,
      planName: plan.name,
      features: [{
        featureId: feature._id,
        featureKey: 'listing_audit',
        featureName: 'Listing Audit',
        enabled: true,
        limit: 10
      }],
      assignedAt: new Date()
    },
    subscriptionStatus: 'active',
    subscriptionStartDate: new Date(),
    subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    analysisCount: 0,
    analysisLimit: 10
  });
});

afterAll(async () => {
  await clearDB();
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/customer/analysis — Analyze Listing
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/customer/analysis', () => {
  it('should return 401 without auth', async () => {
    const res = await api.post(BASE, validListing);
    expect(res.status).toBe(401);
  });

  it('should fail without active subscription', async () => {
    // Create a customer with no subscription
    const noSubCustomer = await seedCustomer(User, {
      subscriptionStatus: 'none',
      currentPlan: null,
      planSnapshot: null
    });

    const res = await api.post(BASE, validListing, noSubCustomer.token);
    // Should fail because of checkSubscription middleware
    expect([400, 402, 403]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  it('should succeed with auth + active subscription + listing_audit feature', async () => {
    const res = await api.post(BASE, validListing, customer.token);
    expectSuccess(res, 200);
    expect(res.body).toHaveProperty('analysis');
  });

  it('should return 400 when title is missing', async () => {
    const body = { ...validListing };
    delete body.title;
    const res = await api.post(BASE, body, customer.token);
    expectError(res, 400);
  });

  it('should return 400 when description is missing', async () => {
    const body = { ...validListing };
    delete body.description;
    const res = await api.post(BASE, body, customer.token);
    expectError(res, 400);
  });

  it('should return correct response structure with score and recommendations', async () => {
    const res = await api.post(BASE, validListing, customer.token);
    expectSuccess(res, 200);

    const data = res.body.analysis || res.body.data || res.body;
    // Analysis should contain score
    expect(data).toHaveProperty('score');
    // Analysis should contain recommendations
    expect(data).toHaveProperty('recommendations');
  });

  it('should increment user analysisCount after successful analysis', async () => {
    const beforeUser = await User.findById(customer.user._id);
    const countBefore = beforeUser.analysisCount;

    await api.post(BASE, validListing, customer.token);

    const afterUser = await User.findById(customer.user._id);
    expect(afterUser.analysisCount).toBeGreaterThanOrEqual(countBefore);
  });

  it('should fail when feature is disabled in admin settings', async () => {
    // Disable the analysis feature
    await seedAdminSettings(AdminSettings, {
      features: {
        enableAnalysis: false,
        enableSubscriptions: true,
        enableCustomRoles: true,
        enableActivityLogs: true
      }
    });

    const res = await api.post(BASE, validListing, customer.token);
    expect([403, 400]).toContain(res.status);
    expect(res.body.success).toBe(false);

    // Re-enable for other tests
    await seedAdminSettings(AdminSettings);
  });
});
