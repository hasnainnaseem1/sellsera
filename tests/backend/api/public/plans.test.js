/**
 * Public Plans API Tests
 * Covers: GET /api/v1/public/plans
 */
const { connectDB, clearDB } = require('../../setup/testSetup');
const {
  seedAdminSettings,
  apiClient,
  expectSuccess
} = require('../../helpers/testHelpers');

const Plan = require('../../../../backend/src/models/subscription/Plan');
const Feature = require('../../../../backend/src/models/subscription/Feature');
const AdminSettings = require('../../../../backend/src/models/admin/AdminSettings');

const BASE = '/api/v1/public/plans';

let app, api;

beforeAll(async () => {
  app = await connectDB();
  api = apiClient(app);
  await seedAdminSettings(AdminSettings);

  // Create features
  const feature = await Feature.create({
    name: 'Public Listing Audit',
    featureKey: 'listing_audit_public',
    description: 'Public listing audit feature',
    type: 'numeric',
    defaultValue: 0,
    isActive: true
  });

  // Create active plans with different display orders
  await Plan.create({
    name: 'Public Free',
    slug: 'public-free',
    description: 'Free plan',
    price: { monthly: 0, yearly: 0 },
    billingCycle: 'both',
    isActive: true,
    displayOrder: 1,
    features: [{
      featureId: feature._id,
      featureKey: 'listing_audit_public',
      featureName: 'Public Listing Audit',
      enabled: true,
      limit: 5
    }]
  });

  await Plan.create({
    name: 'Public Pro',
    slug: 'public-pro',
    description: 'Pro plan',
    price: { monthly: 19.99, yearly: 199.99 },
    billingCycle: 'both',
    isActive: true,
    displayOrder: 2,
    features: [{
      featureId: feature._id,
      featureKey: 'listing_audit_public',
      featureName: 'Public Listing Audit',
      enabled: true,
      limit: 100
    }]
  });

  // Create an inactive plan
  await Plan.create({
    name: 'Public Deprecated',
    slug: 'public-deprecated',
    description: 'Deprecated plan',
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
// GET /api/v1/public/plans — List Active Plans (no auth)
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/public/plans', () => {
  it('should return active plans only', async () => {
    const res = await api.get(BASE);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.plans || [];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(2);

    // Public API only returns active plans (isActive is not included in response)
    // Verify by checking that inactive plans are not present
    const names = data.map(p => p.name);
    expect(names).not.toContain('Public Deprecated');
  });

  it('should include features array in plans', async () => {
    const res = await api.get(BASE);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.plans || [];
    const planWithFeatures = data.find(p => p.features && p.features.length > 0);
    expect(planWithFeatures).toBeDefined();
    expect(Array.isArray(planWithFeatures.features)).toBe(true);
  });

  it('should not return inactive plans', async () => {
    const res = await api.get(BASE);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.plans || [];
    const names = data.map(p => p.name);
    expect(names).not.toContain('Public Deprecated');
  });

  it('should return plans ordered by displayOrder', async () => {
    const res = await api.get(BASE);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.plans || [];

    // Verify ascending displayOrder
    for (let i = 1; i < data.length; i++) {
      if (data[i].displayOrder !== undefined && data[i - 1].displayOrder !== undefined) {
        expect(data[i].displayOrder).toBeGreaterThanOrEqual(data[i - 1].displayOrder);
      }
    }
  });
});
