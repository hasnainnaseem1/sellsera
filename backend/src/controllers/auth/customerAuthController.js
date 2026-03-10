const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { User } = require('../../models/user');
const { ActivityLog, AdminSettings } = require('../../models/admin');
const { Notification } = require('../../models/notification');
const { Plan } = require('../../models/subscription');
const { getWelcomeNotification } = require('../../utils/helpers');
const { getClientIP } = require('../../utils/helpers/ipHelper');
const emailService = require('../../services/email/emailService');
const { notifyNewCustomer, notifyCustomerPasswordReset } = require('../../services/notification/adminNotifier');
const { getSecuritySettings, msToJwtExpiry, validatePassword } = require('../../utils/helpers/securityHelper');
const { safeSave } = require('../../utils/helpers/safeDbOps');

// Generate JWT token with dynamic session timeout
const generateToken = (userId, sessionTimeoutMs) => {
  const expiresIn = sessionTimeoutMs ? msToJwtExpiry(sessionTimeoutMs) : '7d';
  return jwt.sign(
    { userId }, 
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

// Generate email verification token
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Hash a raw token for safe DB storage (SHA-256)
const hashToken = (rawToken) => {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
};

// Google OAuth2 client — accepts a clientId param so we can pass DB-driven value
const getGoogleClient = (clientId) => new OAuth2Client(clientId);

// @route   POST /api/v1/auth/customer/google
// @desc    Sign in / sign up via Google (accepts ID token credential OR access_token)
// @access  Public
const googleSSO = async (req, res) => {
  try {
    const { credential, access_token } = req.body;

    if (!credential && !access_token) {
      return res.status(400).json({ success: false, message: 'Google credential is required' });
    }

    // --- Read Google SSO config from DB (fall back to .env) ---
    const siteSettings = await AdminSettings.getSettings();
    const googleSSO = siteSettings.googleSSOSettings || {};
    if (!googleSSO.enabled) {
      return res.status(503).json({ success: false, message: 'Google sign-in is currently disabled.' });
    }
    const googleClientId = (googleSSO.clientId && googleSSO.clientId.trim()) || process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      return res.status(503).json({ success: false, message: 'Google OAuth is not configured on this server' });
    }

    let email, name, picture, googleId, email_verified;

    if (credential) {
      // --- ID token flow (GoogleLogin component / One Tap) ---
      const client = getGoogleClient(googleClientId);
      try {
        const ticket = await client.verifyIdToken({
          idToken: credential,
          audience: googleClientId,
        });
        const p = ticket.getPayload();
        ({ email, name, picture, sub: googleId, email_verified } = p);
      } catch (verifyErr) {
        console.error('Google ID token verification failed:', verifyErr.message);
        return res.status(401).json({ success: false, message: 'Invalid Google credential. Please try again.' });
      }
    } else {
      // --- Access token flow (useGoogleLogin implicit flow) ---
      try {
        const oauthClient = getGoogleClient(googleClientId);
        oauthClient.setCredentials({ access_token });
        const { data } = await oauthClient.request({
          url: 'https://www.googleapis.com/oauth2/v2/userinfo',
        });
        email = data.email;
        name = data.name;
        picture = data.picture;
        googleId = data.id;
        email_verified = data.verified_email;
      } catch (fetchErr) {
        console.error('Google userinfo fetch failed:', fetchErr.message);
        return res.status(401).json({ success: false, message: 'Could not verify Google account. Please try again.' });
      }
    }

    if (!email_verified) {
      return res.status(400).json({ success: false, message: 'Google account email is not verified.' });
    }

    // --- Check feature flags for login / signup ---
    const featureFlags = siteSettings.features || {};
    const clientIP = getClientIP(req);
    let user = await User.findOne({ email });
    let isNewUser = false;

    if (user) {
      // Existing user → this is a login — check enableLogin
      if (featureFlags.enableLogin === false) {
        return res.status(403).json({
          success: false,
          message: 'Customer login is currently disabled. Please contact the administrator.',
        });
      }

      // Existing user — must be a customer account
      if (user.accountType !== 'customer') {
        return res.status(403).json({
          success: false,
          message: 'This email is registered as an admin account. Please use a different login.',
        });
      }

      // If account was suspended / banned, block
      if (['suspended', 'banned'].includes(user.status)) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been suspended. Please contact support.',
        });
      }

      // Promote to active & verified if they were pending
      if (!user.isEmailVerified) {
        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
      }
      if (user.status === 'pending_verification') {
        user.status = 'active';
      }

      // Store Google ID if not already stored
      if (!user.googleId) user.googleId = googleId;
      if (!user.avatar && picture) user.avatar = picture;

      user.lastLogin = new Date();
      user.lastLoginIP = clientIP;
      await safeSave(user);

    } else {
      // New user → this is a signup — check enableCustomerSignup
      if (featureFlags.enableCustomerSignup === false) {
        return res.status(403).json({
          success: false,
          message: 'Customer signup is currently disabled. Please contact the administrator.',
        });
      }

      // New user — create account (no email verification needed for Google)
      isNewUser = true;

      const settings = await AdminSettings.getSettings();

      user = new User({
        name,
        email,
        // Google users have no local password — set a random unguessable one
        password: crypto.randomBytes(32).toString('hex'),
        accountType: 'customer',
        role: 'customer',
        status: 'active',
        plan: 'free',
        analysisLimit: 1,
        analysisCount: 0,
        isEmailVerified: true,
        googleId,
        avatar: picture || undefined,
        lastLogin: new Date(),
        lastLoginIP: clientIP,
      });

      // Assign default plan from dynamic plan system
      try {
        const defaultPlan = await Plan.findOne({ isDefault: true, isActive: true });
        if (defaultPlan) {
          user.currentPlan = defaultPlan._id;
          user.plan = defaultPlan.slug || defaultPlan.name.toLowerCase().includes('free') ? 'free' : user.plan;
          user.analysisLimit = defaultPlan.features?.find(f => f.featureKey === 'analysis_limit')?.value || 1;
          user.planSnapshot = {
            planId: defaultPlan._id,
            planName: defaultPlan.name,
            features: (defaultPlan.features || []).map(f => ({
              featureId: f._id,
              featureKey: f.featureKey,
              featureName: f.featureName,
              value: f.value,
              enabled: f.enabled,
            })),
          };
        }
      } catch (planErr) {
        console.error('Could not assign default plan (Google signup):', planErr.message);
      }

      await safeSave(user);

      // Send welcome email asynchronously (don't block login)
      emailService.sendWelcomeEmail?.(user).catch(() => {});

      // Notify admins about new customer (Google SSO signup)
      notifyNewCustomer(user).catch(() => {});
    }

    // Log activity (non-critical)
    try {
      await ActivityLog.logActivity({
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        action: isNewUser ? 'signup' : 'login',
        actionType: 'auth',
        description: `Google SSO ${isNewUser ? 'signup' : 'login'}: ${user.email}`,
        ipAddress: clientIP,
        userAgent: req.get('user-agent'),
        status: 'success',
      });
    } catch (logErr) {
      console.error('Failed to log Google SSO activity:', logErr.message);
    }

    const ssoSecSettings = await getSecuritySettings();
    const token = generateToken(user._id, ssoSecSettings.sessionTimeout);

    res.json({
      success: true,
      message: isNewUser ? 'Account created successfully!' : 'Login successful',
      token,
      isNewUser,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        plan: user.plan,
        analysisCount: user.analysisCount,
        analysisLimit: user.analysisLimit,
        subscriptionStatus: user.subscriptionStatus,
        isEmailVerified: user.isEmailVerified,
      },
    });

  } catch (error) {
    console.error('Google SSO error:', error);
    res.status(500).json({ success: false, message: 'Google sign-in failed. Please try again.' });
  }
};

