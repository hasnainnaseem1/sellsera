/**
 * Redis Service
 * 
 * Provides a getOrSet caching pattern for hot endpoints.
 * Falls back gracefully when Redis is unavailable (cache misses, no crashes).
 * 
 * Env vars:
 *   REDIS_URL — Redis connection URL (default: redis://localhost:6379)
 * 
 * Usage:
 *   const redis = require('../../services/cache/redisService');
 * 
 *   // Get or set with auto-expiry
 *   const data = await redis.getOrSet('kw:abc123', 21600, async () => {
 *     return await expensiveApiCall();
 *   });
 * 
 *   // Manual get/set/del
 *   await redis.set('key', { some: 'data' }, 300);
 *   const val = await redis.get('key');
 *   await redis.del('key');
 */

const Redis = require('ioredis');
const log = require('../../utils/logger')('Redis');

let client = null;
let isConnected = false;

/**
 * Get or create the Redis client (lazy singleton).
 */
const getClient = () => {
  if (client) return client;

  const url = process.env.REDIS_URL || 'redis://localhost:6379';

  client = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 3) return null; // Stop retrying after 3 attempts
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
  });

  client.on('connect', () => {
    isConnected = true;
    log.info('Connected');
  });

  client.on('error', (err) => {
    isConnected = false;
    log.error('Error:', err.message);
  });

  client.on('close', () => {
    isConnected = false;
  });

  // Attempt connection (non-blocking)
  client.connect().catch(() => {
    log.warn('Could not connect — caching disabled, falling back to direct queries');
  });

  return client;
};

/**
 * Get a cached value by key.
 * @param {string} key
 * @returns {*} Parsed JSON value or null
 */
const get = async (key) => {
  try {
    const redis = getClient();
    if (!isConnected) return null;
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
};

/**
 * Set a cached value with TTL.
 * @param {string} key
 * @param {*} value - Will be JSON.stringified
 * @param {number} ttlSeconds - Time to live in seconds
 */
const set = async (key, value, ttlSeconds) => {
  try {
    const redis = getClient();
    if (!isConnected) return;
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // Silent fail — cache is optional
  }
};

/**
 * Delete a cached key.
 * @param {string} key
 */
const del = async (key) => {
  try {
    const redis = getClient();
    if (!isConnected) return;
    await redis.del(key);
  } catch {
    // Silent fail
  }
};

/**
 * Delete all keys matching a pattern.
 * @param {string} pattern - e.g., "dash:*" or "usage:abc*"
 */
const delPattern = async (pattern) => {
  try {
    const redis = getClient();
    if (!isConnected) return;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Silent fail
  }
};

/**
 * Get or set pattern — check cache first, compute on miss.
 * @param {string} key
 * @param {number} ttlSeconds
 * @param {Function} fetchFn - Async function to compute the value on cache miss
 * @returns {*} Cached or freshly computed value
 */
const getOrSet = async (key, ttlSeconds, fetchFn) => {
  const cached = await get(key);
  if (cached !== null) return cached;

  const freshValue = await fetchFn();
  await set(key, freshValue, ttlSeconds);
  return freshValue;
};

/**
 * Check if Redis is connected.
 */
const isReady = () => isConnected;

module.exports = { get, set, del, delPattern, getOrSet, isReady, getClient };
