/**
 * Etsy API Rate Limiter
 * 
 * Token-bucket rate limiter backed by Redis.
 * Enforces Etsy's 5 QPS and 5,000 QPD limits across all workers.
 * Falls back to in-memory limiter when Redis is unavailable.
 * 
 * Usage:
 *   const rateLimiter = require('./rateLimiter');
 *   await rateLimiter.acquire(); // blocks until a slot is available
 */

const redis = require('../cache/redisService');

const QPS_LIMIT = 5;
const QPD_LIMIT = 5000;
const QPS_WINDOW_MS = 1000;
const MAX_WAIT_MS = 30000; // max time to wait for a slot

// In-memory fallback when Redis is down
let memoryTokens = QPS_LIMIT;
let memoryLastRefill = Date.now();
let memoryDailyCount = 0;
let memoryDailyResetAt = getNextMidnight();

function getNextMidnight() {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.getTime();
}

/**
 * Acquire a rate-limit slot. Waits (with backoff) until a slot is free.
 * Throws if the daily limit is exhausted or max wait is exceeded.
 */
const acquire = async () => {
  if (redis.isReady()) {
    return acquireRedis();
  }
  return acquireMemory();
};

/**
 * Redis-backed sliding window.
 * Uses a sorted set with timestamps to track requests in the last 1s window.
 */
const acquireRedis = async () => {
  const client = redis.getClient();
  const qpsKey = 'etsy:ratelimit:qps';
  const qpdKey = 'etsy:ratelimit:qpd';
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_WAIT_MS) {
    // Check daily limit
    const dailyCount = parseInt(await client.get(qpdKey) || '0', 10);
    if (dailyCount >= QPD_LIMIT) {
      throw new Error('Etsy daily API quota exhausted (5,000 requests/day)');
    }

    const now = Date.now();
    const windowStart = now - QPS_WINDOW_MS;

    // Remove expired entries and count current window
    await client.zremrangebyscore(qpsKey, '-inf', windowStart);
    const currentCount = await client.zcard(qpsKey);

    if (currentCount < QPS_LIMIT) {
      // Add this request to the window
      await client.zadd(qpsKey, now, `${now}:${Math.random().toString(36).slice(2, 8)}`);
      await client.expire(qpsKey, 2); // auto-cleanup
      await client.incr(qpdKey);

      // Set QPD key expiry to midnight UTC if not set
      const ttl = await client.ttl(qpdKey);
      if (ttl < 0) {
        const secondsUntilMidnight = Math.ceil((getNextMidnight() - Date.now()) / 1000);
        await client.expire(qpdKey, Math.max(secondsUntilMidnight, 1));
      }

      return; // slot acquired
    }

    // Wait for the oldest entry to expire
    const oldest = await client.zrange(qpsKey, 0, 0, 'WITHSCORES');
    const waitMs = oldest.length >= 2
      ? Math.max(50, parseInt(oldest[1], 10) + QPS_WINDOW_MS - now + 10)
      : 200;

    await sleep(Math.min(waitMs, 500));
  }

  throw new Error('Rate limiter timeout — Etsy QPS limit sustained');
};

/**
 * In-memory token bucket fallback.
 */
const acquireMemory = async () => {
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_WAIT_MS) {
    // Reset daily counter at midnight
    if (Date.now() >= memoryDailyResetAt) {
      memoryDailyCount = 0;
      memoryDailyResetAt = getNextMidnight();
    }

    if (memoryDailyCount >= QPD_LIMIT) {
      throw new Error('Etsy daily API quota exhausted (5,000 requests/day)');
    }

    // Refill tokens
    const elapsed = Date.now() - memoryLastRefill;
    if (elapsed >= QPS_WINDOW_MS) {
      memoryTokens = QPS_LIMIT;
      memoryLastRefill = Date.now();
    }

    if (memoryTokens > 0) {
      memoryTokens--;
      memoryDailyCount++;
      return; // slot acquired
    }

    // Wait for token refill
    const waitMs = QPS_WINDOW_MS - (Date.now() - memoryLastRefill) + 10;
    await sleep(Math.min(waitMs, 500));
  }

  throw new Error('Rate limiter timeout — Etsy QPS limit sustained');
};

/**
 * Get current rate limit status (for monitoring/admin).
 */
const getStatus = async () => {
  if (redis.isReady()) {
    const client = redis.getClient();
    const qpsKey = 'etsy:ratelimit:qps';
    const qpdKey = 'etsy:ratelimit:qpd';
    const now = Date.now();

    await client.zremrangebyscore(qpsKey, '-inf', now - QPS_WINDOW_MS);
    const currentQps = await client.zcard(qpsKey);
    const dailyCount = parseInt(await client.get(qpdKey) || '0', 10);

    return {
      backend: 'redis',
      qps: { current: currentQps, limit: QPS_LIMIT },
      qpd: { current: dailyCount, limit: QPD_LIMIT },
    };
  }

  return {
    backend: 'memory',
    qps: { current: QPS_LIMIT - memoryTokens, limit: QPS_LIMIT },
    qpd: { current: memoryDailyCount, limit: QPD_LIMIT },
  };
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

module.exports = { acquire, getStatus };