// @route   POST /api/v1/auth/customer/signup
// @desc    Register new customer
// @access  Public
const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const clientIP = getClientIP(req);

    // Check if customer signup is enabled
    const featureSettings = await AdminSettings.getSettings();
    if (featureSettings.features?.enableCustomerSignup === false) {
      return res.status(403).json({
        success: false,
        message: 'Customer signup is currently disabled. Please contact the administrator.',
        action: 'disabled'
      });
    }

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
        action: 'retry'
      });
    }

    // Validate password against security settings
    const secSettings = await getSecuritySettings();
    const pwdCheck = await validatePassword(password, secSettings);
    if (!pwdCheck.valid) {
      return res.status(400).json({
        success: false,
        message: pwdCheck.message,
        action: 'retry'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered. Please login instead.',
        action: 'login',
        loginUrl: '/api/v1/auth/customer/login'
      });
    }

    // Read admin settings to determine verification behaviour
    const settings = await AdminSettings.getSettings();
    const requireEmailVerification = settings.customerSettings?.requireEmailVerification !== false;

    // Generate email verification token (always create it; used only if verification is required)
    const rawVerificationToken = generateVerificationToken();
    const verificationToken = hashToken(rawVerificationToken); // store hash, send raw
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Create new customer
    const user = new User({
      name,
      email,
      password,
      accountType: 'customer',
      role: 'customer',
      status: requireEmailVerification ? 'pending_verification' : 'active',
      plan: 'free',
      analysisLimit: 1,
      analysisCount: 0,
      isEmailVerified: !requireEmailVerification,
      emailVerificationToken: requireEmailVerification ? verificationToken : undefined,
      emailVerificationExpires: requireEmailVerification ? verificationExpiry : undefined
    });

    // Assign default plan from the dynamic plan system
    try {
      const defaultPlan = await Plan.getDefaultPlan();
      if (defaultPlan) {
        const now = new Date();
        user.currentPlan = defaultPlan._id;
        user.planSnapshot = {
          planId: defaultPlan._id,
          planName: defaultPlan.name,
          features: defaultPlan.features.map(f => ({
            featureId: f.featureId,
            featureKey: f.featureKey,
            featureName: f.featureName,
            enabled: f.enabled,
            limit: f.limit,
            value: f.value,
          })),
          assignedAt: now,
          assignedBy: null, // system-assigned
        };
        user.subscriptionStartDate = now;
        user.monthlyResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        // Handle trial period
        if (defaultPlan.trialDays && defaultPlan.trialDays > 0) {
          user.subscriptionStatus = 'trial';
          user.trialEndsAt = new Date(now.getTime() + defaultPlan.trialDays * 24 * 60 * 60 * 1000);
          user.subscriptionExpiresAt = user.trialEndsAt;
        } else {
          user.subscriptionStatus = 'active';
          user.trialEndsAt = null;
          user.subscriptionExpiresAt = null;
        }

        // Update legacy plan field
        const slug = defaultPlan.slug || defaultPlan.name.toLowerCase();
        if (['free', 'starter', 'pro', 'unlimited'].includes(slug)) {
          user.plan = slug;
        }
        user.updateAnalysisLimit();
      }
    } catch (planErr) {
      console.error('Could not assign default plan:', planErr);
      // Continue with signup even if default plan assignment fails
    }

    await safeSave(user);

    // Send raw token in URL; DB stores the hash
    const verificationLink = `${process.env.CUSTOMER_FRONTEND_URL || 'http://localhost:3002'}/verify-email/${rawVerificationToken}`;

    // Send verification email ASYNCHRONOUSLY — never block the signup response.
    if (requireEmailVerification) {
      emailService.sendVerificationEmail(user, verificationLink)
        .then(result => {
          if (result?.success) {
            console.log(`[SIGNUP] Verification email sent to ${email} (${result.messageId})`);
          } else {
            console.warn(`[SIGNUP] Verification email failed for ${email}: ${result?.error || 'unknown'}`);
          }
        })
        .catch(err => {
          console.error(`[SIGNUP] Verification email error for ${email}:`, err.message);
        });
    }

    // Log activity (non-critical)
    try {
      await ActivityLog.logActivity({
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        action: 'signup',
        actionType: 'auth',
        description: `New customer registered: ${user.email}`,
        ipAddress: clientIP,
        userAgent: req.get('user-agent'),
        status: 'success'
      });
    } catch (logErr) {
      console.error('Failed to log signup activity:', logErr.message);
    }

    // Create welcome notification - DYNAMIC (non-critical)
    try {
      const welcomeNotification = getWelcomeNotification();
      await Notification.createNotification({
        recipientId: user._id,
        ...welcomeNotification
      });
    } catch (notifErr) {
      console.error('Failed to create welcome notification:', notifErr.message);
    }

    // Notify admins about new customer (respects notification settings)
    notifyNewCustomer(user).catch(() => {});

    // If email verification is NOT required, log the user in immediately
    if (!requireEmailVerification) {
      // Send welcome email (fire-and-forget)
      emailService.sendWelcomeEmail(user).catch((err) => {
        console.error(`[SIGNUP] Welcome email failed for ${user.email}:`, err.message);
      });

      const signupSecSettings = await getSecuritySettings();
      const token = generateToken(user._id, signupSecSettings.sessionTimeout);
      return res.status(201).json({
        success: true,
        message: 'Account created successfully!',
        verificationRequired: false,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          accountType: user.accountType,
          role: user.role,
          plan: user.plan,
          planSnapshot: user.planSnapshot || null,
          analysisCount: user.analysisCount,
          analysisLimit: user.analysisLimit,
          monthlyResetDate: user.monthlyResetDate,
          subscriptionStatus: user.subscriptionStatus,
          trialEndsAt: user.trialEndsAt || null,
          isEmailVerified: user.isEmailVerified,
          status: user.status,
          createdAt: user.createdAt
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Account created successfully! Please check your email to verify your account.',
      nextStep: 'Please check your email to verify your account.',
      verificationRequired: true,
      verificationLink: process.env.NODE_ENV === 'development' ? verificationLink : undefined
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating account. Please try again later.',
      action: 'retry'
    });
  }
};

