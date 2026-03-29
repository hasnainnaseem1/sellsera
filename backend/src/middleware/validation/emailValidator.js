const log = require('../../utils/logger')('EmailValidator');
const dns = require('dns').promises;
const AdminSettings = require('../../models/admin/AdminSettings');

/**
 * Well-known, trusted email domains that should NEVER be blocked.
 * These bypass the blocked-domains list AND the MX-record check.
 */
// Runtime cache — populated from DB if helper functions are called directly
let TEMP_EMAIL_DOMAINS = [];

const TRUSTED_DOMAINS = new Set([
  // Google
  'gmail.com', 'googlemail.com', 'google.com',
  // Microsoft
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'outlook.co.uk',
  'hotmail.co.uk', 'hotmail.fr', 'hotmail.de', 'hotmail.it', 'hotmail.es',
  'outlook.de', 'outlook.fr', 'outlook.es', 'outlook.it',
  // Yahoo
  'yahoo.com', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de', 'yahoo.it',
  'yahoo.es', 'yahoo.co.jp', 'yahoo.ca', 'yahoo.com.au', 'yahoo.co.in',
  'ymail.com', 'rocketmail.com',
  // Apple
  'icloud.com', 'me.com', 'mac.com',
  // Zoho
  'zoho.com', 'zohomail.com',
  // ProtonMail
  'protonmail.com', 'proton.me', 'pm.me',
  // AOL
  'aol.com',
  // GMX
  'gmx.com', 'gmx.de', 'gmx.net',
  // Mail.com
  'mail.com', 'email.com',
  // Fastmail
  'fastmail.com', 'fastmail.fm',
  // Tutanota
  'tutanota.com', 'tutamail.com', 'tuta.io',
]);

/**
 * Validate email and check if it's from a temporary email service
 */
const validateEmail = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return next(); // Let the route handler handle missing email
    }

    // Extract domain from email
    const domain = email.toLowerCase().split('@')[1];
    
    if (!domain) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Trusted domains always pass — no further checks needed
    if (TRUSTED_DOMAINS.has(domain)) {
      return next();
    }

    // Get blocked domains from settings
    const settings = await AdminSettings.getSettings();
    const allowTemporaryEmails = settings.customerSettings?.allowTemporaryEmails === true;

    // If admin has enabled temporary emails, skip all blocking checks
    if (allowTemporaryEmails) {
      return next();
    }

    const blockedDomains = settings.customerSettings?.blockedTemporaryEmailDomains || [];

    // Check against temporary email domains list from settings
    if (blockedDomains.includes(domain)) {
      return res.status(400).json({
        success: false,
        message: 'Temporary or disposable email addresses are not allowed. Please use a permanent email address.',
        errorCode: 'TEMP_EMAIL_NOT_ALLOWED'
      });
    }

    // Verify domain has valid MX records (best-effort — don't block on DNS failure)
    try {
      await dns.resolveMx(domain);
    } catch (dnsError) {
      // DNS lookup failed — log a warning but allow the signup to proceed.
      // Blocking on DNS failure rejects legitimate domains when the server
      // has connectivity issues or restrictive DNS settings.
      log.warn(`MX lookup failed for ${domain}: ${dnsError.message} — allowing anyway`);
    }

    next();
  } catch (error) {
    log.error('Email validation error:', error.message);
    // Don't block the request if validation fails
    // Let it proceed and handle errors downstream
    next();
  }
};

/**
 * Check if email is temporary (for use in routes)
 */
const isTemporaryEmail = (email) => {
  const domain = email.toLowerCase().split('@')[1];
  return TEMP_EMAIL_DOMAINS.includes(domain);
};

/**
 * Add custom temporary email domain
 */
const addTempEmailDomain = (domain) => {
  if (!TEMP_EMAIL_DOMAINS.includes(domain.toLowerCase())) {
    TEMP_EMAIL_DOMAINS.push(domain.toLowerCase());
  }
};

/**
 * Remove temporary email domain from blocklist
 */
const removeTempEmailDomain = (domain) => {
  const index = TEMP_EMAIL_DOMAINS.indexOf(domain.toLowerCase());
  if (index > -1) {
    TEMP_EMAIL_DOMAINS.splice(index, 1);
  }
};

/**
 * Get all blocked domains
 */
const getBlockedDomains = () => {
  return [...TEMP_EMAIL_DOMAINS];
};

module.exports = {
  validateEmail,
  isTemporaryEmail,
  addTempEmailDomain,
  removeTempEmailDomain,
  getBlockedDomains
};
