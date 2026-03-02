/**
 * Customer Subscription API Tests
 * Covers: GET /api/v1/customer/subscription, GET /api/v1/customer/subscription/usage
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
const AdminSettings = require('../../../../backend/src/models/admin/AdminSettings');
const UsageLog = require('../../../../backend/src/models/subscription/UsageLog');

const BASE = '/api/v1/customer/subscription';

let app, api, plan, feature;

beforeAll(async () => {
  app = await connectDB();
  api = apiClient(app);
  await seedAdminSettings(AdminSettings);

  // Seed a feature and plan
  feature = await Feature.create({
    name: 'Listing Audit',
    featureKey: 'listing_audit',
    description: 'AI listing audit',
    type: 'numeric',
    defaultValue: 0,
    isActive: true
  });

  plan = await Plan.create({
    name: 'Pro Plan',
    slug: 'pro-plan',
    description: 'Pro subscription plan',
    price: { monthly: 19.99, yearly: 199.99 },
    billingCycle: 'both',
    isActive: true,
    features: [{
      featureId: feature._id,
      featureKey: 'listing_audit',
      featureName: 'Listing Audit',
      enabled: true,
      limit: 50
    }]
  });
});

afterAll(async () => {
  await clearDB();
});

// ─────────────────────────────────────────────────────────────
// AUTH CHECKS
// ─────────────────────────────────────────────────────────────
describe('Subscription endpoints — auth required', () => {
  it('should return 401 on GET / without auth', async () => {
    const res = await api.get(BASE);
    expect(res.status).toBe(401);
  });

  it('should return 401 on GET /usage without auth', async () => {
    const res = await api.get(`${BASE}/usage`);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/customer/subscription — Get Subscription Info
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/customer/subscription', () => {
  it('should return subscription info for active subscriber', async () => {
    const activeCustomer = await seedCustomer(User, {
      currentPlan: plan._id,
      planSnapshot: {
        planId: plan._id,
        planName: plan.name,
        features: plan.features,
        assignedAt: new Date()
      },
      subscriptionStatus: 'active',
      subscriptionStartDate: new Date(),
      subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    const res = await api.get(BASE, activeCustomer.token);
    expectSuccess(res, 200);
    expect(res.body).toHaveProperty('subscription');
  });

  it('should return appropriate response when user has no subscription', async () => {
    const noSubCustomer = await seedCustomer(User, {
      subscriptionStatus: 'none',
      currentPlan: null,
      planSnapshot: null
    });

    const res = await api.get(BASE, noSubCustomer.token);
    expectSuccess(res, 200);
    // Should still succeed but indicate no active subscription
    const data = res.body.data || res.body;
    expect(data).toBeDefined();
  });

  it('should return info for trial subscription user', async () => {
    const trialCustomer = await seedCustomer(User, {
      currentPlan: plan._id,
      planSnapshot: {
        planId: plan._id,
        planName: plan.name,
        features: plan.features,
        assignedAt: new Date()
      },
      subscriptionStatus: 'trial',
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    });

    const res = await api.get(BASE, trialCustomer.token);
    expectSuccess(res, 200);
  });

  it('should return info for expired subscription user', async () => {
    const expiredCustomer = await seedCustomer(User, {
      currentPlan: plan._id,
      planSnapshot: {
        planId: plan._id,
        planName: plan.name,
        features: plan.features,
        assignedAt: new Date()
      },
      subscriptionStatus: 'expired',
      subscriptionExpiresAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    });

    const res = await api.get(BASE, expiredCustomer.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/customer/subscription/usage — Get Feature Usage
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/customer/subscription/usage', () => {
  it('should return usage data for current plan features', async () => {
    const activeCustomer = await seedCustomer(User, {
      currentPlan: plan._id,
      planSnapshot: {
        planId: plan._id,
        planName: plan.name,
        features: plan.features,
        assignedAt: new Date()
      },
      subscriptionStatus: 'active',
      subscriptionStartDate: new Date(),
      subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      analysisCount: 5,
      analysisLimit: 50
    });

    // Seed some usage logs
    await UsageLog.create({
      userId: activeCustomer.user._id,
      featureKey: 'listing_audit',
      featureName: 'Listing Audit',
      planId: plan._id,
      planName: plan.name,
      action: 'used',
      currentCount: 5,
      limit: 50
    });

    const res = await api.get(`${BASE}/usage`, activeCustomer.token);
    expectSuccess(res, 200);
    expect(res.body).toHaveProperty('usage');
  });
});

// ─────────────────────────────────────────────────────────────
// FEATURE GATE — enableSubscriptions
// ─────────────────────────────────────────────────────────────
describe('Feature gate: enableSubscriptions', () => {
  it('should return 403 on GET / when enableSubscriptions is disabled', async () => {
    await seedAdminSettings(AdminSettings, {
      features: {
        enableAnalysis: true,
        enableSubscriptions: false,
        enableCustomRoles: true,
        enableActivityLogs: true
      }
    });

    const cust = await seedCustomer(User, { subscriptionStatus: 'active' });
    const res = await api.get(BASE, cust.token);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('should return 403 on GET /usage when enableSubscriptions is disabled', async () => {
    // Settings already disabled from previous test
    const cust = await seedCustomer(User, { subscriptionStatus: 'active' });
    const res = await api.get(`${BASE}/usage`, cust.token);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);

    // Re-enable for other tests
    await seedAdminSettings(AdminSettings);
  });
});
