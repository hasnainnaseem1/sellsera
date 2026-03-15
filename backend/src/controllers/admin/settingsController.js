const { ActivityLog, AdminSettings } = require('../../models/admin');
const { bustMaintenanceCache } = require('../../middleware/security/maintenanceMode');
const { getClientIP } = require('../../utils/helpers/ipHelper');
const emailService = require('../../services/email/emailService');
const { resolveFromReq, toRelativeUploadPath } = require('../../utils/helpers/urlHelper');
const { safeSave, safeActivityLog } = require('../../utils/helpers/safeDbOps');

// GET /api/admin/settings
const getSettings = async (req, res) => {
  try {
    const settings = await AdminSettings.getSettings();

    // Hide sensitive information for non-super admins
    const sanitizedSettings = { ...settings.toObject() };
    
    if (req.user.role !== 'super_admin') {
      delete sanitizedSettings.emailSettings.smtpPassword;
      delete sanitizedSettings.stripeSettings?.secretKey;
      delete sanitizedSettings.stripeSettings?.webhookSecret;
      // Hide LemonSqueezy secrets from non-super-admins
      if (sanitizedSettings.lemonSqueezySettings) {
        delete sanitizedSettings.lemonSqueezySettings.apiKey;
        delete sanitizedSettings.lemonSqueezySettings.webhookSecret;
      }
      // Hide Google SSO secret from non-super-admins
      if (sanitizedSettings.googleSSOSettings) {
        delete sanitizedSettings.googleSSOSettings.clientSecret;
      }
      // Hide Etsy secrets from non-super-admins
      if (sanitizedSettings.etsySettings) {
        delete sanitizedSettings.etsySettings.clientSecret;
        delete sanitizedSettings.etsySettings.encryptionKey;
      }
    }

    // For Etsy, always add computed flags so UI knows if secrets are set
    if (sanitizedSettings.etsySettings) {
      sanitizedSettings.etsySettings.hasClientSecret = !!settings.etsySettings?.clientSecret;
      sanitizedSettings.etsySettings.hasEncryptionKey = !!settings.etsySettings?.encryptionKey;
    }

    res.json(resolveFromReq({
      success: true,
      settings: sanitizedSettings
    }, req));

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching settings'
    });
  }
};

// PUT /api/admin/settings/general
const updateGeneralSettings = async (req, res) => {
  try {
    const { siteName, siteDescription, supportEmail, contactEmail } = req.body;
    const clientIP = getClientIP(req);

    const settings = await AdminSettings.getSettings();

    if (siteName) settings.siteName = siteName;
    if (siteDescription) settings.siteDescription = siteDescription;
    if (supportEmail) settings.supportEmail = supportEmail;
    if (contactEmail) settings.contactEmail = contactEmail;

    settings.lastUpdatedBy = req.userId;
    await safeSave(settings);

    // Log activity
    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'settings_updated',
      actionType: 'update',
      targetModel: 'Settings',
      description: 'Updated general settings',
      metadata: req.body,
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      message: 'General settings updated successfully'
    });

  } catch (error) {
    console.error('Update general settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating settings'
    });
  }
};

// PUT /api/admin/settings/email
const updateEmailSettings = async (req, res) => {
  try {
    const { smtpHost, smtpPort, smtpUser, smtpPassword, smtpSecure, fromEmail, fromName } = req.body;
    const clientIP = getClientIP(req);

    const settings = await AdminSettings.getSettings();

    if (smtpHost) settings.emailSettings.smtpHost = smtpHost;
    if (smtpPort) {
      settings.emailSettings.smtpPort = smtpPort;
      // Auto-correct smtpSecure flag based on port to prevent SSL mismatch errors.
      // Port 465 = implicit TLS → secure: true.  Anything else (587, 25) = STARTTLS → secure: false.
      settings.emailSettings.smtpSecure = Number(smtpPort) === 465;
    }
    if (smtpUser) settings.emailSettings.smtpUser = smtpUser;
    if (smtpPassword) settings.emailSettings.smtpPassword = smtpPassword;
    if (typeof smtpSecure === 'boolean') settings.emailSettings.smtpSecure = smtpSecure;
    if (fromEmail) settings.emailSettings.fromEmail = fromEmail;
    if (fromName) settings.emailSettings.fromName = fromName;

    settings.lastUpdatedBy = req.userId;
    await safeSave(settings);

    // Invalidate the cached SMTP transporter so the next email uses the new settings
    emailService.resetTransporter();

    // Log activity (without password)
    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'settings_updated',
      actionType: 'update',
      targetModel: 'Settings',
      description: 'Updated email settings',
      metadata: { ...req.body, smtpPassword: '***' },
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      message: 'Email settings updated successfully'
    });

  } catch (error) {
    console.error('Update email settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating email settings'
    });
  }
};

