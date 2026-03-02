/**
 * Admin Authentication API Tests
 * Covers all endpoints under /api/v1/auth/admin
 */
const { connectDB, clearDB } = require('../../setup/testSetup');
const { seedAdmin, seedModerator, apiClient, expectSuccess, expectError, generateExpiredToken } = require('../../helpers/testHelpers');

const User = require('../../../../backend/src/models/user/User');
const AdminSettings = require('../../../../backend/src/models/admin/AdminSettings');

const BASE = '/api/v1/auth/admin';

let app, api;

beforeAll(async () => {
  app = await connectDB();
  api = apiClient(app);

  // Seed default AdminSettings so security helpers work
  await AdminSettings.create({
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
      blockedTemporaryEmailDomains: ['tempmail.com']
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
    paymentGateway: 'lemonsqueezy'
  });
});

afterAll(async () => {
  await clearDB();
});

// ─────────────────────────────────────────────────────────────
// 1. LOGIN
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/admin/login', () => {
  let admin;

  beforeAll(async () => {
    admin = await seedAdmin(User);
  });

  afterAll(async () => {
    await User.deleteMany({});
  });

  it('should login with valid credentials and return token + user', async () => {
    const res = await api.post(`${BASE}/login`, {
      email: admin.user.email,
      password: admin.rawPassword
    });

    expectSuccess(res, 200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user.email).toBe(admin.user.email);
    expect(res.body.user.accountType).toBe('admin');
    expect(res.body.user.role).toBe('super_admin');
    expect(res.body.user).toHaveProperty('permissions');
    expect(res.body.message).toContain('Login successful');
  });

  it('should return 401 for non-existent email', async () => {
    const res = await api.post(`${BASE}/login`, {
      email: 'nonexistent@test.com',
      password: 'SomePassword123!'
    });

    expectError(res, 401);
    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  it('should return 401 for wrong password', async () => {
    const res = await api.post(`${BASE}/login`, {
      email: admin.user.email,
      password: 'WrongPassword999!'
    });

    expectError(res, 401);
    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  it('should return 400 when email or password is missing', async () => {
    const res = await api.post(`${BASE}/login`, { email: admin.user.email });
    expectError(res, 400);
    expect(res.body.message).toMatch(/provide email and password/i);
  });

  it('should reject login for a non-admin (customer) account', async () => {
    // Create a customer directly
    const bcrypt = require('bcryptjs');
    const hashed = await bcrypt.hash('CustomerPass123!', 10);
    await User.create({
      name: 'Customer User',
      email: 'customer-login-test@test.com',
      password: hashed,
      accountType: 'customer',
      role: 'customer',
      status: 'active',
      isEmailVerified: true
    });

    const res = await api.post(`${BASE}/login`, {
      email: 'customer-login-test@test.com',
      password: 'CustomerPass123!'
    });

    // The route looks for accountType: 'admin', so a customer won't be found
    expectError(res, 401);
    expect(res.body.message).toMatch(/invalid credentials|insufficient privileges/i);
  });

  it('should return 403 for a suspended admin account', async () => {
    const suspended = await seedAdmin(User, { status: 'suspended' });

    const res = await api.post(`${BASE}/login`, {
      email: suspended.user.email,
      password: suspended.rawPassword
    });

    expectError(res, 403);
    expect(res.body.message).toMatch(/suspended/i);
  });

  it('should return 423 for a locked admin account', async () => {
    const locked = await seedAdmin(User, {
      loginAttempts: 10,
      lockUntil: new Date(Date.now() + 30 * 60 * 1000) // locked for 30 min
    });

    const res = await api.post(`${BASE}/login`, {
      email: locked.user.email,
      password: locked.rawPassword
    });

    expect(res.status).toBe(423);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/locked/i);
  });
});

// ─────────────────────────────────────────────────────────────
// 2. GET PROFILE (GET /me)
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/auth/admin/me', () => {
  let admin;

  beforeAll(async () => {
    admin = await seedAdmin(User);
  });

  afterAll(async () => {
    await User.deleteMany({});
  });

  it('should return current admin profile with a valid token', async () => {
    const res = await api.get(`${BASE}/me`, admin.token);

    expectSuccess(res, 200);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user.email).toBe(admin.user.email);
    expect(res.body.user.name).toBe(admin.user.name);
    expect(res.body.user.accountType).toBe('admin');
    expect(res.body.user.role).toBe('super_admin');
    expect(res.body.user).toHaveProperty('permissions');
    expect(res.body.user).toHaveProperty('status');
    expect(res.body.user).toHaveProperty('createdAt');
    // password should not be exposed
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('should return 401 when no token is provided', async () => {
    const res = await api.get(`${BASE}/me`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should return 401 for an invalid token', async () => {
    const res = await api.get(`${BASE}/me`, 'invalid.jwt.token');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should return 401 for an expired token', async () => {
    const expiredToken = generateExpiredToken(admin.user._id);
    const res = await api.get(`${BASE}/me`, expiredToken);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// 3. LOGOUT
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/admin/logout', () => {
  let admin;

  beforeAll(async () => {
    admin = await seedAdmin(User);
  });

  afterAll(async () => {
    await User.deleteMany({});
  });

  it('should logout successfully with a valid token', async () => {
    const res = await api.post(`${BASE}/logout`, {}, admin.token);

    expectSuccess(res, 200);
    expect(res.body.message).toMatch(/logout successful/i);
  });

  it('should return 401 when logging out without a token', async () => {
    const res = await api.post(`${BASE}/logout`, {});

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// 4. CHANGE PASSWORD
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/admin/change-password', () => {
  let admin;

  beforeEach(async () => {
    await User.deleteMany({});
    admin = await seedAdmin(User);
  });

  afterAll(async () => {
    await User.deleteMany({});
  });

  it('should change password when current password is correct (super admin)', async () => {
    const res = await api.post(`${BASE}/change-password`, {
      currentPassword: admin.rawPassword,
      newPassword: 'NewStrongPass456!'
    }, admin.token);

    expectSuccess(res, 200);
    expect(res.body.message).toMatch(/password changed/i);

    // Verify new password works for login
    const loginRes = await api.post(`${BASE}/login`, {
      email: admin.user.email,
      password: 'NewStrongPass456!'
    });
    expectSuccess(loginRes, 200);
    expect(loginRes.body).toHaveProperty('token');
  });

  it('should return 401 when current password is wrong', async () => {
    const res = await api.post(`${BASE}/change-password`, {
      currentPassword: 'WrongOldPassword!',
      newPassword: 'NewStrongPass456!'
    }, admin.token);

    expectError(res, 401);
    expect(res.body.message).toMatch(/current password is incorrect/i);
  });

  it('should return 400 when required fields are missing', async () => {
    const res = await api.post(`${BASE}/change-password`, {
      currentPassword: admin.rawPassword
      // missing newPassword
    }, admin.token);

    expectError(res, 400);
    expect(res.body.message).toMatch(/provide/i);
  });

  it('should return 403 when non-super-admin without passwordChangeRequired tries to change password', async () => {
    const moderator = await seedModerator(User, { passwordChangeRequired: false });

    const res = await api.post(`${BASE}/change-password`, {
      currentPassword: moderator.rawPassword,
      newPassword: 'NewModPass456!'
    }, moderator.token);

    expectError(res, 403);
    expect(res.body.message).toMatch(/cannot change your password/i);
  });

  it('should allow non-super-admin with passwordChangeRequired to change password (first login)', async () => {
    const moderator = await seedModerator(User, { passwordChangeRequired: true });

    const res = await api.post(`${BASE}/change-password`, {
      currentPassword: moderator.rawPassword,
      newPassword: 'NewModeratorPass456!'
    }, moderator.token);

    expectSuccess(res, 200);
    expect(res.body.message).toMatch(/password changed/i);

    // Verify passwordChangeRequired is cleared
    const updatedUser = await User.findById(moderator.user._id);
    expect(updatedUser.passwordChangeRequired).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// 5. UPDATE PROFILE
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/auth/admin/profile', () => {
  let admin;

  beforeAll(async () => {
    admin = await seedAdmin(User);
  });

  afterAll(async () => {
    await User.deleteMany({});
  });

  it('should update profile with valid data', async () => {
    const res = await api.put(`${BASE}/profile`, {
      name: 'Updated Admin Name',
      timezone: 'America/New_York'
    }, admin.token);

    expectSuccess(res, 200);
    expect(res.body.message).toMatch(/profile updated/i);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.name).toBe('Updated Admin Name');
    expect(res.body.user.timezone).toBe('America/New_York');
    expect(res.body.user).toHaveProperty('permissions');
    // password should not be exposed
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('should update only timezone without affecting name', async () => {
    // Reset name first
    await User.findByIdAndUpdate(admin.user._id, { name: 'Original Name' });

    const res = await api.put(`${BASE}/profile`, {
      timezone: 'Europe/London'
    }, admin.token);

    expectSuccess(res, 200);
    expect(res.body.user.timezone).toBe('Europe/London');
    expect(res.body.user.name).toBe('Original Name');
  });

  it('should return 401 without auth token', async () => {
    const res = await api.put(`${BASE}/profile`, { name: 'No Auth' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// 6. FORGOT PASSWORD
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/admin/forgot-password', () => {
  let superAdmin, moderator;

  beforeAll(async () => {
    await User.deleteMany({});
    superAdmin = await seedAdmin(User);
    moderator = await seedModerator(User);
  });

  afterAll(async () => {
    await User.deleteMany({});
  });

  it('should return a reset token for a super admin email', async () => {
    const res = await api.post(`${BASE}/forgot-password`, {
      email: superAdmin.user.email
    });

    expectSuccess(res, 200);
    expect(res.body.message).toMatch(/reset link sent|reset/i);
    expect(res.body).toHaveProperty('resetToken'); // test-only field
  });

  it('should notify super admin when a non-super-admin requests forgot password', async () => {
    const res = await api.post(`${BASE}/forgot-password`, {
      email: moderator.user.email
    });

    expectSuccess(res, 200);
    expect(res.body).toHaveProperty('needsAdminHelp', true);
    expect(res.body).toHaveProperty('superAdminName');
    expect(res.body).toHaveProperty('superAdminEmail');
  });

  it('should return 404 for a non-existent admin email', async () => {
    const res = await api.post(`${BASE}/forgot-password`, {
      email: 'nobody@test.com'
    });

    expectError(res, 404);
    expect(res.body.message).toMatch(/no admin account found/i);
  });

  it('should return 400 when email is missing', async () => {
    const res = await api.post(`${BASE}/forgot-password`, {});

    expectError(res, 400);
    expect(res.body.message).toMatch(/provide email/i);
  });
});

// ─────────────────────────────────────────────────────────────
// 7. RESET PASSWORD (via token)
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/admin/reset-password', () => {
  let superAdmin, resetToken;

  beforeAll(async () => {
    await User.deleteMany({});
    superAdmin = await seedAdmin(User);

    // Request a forgot-password to get a reset token
    const forgotRes = await api.post(`${BASE}/forgot-password`, {
      email: superAdmin.user.email
    });
    resetToken = forgotRes.body.resetToken;
  });

  afterAll(async () => {
    await User.deleteMany({});
  });

  it('should reset password with a valid token', async () => {
    const newPassword = 'ResetNewPass789!';
    const res = await api.post(`${BASE}/reset-password`, {
      resetToken,
      newPassword,
      confirmPassword: newPassword
    });

    expectSuccess(res, 200);
    expect(res.body.message).toMatch(/password reset successfully/i);

    // Verify the new password works
    const loginRes = await api.post(`${BASE}/login`, {
      email: superAdmin.user.email,
      password: newPassword
    });
    expectSuccess(loginRes, 200);
    expect(loginRes.body).toHaveProperty('token');
  });

  it('should return 400 for an expired or invalid reset token', async () => {
    const res = await api.post(`${BASE}/reset-password`, {
      resetToken: 'invalidtokenvalue12345',
      newPassword: 'AnotherPass789!',
      confirmPassword: 'AnotherPass789!'
    });

    expectError(res, 400);
    expect(res.body.message).toMatch(/invalid|expired/i);
  });

  it('should return 400 when passwords do not match', async () => {
    const res = await api.post(`${BASE}/reset-password`, {
      resetToken: 'sometoken',
      newPassword: 'Password1!',
      confirmPassword: 'Password2!'
    });

    expectError(res, 400);
    expect(res.body.message).toMatch(/do not match/i);
  });

  it('should return 400 when required fields are missing', async () => {
    const res = await api.post(`${BASE}/reset-password`, {
      resetToken: 'sometoken'
      // missing newPassword and confirmPassword
    });

    expectError(res, 400);
    expect(res.body.message).toMatch(/provide all required/i);
  });
});

// ─────────────────────────────────────────────────────────────
// 8. RESET PASSWORD FOR USER (super admin resets another user)
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/admin/reset-password-for-user', () => {
  let superAdmin, moderator;

  beforeEach(async () => {
    await User.deleteMany({});
    superAdmin = await seedAdmin(User);
    moderator = await seedModerator(User);
  });

  afterAll(async () => {
    await User.deleteMany({});
  });

  it('should allow super admin to reset another admin user password', async () => {
    const newPassword = 'ResetByAdmin123!';
    const res = await api.post(`${BASE}/reset-password-for-user`, {
      userId: moderator.user._id.toString(),
      newPassword
    }, superAdmin.token);

    expectSuccess(res, 200);
    expect(res.body.message).toMatch(/password reset successfully/i);
    expect(res.body).toHaveProperty('resetUser');
    expect(res.body.resetUser.email).toBe(moderator.user.email);

    // Verify passwordChangeRequired is set for moderator
    const updatedMod = await User.findById(moderator.user._id);
    expect(updatedMod.passwordChangeRequired).toBe(true);

    // Verify the new password works
    const loginRes = await api.post(`${BASE}/login`, {
      email: moderator.user.email,
      password: newPassword
    });
    expectSuccess(loginRes, 200);
  });

  it('should return 403 when a non-super-admin tries to reset another user password', async () => {
    const res = await api.post(`${BASE}/reset-password-for-user`, {
      userId: superAdmin.user._id.toString(),
      newPassword: 'AttemptReset123!'
    }, moderator.token);

    expectError(res, 403);
    expect(res.body.message).toMatch(/only super admin/i);
  });

  it('should return 400 when userId or newPassword is missing', async () => {
    const res = await api.post(`${BASE}/reset-password-for-user`, {
      userId: moderator.user._id.toString()
      // missing newPassword
    }, superAdmin.token);

    expectError(res, 400);
    expect(res.body.message).toMatch(/provide/i);
  });

  it('should return 404 when target user does not exist', async () => {
    const mongoose = require('mongoose');
    const fakeId = new mongoose.Types.ObjectId();

    const res = await api.post(`${BASE}/reset-password-for-user`, {
      userId: fakeId.toString(),
      newPassword: 'SomeNewPass123!'
    }, superAdmin.token);

    expectError(res, 404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it('should return 403 when super admin tries to reset another super admin password', async () => {
    const anotherSuperAdmin = await seedAdmin(User);

    const res = await api.post(`${BASE}/reset-password-for-user`, {
      userId: anotherSuperAdmin.user._id.toString(),
      newPassword: 'ResetSuper123!'
    }, superAdmin.token);

    expectError(res, 403);
    expect(res.body.message).toMatch(/cannot reset another super admin/i);
  });
});

// ─────────────────────────────────────────────────────────────
// 9. REQUEST PASSWORD RESET (non-super admin requests)
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/admin/request-password-reset', () => {
  let superAdmin, moderator;

  beforeAll(async () => {
    await User.deleteMany({});
    superAdmin = await seedAdmin(User);
    moderator = await seedModerator(User);
  });

  afterAll(async () => {
    await User.deleteMany({});
  });

  it('should allow a non-super-admin to request a password reset', async () => {
    const res = await api.post(`${BASE}/request-password-reset`, {}, moderator.token);

    expectSuccess(res, 200);
    expect(res.body.message).toMatch(/password reset request sent/i);
    expect(res.body).toHaveProperty('superAdminEmail');
  });

  it('should return 400 when super admin tries to use this endpoint', async () => {
    const res = await api.post(`${BASE}/request-password-reset`, {}, superAdmin.token);

    expectError(res, 400);
    expect(res.body.message).toMatch(/super admin can use the forgot password/i);
  });

  it('should return 401 without auth token', async () => {
    const res = await api.post(`${BASE}/request-password-reset`, {});

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