// @route   POST /api/v1/auth/customer/login
// @desc    Login customer
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const clientIP = getClientIP(req);

    // Check if customer login is enabled
    const loginFeatureSettings = await AdminSettings.getSettings();
    if (loginFeatureSettings.features?.enableLogin === false) {
      return res.status(403).json({
        success: false,
        message: 'Customer login is currently disabled. Please contact the administrator.',
        action: 'disabled'
      });
    }

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
        action: 'retry'
      });
    }

    // Find user
    const user = await User.findOne({ email, accountType: 'customer' });
    
    // User doesn't exist
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email. Please sign up first.',
        action: 'signup',
        signupUrl: '/api/v1/auth/customer/signup'
      });
    }

    // Fetch dynamic security settings
    const secSettings = await getSecuritySettings();

    // Account locked
    if (user.isLocked()) {
      const lockMinutes = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
      return res.status(423).json({
        success: false,
        message: `Account temporarily locked. Please try again in ${lockMinutes} minutes.`,
        action: 'wait',
        lockedUntil: user.lockUntil,
        contactSupport: process.env.SUPPORT_EMAIL || 'support@example.com'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      // Increment login attempts (non-critical)
      try {
        await user.incLoginAttempts(secSettings.maxLoginAttempts, secSettings.lockoutDuration);
      } catch (incErr) {
        console.error('Failed to increment login attempts:', incErr.message);
      }

      const attemptsRemaining = Math.max(0, secSettings.maxLoginAttempts - user.loginAttempts);
      
      // Log failed login (non-critical)
      try {
        await ActivityLog.logActivity({
          userId: user._id,
          userName: user.name,
          userEmail: user.email,
          userRole: user.role,
          action: 'login',
          actionType: 'auth',
          description: 'Failed login attempt - incorrect password',
          ipAddress: clientIP,
          userAgent: req.get('user-agent'),
          status: 'failed',
          errorMessage: 'Incorrect password'
        });
      } catch (logErr) {
        console.error('Failed to log failed login activity:', logErr.message);
      }
      
      return res.status(401).json({
        success: false,
        message: attemptsRemaining > 0 
          ? `Incorrect password. ${attemptsRemaining} attempts remaining.`
          : 'Incorrect password. Account will be locked after next failed attempt.',
        action: 'retry',
        attemptsRemaining
      });
    }

    // Email not verified
    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in.',
        action: 'verify_email',
        emailVerificationRequired: true,
        resendUrl: '/api/v1/auth/customer/resend-verification',
        hint: 'Check your email inbox for verification link.'
      });
    }

    // Account not active
    if (user.status !== 'active') {
      const statusMessages = {
        pending_verification: 'Your account is pending verification.',
        suspended: 'Your account has been suspended. Please contact support.',
        banned: 'Your account has been banned. Please contact support.',
        inactive: 'Your account is inactive. Please contact support.'
      };
      
      return res.status(403).json({
        success: false,
        message: statusMessages[user.status] || 'Your account is not active.',
        action: 'contact_support',
        accountStatus: user.status,
        contactSupport: process.env.SUPPORT_EMAIL || 'support@example.com'
      });
    }

    // Success - reset attempts and login
    try {
      await user.resetLoginAttempts();
    } catch (resetErr) {
      console.error('Failed to reset login attempts:', resetErr.message);
    }

    // Update last login (non-critical)
    try {
      await User.updateOne(
        { _id: user._id },
        { $set: { lastLogin: new Date(), lastLoginIP: clientIP } }
      );
    } catch (updateErr) {
      console.error('Failed to update lastLogin:', updateErr.message);
    }

    // Log successful login (non-critical)
    try {
      await ActivityLog.logActivity({
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        action: 'login',
        actionType: 'auth',
        description: 'Successful login',
        ipAddress: clientIP,
        userAgent: req.get('user-agent'),
        status: 'success'
      });
    } catch (logErr) {
      console.error('Failed to log login activity:', logErr.message);
    }

    const token = generateToken(user._id, secSettings.sessionTimeout);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        accountType: user.accountType,
        role: user.role,
        plan: user.plan,
        planSnapshot: user.planSnapshot || null,
        analysisCount: user.analysisCount,
        analysisLimit: user.analysisLimit,
        monthlyResetDate: user.monthlyResetDate,
        subscriptionStatus: user.subscriptionStatus,
        trialEndsAt: user.trialEndsAt || null,
        isEmailVerified: user.isEmailVerified,
        status: user.status,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in. Please try again later.',
      action: 'retry'
    });
  }
};