// POST /api/admin/settings/email/test
const sendTestEmail = async (req, res) => {
  try {
    const { recipientEmail } = req.body;
    const clientIP = getClientIP(req);

    if (!recipientEmail) {
      return res.status(400).json({
        success: false,
        message: 'Recipient email is required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address'
      });
    }

    // Send test email
    const result = await emailService.sendTestEmail(recipientEmail);

    // Log activity
    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'test_email_sent',
      actionType: 'create',
      targetModel: 'Settings',
      description: `Sent test email to ${recipientEmail}`,
      metadata: { recipientEmail },
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      message: result.message || `Test email sent successfully to ${recipientEmail}`,
      messageId: result.messageId
    });

  } catch (error) {
    console.error('Send test email error:', error);
    
    // Log failed attempt
    const clientIP = getClientIP(req);
    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'test_email_failed',
      actionType: 'create',
      targetModel: 'Settings',
      description: `Failed to send test email: ${error.message}`,
      metadata: { error: error.message },
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'error'
    });

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send test email. Please check your SMTP configuration.'
    });
  }
};

// PUT /api/admin/settings/customer
const updateCustomerSettings = async (req, res) => {
  try {
    const {
      requireEmailVerification,
      allowTemporaryEmails,
      autoApproveNewcustomers,
      defaultPlan,
      freeTrialDays
    } = req.body;
    const clientIP = getClientIP(req);

    const settings = await AdminSettings.getSettings();

    if (requireEmailVerification !== undefined) {
      settings.customerSettings.requireEmailVerification = requireEmailVerification;
    }
    if (allowTemporaryEmails !== undefined) {
      settings.customerSettings.allowTemporaryEmails = allowTemporaryEmails;
    }
    if (autoApproveNewcustomers !== undefined) {
      settings.customerSettings.autoApproveNewcustomers = autoApproveNewcustomers;
    }
    if (defaultPlan) settings.customerSettings.defaultPlan = defaultPlan;
    if (freeTrialDays !== undefined) settings.customerSettings.freeTrialDays = freeTrialDays;

    settings.lastUpdatedBy = req.userId;
    await safeSave(settings);

    // Log activity
    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'settings_updated',
      actionType: 'update',
      targetModel: 'Settings',
      description: 'Updated customer settings',
      metadata: req.body,
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      message: 'Customer settings updated successfully'
    });

  } catch (error) {
    console.error('Update customer settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating customer settings'
    });
  }
};

// PUT /api/admin/settings/security
const updateSecuritySettings = async (req, res) => {
  try {
    const {
      maxLoginAttempts,
      lockoutDuration,
      passwordMinLength,
      requireStrongPassword,
      sessionTimeout,
      twoFactorEnabled
    } = req.body;
    const clientIP = getClientIP(req);

    const settings = await AdminSettings.getSettings();

    if (maxLoginAttempts) settings.securitySettings.maxLoginAttempts = maxLoginAttempts;
    if (lockoutDuration) settings.securitySettings.lockoutDuration = lockoutDuration;
    if (passwordMinLength) settings.securitySettings.passwordMinLength = passwordMinLength;
    if (requireStrongPassword !== undefined) {
      settings.securitySettings.requireStrongPassword = requireStrongPassword;
    }
    if (sessionTimeout) settings.securitySettings.sessionTimeout = sessionTimeout;
    if (twoFactorEnabled !== undefined) {
      settings.securitySettings.twoFactorEnabled = twoFactorEnabled;
    }

    settings.lastUpdatedBy = req.userId;
    await safeSave(settings);

    // Log activity
    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'settings_updated',
      actionType: 'update',
      targetModel: 'Settings',
      description: 'Updated security settings',
      metadata: req.body,
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      message: 'Security settings updated successfully'
    });

  } catch (error) {
    console.error('Update security settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating security settings'
    });
  }
};

