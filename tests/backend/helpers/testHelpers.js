/**
 * Test Helpers — auth tokens, seed data, request builders
 * Centralizes all test utility functions.
 */
const path = require('path');
const backendModules = path.resolve(__dirname, '../../../backend/node_modules');
const jwt = require(path.join(backendModules, 'jsonwebtoken'));
const bcrypt = require(path.join(backendModules, 'bcryptjs'));
const mongoose = require(path.join(backendModules, 'mongoose'));
const supertest = require(path.join(backendModules, 'supertest'));

const JWT_SECRET = 'test-jwt-secret-key-for-testing-only';

// ─── Token Generation ──────────────────────────────────────

function generateToken(userId, extra = {}) {
  return jwt.sign({ userId, ...extra }, JWT_SECRET, { expiresIn: '24h' });
}

function generateExpiredToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '-1h' });
}

// ─── Test Data Factories ───────────────────────────────────

function makeAdminData(overrides = {}) {
  const id = new mongoose.Types.ObjectId();
  return {
    _id: id,
    name: 'Test Admin',
    email: `admin-${id}@test.com`,
    password: 'TestPassword123!',
    accountType: 'admin',
    role: 'super_admin',
    status: 'active',
    isEmailVerified: true,
    ...overrides
  };
}

function makeCustomerData(overrides = {}) {
  const id = new mongoose.Types.ObjectId();
  return {
    _id: id,
    name: 'Test Customer',
    email: `customer-${id}@test.com`,
    password: 'TestPassword123!',
    accountType: 'customer',
    role: 'customer',
    status: 'active',
    isEmailVerified: true,
    subscriptionStatus: 'active',
    ...overrides
  };
}

function makePlanData(overrides = {}) {
  const id = new mongoose.Types.ObjectId();
  return {
    _id: id,
    name: `Test Plan ${id}`,
    slug: `test-plan-${id}`,
    description: 'A test plan',
    price: { monthly: 9.99, yearly: 99.99 },
    currency: 'USD',
    billingCycle: 'both',
    isActive: true,
    isDefault: false,
    displayOrder: 1,
    features: [],
    trialDays: 0,
    ...overrides
  };
}

function makeFeatureData(overrides = {}) {
  const id = new mongoose.Types.ObjectId();
  return {
    _id: id,
    name: `Test Feature ${id}`,
    featureKey: `test_feature_${id}`,
    description: 'A test feature',
    type: 'boolean',
    defaultValue: false,
    isActive: true,
    ...overrides
  };
}

function makeBlogPostData(overrides = {}) {
  const id = new mongoose.Types.ObjectId();
  return {
    title: `Test Blog Post ${id}`,
    excerpt: 'Test excerpt for the blog post',
    content: '<p>Test blog content with enough words to calculate read time properly</p>',
    category: 'General',
    tags: ['test', 'automation'],
    status: 'published',
    ...overrides
  };
}

function makeMarketingPageData(overrides = {}) {
  const id = new mongoose.Types.ObjectId();
  return {
    title: `Test Page ${id}`,
    description: 'A test marketing page',
    status: 'published',
    showInNavigation: true,
    blocks: [
      {
        type: 'hero',
        title: 'Hero Title',
        subtitle: 'Hero Subtitle',
        content: 'Hero content',
        visible: true,
        order: 0
      }
    ],
    ...overrides
  };
}

function makeDepartmentData(overrides = {}) {
  const id = new mongoose.Types.ObjectId();
  return {
    name: `Department ${id}`,
    value: `department-${id}`,
    description: 'Test department',
    isActive: true,
    isDefault: false,
    ...overrides
  };
}

function makeRoleData(overrides = {}) {
  const id = new mongoose.Types.ObjectId();
  return {
    name: `Role ${id}`,
    description: 'Test custom role',
    permissions: ['users.view', 'settings.view'],
    isActive: true,
    ...overrides
  };
}

function makeSeoRedirectData(overrides = {}) {
  const id = new mongoose.Types.ObjectId();
  return {
    fromPath: `/old-path-${id}`,
    toPath: `/new-path-${id}`,
    statusCode: 301,
    isActive: true,
    note: 'Test redirect',
    ...overrides
  };
}

function makeCronJobData(overrides = {}) {
  const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  return {
    key: `testjob_${uid}`,
    name: `Test Job ${uid}`,
    description: 'A test cron job',
    schedule: '0 * * * *',
    actionType: 'log',
    logMessage: 'Test cron log',
    enabled: false,
    ...overrides
  };
}

// ─── Database Seeders ──────────────────────────────────────

/**
 * Seed a super admin user and return { user, token }
 */
async function seedAdmin(User, overrides = {}) {
  const data = makeAdminData(overrides);
  // Don't hash here — the User model's pre-save hook handles hashing
  const user = await User.create(data);
  const token = generateToken(user._id);
  return { user, token, rawPassword: data.password };
}