// @route   GET /api/v1/auth/customer/verify-email/:token
// @desc    Verify email address
// @access  Public
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const clientIP = getClientIP(req);

    // Hash the raw token from the URL to compare against stored hash
    const hashedToken = hashToken(token);

    // Look up user by token hash (ignore expiry for now — check separately)
    const user = await User.findOne({ emailVerificationToken: hashedToken });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token. If you already verified, try logging in.',
        action: 'resend',
        resendUrl: '/api/v1/auth/customer/resend-verification'
      });
    }

    // If the user is ALREADY verified, respond with success
    if (user.isEmailVerified) {
      return res.json({
        success: true,
        message: 'Email already verified! You can log in now.',
        action: 'login',
        loginUrl: '/api/v1/auth/customer/login'
      });
    }

    // Check if the token has expired
    if (user.emailVerificationExpires && new Date(user.emailVerificationExpires) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Verification link has expired. Please request a new one.',
        action: 'resend',
        resendUrl: '/api/v1/auth/customer/resend-verification'
      });
    }

    // Verify the user
    user.isEmailVerified = true;
    user.status = 'active';
    await safeSave(user);

    // Send welcome email after successful verification (fire-and-forget)
    emailService.sendWelcomeEmail(user).catch((err) => {
      console.error(`[VERIFY] Welcome email failed for ${user.email}:`, err.message);
    });

    // Log activity (non-critical)
    try {
      await ActivityLog.logActivity({
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        action: 'email_verification',
        actionType: 'auth',
        description: `Email verified for: ${user.email}`,
        ipAddress: clientIP,
        userAgent: req.get('user-agent'),
        status: 'success'
      });
    } catch (logErr) {
      console.error('Failed to log email verification activity:', logErr.message);
    }

    res.json({
      success: true,
      message: 'Email verified successfully! You can now log in.',
      action: 'login',
      loginUrl: '/api/v1/auth/customer/login'
    });

  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying email',
      action: 'retry'
    });
  }
};

