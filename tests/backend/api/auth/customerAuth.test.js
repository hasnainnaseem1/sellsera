/**
 * Customer Authentication API Tests
 * Covers all endpoints under /api/v1/auth/customer
 */
const { connectDB, clearDB } = require('../../setup/testSetup');
const { seedCustomer, seedAdminSettings, apiClient, expectSuccess, expectError, generateExpiredToken } = require('../../helpers/testHelpers');
const User = require('../../../../backend/src/models/user/User');
const AdminSettings = require('../../../../backend/src/models/admin/AdminSettings');

const BASE = '/api/v1/auth/customer';

let app, api;

beforeAll(async () => {
  app = await connectDB();
  api = apiClient(app);

  // Seed default AdminSettings so security/email helpers work
  await seedAdminSettings(AdminSettings);
});

afterAll(async () => {
  await clearDB();
});

// ─────────────────────────────────────────────────────────────
// 1. SIGNUP
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/customer/signup', () => {
  afterEach(async () => {
    await User.deleteMany({});
  });

  it('should register a new customer with valid data', async () => {
    const res = await api.post(`${BASE}/signup`, {
      name: 'New Customer',
      email: 'newcustomer@test.com',
      password: 'StrongPass123!'
    });

    expectSuccess(res, 201);
    expect(res.body.message).toMatch(/registered|created|verification/i);
    // Depending on settings, may require verification
    const user = await User.findOne({ email: 'newcustomer@test.com' });
    expect(user).toBeTruthy();
    expect(user.accountType).toBe('customer');
    expect(user.role).toBe('customer');
  });

  it('should return 400 for duplicate email', async () => {
    // Create customer first
    await seedCustomer(User, { email: 'duplicate@test.com' });

    const res = await api.post(`${BASE}/signup`, {
      name: 'Dupe Customer',
      email: 'duplicate@test.com',
      password: 'StrongPass123!'
    });

    expectError(res, 400);
    expect(res.body.message).toMatch(/already registered/i);
  });

  it('should return 400 when required fields are missing', async () => {
    const res = await api.post(`${BASE}/signup`, {
      name: 'No Password',
      email: 'nopassword@test.com'
      // missing password
    });

    expectError(res, 400);
    expect(res.body.message).toMatch(/provide all required/i);
  });

  it('should return 400 for a weak password', async () => {
    const res = await api.post(`${BASE}/signup`, {
      name: 'Weak Pass',
      email: 'weakpass@test.com',
      password: '123'
    });

    expectError(res, 400);
    // Password validation message from security settings
    expect(res.body.success).toBe(false);
  });

  it('should return 400 for invalid email format', async () => {
    const res = await api.post(`${BASE}/signup`, {
      name: 'Bad Email',
      email: 'not-an-email',
      password: 'StrongPass123!'
    });

    // The validateEmail middleware should reject this
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// 2. LOGIN
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/customer/login', () => {
  let customer;

  beforeAll(async () => {
    customer = await seedCustomer(User);
  });

  afterAll(async () => {
    await User.deleteMany({});
  });

  it('should login with valid credentials and return token + user', async () => {
    const res = await api.post(`${BASE}/login`, {
      email: customer.user.email,
      password: customer.rawPassword
    });

    expectSuccess(res, 200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user.email).toBe(customer.user.email);
    expect(res.body.user.accountType).toBe('customer');
    expect(res.body.message).toMatch(/login successful/i);
  });

  it('should return 401 for wrong password', async () => {
    const res = await api.post(`${BASE}/login`, {
      email: customer.user.email,
      password: 'WrongPassword999!'
    });

    expectError(res, 401);
    expect(res.body.message).toMatch(/incorrect password/i);
  });

  it('should return 403 for unverified email', async () => {
    const unverified = await seedCustomer(User, {
      isEmailVerified: false,
      status: 'pending_verification'
    });

    const res = await api.post(`${BASE}/login`, {
      email: unverified.user.email,
      password: unverified.rawPassword
    });

    expectError(res, 403);
    expect(res.body.message).toMatch(/verify your email/i);
    expect(res.body).toHaveProperty('emailVerificationRequired', true);
  });

  it('should return 404 for non-existent email', async () => {
    const res = await api.post(`${BASE}/login`, {
      email: 'nonexistent@test.com',
      password: 'SomePassword123!'
    });

    expectError(res, 404);
    expect(res.body.message).toMatch(/no account found/i);
  });

  it('should return 403 for a suspended account', async () => {
    const suspended = await seedCustomer(User, { status: 'suspended' });

    const res = await api.post(`${BASE}/login`, {
      email: suspended.user.email,
      password: suspended.rawPassword
    });

    expectError(res, 403);
    expect(res.body.message).toMatch(/suspended/i);
  });
});