/**
 * Seed a regular admin (moderator) user and return { user, token }
 */
async function seedModerator(User, overrides = {}) {
  return seedAdmin(User, { role: 'moderator', ...overrides });
}

/**
 * Seed a customer user and return { user, token }
 */
async function seedCustomer(User, overrides = {}) {
  const data = makeCustomerData(overrides);
  const user = await User.create(data);
  const token = generateToken(user._id);
  return { user, token, rawPassword: data.password };
}

/**
 * Seed AdminSettings (singleton)
 */
async function seedAdminSettings(AdminSettings, overrides = {}) {
  // Delete existing settings first
  await AdminSettings.deleteMany({});
  
  const settings = await AdminSettings.create({
    siteName: 'Test Platform',
    siteDescription: 'Test platform description',
    supportEmail: 'support@test.com',
    contactEmail: 'contact@test.com',
    themeSettings: {
      appName: 'Test App',
      primaryColor: '#7C3AED',
      companyName: 'Test Company',
      logoUrl: '',
      faviconUrl: ''
    },
    emailSettings: {
      smtpHost: 'smtp.test.com',
      smtpPort: 587,
      smtpUser: 'test@test.com',
      smtpPassword: 'testpass',
      fromEmail: 'noreply@test.com',
      fromName: 'Test Platform'
    },
    customerSettings: {
      requireEmailVerification: true,
      allowTemporaryEmails: false,
      blockedTemporaryEmailDomains: ['tempmail.com', 'throwaway.email']
    },
    features: {
      enableAnalysis: true,
      enableSubscriptions: true,
      enableCustomRoles: true,
      enableActivityLogs: true
    },
    maintenanceMode: {
      enabled: false,
      message: 'Under maintenance',
      allowAdminAccess: true
    },
    securitySettings: {
      maxLoginAttempts: 5,
      lockoutDuration: 30,
      sessionTimeout: 60
    },
    paymentGateway: 'lemonsqueezy',
    ...overrides
  });
  
  return settings;
}

/**
 * Seed a plan
 */
async function seedPlan(Plan, overrides = {}) {
  const data = makePlanData(overrides);
  return Plan.create(data);
}

/**
 * Seed a feature
 */
async function seedFeature(Feature, overrides = {}) {
  const data = makeFeatureData(overrides);
  return Feature.create(data);
}

// ─── Request Builder ───────────────────────────────────────

/**
 * Create a supertest agent with optional auth
 */
function apiClient(app) {
  const agent = supertest(app);
  
  return {
    get: (url, token) => {
      const req = agent.get(url);
      if (token) req.set('Authorization', `Bearer ${token}`);
      return req;
    },
    post: (url, body, token) => {
      const req = agent.post(url).send(body);
      if (token) req.set('Authorization', `Bearer ${token}`);
      return req;
    },
    put: (url, body, token) => {
      const req = agent.put(url).send(body);
      if (token) req.set('Authorization', `Bearer ${token}`);
      return req;
    },
    delete: (url, token) => {
      const req = agent.delete(url);
      if (token) req.set('Authorization', `Bearer ${token}`);
      return req;
    },
    // For file uploads
    upload: (url, fieldName, filePath, token) => {
      const req = agent.post(url).attach(fieldName, filePath);
      if (token) req.set('Authorization', `Bearer ${token}`);
      return req;
    }
  };
}

// ─── Assertion Helpers ─────────────────────────────────────

function expectSuccess(res, statusCode = 200) {
  expect(res.status).toBe(statusCode);
  expect(res.body.success).toBe(true);
}

function expectError(res, statusCode, messagePattern) {
  expect(res.status).toBe(statusCode);
  expect(res.body.success).toBe(false);
  if (messagePattern) {
    if (typeof messagePattern === 'string') {
      expect(res.body.message).toContain(messagePattern);
    } else {
      expect(res.body.message).toMatch(messagePattern);
    }
  }
}

function expectPaginated(res) {
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  expect(res.body).toHaveProperty('data');
  // Pagination can be in body root or in a pagination object
  const hasPagination = res.body.pagination || 
    (res.body.totalPages !== undefined) || 
    (res.body.total !== undefined);
  expect(hasPagination).toBeTruthy();
}

module.exports = {
  JWT_SECRET,
  generateToken,
  generateExpiredToken,
  makeAdminData,
  makeCustomerData,
  makePlanData,
  makeFeatureData,
  makeBlogPostData,
  makeMarketingPageData,
  makeDepartmentData,
  makeRoleData,
  makeSeoRedirectData,
  makeCronJobData,
  seedAdmin,
  seedModerator,
  seedCustomer,
  seedAdminSettings,
  seedPlan,
  seedFeature,
  apiClient,
  expectSuccess,
  expectError,
  expectPaginated
};
