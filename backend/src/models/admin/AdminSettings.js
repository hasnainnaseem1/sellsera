const mongoose = require('mongoose');

const adminSettingsSchema = new mongoose.Schema({
  // ==========================================
  // THEME & BRANDING SETTINGS
  // ==========================================
  themeSettings: {
    // Application Branding
    appName: {
      type: String,
      default: 'My Platform'
    },
    appTagline: {
      type: String,
      default: 'Your Business Optimization Platform'
    },
    appDescription: {
      type: String,
      default: 'AI-powered business optimization platform'
    },
    
    // Logo URLs
    logoUrl: {
      type: String,
      default: ''
    },
    logoSmallUrl: {
      type: String,
      default: ''
    },
    faviconUrl: {
      type: String,
      default: ''
    },
    
    // Service/Product Keywords
    primaryService: {
      type: String,
      default: 'SEO'
    },
    secondaryService: {
      type: String,
      default: 'Optimization'
    },
    targetPlatform: {
      type: String,
      default: ''
    },
    toolType: {
      type: String,
      default: 'AI Agent'
    },
    
    // Welcome Messages
    welcomeTitle: {
      type: String,
      default: 'Welcome to {APP_NAME}!'
    },
    welcomeMessage: {
      type: String,
      default: 'Thank you for joining {APP_NAME}. Please verify your email to get started.'
    },
    emailVerificationMessage: {
      type: String,
      default: 'Please verify your email to start using our platform.'
    },
    
    // Colors (for frontend theme)
    primaryColor: {
      type: String,
      default: '#7C3AED'
    },
    secondaryColor: {
      type: String,
      default: '#3B82F6'
    },
    accentColor: {
      type: String,
      default: '#10B981'
    },
    companyName: {
      type: String,
      default: ''
    }
  },

  // ==========================================
  // GENERAL SETTINGS
  // ==========================================
  siteName: {
    type: String,
    default: 'My Platform'
  },
  siteDescription: {
    type: String,
    default: 'AI-powered platform'
  },
  supportEmail: {
    type: String,
    default: 'support@example.com'
  },
  contactEmail: {
    type: String,
    default: 'contact@example.com'
  },

  // ==========================================
  // EMAIL SETTINGS
  // ==========================================
  emailSettings: {
    smtpHost: String,
    smtpPort: Number,
    smtpUser: String,
    smtpPassword: String,
    smtpSecure: {
      type: Boolean,
      default: false
    },
    fromEmail: String,
    fromName: {
      type: String,
      default: 'Platform Team'
    },
    subjectPrefix: {
      type: String,
      default: '[Platform]'
    }
  },

  // ==========================================
  // EMAIL TEMPLATES (admin-editable)
  // ==========================================
  emailTemplates: {
    verification: {
      subject: { type: String, default: '' },
      body: { type: String, default: '' },
    },
    welcome: {
      subject: { type: String, default: '' },
      body: { type: String, default: '' },
    },
    passwordReset: {
      subject: { type: String, default: '' },
      body: { type: String, default: '' },
    },
    planChange: {
      subject: { type: String, default: '' },
      body: { type: String, default: '' },
    },
    trialWarning: {
      subject: { type: String, default: '' },
      body: { type: String, default: '' },
    },
    trialExpired: {
      subject: { type: String, default: '' },
      body: { type: String, default: '' },
    },
  },

  // ==========================================
  // CUSTOMER SETTINGS
  // ==========================================
  customerSettings: {
    requireEmailVerification: {
      type: Boolean,
      default: true
    },
    allowTemporaryEmails: {
      type: Boolean,
      default: false
    },
    blockedTemporaryEmailDomains: {
      type: [String],
      default: [
        // 10 Minute Mail variants
        '10minutemail.com', '10minutemail.net', '10minutesmail.com', '10minemail.com',
        
        // Guerrilla Mail variants
        'guerrillamail.com', 'guerrillamail.org', 'guerrillamail.net', 'guerrillamail.biz',
        'sharklasers.com', 'grr.la', 'guerrillamailblock.com',
        
        // Mailinator variants
        'mailinator.com', 'mailinator2.com', 'mailinator.net',
        
        // Temp Mail variants
        'temp-mail.org', 'tempmail.com', 'tempmail.net', 'tempmail.io',
        'temp-email.org', 'temp-email.net', 'tempemail.net',
        
        // Throwaway Mail variants
        'throwaway.email', 'throwawaymail.com', 'throwaway.top', 'throwaway.me',
        'throwawaymail.net', 'throwawaymail.org',
        
        // Yopmail variants
        'yopmail.com', 'yopmail.net', 'yopmail.fr', 'yopmail.de', 'yopmail.es',
        'yopmail.it', 'yopmail.jp', 'yopmail.com.br', 'yopmail.at', 'yopmail.ch',
        'yopmail.ru',
        
        // Fake Mail variants
        'fake-mail.com', 'fakemail.net', 'fakemail.com', 'fakeinbox.com',
        
        // Trash Mail
        'trashmail.com', 'trashmail.net', 'trash-mail.com', 'trash-mail.net',
        
        // Mail variants
        'mailnesia.com', 'emailondeck.com', 'mintemail.com', 'mytemp.email',
        'tempinbox.com', 'dispostable.com', 'emailtemporanea.net',
        'burnermail.io', 'burner.email', 'burnerin.com',
        
        // Nada variants
        'getnada.com', 'nada.email', 'nadamail.com', 'nada.fr',
        
        // Mail Catch variants
        'mohmal.com', 'mailcatch.com', 'anonbox.net',
        
        // Spam & Trash variants
        'spam4.me', 'mailforspam.com', 'spamgourmet.com', 'spambox.us',
        'spamfree24.org', 'crazymailing.com', 'smellfear.com',
        
        // Mail Express variants
        'mailexpire.com', 'mailsac.com', 'tempr.email',
        
        // Harakiri Mail variants
        'harakirimail.com', 'mail.tm', 'mailtm.com',
        
        // Pokemail variants
        'pokemail.net', 'pokemail.com',
        
        // Mail variants
        'maildrop.cc', 'maildrop.com', 'maildrop.net',
        
        // Email Temporaire
        'mail-temporaire.fr', 'mail-temporaire.com',
        
        // Disposable Email variants
        'dispostable.com', 'disposableemailaddresses.com', 'disposeamail.com',
        'disposemail.com', 'disposable.email',
        
        // T-mail variants
        'tmail.ws', 'tmail.com', 'tmails.net', 'tafmail.com',
        
        // Temp Sky variants
        'moakt.com', 'tempsky.com', 'clrmail.com', 'freemail.ms',
        'emailnax.com', 'devnullmail.com', 'inboxbear.com',
        
        // Mail ZI variants
        'mailzi.ru', 'mailzi.com',
        
        // Temporary Email aliases
        'temp.email', 'temporary.email', 'tempory.email', 'tempoemail.com',
        'temporarymail.com', 'temporaryemail.com', 'temporaryinbox.com',
        
        // Drop Mail variants
        'dropmail.me', 'dropmyemail.com',
        
        // Email In Box variants
        'emailinbox.com',
        
        // Spam4me variants
        'spam.la', 'spambox.com', 'spamfree.org',
        
        // Mail Fragment variants
        'maildrop.xyz',
        
        // 1secMail variants
        '1secmail.com', '1secmail.net', '1secmail.org', 'secondmail.com',
        
        // Temp-SMS
        'tempmail.email', 'tempsms.com', 'temporaryphone.com',
        
        // Get Ring variants
        'getring.com', 'ringring.jp', 'tempnote.com',
        
        // Mail Cloud variants
        'guerrillamail.info', 'mail.tm', 'tempmail.pro',
        
        // SMS Receive variants
        'smstempmail.com', 'sms-temp-mail.com',
        
        // Other common temp mail services
        'mailslite.com', 'mailsilo.com', 'mailstro.com',
        'sharp-secure.com', 'vpn.sc', 'temp.sh',
        'protomail.com', 'protonmail.com',
        'keepmail.me', 'keepmymail.com',
        'vpn.email', 'vpnadmin.email',
        'temp.0box.eu', 'inbox.tm',
        'privateemail.com', 'proton.me',
        'nonbusimail.com',
        
        // More variants
        'mytrashmail.com', 'yeet.cc', 'mooo.com', 'guerrillamail.xyz',
        'email.com.ve', 'temp-mail.io', 'mail.cx',
        'trash.email',
        'binkmail.com',
        'getnada.com',
        'minutemail.com',
        'junk.to',
        'spam-me.com',
        'spamspot.com',
        'spam123.com', 'spam321.com',
        '5minutemail.com',
        '5minutemail.net',
        'shorttermmail.com',
        'tempinbox.com',
        'inbox.cultparade.in'
      ]
    },
    autoApproveNewcustomers: {
      type: Boolean,
      default: true
    },
    defaultPlan: {
      type: mongoose.Schema.Types.Mixed,
      default: 'free'
    },
    freeTrialDays: {
      type: Number,
      default: 0
    }
  },

  // ==========================================
  // SECURITY SETTINGS
  // ==========================================
  securitySettings: {
    maxLoginAttempts: {
      type: Number,
      default: 5
    },
    lockoutDuration: {
      type: Number,
      default: 2 * 60 * 60 * 1000
    },
    passwordMinLength: {
      type: Number,
      default: 8
    },
    requireStrongPassword: {
      type: Boolean,
      default: true
    },
    sessionTimeout: {
      type: Number,
      default: 7 * 24 * 60 * 60 * 1000
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false
    }
  },

  // ==========================================
  // ANALYTICS SETTINGS
  // ==========================================
  analyticsSettings: {
    enableTracking: {
      type: Boolean,
      default: true
    },
    dataRetentionDays: {
      type: Number,
      default: 90
    }
  },

  // ==========================================
  // NOTIFICATION SETTINGS
  // ==========================================
  notificationSettings: {
    enableEmailNotifications: {
      type: Boolean,
      default: true
    },
    enablePushNotifications: {
      type: Boolean,
      default: false
    },
    notifyAdminOnNewcustomer: {
      type: Boolean,
      default: true
    },
    notifyAdminOnSubscription: {
      type: Boolean,
      default: true
    }
  },

  // ==========================================
  // STRIPE SETTINGS
  // ==========================================
  stripeSettings: {
    publicKey: String,
    secretKey: String,
    webhookSecret: String
  },

  // ==========================================
  // LEMON SQUEEZY SETTINGS
  // ==========================================
  lemonSqueezySettings: {
    apiKey: String,
    storeId: String,
    webhookSecret: String,
    enabled: {
      type: Boolean,
      default: false
    }
  },

  // ==========================================
  // ACTIVE PAYMENT GATEWAY
  // ==========================================
  activePaymentGateway: {
    type: String,
    enum: ['stripe', 'lemonsqueezy', 'none'],
    default: 'stripe'
  },

  // ==========================================
  // MAINTENANCE MODE
  // ==========================================
  maintenanceMode: {
    enabled: {
      type: Boolean,
      default: false
    },
    message: {
      type: String,
      default: 'We are currently performing maintenance. Please check back soon.'
    },
    allowAdminAccess: {
      type: Boolean,
      default: true
    }
  },

  // ==========================================
  // SEO SETTINGS
  // ==========================================
  seoSettings: {
    googleAnalyticsId: {
      type: String,
      default: ''
    },
    googleSearchConsoleVerification: {
      type: String,
      default: ''
    },
    bingVerification: {
      type: String,
      default: ''
    },
    defaultOgImage: {
      type: String,
      default: ''
    },
    socialLinks: {
      twitter: { type: String, default: '' },
      facebook: { type: String, default: '' },
      linkedin: { type: String, default: '' },
      instagram: { type: String, default: '' },
      youtube: { type: String, default: '' }
    },
    socialLinksEnabled: {
      twitter: { type: Boolean, default: true },
      facebook: { type: Boolean, default: true },
      linkedin: { type: Boolean, default: true },
      instagram: { type: Boolean, default: true },
      youtube: { type: Boolean, default: true }
    },
    customSocialLinks: [{
      name: { type: String, default: '' },
      url: { type: String, default: '' },
      iconUrl: { type: String, default: '' },
      enabled: { type: Boolean, default: true }
    }],
    enableSitemap: {
      type: Boolean,
      default: true
    },
    robotsTxtCustom: {
      type: String,
      default: ''
    },
    customHeadScripts: {
      type: String,
      default: ''
    },
    enableSchemaMarkup: {
      type: Boolean,
      default: true
    }
  },

  // ==========================================
  // FEATURE FLAGS
  // ==========================================
  features: {
    enableCustomerSignup: {
      type: Boolean,
      default: true
    },
    enableLogin: {
      type: Boolean,
      default: true
    },
    enableAnalysis: {
      type: Boolean,
      default: true
    },
    enableSubscriptions: {
      type: Boolean,
      default: true
    },
    enableCustomRoles: {
      type: Boolean,
      default: true
    },
    enableActivityLogs: {
      type: Boolean,
      default: true
    }
  },

  // ==========================================
  // ETSY INTEGRATION SETTINGS
  // ==========================================
  etsySettings: {
    enabled: {
      type: Boolean,
      default: false
    },
    clientId: {
      type: String,
      default: ''
    },
    clientSecret: {
      type: String,
      default: ''
    },
    redirectUri: {
      type: String,
      default: ''
    },
    encryptionKey: {
      type: String,
      default: ''
    }
  },

  // ==========================================
  // GOOGLE SSO SETTINGS
  // ==========================================
  googleSSOSettings: {
    enabled: {
      type: Boolean,
      default: false
    },
    clientId: {
      type: String,
      default: ''
    },
    clientSecret: {
      type: String,
      default: ''
    }
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp
adminSettingsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to get settings
adminSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne().sort({ _id: 1 });
  
  if (!settings) {
    // Create with default values to ensure nested defaults are applied
    settings = await this.create({
      siteName: 'My Platform',
      siteDescription: 'AI-powered platform',
      customerSettings: {
        blockedTemporaryEmailDomains: [
          // 10 Minute Mail variants
          '10minutemail.com', '10minutemail.net', '10minutesmail.com', '10minemail.com',
          // Guerrilla Mail variants
          'guerrillamail.com', 'guerrillamail.org', 'guerrillamail.net', 'guerrillamail.biz',
          'sharklasers.com', 'grr.la', 'guerrillamailblock.com',
          // Mailinator variants
          'mailinator.com', 'mailinator2.com', 'mailinator.net',
          // Temp Mail variants
          'temp-mail.org', 'tempmail.com', 'tempmail.net', 'tempmail.io',
          'temp-email.org', 'temp-email.net', 'tempemail.net',
          // Throwaway Mail variants
          'throwaway.email', 'throwawaymail.com', 'throwaway.top', 'throwaway.me',
          'throwawaymail.net', 'throwawaymail.org',
          // Yopmail variants
          'yopmail.com', 'yopmail.net', 'yopmail.fr', 'yopmail.de', 'yopmail.es',
          'yopmail.it', 'yopmail.jp', 'yopmail.com.br', 'yopmail.at', 'yopmail.ch',
          'yopmail.ru',
          // Fake Mail variants
          'fake-mail.com', 'fakemail.net', 'fakemail.com', 'fakeinbox.com',
          // Trash Mail
          'trashmail.com', 'trashmail.net', 'trash-mail.com', 'trash-mail.net',
          // Mail variants
          'mailnesia.com', 'emailondeck.com', 'mintemail.com', 'mytemp.email',
          'tempinbox.com', 'dispostable.com', 'emailtemporanea.net',
          'burnermail.io', 'burner.email', 'burnerin.com',
          // Nada variants
          'getnada.com', 'nada.email', 'nadamail.com', 'nada.fr',
          // Mail Catch variants
          'mohmal.com', 'mailcatch.com', 'anonbox.net',
          // Spam & Trash variants
          'spam4.me', 'mailforspam.com', 'spamgourmet.com', 'spambox.us',
          'spamfree24.org', 'crazymailing.com', 'smellfear.com',
          // Mail Express variants
          'mailexpire.com', 'mailsac.com', 'tempr.email',
          // Harakiri Mail variants
          'harakirimail.com', 'mail.tm', 'mailtm.com',
          // Pokemail variants
          'pokemail.net', 'pokemail.com',
          // Mail variants
          'maildrop.cc', 'maildrop.com', 'maildrop.net',
          // Email Temporaire
          'mail-temporaire.fr', 'mail-temporaire.com',
          // Disposable Email variants
          'dispostable.com', 'disposableemailaddresses.com', 'disposeamail.com',
          'disposemail.com', 'disposable.email',
          // T-mail variants
          'tmail.ws', 'tmail.com', 'tmails.net', 'tafmail.com',
          // Temp Sky variants
          'moakt.com', 'tempsky.com', 'clrmail.com', 'freemail.ms',
          'emailnax.com', 'devnullmail.com', 'inboxbear.com',
          // Mail ZI variants
          'mailzi.ru', 'mailzi.com',
          // Temporary Email aliases
          'temp.email', 'temporary.email', 'tempory.email', 'tempoemail.com',
          'temporarymail.com', 'temporaryemail.com', 'temporaryinbox.com',
          // Drop Mail variants
          'dropmail.me', 'dropmyemail.com',
          // Email In Box variants
          'emailinbox.com',
          // Spam4me variants
          'spam.la', 'spambox.com', 'spamfree.org',
          // Mail Fragment variants
          'maildrop.xyz',
          // 1secMail variants
          '1secmail.com', '1secmail.net', '1secmail.org', 'secondmail.com',
          // Temp-SMS
          'tempmail.email', 'tempsms.com', 'temporaryphone.com',
          // Get Ring variants
          'getring.com', 'ringring.jp', 'tempnote.com',
          // Mail Cloud variants
          'guerrillamail.info', 'mail.tm', 'tempmail.pro',
          // SMS Receive variants
          'smstempmail.com', 'sms-temp-mail.com',
          // Other common temp mail services
          'mailslite.com', 'mailsilo.com', 'mailstro.com',
          'sharp-secure.com', 'vpn.sc', 'temp.sh',
          'protomail.com', 'protonmail.com',
          'keepmail.me', 'keepmymail.com',
          'vpn.email', 'vpnadmin.email',
          'temp.0box.eu', 'inbox.tm',
          'privateemail.com', 'proton.me',
          'nonbusimail.com',
          // More variants
          'mytrashmail.com', 'yeet.cc', 'mooo.com', 'guerrillamail.xyz',
          'email.com.ve', 'temp-mail.io', 'mail.cx',
          'trash.email',
          'binkmail.com',
          'getnada.com',
          'minutemail.com',
          'junk.to',
          'spam-me.com',
          'spamspot.com',
          'spam123.com', 'spam321.com',
          '5minutemail.com',
          '5minutemail.net',
          'shorttermmail.com',
          'tempinbox.com',
          'inbox.cultparade.in'
        ]
      }
    });
  }
  
  return settings;
};

const AdminSettings = mongoose.model('AdminSettings', adminSettingsSchema);

module.exports = AdminSettings;