// ─────────────────────────────────────────────────────────────
// 3. EMAIL VERIFICATION
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/auth/customer/verify-email/:token', () => {
  afterEach(async () => {
    await User.deleteMany({});
  });

  it('should verify email with a valid token', async () => {
    const crypto = require('crypto');
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    await seedCustomer(User, {
      isEmailVerified: false,
      status: 'pending_verification',
      emailVerificationToken: hashedToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    const res = await api.get(`${BASE}/verify-email/${rawToken}`);

    expectSuccess(res, 200);
    expect(res.body.message).toMatch(/verified successfully/i);
  });

  it('should return 400 for an expired or invalid token', async () => {
    const res = await api.get(`${BASE}/verify-email/invalidtokenvalue123456`);

    expectError(res, 400);
    expect(res.body.message).toMatch(/invalid|expired/i);
  });

  it('should return 200 if email is already verified', async () => {
    const crypto = require('crypto');
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    await seedCustomer(User, {
      isEmailVerified: true,
      status: 'active',
      emailVerificationToken: hashedToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    const res = await api.get(`${BASE}/verify-email/${rawToken}`);

    expectSuccess(res, 200);
    expect(res.body.message).toMatch(/already verified/i);
  });
});

// ─────────────────────────────────────────────────────────────
// 4. RESEND VERIFICATION
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/customer/resend-verification', () => {
  afterEach(async () => {
    await User.deleteMany({});
  });

  it('should resend verification email for a valid unverified user', async () => {
    const unverified = await seedCustomer(User, {
      isEmailVerified: false,
      status: 'pending_verification'
    });

    const res = await api.post(`${BASE}/resend-verification`, {
      email: unverified.user.email
    });

    expectSuccess(res, 200);
    expect(res.body.message).toMatch(/verification email sent/i);
  });

  it('should return 404 for non-existent email', async () => {
    // Note: the route returns 404 for non-existent email (unlike forgot-password which returns 200)
    const res = await api.post(`${BASE}/resend-verification`, {
      email: 'nobody@test.com'
    });

    // Route returns 404 with message "No account found"
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 when email is already verified', async () => {
    const verified = await seedCustomer(User, {
      isEmailVerified: true,
      status: 'active'
    });

    const res = await api.post(`${BASE}/resend-verification`, {
      email: verified.user.email
    });

    expectError(res, 400);
    expect(res.body.message).toMatch(/already verified/i);
  });
});