// PUT /api/admin/settings/notification
const updateNotificationSettings = async (req, res) => {
  try {
    const {
      enableEmailNotifications,
      enablePushNotifications,
      notifyAdminOnNewcustomer,
      notifyAdminOnSubscription
    } = req.body;
    const clientIP = getClientIP(req);

    const settings = await AdminSettings.getSettings();

    if (enableEmailNotifications !== undefined) {
      settings.notificationSettings.enableEmailNotifications = enableEmailNotifications;
    }
    if (enablePushNotifications !== undefined) {
      settings.notificationSettings.enablePushNotifications = enablePushNotifications;
    }
    if (notifyAdminOnNewcustomer !== undefined) {
      settings.notificationSettings.notifyAdminOnNewcustomer = notifyAdminOnNewcustomer;
    }
    if (notifyAdminOnSubscription !== undefined) {
      settings.notificationSettings.notifyAdminOnSubscription = notifyAdminOnSubscription;
    }

    settings.lastUpdatedBy = req.userId;
    await safeSave(settings);

    // Log activity
    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'settings_updated',
      actionType: 'update',
      targetModel: 'Settings',
      description: 'Updated notification settings',
      metadata: req.body,
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      message: 'Notification settings updated successfully'
    });

  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating notification settings'
    });
  }
};

// PUT /api/admin/settings/maintenance
const updateMaintenanceMode = async (req, res) => {
  try {
    const { enabled, message, allowAdminAccess } = req.body;
    const clientIP = getClientIP(req);

    // Only super admin can toggle maintenance mode
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only super admin can toggle maintenance mode'
      });
    }

    const settings = await AdminSettings.getSettings();

    if (enabled !== undefined) settings.maintenanceMode.enabled = enabled;
    if (message) settings.maintenanceMode.message = message;
    if (allowAdminAccess !== undefined) {
      settings.maintenanceMode.allowAdminAccess = allowAdminAccess;
    }

    settings.lastUpdatedBy = req.userId;
    await safeSave(settings);

    // Bust maintenance cache so changes take effect immediately
    bustMaintenanceCache();

    // Log activity
    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'system_maintenance',
      actionType: 'system',
      targetModel: 'Settings',
      description: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`,
      metadata: req.body,
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'} successfully`
    });

  } catch (error) {
    console.error('Update maintenance mode error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating maintenance mode'
    });
  }
};

// PUT /api/admin/settings/features
const updateFeatureFlags = async (req, res) => {
  try {
    const {
      enableCustomerSignup,
      enableLogin,
      enableAnalysis,
      enableSubscriptions,
      enableCustomRoles,
      enableActivityLogs
    } = req.body;
    const clientIP = getClientIP(req);

    const settings = await AdminSettings.getSettings();

    if (enableCustomerSignup !== undefined) settings.features.enableCustomerSignup = enableCustomerSignup;
    if (enableLogin !== undefined) settings.features.enableLogin = enableLogin;
    if (enableAnalysis !== undefined) settings.features.enableAnalysis = enableAnalysis;
    if (enableSubscriptions !== undefined) settings.features.enableSubscriptions = enableSubscriptions;
    if (enableCustomRoles !== undefined) settings.features.enableCustomRoles = enableCustomRoles;
    if (enableActivityLogs !== undefined) settings.features.enableActivityLogs = enableActivityLogs;

    settings.lastUpdatedBy = req.userId;
    await safeSave(settings);

    // Log activity
    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'settings_updated',
      actionType: 'update',
      targetModel: 'Settings',
      description: 'Updated feature flags',
      metadata: req.body,
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      message: 'Feature flags updated successfully'
    });

  } catch (error) {
    console.error('Update feature flags error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating feature flags'
    });
  }
};

// GET /api/v1/admin/settings/theme
const getThemeSettings = async (req, res) => {
  try {
    const settings = await AdminSettings.getSettings();

    res.json(resolveFromReq({
      success: true,
      themeSettings: settings.themeSettings
    }, req));

  } catch (error) {
    console.error('Get theme settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching theme settings'
    });
  }
};

