/**
 * Upload URL Helper
 * 
 * Ensures upload URLs (/uploads/...) are stored as relative paths in the
 * database and resolved to full URLs at response time. This makes the
 * database environment-agnostic — the same data works in dev, staging,
 * and production without migration scripts.
 */

/**
 * Get the public base URL from an Express request.
 * Respects X-Forwarded-Proto / X-Forwarded-Host behind a reverse proxy
 * (requires app.set('trust proxy', ...) in Express).
 */
function getBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

/**
 * Get the public base URL from environment variables (for contexts
 * where there is no HTTP request, e.g. background jobs, email service).
 */
function getBaseUrlFromEnv() {
  return process.env.BACKEND_URL || process.env.API_URL || '';
}

/**
 * Strip the host portion from an upload URL, leaving only the path.
 *   "http://localhost:3001/uploads/logos/img.png" → "/uploads/logos/img.png"
 *   "/uploads/logos/img.png"                      → "/uploads/logos/img.png"
 *   "https://cdn.example.com/logo.png"            → "https://cdn.example.com/logo.png" (external, unchanged)
 *   ""                                            → ""
 */
function toRelativeUploadPath(url) {
  if (!url || typeof url !== 'string') return url;
  const idx = url.indexOf('/uploads/');
  if (idx !== -1) return url.substring(idx);
  return url; // external URL or empty — leave unchanged
}

/**
 * Deep-traverse a value (string / array / plain object) and resolve every
 * upload reference to a full URL.
 *
 * Handles:
 *   - Relative paths:  /uploads/logos/img.png
 *   - Old full URLs:   http://localhost:3001/uploads/logos/img.png
 *   - Embedded in HTML: <img src="http://localhost:3001/uploads/blog/img.png">
 *
 * Non-upload strings (external CDN URLs, plain text, etc.) are left untouched.
 */
const UPLOAD_URL_RE = /(?:https?:\/\/[^/\s"'<>]+)?\/uploads\//g;

function resolveUploadUrls(value, baseUrl) {
  if (!baseUrl) return value;

  if (typeof value === 'string') {
    if (!value.includes('/uploads/')) return value;
    return value.replace(UPLOAD_URL_RE, `${baseUrl}/uploads/`);
  }

  if (Array.isArray(value)) {
    return value.map(item => resolveUploadUrls(item, baseUrl));
  }

  if (value && typeof value === 'object' && !(value instanceof Date) && !(value._bsontype)) {
    const out = {};
    for (const key of Object.keys(value)) {
      out[key] = resolveUploadUrls(value[key], baseUrl);
    }
    return out;
  }

  return value;
}

/**
 * Convenience: resolve upload URLs using the current request's base URL.
 */
function resolveFromReq(value, req) {
  return resolveUploadUrls(value, getBaseUrl(req));
}

/**
 * Convenience: resolve upload URLs using environment variables
 * (for emails, background jobs, etc.).
 */
function resolveFromEnv(value) {
  return resolveUploadUrls(value, getBaseUrlFromEnv());
}

/**
 * Deep-traverse a value and strip hosts from all upload URLs, converting
 * them to relative paths. Use this before persisting to the database.
 */
function stripUploadHosts(value) {
  if (typeof value === 'string') {
    if (!value.includes('/uploads/')) return value;
    return value.replace(UPLOAD_URL_RE, '/uploads/');
  }

  if (Array.isArray(value)) {
    return value.map(item => stripUploadHosts(item));
  }

  if (value && typeof value === 'object' && !(value instanceof Date) && !(value._bsontype)) {
    const out = {};
    for (const key of Object.keys(value)) {
      out[key] = stripUploadHosts(value[key]);
    }
    return out;
  }

  return value;
}

module.exports = {
  getBaseUrl,
  getBaseUrlFromEnv,
  toRelativeUploadPath,
  resolveUploadUrls,
  resolveFromReq,
  resolveFromEnv,
  stripUploadHosts,
};