// ─────────────────────────────────────────────────────────────
// 5. GET PROFILE (GET /me)
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/auth/customer/me', () => {
  let customer;

  beforeAll(async () => {
    customer = await seedCustomer(User);
  });

  afterAll(async () => {
    await User.deleteMany({});
  });

  it('should return current customer profile with a valid token', async () => {
    const res = await api.get(`${BASE}/me`, customer.token);

    expectSuccess(res, 200);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user.email).toBe(customer.user.email);
    expect(res.body.user.name).toBe(customer.user.name);
    expect(res.body.user.accountType).toBe('customer');
    expect(res.body.user).toHaveProperty('plan');
    expect(res.body.user).toHaveProperty('subscriptionStatus');
    expect(res.body.user).toHaveProperty('isEmailVerified');
    // password should not be exposed
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('should return 401 when no token is provided', async () => {
    const res = await api.get(`${BASE}/me`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should return 401 for an expired token', async () => {
    const expiredToken = generateExpiredToken(customer.user._id);
    const res = await api.get(`${BASE}/me`, expiredToken);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// 6. UPDATE PROFILE (PUT /me)
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/auth/customer/me', () => {
  let customer;

  beforeAll(async () => {
    customer = await seedCustomer(User);
  });

  afterAll(async () => {
    await User.deleteMany({});
  });

  it('should update profile with a valid name', async () => {
    const res = await api.put(`${BASE}/me`, {
      name: 'Updated Customer Name'
    }, customer.token);

    expectSuccess(res, 200);
    expect(res.body.message).toMatch(/profile updated/i);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.name).toBe('Updated Customer Name');
    // password should not be exposed
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('should return 400 when name is empty or too short', async () => {
    const res = await api.put(`${BASE}/me`, {
      name: ''
    }, customer.token);

    expectError(res, 400);
    expect(res.body.message).toMatch(/name must be at least/i);
  });
});

// ─────────────────────────────────────────────────────────────
// 7. CHANGE PASSWORD (PUT /me/password)
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/auth/customer/me/password', () => {
  let customer;

  beforeEach(async () => {
    await User.deleteMany({});
    customer = await seedCustomer(User);
  });

  afterAll(async () => {
    await User.deleteMany({});
  });

  it('should change password when current password is correct', async () => {
    const res = await api.put(`${BASE}/me/password`, {
      currentPassword: customer.rawPassword,
      newPassword: 'NewStrongPass456!'
    }, customer.token);

    expectSuccess(res, 200);
    expect(res.body.message).toMatch(/password changed/i);

    // Verify new password works for login
    const loginRes = await api.post(`${BASE}/login`, {
      email: customer.user.email,
      password: 'NewStrongPass456!'
    });
    expectSuccess(loginRes, 200);
    expect(loginRes.body).toHaveProperty('token');
  });

  it('should return 400 when current password is wrong', async () => {
    const res = await api.put(`${BASE}/me/password`, {
      currentPassword: 'WrongOldPassword!',
      newPassword: 'NewStrongPass456!'
    }, customer.token);

    expectError(res, 400);
    expect(res.body.message).toMatch(/current password is incorrect/i);
  });

  it('should return 400 for a weak new password', async () => {
    const res = await api.put(`${BASE}/me/password`, {
      currentPassword: customer.rawPassword,
      newPassword: '123'
    }, customer.token);

    expectError(res, 400);
    // Either "at least 8 characters" or security-settings-driven message
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// 8. LOGOUT
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/customer/logout', () => {
  let customer;

  beforeAll(async () => {
    customer = await seedCustomer(User);
  });

  afterAll(async () => {
    await User.deleteMany({});
  });

  it('should logout successfully with a valid token', async () => {
    const res = await api.post(`${BASE}/logout`, {}, customer.token);

    expectSuccess(res, 200);
    expect(res.body.message).toMatch(/logged out successfully/i);
  });
});

// ─────────────────────────────────────────────────────────────
// 9. FORGOT PASSWORD
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/customer/forgot-password', () => {
  let customer;

  beforeAll(async () => {
    customer = await seedCustomer(User);
  });

  afterAll(async () => {
    await User.deleteMany({});
  });

  it('should return 200 for a valid customer email', async () => {
    const res = await api.post(`${BASE}/forgot-password`, {
      email: customer.user.email
    });

    expectSuccess(res, 200);
    expect(res.body.message).toMatch(/reset link|if an account/i);
  });

  it('should return 200 for a non-existent email (prevents enumeration)', async () => {
    const res = await api.post(`${BASE}/forgot-password`, {
      email: 'nobody-here@test.com'
    });

    // Route always returns 200 to prevent email enumeration
    expectSuccess(res, 200);
    expect(res.body.message).toMatch(/if an account/i);
  });

  it('should return 400 when email is missing', async () => {
    const res = await api.post(`${BASE}/forgot-password`, {});

    expectError(res, 400);
    expect(res.body.message).toMatch(/email is required/i);
  });
});

// ─────────────────────────────────────────────────────────────
// 10. RESET PASSWORD (via token)
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/customer/reset-password/:token', () => {
  afterEach(async () => {
    await User.deleteMany({});
  });

  it('should reset password with a valid token', async () => {
    const crypto = require('crypto');
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const hashedResetToken = crypto.createHash('sha256').update(rawResetToken).digest('hex');

    const cust = await seedCustomer(User, {
      passwordResetToken: hashedResetToken,
      passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
    });

    const newPassword = 'ResetNewPass789!';
    const res = await api.post(`${BASE}/reset-password/${rawResetToken}`, {
      password: newPassword
    });

    expectSuccess(res, 200);
    expect(res.body.message).toMatch(/password reset successfully/i);

    // Verify new password works
    const loginRes = await api.post(`${BASE}/login`, {
      email: cust.user.email,
      password: newPassword
    });
    expectSuccess(loginRes, 200);
    expect(loginRes.body).toHaveProperty('token');
  });

  it('should return 400 for an invalid or expired reset token', async () => {
    const res = await api.post(`${BASE}/reset-password/invalidtokenvalue12345`, {
      password: 'AnotherPass789!'
    });

    expectError(res, 400);
    expect(res.body.message).toMatch(/invalid|expired/i);
  });
});

// ─────────────────────────────────────────────────────────────
// 11. GOOGLE SSO
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/customer/google', () => {
  // Google SSO tests require mocking the Google OAuth2 client
  // (verifyIdToken / userinfo fetch). These are skipped by default.
  // To enable, mock `google-auth-library` and provide fake payloads.

  it.todo('should authenticate with a valid Google credential (requires mocked Google client)');

  it('should return 400 when no credential or access_token is provided', async () => {
    const res = await api.post(`${BASE}/google`, {});

    // Depending on whether Google SSO is enabled in AdminSettings,
    // this could be 400 (missing credential) or 503 (SSO disabled)
    expect([400, 503]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });
});
