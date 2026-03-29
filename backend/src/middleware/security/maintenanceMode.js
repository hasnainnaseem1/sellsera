const log = require('../../utils/logger')('Maintenance');
/**
 * Maintenance Mode Middleware
 *
 * Checks if the platform is in maintenance mode and blocks non-admin requests.
 * Respects the `allowAdminAccess` flag — when true, authenticated admin requests
 * are allowed through even during maintenance.
 *
 * Returns 503 Service Unavailable with the configured maintenance message.
 *
 * Skipped paths:
 *  - Health check (/api/health)
 *  - Public site config (/api/v1/public/site) — so frontends can detect maintenance
 *  - Admin auth (/api/v1/auth/admin) — so admins can still log in
 *  - Admin settings (/api/v1/admin/settings) — so admins can disable maintenance
 */
const { AdminSettings } = require('../../models/admin');
const { User } = require('../../models/user');
const jwt = require('jsonwebtoken');

// Paths that are NEVER blocked by maintenance mode
const BYPASS_PATHS = [
  '/api/health',
  '/api/v1/public/site',
  '/api/v1/public/navigation',
  '/api/v1/auth/admin',
  '/api/v1/admin/settings/maintenance',
  '/api/v1/webhooks/stripe',
  '/api/v1/webhooks/lemonsqueezy',
];

// Cache to avoid hitting DB on every single request
let cachedSettings = null;
let cacheExpiry = 0;
const CACHE_TTL = 5000; // 5 seconds

const getMaintenanceSettings = async () => {
  const now = Date.now();
  if (cachedSettings && now < cacheExpiry) {
    return cachedSettings;
  }
  try {
    const settings = await AdminSettings.getSettings();
    cachedSettings = {
      enabled: settings.maintenanceMode?.enabled || false,
      message: settings.maintenanceMode?.message || 'We are currently performing maintenance. Please check back soon.',
      allowAdminAccess: settings.maintenanceMode?.allowAdminAccess !== false,
    };
    cacheExpiry = now + CACHE_TTL;
    return cachedSettings;
  } catch (err) {
    log.error('Error checking maintenance mode:', err.message);
    // Fail-open: don't block requests if we can't read settings
    return { enabled: false, message: '', allowAdminAccess: true };
  }
};

// Exported so settings route can bust the cache when maintenance is toggled
const bustMaintenanceCache = () => {
  cachedSettings = null;
  cacheExpiry = 0;
};

const maintenanceMiddleware = async (req, res, next) => {
  // Skip bypass paths
  const path = req.path;
  if (BYPASS_PATHS.some(bp => path.startsWith(bp))) {
    return next();
  }

  const maintenance = await getMaintenanceSettings();

  if (!maintenance.enabled) {
    return next();
  }

  // Maintenance is ON — check if admin access is allowed
  if (maintenance.allowAdminAccess) {
    // Try to extract and verify admin token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Look up the user to check accountType
        const user = await User.findById(decoded.userId).select('accountType').lean();
        if (user && user.accountType === 'admin') {
          return next();
        }
      } catch {
        // Invalid token — fall through to maintenance response
      }
    }
  }

  // Block the request
  return res.status(503).json({
    success: false,
    maintenance: true,
    message: maintenance.message,
  });
};

module.exports = { maintenanceMiddleware, bustMaintenanceCache };