// PUT /api/v1/admin/settings/theme
const updateThemeSettings = async (req, res) => {
  try {
    const {
      appName,
      appTagline,
      appDescription,
      logoUrl,
      logoSmallUrl,
      faviconUrl,
      primaryService,
      secondaryService,
      targetPlatform,
      toolType,
      welcomeTitle,
      welcomeMessage,
      emailVerificationMessage,
      primaryColor,
      secondaryColor,
      accentColor,
      companyName
    } = req.body;
    const clientIP = getClientIP(req);

    const settings = await AdminSettings.getSettings();

    // Update theme settings
    if (appName !== undefined) settings.themeSettings.appName = appName;
    if (appTagline !== undefined) settings.themeSettings.appTagline = appTagline;
    if (appDescription !== undefined) settings.themeSettings.appDescription = appDescription;
    if (logoUrl !== undefined) settings.themeSettings.logoUrl = toRelativeUploadPath(logoUrl);
    if (logoSmallUrl !== undefined) settings.themeSettings.logoSmallUrl = toRelativeUploadPath(logoSmallUrl);
    if (faviconUrl !== undefined) settings.themeSettings.faviconUrl = toRelativeUploadPath(faviconUrl);
    if (primaryService !== undefined) settings.themeSettings.primaryService = primaryService;
    if (secondaryService !== undefined) settings.themeSettings.secondaryService = secondaryService;
    if (targetPlatform !== undefined) settings.themeSettings.targetPlatform = targetPlatform;
    if (toolType !== undefined) settings.themeSettings.toolType = toolType;
    if (welcomeTitle !== undefined) settings.themeSettings.welcomeTitle = welcomeTitle;
    if (welcomeMessage !== undefined) settings.themeSettings.welcomeMessage = welcomeMessage;
    if (emailVerificationMessage !== undefined) settings.themeSettings.emailVerificationMessage = emailVerificationMessage;
    if (primaryColor !== undefined) settings.themeSettings.primaryColor = primaryColor;
    if (secondaryColor !== undefined) settings.themeSettings.secondaryColor = secondaryColor;
    if (accentColor !== undefined) settings.themeSettings.accentColor = accentColor;
    if (companyName !== undefined) settings.themeSettings.companyName = companyName;

    settings.markModified('themeSettings');
    await safeSave(settings);
    // Direct update to guarantee nested themeSettings persists (plain object avoids Mongoose serialization issues)
    const themePlain = JSON.parse(JSON.stringify(settings.themeSettings));
    await AdminSettings.updateOne(
      { _id: settings._id },
      { $set: { themeSettings: themePlain } }
    );

    // Log activity
    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      action: 'settings_updated',
      actionType: 'update',
      targetModel: 'AdminSettings',
      targetId: settings._id,
      description: 'Theme/branding settings updated',
      metadata: { updatedFields: Object.keys(req.body) },
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json(resolveFromReq({
      success: true,
      message: 'Theme settings updated successfully',
      themeSettings: settings.themeSettings
    }, req));

  } catch (error) {
    console.error('Update theme settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating theme settings'
    });
  }
};

// GET /api/admin/settings/email-blocking/domains
const getBlockedDomains = async (req, res) => {
  try {
    const settings = await AdminSettings.getSettings();
    const blockedDomains = settings.customerSettings.blockedTemporaryEmailDomains || [];

    res.json({
      success: true,
      domains: blockedDomains,
      total: blockedDomains.length
    });

  } catch (error) {
    console.error('Get blocked domains error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching blocked domains'
    });
  }
};

// PUT /api/admin/settings/email-blocking/domains
const updateBlockedDomains = async (req, res) => {
  try {
    const { domains } = req.body;
    const clientIP = getClientIP(req);

    if (!Array.isArray(domains)) {
      return res.status(400).json({
        success: false,
        message: 'Domains must be an array'
      });
    }

    // Normalize domains (lowercase)
    const normalizedDomains = domains.map(d => d.toLowerCase().trim()).filter(d => d.length > 0);

    const settings = await AdminSettings.getSettings();
    settings.customerSettings.blockedTemporaryEmailDomains = normalizedDomains;
    settings.markModified('customerSettings');
    settings.lastUpdatedBy = req.userId;
    await safeSave(settings);
    // Direct update to guarantee nested array persists
    await AdminSettings.updateOne(
      { _id: settings._id },
      { $set: { 'customerSettings.blockedTemporaryEmailDomains': normalizedDomains } }
    );

    // Log activity
    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'settings_updated',
      actionType: 'update',
      targetModel: 'Settings',
      description: `Updated blocked temporary email domains (${normalizedDomains.length} domains)`,
      metadata: { domainCount: normalizedDomains.length },
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      message: 'Blocked domains updated successfully',
      domains: normalizedDomains,
      total: normalizedDomains.length
    });

  } catch (error) {
    console.error('Update blocked domains error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating blocked domains'
    });
  }
};

