/**
 * Etsy API Service
 * 
 * Wraps all Etsy Open API v3 calls with:
 * - Automatic key rotation via keyPoolService
 * - Token refresh on 401 (lazy refresh)
 * - Token revocation detection (graceful degradation)
 * - Structured { success, data, error } responses
 * 
 * Usage:
 *   const etsyApi = require('../../services/etsy/etsyApiService');
 * 
 *   // Public endpoint (uses key pool, no user token)
 *   const result = await etsyApi.publicRequest('GET', '/v3/application/shops/12345');
 * 
 *   // Authenticated endpoint (uses user's OAuth token)
 *   const result = await etsyApi.authenticatedRequest(etsyShop, 'GET', '/v3/application/shops/me/listings');
 */

const { EtsyShop } = require('../../models/integrations');
const { getNextKey, handleRateLimit, handleKeyError } = require('./keyPoolService');
const { encrypt, decrypt } = require('../../utils/encryption');
const AdminSettings = require('../../models/admin/AdminSettings');
const rateLimiter = require('./rateLimiter');
const log = require('../../utils/logger')('EtsyAPI');

const ETSY_API_BASE = 'https://openapi.etsy.com';
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000; // exponential backoff base

/**
 * Make a public Etsy API request (no OAuth token, uses API key from pool).
 * 
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} path - API path (e.g., '/v3/application/shops/12345')
 * @param {Object} [options] - { params, body }
 * @returns {Object} { success: true, data } or { success: false, error, code }
 */
const publicRequest = async (method, path, options = {}) => {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let key;

    try {
      key = await getNextKey();
      log.info(`publicRequest: key acquired (label=${key.label})`);
    } catch (err) {
      log.error('publicRequest: NO API KEYS AVAILABLE -', err.message);
      return { success: false, error: 'No API keys available', code: 'NO_KEYS_AVAILABLE' };
    }

    try {
      // Respect Etsy's 5 QPS / 5K QPD limits
      await rateLimiter.acquire();

      const url = buildUrl(path, options.params);
      log.info(`publicRequest: ${method} ${url} (attempt ${attempt + 1}/${MAX_RETRIES + 1})`);

      if (!key.sharedSecret) {
        log.error(`publicRequest: sharedSecret is EMPTY for key label="${key.label}" — Etsy will reject this with 403`);
      }
      const apiKeyHeader = `${key.apiKey}:${key.sharedSecret || ''}`;

      const response = await fetch(url, {
        method,
        headers: {
          'x-api-key': apiKeyHeader,
          'Content-Type': 'application/json',
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      });

      log.info(`publicRequest: ${method} ${path} → HTTP ${response.status} ${response.statusText}`);

      // Rate limited — retry with exponential backoff
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '5', 10);
        await handleRateLimit(key._id, retryAfter);

        if (attempt < MAX_RETRIES) {
          const backoffMs = Math.min(retryAfter * 1000, RETRY_BASE_MS * Math.pow(2, attempt));
          log.warn(`429 on ${path} — retry ${attempt + 1}/${MAX_RETRIES} in ${backoffMs}ms`);
          await sleep(backoffMs);
          continue;
        }
        log.error(`429 on ${path} — all ${MAX_RETRIES} retries exhausted`);
        return { success: false, error: 'Rate limited after retries', code: 'RATE_LIMITED' };
      }

      // Server error — retry with backoff
      if (response.status >= 500) {
        await handleKeyError(key._id, `Etsy ${response.status}: ${response.statusText}`);

        if (attempt < MAX_RETRIES) {
          const backoffMs = RETRY_BASE_MS * Math.pow(2, attempt);
          log.warn(`${response.status} on ${path} — retry ${attempt + 1}/${MAX_RETRIES} in ${backoffMs}ms`);
          await sleep(backoffMs);
          continue;
        }
        log.error(`${response.status} on ${path} — all ${MAX_RETRIES} retries exhausted`);
        return { success: false, error: 'Etsy server error after retries', code: 'ETSY_SERVER_ERROR' };
      }

      // Client error (4xx except 429) — don't retry
      if (!response.ok) {
        const errorBody = await safeParseJson(response);
        log.error(`${method} ${path} → ${response.status}: ${JSON.stringify(errorBody?.error || response.statusText)}`);
        return {
          success: false,
          error: errorBody?.error || response.statusText,
          code: 'ETSY_CLIENT_ERROR',
          status: response.status,
        };
      }

      const data = await response.json();
      log.info(`publicRequest: ${method} ${path} → SUCCESS (results=${data?.count || data?.results?.length || 'n/a'})`);
      return { success: true, data };

    } catch (err) {
      if (key) {
        await handleKeyError(key._id, err.message);
      }
      // Network errors — retry
      if (attempt < MAX_RETRIES) {
        const backoffMs = RETRY_BASE_MS * Math.pow(2, attempt);
        log.warn(`Network error on ${path} — retry ${attempt + 1}/${MAX_RETRIES} in ${backoffMs}ms: ${err.message}`);
        await sleep(backoffMs);
        continue;
      }
      log.error(`Network error on ${path} — all retries exhausted: ${err.message}`);
      return { success: false, error: err.message, code: 'NETWORK_ERROR' };
    }
  }
};

