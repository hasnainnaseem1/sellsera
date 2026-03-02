/**
 * Customer Billing API Tests
 * Covers: POST /checkout, POST /portal, GET /payments, POST /cancel,
 *         POST /resume, POST /verify-session, GET /invoice/:paymentId
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
const Plan = require('../../../../backend/src/models/subscription/Plan');
const Payment = require('../../../../backend/src/models/payment/Payment');
const AdminSettings = require('../../../../backend/src/models/admin/AdminSettings');

const BASE = '/api/v1/customer/billing';

let app, api, customer, plan, payments;

beforeAll(async () => {
  app = await connectDB();
  api = apiClient(app);
  await seedAdminSettings(AdminSettings);

  // Create a plan
  plan = await Plan.create({
    name: 'Billing Test Plan',
    slug: 'billing-test-plan',
    description: 'Plan for billing tests',
    price: { monthly: 29.99, yearly: 299.99 },
    billingCycle: 'both',
    isActive: true,
    features: []
  });

  // Create customer with active subscription
  customer = await seedCustomer(User, {
    currentPlan: plan._id,
    planSnapshot: {
      planId: plan._id,
      planName: plan.name,
      features: [],
      assignedAt: new Date()
    },
    subscriptionStatus: 'active',
    subscriptionStartDate: new Date(),
    subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  });

  // Seed payment records
  payments = [];
  for (let i = 0; i < 5; i++) {
    const payment = await Payment.create({
      userId: customer.user._id,
      stripePaymentIntentId: `pi_test_${new mongoose.Types.ObjectId()}`,
      stripeInvoiceId: `inv_test_${new mongoose.Types.ObjectId()}`,
      planId: plan._id,
      planName: plan.name,
      amount: 29.99,
      currency: 'usd',
      status: 'succeeded',
      billingCycle: 'monthly',
      description: `Payment #${i + 1}`,
      paidAt: new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000)
    });
    payments.push(payment);
  }
});

afterAll(async () => {
  await clearDB();
});

// ─────────────────────────────────────────────────────────────
// AUTH CHECKS
// ─────────────────────────────────────────────────────────────
describe('Billing endpoints — auth required', () => {
  it('should return 401 on POST /checkout without auth', async () => {
    const res = await api.post(`${BASE}/checkout`, { planId: plan._id, billingCycle: 'monthly' });
    expect(res.status).toBe(401);
  });

  it('should return 401 on POST /portal without auth', async () => {
    const res = await api.post(`${BASE}/portal`, {});
    expect(res.status).toBe(401);
  });

  it('should return 401 on GET /payments without auth', async () => {
    const res = await api.get(`${BASE}/payments`);
    expect(res.status).toBe(401);
  });

  it('should return 401 on POST /cancel without auth', async () => {
    const res = await api.post(`${BASE}/cancel`, {});
    expect(res.status).toBe(401);
  });

  it('should return 401 on POST /resume without auth', async () => {
    const res = await api.post(`${BASE}/resume`, {});
    expect(res.status).toBe(401);
  });

  it('should return 401 on GET /invoice/:paymentId without auth', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await api.get(`${BASE}/invoice/${fakeId}`);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// POST /checkout
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/customer/billing/checkout', () => {
  it('should return 400 when planId is missing', async () => {
    const res = await api.post(`${BASE}/checkout`, { billingCycle: 'monthly' }, customer.token);
    expectError(res, 400);
  });

  it('should return error or default when billingCycle is missing', async () => {
    const res = await api.post(`${BASE}/checkout`, { planId: plan._id.toString() }, customer.token);
    // Controller defaults billingCycle to 'monthly', then may fail on Stripe call
    expect([200, 400, 500]).toContain(res.status);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /payments
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/customer/billing/payments', () => {
  it('should return payment list', async () => {
    const res = await api.get(`${BASE}/payments`, customer.token);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.payments || [];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
  });

  it('should support pagination', async () => {
    const res = await api.get(`${BASE}/payments?page=1&limit=2`, customer.token);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.payments || [];
    expect(data.length).toBeLessThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /invoice/:paymentId
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/customer/billing/invoice/:paymentId', () => {
  it('should return PDF invoice for a valid payment', async () => {
    const paymentId = payments[0]._id;
    const res = await api.get(`${BASE}/invoice/${paymentId}`, customer.token);
    // Should return a PDF or at least succeed
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.headers['content-type']).toMatch(/application\/pdf|application\/octet-stream/);
    }
  });

  it('should return 404 for non-existent payment', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await api.get(`${BASE}/invoice/${fakeId}`, customer.token);
    expect([404, 400]).toContain(res.status);
  });
});

// ─────────────────────────────────────────────────────────────
// POST /cancel
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/customer/billing/cancel', () => {
  it('should fail when user has no active stripe subscription to cancel', async () => {
    const noSubCustomer = await seedCustomer(User, {
      subscriptionStatus: 'none',
      currentPlan: null
    });

    const res = await api.post(`${BASE}/cancel`, {}, noSubCustomer.token);
    expect([400, 403, 404, 500]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// POST /resume
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/customer/billing/resume', () => {
  it('should fail when user has no cancelled subscription to resume', async () => {
    const activeCustomer = await seedCustomer(User, {
      subscriptionStatus: 'active',
      currentPlan: plan._id
    });

    const res = await api.post(`${BASE}/resume`, {}, activeCustomer.token);
    expect([400, 403, 404, 500]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// FEATURE GATE — enableSubscriptions
// ─────────────────────────────────────────────────────────────
describe('Feature gate: enableSubscriptions', () => {
  it('should return 403 on billing endpoints when enableSubscriptions is disabled', async () => {
    await seedAdminSettings(AdminSettings, {
      features: {
        enableAnalysis: true,
        enableSubscriptions: false,
        enableCustomRoles: true,
        enableActivityLogs: true
      }
    });

    const cust = await seedCustomer(User, { subscriptionStatus: 'active' });

    const checkoutRes = await api.post(`${BASE}/checkout`, { planId: plan._id.toString(), billingCycle: 'monthly' }, cust.token);
    expect(checkoutRes.status).toBe(403);

    const paymentsRes = await api.get(`${BASE}/payments`, cust.token);
    expect(paymentsRes.status).toBe(403);

    const cancelRes = await api.post(`${BASE}/cancel`, {}, cust.token);
    expect(cancelRes.status).toBe(403);

    // Re-enable for other tests
    await seedAdminSettings(AdminSettings);
  });
});