// POST /api/admin/settings/email-blocking/domains/:domain
const addBlockedDomain = async (req, res) => {
  try {
    const domain = req.params.domain.toLowerCase().trim();
    const clientIP = getClientIP(req);

    if (!domain || domain.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Domain is required'
      });
    }

    const settings = await AdminSettings.getSettings();
    const domains = settings.customerSettings.blockedTemporaryEmailDomains || [];

    if (domains.includes(domain)) {
      return res.status(400).json({
        success: false,
        message: 'Domain already blocked'
      });
    }

    domains.push(domain);
    settings.customerSettings.blockedTemporaryEmailDomains = domains;
    settings.markModified('customerSettings');
    settings.lastUpdatedBy = req.userId;
    await safeSave(settings);
    // Direct update to guarantee nested array persists
    await AdminSettings.updateOne(
      { _id: settings._id },
      { $addToSet: { 'customerSettings.blockedTemporaryEmailDomains': domain } }
    );

    // Log activity
    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'settings_updated',
      actionType: 'update',
      targetModel: 'Settings',
      description: `Added blocked domain: ${domain}`,
      metadata: { domain },
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      message: `Domain ${domain} blocked successfully`,
      domains
    });

  } catch (error) {
    console.error('Add blocked domain error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding blocked domain'
    });
  }
};

// DELETE /api/admin/settings/email-blocking/domains/:domain
const removeBlockedDomain = async (req, res) => {
  try {
    const domain = req.params.domain.toLowerCase().trim();
    const clientIP = getClientIP(req);

    if (!domain || domain.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Domain is required'
      });
    }

    const settings = await AdminSettings.getSettings();
    const domains = settings.customerSettings.blockedTemporaryEmailDomains || [];

    const initialLength = domains.length;
    const updatedDomains = domains.filter(d => d !== domain);

    if (updatedDomains.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: 'Domain not found in blocked list'
      });
    }

    settings.customerSettings.blockedTemporaryEmailDomains = updatedDomains;
    settings.markModified('customerSettings');
    settings.lastUpdatedBy = req.userId;
    await safeSave(settings);
    // Direct update to guarantee nested array persists
    await AdminSettings.updateOne(
      { _id: settings._id },
      { $pull: { 'customerSettings.blockedTemporaryEmailDomains': domain } }
    );

    // Log activity
    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'settings_updated',
      actionType: 'update',
      targetModel: 'Settings',
      description: `Removed blocked domain: ${domain}`,
      metadata: { domain },
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      message: `Domain ${domain} unblocked successfully`,
      domains: updatedDomains
    });

  } catch (error) {
    console.error('Remove blocked domain error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing blocked domain'
    });
  }
};

// PUT /api/v1/admin/settings/google-sso
const updateGoogleSSO = async (req, res) => {
  try {
    const { enabled, clientId, clientSecret } = req.body;
    const clientIP = getClientIP(req);

    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only super admins can update Google SSO settings' });
    }

    const settings = await AdminSettings.getSettings();

    if (!settings.googleSSOSettings) settings.googleSSOSettings = {};

    if (enabled !== undefined) settings.googleSSOSettings.enabled = enabled;
    if (clientId !== undefined) settings.googleSSOSettings.clientId = clientId.trim();
    // Only update secret if a new one is provided (non-empty)
    if (clientSecret && clientSecret.trim()) {
      settings.googleSSOSettings.clientSecret = clientSecret.trim();
    }

    settings.lastUpdatedBy = req.userId;
    await safeSave(settings);

    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'settings_updated',
      actionType: 'update',
      targetModel: 'Settings',
      description: `Google SSO settings updated — ${enabled ? 'enabled' : 'disabled'}`,
      metadata: { enabled, clientId: clientId ? '***set***' : '(unchanged)' },
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      message: 'Google SSO settings saved successfully',
      googleSSOSettings: {
        enabled: settings.googleSSOSettings.enabled,
        clientId: settings.googleSSOSettings.clientId,
        // Never return the secret
      }
    });

  } catch (error) {
    console.error('Update Google SSO settings error:', error);
    res.status(500).json({ success: false, message: 'Error updating Google SSO settings' });
  }
};

