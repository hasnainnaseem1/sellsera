/**
 * Etsy OAuth Service
 * 
 * Handles Etsy OAuth2 + PKCE flow for connecting user shops.
 * 
 * Flow:
 * 1. generateAuthUrl() → Authorization URL with PKCE challenge
 * 2. exchangeCodeForTokens() → Exchange auth code for access/refresh tokens
 * 3. Tokens encrypted via AES-256-GCM and stored in EtsyShop model
 * 
 * Credentials are read from AdminSettings DB first, with env var fallback:
 *   DB: AdminSettings.etsySettings.clientId / clientSecret / redirectUri / encryptionKey
 *   Env: ETSY_CLIENT_ID / ETSY_CLIENT_SECRET / ETSY_REDIRECT_URI / ENCRYPTION_KEY
 * 
 * Usage:
 *   const oauthService = require('../../services/etsy/oauthService');
 *   const { authUrl, state, codeVerifier } = await oauthService.generateAuthUrl();
 *   const tokens = await oauthService.exchangeCodeForTokens(code, codeVerifier);
 */

const crypto = require('crypto');
const { EtsyShop } = require('../../models/integrations');
const { encrypt } = require('../../utils/encryption');
const AdminSettings = require('../../models/admin/AdminSettings');

const ETSY_AUTH_URL = 'https://www.etsy.com/oauth/connect';
const ETSY_TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token';

// Scopes needed for Sellsera features
const SCOPES = [
  'shops_r',        // Read shop info
  'listings_r',     // Read listings
  'transactions_r', // Read orders/receipts for delivery tracking
  'profile_r',      // Read user profile
];

// Cache to avoid DB reads on every request (5 min TTL)
let _cachedConfig = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get Etsy config from AdminSettings with env var fallback.
 * @returns {{ clientId: string, clientSecret: string, redirectUri: string }}
 */
const getEtsyConfig = async () => {
  const now = Date.now();
  if (_cachedConfig && (now - _cacheTime) < CACHE_TTL) {
    return _cachedConfig;
  }

  try {
    const settings = await AdminSettings.getSettings();
    const etsy = settings.etsySettings || {};

    _cachedConfig = {
      clientId: etsy.clientId || process.env.ETSY_CLIENT_ID || '',
      clientSecret: etsy.clientSecret || process.env.ETSY_CLIENT_SECRET || '',
      redirectUri: etsy.redirectUri || process.env.ETSY_REDIRECT_URI || '',
    };
  } catch {
    // DB unavailable — fall back to env vars entirely
    _cachedConfig = {
      clientId: process.env.ETSY_CLIENT_ID || '',
      clientSecret: process.env.ETSY_CLIENT_SECRET || '',
      redirectUri: process.env.ETSY_REDIRECT_URI || '',
    };
  }

  _cacheTime = now;
  return _cachedConfig;
};

/**
 * Generate PKCE code verifier and challenge.
 * @returns {{ codeVerifier: string, codeChallenge: string }}
 */
const generatePKCE = () => {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
};

/**
 * Generate the Etsy OAuth authorization URL with PKCE.
 * Now async — reads credentials from DB.
 * 
 * @returns {Promise<{ authUrl: string, state: string, codeVerifier: string }>}
 */
const generateAuthUrl = async () => {
  const config = await getEtsyConfig();

  if (!config.clientId) {
    throw new Error('Etsy Client ID is not configured. Set it in Admin → Integrations → Etsy.');
  }
  if (!config.redirectUri) {
    throw new Error('Etsy Redirect URI is not configured. Set it in Admin → Integrations → Etsy.');
  }

  const state = crypto.randomBytes(16).toString('hex');
  const { codeVerifier, codeChallenge } = generatePKCE();

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: SCOPES.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  const authUrl = `${ETSY_AUTH_URL}?${params.toString()}`;

  return { authUrl, state, codeVerifier };
};

/**
 * Exchange authorization code for access + refresh tokens.
 * 
 * @param {string} code - Authorization code from Etsy callback
 * @param {string} codeVerifier - PKCE code verifier from the original auth request
 * @returns {{ accessToken: string, refreshToken: string, expiresIn: number }}
 */
const exchangeCodeForTokens = async (code, codeVerifier) => {
  const config = await getEtsyConfig();

  const response = await fetch(ETSY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      code,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error(`[${new Date().toISOString()}] [EtsyOAuth] Token exchange failed:`, response.status, JSON.stringify(error));
    throw new Error(error.error_description || `Token exchange failed (HTTP ${response.status})`);
  }

  const tokenData = await response.json();

  if (!tokenData.access_token) {
    console.error(`[${new Date().toISOString()}] [EtsyOAuth] Token response missing access_token:`, JSON.stringify(tokenData));
    throw new Error('Etsy returned no access token');
  }

  console.log(`[${new Date().toISOString()}] [EtsyOAuth] Token exchange success — token_type: ${tokenData.token_type}, expires_in: ${tokenData.expires_in}, has_access_token: ${!!tokenData.access_token}, has_refresh_token: ${!!tokenData.refresh_token}`);

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresIn: tokenData.expires_in,
  };
};