/**
 * Make an authenticated Etsy API request using a user's OAuth token.
 * Handles 401 → token refresh → retry, and revocation detection.
 * 
 * @param {Object} etsyShop - The user's EtsyShop document (from req.etsyShop)
 * @param {string} method - HTTP method
 * @param {string} path - API path
 * @param {Object} [options] - { params, body }
 * @returns {Object} { success: true, data } or { success: false, error, code }
 */
const authenticatedRequest = async (etsyShop, method, path, options = {}) => {
  let key;
  let apiKeyHeader;

  // Try key pool first, fall back to OAuth config from AdminSettings
  try {
    key = await getNextKey();
    apiKeyHeader = `${key.apiKey}:${key.sharedSecret || ''}`;
    log.info(`authRequest: key acquired (label=${key.label})`);
  } catch (err) {
    log.warn('authRequest: key pool empty, falling back to AdminSettings -', err.message);
    try {
      const settings = await AdminSettings.getSettings();
      const etsy = settings?.etsySettings || {};
      const clientId = etsy.clientId || process.env.ETSY_CLIENT_ID;
      if (!clientId) {
        log.error('authRequest: NO API KEYS - pool empty AND no AdminSettings/env clientId');
        return { success: false, error: 'No API keys available', code: 'NO_KEYS_AVAILABLE' };
      }
      const clientSecret = etsy.clientSecret || process.env.ETSY_CLIENT_SECRET || '';
      apiKeyHeader = `${clientId}:${clientSecret}`;
      log.info('authRequest: using AdminSettings clientId as fallback');
    } catch {
      log.error('authRequest: NO API KEYS - pool empty AND AdminSettings query failed');
      return { success: false, error: 'No API keys available', code: 'NO_KEYS_AVAILABLE' };
    }
  }

  let currentAccessToken = decrypt(etsyShop.accessToken_enc);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Respect Etsy's 5 QPS / 5K QPD limits
      await rateLimiter.acquire();

      const url = buildUrl(path, options.params);

      // Build headers — skip Content-Type for formData (let fetch set multipart boundary)
      const baseHeaders = {
        'x-api-key': apiKeyHeader,
        'Authorization': `Bearer ${currentAccessToken}`,
      };
      if (!options.formData) {
        baseHeaders['Content-Type'] = 'application/json';
      }

      // Build body
      let fetchBody;
      if (options.formData) {
        fetchBody = options.formData;
      } else if (options.body) {
        fetchBody = JSON.stringify(options.body);
      }

      let response = await fetch(url, {
        method,
        headers: options.formData
          ? { ...baseHeaders, ...options.formData.getHeaders?.() }
          : baseHeaders,
        ...(fetchBody ? { body: fetchBody } : {}),
      });

      log.info(`authRequest: ${method} ${path} → HTTP ${response.status} ${response.statusText}`);

      // Token expired — attempt one refresh (only on first attempt)
      if (response.status === 401 && attempt === 0) {
        log.warn(`authRequest: 401 on ${path} — attempting token refresh for shop ${etsyShop.shopId}`);
        // client_id for token refresh must be just the keystring, not keystring:secret
        const clientId = key ? key.apiKey : (apiKeyHeader.split(':')[0]);
        const refreshResult = await attemptTokenRefresh(etsyShop, clientId);

        if (!refreshResult.success) {
          await etsyShop.revokeTokens();
          log.error(`Token revoked for shop ${etsyShop.shopId} (user ${etsyShop.userId}) — refresh failed`);
          return { success: false, error: 'Etsy connection expired', code: 'SHOP_TOKEN_REVOKED' };
        }

        currentAccessToken = refreshResult.accessToken;
        await rateLimiter.acquire();

        const retryHeaders = {
          'x-api-key': apiKeyHeader,
          'Authorization': `Bearer ${currentAccessToken}`,
        };
        if (!options.formData) {
          retryHeaders['Content-Type'] = 'application/json';
        }

        response = await fetch(url, {
          method,
          headers: options.formData
            ? { ...retryHeaders, ...options.formData.getHeaders?.() }
            : retryHeaders,
          ...(fetchBody ? { body: fetchBody } : {}),
        });

        if (response.status === 401) {
          await etsyShop.revokeTokens();
          return { success: false, error: 'Etsy connection expired', code: 'SHOP_TOKEN_REVOKED' };
        }
      }

      // Rate limited — retry with exponential backoff
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '5', 10);
        if (key) await handleRateLimit(key._id, retryAfter);

        if (attempt < MAX_RETRIES) {
          const backoffMs = Math.min(retryAfter * 1000, RETRY_BASE_MS * Math.pow(2, attempt));
          log.warn(`authRequest: 429 on ${path} — retry ${attempt + 1}/${MAX_RETRIES} in ${backoffMs}ms`);
          await sleep(backoffMs);
          continue;
        }
        log.error(`authRequest: 429 on ${path} — all ${MAX_RETRIES} retries exhausted`);
        return { success: false, error: 'Rate limited after retries', code: 'RATE_LIMITED' };
      }

      // Server error — retry with backoff
      if (response.status >= 500) {
        if (key) await handleKeyError(key._id, `Etsy ${response.status}: ${response.statusText}`);

        if (attempt < MAX_RETRIES) {
          const backoffMs = RETRY_BASE_MS * Math.pow(2, attempt);
          log.warn(`authRequest: ${response.status} on ${path} — retry ${attempt + 1}/${MAX_RETRIES} in ${backoffMs}ms`);
          await sleep(backoffMs);
          continue;
        }
        log.error(`authRequest: ${response.status} on ${path} — all retries exhausted`);
        return { success: false, error: 'Etsy server error after retries', code: 'ETSY_SERVER_ERROR' };
      }

      // Other client errors — don't retry
      if (!response.ok) {
        const errorBody = await safeParseJson(response);
        log.error(`authRequest: ${method} ${path} → ${response.status}: ${JSON.stringify(errorBody?.error || response.statusText)}`);
        return {
          success: false,
          error: errorBody?.error || response.statusText,
          code: 'ETSY_CLIENT_ERROR',
          status: response.status,
        };
      }

      const data = await response.json();
      log.info(`authRequest: ${method} ${path} → SUCCESS`);
      return { success: true, data };

    } catch (err) {
      if (key) {
        await handleKeyError(key._id, err.message);
      }
      if (attempt < MAX_RETRIES) {
        const backoffMs = RETRY_BASE_MS * Math.pow(2, attempt);
        log.warn(`authRequest: Network error on ${path} — retry ${attempt + 1}/${MAX_RETRIES} in ${backoffMs}ms: ${err.message}`);
        await sleep(backoffMs);
        continue;
      }
      log.error(`authRequest: ${method} ${path} network error: ${err.message}`);
      return { success: false, error: err.message, code: 'NETWORK_ERROR' };
    }
  }
};

