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

const ETSY_API_BASE = 'https://openapi.etsy.com';

/**
 * Make a public Etsy API request (no OAuth token, uses API key from pool).
 * 
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} path - API path (e.g., '/v3/application/shops/12345')
 * @param {Object} [options] - { params, body }
 * @returns {Object} { success: true, data } or { success: false, error, code }
 */
const publicRequest = async (method, path, options = {}) => {
  let key;

  try {
    key = await getNextKey();
  } catch (err) {
    return { success: false, error: 'No API keys available', code: 'NO_KEYS_AVAILABLE' };
  }

  try {
    const url = buildUrl(path, options.params);

    const response = await fetch(url, {
      method,
      headers: {
        'x-api-key': `${key.apiKey}:${key.sharedSecret}`,
        'Content-Type': 'application/json',
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });

    // Rate limited
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
      await handleRateLimit(key._id, retryAfter);
      return { success: false, error: 'Rate limited', code: 'RATE_LIMITED' };
    }

    // Server error
    if (response.status >= 500) {
      await handleKeyError(key._id, `Etsy ${response.status}: ${response.statusText}`);
      return { success: false, error: 'Etsy server error', code: 'ETSY_SERVER_ERROR' };
    }

    // Client error
    if (!response.ok) {
      const errorBody = await safeParseJson(response);
      return {
        success: false,
        error: errorBody?.error || response.statusText,
        code: 'ETSY_CLIENT_ERROR',
        status: response.status,
      };
    }

    const data = await response.json();
    return { success: true, data };

  } catch (err) {
    if (key) {
      await handleKeyError(key._id, err.message);
    }
    return { success: false, error: err.message, code: 'NETWORK_ERROR' };
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

  try {
    key = await getNextKey();
  } catch (err) {
    return { success: false, error: 'No API keys available', code: 'NO_KEYS_AVAILABLE' };
  }

  const accessToken = decrypt(etsyShop.accessToken_enc);

  try {
    const url = buildUrl(path, options.params);

    let response = await fetch(url, {
      method,
      headers: {
        'x-api-key': `${key.apiKey}:${key.sharedSecret}`,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });

    // Token expired — attempt one refresh
    if (response.status === 401) {
      const refreshResult = await attemptTokenRefresh(etsyShop, key.apiKey);

      if (!refreshResult.success) {
        // Refresh failed — token revoked
        await etsyShop.revokeTokens();
        console.error(`[EtsyAPI] Token revoked for shop ${etsyShop.shopId} (user ${etsyShop.userId})`);
        return { success: false, error: 'Etsy connection expired', code: 'SHOP_TOKEN_REVOKED' };
      }

      // Retry with new access token
      response = await fetch(url, {
        method,
        headers: {
          'x-api-key': `${key.apiKey}:${key.sharedSecret}`,
          'Authorization': `Bearer ${refreshResult.accessToken}`,
          'Content-Type': 'application/json',
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      });

      // Still 401 after refresh — revoke
      if (response.status === 401) {
        await etsyShop.revokeTokens();
        return { success: false, error: 'Etsy connection expired', code: 'SHOP_TOKEN_REVOKED' };
      }
    }

    // Rate limited
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
      await handleRateLimit(key._id, retryAfter);
      return { success: false, error: 'Rate limited', code: 'RATE_LIMITED' };
    }

    // Server error
    if (response.status >= 500) {
      await handleKeyError(key._id, `Etsy ${response.status}: ${response.statusText}`);
      return { success: false, error: 'Etsy server error', code: 'ETSY_SERVER_ERROR' };
    }

    // Other client errors
    if (!response.ok) {
      const errorBody = await safeParseJson(response);
      return {
        success: false,
        error: errorBody?.error || response.statusText,
        code: 'ETSY_CLIENT_ERROR',
        status: response.status,
      };
    }

    const data = await response.json();
    return { success: true, data };

  } catch (err) {
    if (key) {
      await handleKeyError(key._id, err.message);
    }
    return { success: false, error: err.message, code: 'NETWORK_ERROR' };
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
    console.error('[EtsyAPI] Token refresh error:', err.message);
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