/**
 * Fetch the authenticated user's shop info from Etsy.
 * 
 * @param {string} accessToken - Plaintext access token
 * @returns {{ shopId: string, shopName: string, iconUrl: string, shopUrl: string, currencyCode: string, listingCount: number, totalSales: number }}
 */
const fetchShopInfo = async (accessToken) => {
  const config = await getEtsyConfig();

  console.log(`[${new Date().toISOString()}] [EtsyOAuth] Calling /users/me with x-api-key: ${config.clientId.substring(0, 8)}...:***`);

  // First get the Etsy user ID
  // Etsy API v3 requires x-api-key in format "keystring:sharedsecret"
  const apiKeyHeader = `${config.clientId}:${config.clientSecret}`;
  const meResponse = await fetch('https://openapi.etsy.com/v3/application/users/me', {
    headers: {
      'x-api-key': apiKeyHeader,
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!meResponse.ok) {
    const errBody = await meResponse.text().catch(() => '');
    console.error(`[${new Date().toISOString()}] [EtsyOAuth] /users/me failed:`, meResponse.status, errBody);
    throw new Error(`Failed to fetch Etsy user info (HTTP ${meResponse.status})`);
  }

  const meData = await meResponse.json();
  const etsyUserId = meData.user_id;

  // Then get their shop
  const shopResponse = await fetch(`https://openapi.etsy.com/v3/application/users/${etsyUserId}/shops`, {
    headers: {
      'x-api-key': apiKeyHeader,
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!shopResponse.ok) {
    const errBody = await shopResponse.text().catch(() => '');
    console.error(`[${new Date().toISOString()}] [EtsyOAuth] /shops failed:`, shopResponse.status, errBody);
    throw new Error('Failed to fetch Etsy shop info. Make sure you have an active Etsy shop.');
  }

  const shopData = await shopResponse.json();

  if (!shopData.results || shopData.results.length === 0) {
    throw new Error('No Etsy shop found for this account');
  }

  const shop = shopData.results[0];

  return {
    shopId: String(shop.shop_id),
    shopName: shop.shop_name,
    iconUrl: shop.icon_url_fullxfull || null,
    shopUrl: shop.url || null,
    currencyCode: shop.currency_code || 'USD',
    listingCount: shop.listing_active_count || 0,
    totalSales: shop.transaction_sold_count || 0,
  };
};

/**
 * Connect a user's Etsy shop (or reconnect if previously revoked).
 * Creates or updates the EtsyShop document with encrypted tokens.
 * 
 * @param {string} userId - The Sellsera user's _id
 * @param {string} code - Authorization code from callback
 * @param {string} codeVerifier - PKCE code verifier
 * @returns {Object} The created/updated EtsyShop document
 */
const connectShop = async (userId, code, codeVerifier) => {
  // Exchange code for tokens
  const { accessToken, refreshToken, expiresIn } = await exchangeCodeForTokens(code, codeVerifier);

  // Fetch shop info using the new token
  const shopInfo = await fetchShopInfo(accessToken);

  // Check if user already has a shop record (reconnection case)
  let etsyShop = await EtsyShop.findOne({ userId });

  if (etsyShop) {
    // Reconnecting — update with fresh tokens
    await etsyShop.reauthorize(
      encrypt(accessToken),
      encrypt(refreshToken),
      new Date(Date.now() + (expiresIn * 1000))
    );
    // Update shop metadata in case it changed
    etsyShop.shopId = shopInfo.shopId;
    etsyShop.shopName = shopInfo.shopName;
    etsyShop.listingCount = shopInfo.listingCount;
    etsyShop.totalSales = shopInfo.totalSales;
    etsyShop.shopMetadata = {
      iconUrl: shopInfo.iconUrl,
      shopUrl: shopInfo.shopUrl,
      currencyCode: shopInfo.currencyCode,
    };
    await etsyShop.save();
  } else {
    // First-time connection
    etsyShop = await EtsyShop.create({
      userId,
      shopId: shopInfo.shopId,
      shopName: shopInfo.shopName,
      accessToken_enc: encrypt(accessToken),
      refreshToken_enc: encrypt(refreshToken),
      tokenExpiresAt: new Date(Date.now() + (expiresIn * 1000)),
      status: 'active',
      listingCount: shopInfo.listingCount,
      totalSales: shopInfo.totalSales,
      shopMetadata: {
        iconUrl: shopInfo.iconUrl,
        shopUrl: shopInfo.shopUrl,
        currencyCode: shopInfo.currencyCode,
      },
    });
  }

  return etsyShop;
};

module.exports = { generateAuthUrl, exchangeCodeForTokens, fetchShopInfo, connectShop };