/**
 * Attempt to refresh the user's OAuth token.
 * On success, updates the EtsyShop document with new encrypted tokens.
 * 
 * @param {Object} etsyShop - The user's EtsyShop document
 * @param {string} apiKey - Decrypted API key (acts as client_id for Etsy)
 * @returns {Object} { success: true, accessToken } or { success: false }
 */
const attemptTokenRefresh = async (etsyShop, apiKey) => {
  try {
    const refreshToken = decrypt(etsyShop.refreshToken_enc);

    const response = await fetch('https://api.etsy.com/v3/public/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: apiKey,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      return { success: false };
    }

    const tokenData = await response.json();

    // Update shop with new encrypted tokens
    etsyShop.accessToken_enc = encrypt(tokenData.access_token);
    etsyShop.refreshToken_enc = encrypt(tokenData.refresh_token);
    etsyShop.tokenExpiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
    etsyShop.status = 'active';
    await etsyShop.save();

    return { success: true, accessToken: tokenData.access_token };

  } catch (err) {
    log.error('Token refresh error:', err.message);
    return { success: false };
  }
};

// --- Helpers ---

/**
 * Build a full URL from path and query params.
 */
const buildUrl = (path, params) => {
  const url = new URL(path, ETSY_API_BASE);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });
  }
  return url.toString();
};

/**
 * Safely parse JSON from a response, returning null on failure.
 */
const safeParseJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

module.exports = { publicRequest, authenticatedRequest };

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