// @route   POST /api/v1/auth/customer/resend-verification
// @desc    Resend verification email
// @access  Public
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    const clientIP = getClientIP(req);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
        action: 'retry'
      });
    }

    const user = await User.findOne({ email, accountType: 'customer' });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email',
        action: 'signup',
        signupUrl: '/api/v1/auth/customer/signup'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified. You can login now.',
        action: 'login',
        loginUrl: '/api/v1/auth/customer/login'
      });
    }

    const rawVerifToken = generateVerificationToken();
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    user.emailVerificationToken = hashToken(rawVerifToken); // store hash
    user.emailVerificationExpires = verificationExpiry;
    await safeSave(user);

    const verificationLink = `${process.env.CUSTOMER_FRONTEND_URL || 'http://localhost:3002'}/verify-email/${rawVerifToken}`;

    // Send verification email — use a timeout so the resend button doesn't hang
    let emailResult;
    try {
      emailResult = await Promise.race([
        emailService.sendVerificationEmail(user, verificationLink),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Email send timed out')), 15_000)),
      ]);
    } catch (emailErr) {
      console.warn(`[RESEND] Email send issue for ${email}: ${emailErr.message}`);
      emailResult = { success: false, error: emailErr.message };
    }

    if (!emailResult?.success) {
      console.warn(`[RESEND] Verification email failed for ${email}: ${emailResult?.error || 'unknown'}`);
    }

    // Log activity (non-critical)
    try {
      await ActivityLog.logActivity({
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        action: 'resend_verification',
        actionType: 'auth',
        description: `Verification email resent to: ${user.email}`,
        ipAddress: clientIP,
        userAgent: req.get('user-agent'),
        status: 'success'
      });
    } catch (logErr) {
      console.error('Failed to log resend verification activity:', logErr.message);
    }

    res.json({
      success: true,
      message: 'Verification email sent! Please check your inbox.',
      verificationLink: process.env.NODE_ENV === 'development' ? verificationLink : undefined
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending verification email',
      action: 'retry'
    });
  }
};