// PUT /api/v1/admin/settings/etsy
const updateEtsySettings = async (req, res) => {
  try {
    const { enabled, clientId, clientSecret, redirectUri, encryptionKey } = req.body;
    const clientIP = getClientIP(req);

    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only super admins can update Etsy settings' });
    }

    const settings = await AdminSettings.getSettings();

    if (!settings.etsySettings) settings.etsySettings = {};

    if (typeof enabled === 'boolean') settings.etsySettings.enabled = enabled;
    if (clientId !== undefined) settings.etsySettings.clientId = clientId.trim();
    if (redirectUri !== undefined) settings.etsySettings.redirectUri = redirectUri.trim();
    // Only update secrets if non-empty (skip blank = keep existing)
    if (clientSecret && clientSecret.trim()) {
      settings.etsySettings.clientSecret = clientSecret.trim();
    }
    if (encryptionKey && encryptionKey.trim()) {
      settings.etsySettings.encryptionKey = encryptionKey.trim();
    }

    settings.markModified('etsySettings');
    settings.lastUpdatedBy = req.userId;
    await safeSave(settings);

    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'settings_updated',
      actionType: 'update',
      targetModel: 'Settings',
      description: 'Etsy integration settings updated',
      metadata: { clientId: clientId ? '***set***' : '(unchanged)', enabled },
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      message: 'Etsy settings saved successfully',
      etsySettings: {
        enabled: settings.etsySettings.enabled,
        clientId: settings.etsySettings.clientId,
        redirectUri: settings.etsySettings.redirectUri,
        hasClientSecret: !!settings.etsySettings.clientSecret,
        hasEncryptionKey: !!settings.etsySettings.encryptionKey,
      }
    });

  } catch (error) {
    console.error('Update Etsy settings error:', error);
    res.status(500).json({ success: false, message: 'Error updating Etsy settings' });
  }
};

// PUT /api/v1/admin/settings/stripe
const updateStripeSettings = async (req, res) => {
  try {
    const { publicKey, secretKey, webhookSecret } = req.body;
    const clientIP = getClientIP(req);

    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only super admins can update Stripe settings' });
    }

    const settings = await AdminSettings.getSettings();

    if (!settings.stripeSettings) settings.stripeSettings = {};

    if (publicKey !== undefined) settings.stripeSettings.publicKey = publicKey.trim();
    // Only update secrets if new values are provided (non-empty)
    if (secretKey && secretKey.trim()) {
      settings.stripeSettings.secretKey = secretKey.trim();
    }
    if (webhookSecret && webhookSecret.trim()) {
      settings.stripeSettings.webhookSecret = webhookSecret.trim();
    }

    settings.lastUpdatedBy = req.userId;
    await safeSave(settings);

    // Clear cached Stripe instance so it reinitializes with new keys
    try {
      const stripeService = require('../../services/stripe/stripeService');
      if (stripeService.stripe) stripeService.stripe = null;
    } catch (e) { /* ignore */ }

    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'settings_updated',
      actionType: 'update',
      targetModel: 'Settings',
      description: 'Stripe integration settings updated',
      metadata: { publicKey: publicKey ? '***set***' : '(unchanged)' },
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      message: 'Stripe settings saved successfully',
      stripeSettings: {
        publicKey: settings.stripeSettings.publicKey,
        // Never return secrets
      }
    });

  } catch (error) {
    console.error('Update Stripe settings error:', error);
    res.status(500).json({ success: false, message: 'Error updating Stripe settings' });
  }
};

