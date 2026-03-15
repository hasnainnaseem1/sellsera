/**
 * Encryption Utility (AES-256-GCM)
 * 
 * Encrypts/decrypts sensitive data at rest (OAuth tokens, API keys).
 * Uses AES-256-GCM for authenticated encryption with integrity checks.
 * 
 * Storage format: iv:authTag:ciphertext (hex-encoded)
 * 
 * Requires env: ENCRYPTION_KEY (64 hex chars = 32 bytes)
 * 
 * Usage:
 *   const { encrypt, decrypt } = require('../utils/encryption');
 *   const encrypted = encrypt('my-secret-token');
 *   const plaintext = decrypt(encrypted);
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

// Cached key loaded from DB or env
let _cachedKeyHex = null;

/**
 * Initialize encryption key from AdminSettings DB (called once at startup or on first use).
 * Falls back to ENCRYPTION_KEY env var if DB has nothing.
 */
const initEncryptionKey = async () => {
  if (_cachedKeyHex) return;
  try {
    const AdminSettings = require('../models/admin/AdminSettings');
    const settings = await AdminSettings.getSettings();
    if (settings.etsySettings?.encryptionKey && settings.etsySettings.encryptionKey.length === 64) {
      _cachedKeyHex = settings.etsySettings.encryptionKey;
      return;
    }
  } catch {
    // DB not available yet, use env var
  }
  _cachedKeyHex = process.env.ENCRYPTION_KEY || null;
};

/**
 * Get the encryption key (validated).
 * @returns {Buffer} 32-byte key buffer
 */
const getKey = () => {
  const key = _cachedKeyHex || process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Set it in Admin → Integrations → Etsy or as an environment variable.');
  }
  return Buffer.from(key, 'hex');
};

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * @param {string} plaintext - The string to encrypt
 * @returns {string} Encrypted string in format iv:authTag:ciphertext (hex)
 */
const encrypt = (plaintext) => {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Plaintext must be a non-empty string');
  }

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

/**
 * Decrypt an encrypted string (AES-256-GCM).
 * @param {string} encryptedText - Encrypted string in format iv:authTag:ciphertext (hex)
 * @returns {string} Decrypted plaintext
 */
const decrypt = (encryptedText) => {
  if (!encryptedText || typeof encryptedText !== 'string') {
    throw new Error('Encrypted text must be a non-empty string');
  }

  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format (expected iv:authTag:ciphertext)');
  }

  const [ivHex, authTagHex, ciphertext] = parts;

  const key = getKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};

module.exports = { encrypt, decrypt, initEncryptionKey };