// @route   GET /api/v1/auth/customer/me
// @desc    Get current customer
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password -emailVerificationToken');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        accountType: user.accountType,
        role: user.role,
        plan: user.plan,
        planSnapshot: user.planSnapshot || null,
        analysisCount: user.analysisCount,
        analysisLimit: user.analysisLimit,
        monthlyResetDate: user.monthlyResetDate,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionStartDate: user.subscriptionStartDate || null,
        subscriptionExpiresAt: user.subscriptionExpiresAt || null,
        billingCycle: user.billingCycle || 'none',
        trialEndsAt: user.trialEndsAt || null,
        isEmailVerified: user.isEmailVerified,
        status: user.status,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user data'
    });
  }
};

// @route   PUT /api/v1/auth/customer/me
// @desc    Update customer profile (name, phone)
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Name must be at least 2 characters' });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { name: name.trim(), ...(phone !== undefined && { phone: phone.trim() }) },
      { new: true, runValidators: true }
    ).select('-password -emailVerificationToken');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        accountType: user.accountType,
        role: user.role,
        plan: user.plan,
        planSnapshot: user.planSnapshot || null,
        analysisCount: user.analysisCount,
        analysisLimit: user.analysisLimit,
        subscriptionStatus: user.subscriptionStatus,
        trialEndsAt: user.trialEndsAt || null,
        isEmailVerified: user.isEmailVerified,
        status: user.status,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Error updating profile' });
  }
};

// @route   PUT /api/v1/auth/customer/me/password
// @desc    Change customer password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
    }
    // Validate password against security settings
    const secSettings = await getSecuritySettings();
    const pwdCheck = await validatePassword(newPassword, secSettings);
    if (!pwdCheck.valid) {
      return res.status(400).json({ success: false, message: pwdCheck.message });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    // Assign plain password — the User model pre-save hook handles bcrypt hashing
    user.password = newPassword;
    await safeSave(user);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Error changing password' });
  }
};