// GET /api/v1/admin/settings/email-templates
const getEmailTemplates = async (req, res) => {
  try {
    const settings = await AdminSettings.getSettings();
    const { defaults, TEMPLATE_KEYS, TEMPLATE_VARIABLES } = require('../../services/email/defaultTemplates');

    const templates = {};
    for (const key of TEMPLATE_KEYS) {
      const custom = settings.emailTemplates?.[key];
      templates[key] = {
        subject: (custom?.subject && custom.subject.trim()) || '',
        body: (custom?.body && custom.body.trim()) || '',
        defaultSubject: defaults[key].subject,
        defaultBody: defaults[key].body,
        variables: TEMPLATE_VARIABLES[key] || [],
      };
    }

    res.json({ success: true, templates });
  } catch (error) {
    console.error('Get email templates error:', error);
    res.status(500).json({ success: false, message: 'Error fetching email templates' });
  }
};

// PUT /api/v1/admin/settings/email-templates/:key
const updateEmailTemplate = async (req, res) => {
  try {
    const { key } = req.params;
    const { subject, body } = req.body;
    const clientIP = getClientIP(req);
    const { TEMPLATE_KEYS } = require('../../services/email/defaultTemplates');

    if (!TEMPLATE_KEYS.includes(key)) {
      return res.status(400).json({ success: false, message: `Invalid template key: ${key}` });
    }

    const settings = await AdminSettings.getSettings();
    if (!settings.emailTemplates) settings.emailTemplates = {};
    if (!settings.emailTemplates[key]) settings.emailTemplates[key] = {};

    // Empty string means "use default"
    settings.emailTemplates[key].subject = (subject || '').trim();
    settings.emailTemplates[key].body = (body || '').trim();
    settings.markModified('emailTemplates');
    await safeSave(settings);

    await safeActivityLog(ActivityLog, {
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'settings_updated',
      actionType: 'update',
      targetModel: 'Settings',
      description: `Email template "${key}" updated`,
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({ success: true, message: `Email template "${key}" saved successfully` });
  } catch (error) {
    console.error('Update email template error:', error);
    res.status(500).json({ success: false, message: 'Error updating email template' });
  }
};

// DELETE /api/v1/admin/settings/email-templates/:key
const resetEmailTemplate = async (req, res) => {
  try {
    const { key } = req.params;
    const { TEMPLATE_KEYS } = require('../../services/email/defaultTemplates');

    if (!TEMPLATE_KEYS.includes(key)) {
      return res.status(400).json({ success: false, message: `Invalid template key: ${key}` });
    }

    const settings = await AdminSettings.getSettings();
    if (settings.emailTemplates?.[key]) {
      settings.emailTemplates[key] = { subject: '', body: '' };
      settings.markModified('emailTemplates');
      await safeSave(settings);
    }

    res.json({ success: true, message: `Email template "${key}" reset to default` });
  } catch (error) {
    console.error('Reset email template error:', error);
    res.status(500).json({ success: false, message: 'Error resetting email template' });
  }
};

// POST /api/v1/admin/settings/email-templates/:key/preview
const previewEmailTemplate = async (req, res) => {
  try {
    const { key } = req.params;
    const { subject: customSubject, body: customBody } = req.body;
    const { TEMPLATE_KEYS } = require('../../services/email/defaultTemplates');

    if (!TEMPLATE_KEYS.includes(key)) {
      return res.status(400).json({ success: false, message: `Invalid template key: ${key}` });
    }

    const customTemplate = (customSubject || customBody)
      ? { subject: customSubject, body: customBody }
      : null;

    const result = await emailService.previewTemplate(key, customTemplate);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Preview email template error:', error);
    res.status(500).json({ success: false, message: 'Error previewing template' });
  }
};

module.exports = {
  getSettings,
  updateGeneralSettings,
  updateEmailSettings,
  sendTestEmail,
  updateCustomerSettings,
  updateSecuritySettings,
  updateNotificationSettings,
  updateMaintenanceMode,
  updateFeatureFlags,
  getThemeSettings,
  updateThemeSettings,
  getBlockedDomains,
  updateBlockedDomains,
  addBlockedDomain,
  removeBlockedDomain,
  updateGoogleSSO,
  updateEtsySettings,
  updateStripeSettings,
  getEmailTemplates,
  updateEmailTemplate,
  resetEmailTemplate,
  previewEmailTemplate,
};
