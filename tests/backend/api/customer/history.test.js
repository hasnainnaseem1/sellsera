/**
 * Customer History API Tests
 * Covers: GET /api/v1/customer/history, GET /:id, DELETE /:id, DELETE /
 */
const { connectDB, clearDB } = require('../../setup/testSetup');
const {
  seedCustomer,
  seedAdminSettings,
  apiClient,
  expectSuccess,
  expectError
} = require('../../helpers/testHelpers');

const mongoose = require('mongoose');
const User = require('../../../../backend/src/models/user/User');
const Analysis = require('../../../../backend/src/models/customer/Analysis');
const AdminSettings = require('../../../../backend/src/models/admin/AdminSettings');

const BASE = '/api/v1/customer/history';

let app, api, customer, otherCustomer;

/**
 * Helper to create an analysis record directly in DB
 */
async function createAnalysis(userId, overrides = {}) {
  return Analysis.create({
    userId,
    originalListing: {
      title: 'Test Listing',
      description: 'A test listing description',
      tags: ['test'],
      price: 29.99,
      category: 'General'
    },
    recommendations: {
      optimizedTitle: 'Better Test Listing',
      titleReasoning: 'Improved for SEO',
      optimizedDescription: 'An improved description',
      descriptionReasoning: 'More detailed',
      optimizedTags: [{ tag: 'improved', reasoning: 'Better keyword' }],
      pricingRecommendation: {
        suggestedPrice: 34.99,
        reasoning: 'Market rate',
        competitorRange: { min: 20, max: 50, average: 35 }
      },
      actionItems: [{ priority: 'high', action: 'Update title', impact: 'Better visibility' }]
    },
    score: 75,
    status: 'completed',
    ...overrides
  });
}

beforeAll(async () => {
  app = await connectDB();
  api = apiClient(app);
  await seedAdminSettings(AdminSettings);
  customer = await seedCustomer(User);
  otherCustomer = await seedCustomer(User);
});

afterAll(async () => {
  await clearDB();
});

// ─────────────────────────────────────────────────────────────
// AUTH CHECKS
// ─────────────────────────────────────────────────────────────
describe('History endpoints — auth required', () => {
  it('should return 401 on GET / without auth', async () => {
    const res = await api.get(BASE);
    expect(res.status).toBe(401);
  });

  it('should return 401 on GET /:id without auth', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await api.get(`${BASE}/${fakeId}`);
    expect(res.status).toBe(401);
  });

  it('should return 401 on DELETE /:id without auth', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await api.delete(`${BASE}/${fakeId}`);
    expect(res.status).toBe(401);
  });

  it('should return 401 on DELETE / without auth', async () => {
    const res = await api.delete(BASE);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/customer/history — List History
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/customer/history', () => {
  beforeEach(async () => {
    await Analysis.deleteMany({});
  });

  it('should return empty array when no analyses exist', async () => {
    const res = await api.get(BASE, customer.token);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.analyses || [];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(0);
  });

  it('should return analyses for the authenticated user', async () => {
    await createAnalysis(customer.user._id);
    await createAnalysis(customer.user._id, {
      originalListing: {
        title: 'Second Listing',
        description: 'Another listing',
        tags: ['second'],
        price: 49.99,
        category: 'Fashion'
      }
    });

    const res = await api.get(BASE, customer.token);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.analyses || [];
    expect(data.length).toBeGreaterThanOrEqual(2);
  });

  it('should support pagination with ?page=1&limit=2', async () => {
    // Create 5 analyses
    for (let i = 0; i < 5; i++) {
      await createAnalysis(customer.user._id, {
        originalListing: {
          title: `Listing ${i}`,
          description: `Description ${i}`,
          tags: [`tag${i}`],
          price: 10 + i,
          category: 'General'
        }
      });
    }

    const res = await api.get(`${BASE}?page=1&limit=2`, customer.token);
    expectSuccess(res, 200);

    const data = res.body.data || res.body.analyses || [];
    expect(data.length).toBeLessThanOrEqual(2);

    // Should have pagination info
    const hasPagination = res.body.pagination || res.body.totalPages || res.body.total;
    expect(hasPagination).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/customer/history/:id — Get Analysis by ID
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/customer/history/:id', () => {
  it('should return a specific analysis by ID', async () => {
    const analysis = await createAnalysis(customer.user._id);
    const res = await api.get(`${BASE}/${analysis._id}`, customer.token);
    expectSuccess(res, 200);

    const data = res.body.data || res.body.analysis || res.body;
    expect(data).toHaveProperty('originalListing');
    expect(data.originalListing.title).toBe('Test Listing');
  });

  it('should return 404 when accessing another user\'s analysis', async () => {
    const otherAnalysis = await createAnalysis(otherCustomer.user._id);
    const res = await api.get(`${BASE}/${otherAnalysis._id}`, customer.token);
    expect([403, 404]).toContain(res.status);
  });

  it('should return 404 for non-existent analysis ID', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await api.get(`${BASE}/${fakeId}`, customer.token);
    expect([404, 400]).toContain(res.status);
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/v1/customer/history/:id — Delete Single Analysis
// ─────────────────────────────────────────────────────────────
describe('DELETE /api/v1/customer/history/:id', () => {
  it('should delete a specific analysis', async () => {
    const analysis = await createAnalysis(customer.user._id);
    const res = await api.delete(`${BASE}/${analysis._id}`, customer.token);
    expectSuccess(res, 200);

    // Verify it's gone
    const found = await Analysis.findById(analysis._id);
    expect(found).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/v1/customer/history — Delete All Analyses
// ─────────────────────────────────────────────────────────────
describe('DELETE /api/v1/customer/history', () => {
  it('should delete all analyses for the authenticated user', async () => {
    // Create analyses for this user
    await createAnalysis(customer.user._id);
    await createAnalysis(customer.user._id);
    // Create one for other user (should NOT be deleted)
    await createAnalysis(otherCustomer.user._id);

    const res = await api.delete(BASE, customer.token);
    expectSuccess(res, 200);

    // Customer's analyses should be gone
    const remaining = await Analysis.find({ userId: customer.user._id });
    expect(remaining.length).toBe(0);

    // Other customer's analysis should still exist
    const otherRemaining = await Analysis.find({ userId: otherCustomer.user._id });
    expect(otherRemaining.length).toBeGreaterThanOrEqual(1);
  });
});