// @route   POST /api/v1/auth/customer/logout
// @desc    Logout customer
// @access  Private
const logout = async (req, res) => {
  try {
    const clientIP = getClientIP(req);

    const user = await User.findById(req.userId).select('name email role').lean();

    // Log logout activity (non-critical)
    try {
      await ActivityLog.logActivity({
        userId: req.userId,
        userName: user?.name || 'Unknown',
        userEmail: user?.email || 'unknown@unknown.com',
        userRole: user?.role || 'customer',
        action: 'logout',
        actionType: 'auth',
        description: 'User logged out',
        ipAddress: clientIP,
        userAgent: req.get('user-agent'),
        status: 'success'
      });
    } catch (logErr) {
      console.error('Failed to log logout activity:', logErr.message);
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging out'
    });
  }
};

// @route   POST /api/v1/auth/customer/forgot-password
// @desc    Send password reset email
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const clientIP = getClientIP(req);

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ email, accountType: 'customer' });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    const rawResetToken = generateVerificationToken();
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.passwordResetToken = hashToken(rawResetToken); // store hash, send raw
    user.passwordResetExpires = resetExpiry;
    user.resetPasswordRequestedAt = new Date();
    await safeSave(user);

    const resetLink = `${process.env.CUSTOMER_FRONTEND_URL || 'http://localhost:3002'}/reset-password/${rawResetToken}`;

    // Send password reset email — use timeout so the request doesn't hang
    emailService.sendPasswordResetEmail(user, resetLink)
      .then(result => {
        if (result?.success) {
          console.log(`[FORGOT-PW] Reset email sent to ${email} (${result.messageId})`);
        } else {
          console.warn(`[FORGOT-PW] Reset email failed for ${email}: ${result?.error || 'unknown'}`);
        }
      })
      .catch(err => {
        console.error(`[FORGOT-PW] Reset email error for ${email}:`, err.message);
      });

    // Notify admins about customer password reset request
    notifyCustomerPasswordReset(user, 'requested').catch(() => {});

    // Log activity (non-critical)
    try {
      await ActivityLog.logActivity({
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        action: 'password_reset',
        actionType: 'auth',
        description: `Password reset requested for: ${user.email}`,
        ipAddress: clientIP,
        userAgent: req.get('user-agent'),
        status: 'success'
      });
    } catch (logErr) {
      console.error('Failed to log forgot password activity:', logErr.message);
    }

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
      resetLink: process.env.NODE_ENV === 'development' ? resetLink : undefined
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Error processing request. Please try again.' });
  }
};

// @route   POST /api/v1/auth/customer/reset-password/:token
// @desc    Reset password using token
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    const clientIP = getClientIP(req);

    if (!password) {
      return res.status(400).json({ success: false, message: 'New password is required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }
    // Validate password against security settings  
    const secSettings = await getSecuritySettings();
    const pwdCheck = await validatePassword(password, secSettings);
    if (!pwdCheck.valid) {
      return res.status(400).json({ success: false, message: pwdCheck.message });
    }

    // Hash the raw token from URL to compare against stored hash
    const hashedToken = hashToken(token);
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset link. Please request a new one.',
        action: 'forgot_password'
      });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.passwordChangeRequired = false;
    await safeSave(user);

    // Notify admins about customer password reset completion
    notifyCustomerPasswordReset(user, 'completed').catch(() => {});

    // Log activity (non-critical)
    try {
      await ActivityLog.logActivity({
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        action: 'password_reset',
        actionType: 'auth',
        description: `Password reset successfully for: ${user.email}`,
        ipAddress: clientIP,
        userAgent: req.get('user-agent'),
        status: 'success'
      });
    } catch (logErr) {
      console.error('Failed to log password reset activity:', logErr.message);
    }

    res.json({
      success: true,
      message: 'Password reset successfully! You can now log in with your new password.',
      action: 'login'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Error resetting password. Please try again.' });
  }
};

module.exports = {
  googleSSO,
  signup,
  login,
  verifyEmail,
  resendVerification,
  getMe,
  updateProfile,
  changePassword,
  logout,
  forgotPassword,
  resetPassword
};
