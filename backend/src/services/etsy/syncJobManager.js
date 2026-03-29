/**
 * Sync Job Manager
 * 
 * Tracks background sync jobs (in-memory + Redis cache).
 * Allows the API to return 202 Accepted immediately while
 * the sync runs in the background.
 * 
 * Usage:
 *   const syncJobs = require('./syncJobManager');
 * 
 *   // Start a job
 *   const jobId = syncJobs.startJob(shopId, userId);
 * 
 *   // Check status
 *   const status = syncJobs.getJob(jobId);
 *   // → { id, shopId, status: 'running'|'completed'|'failed', progress, ... }
 * 
 *   // Update from within sync logic
 *   syncJobs.updateProgress(jobId, { syncedCount: 50, totalEstimate: 200 });
 *   syncJobs.completeJob(jobId, { syncedCount: 200 });
 *   syncJobs.failJob(jobId, 'Token revoked');
 */

const crypto = require('crypto');
const redis = require('../cache/redisService');

// In-memory store for active jobs (Redis is cache-only, not authoritative)
const activeJobs = new Map();

// Job TTL: keep completed/failed jobs for 1 hour
const JOB_TTL_MS = 60 * 60 * 1000;
const REDIS_JOB_TTL = 3600; // seconds

/**
 * Start a new sync job.
 * @param {string} shopId - EtsyShop _id
 * @param {string} userId - User _id
 * @returns {string} jobId
 */
const startJob = (shopId, userId) => {
  const jobId = `sync_${crypto.randomBytes(8).toString('hex')}`;

  const job = {
    id: jobId,
    shopId: String(shopId),
    userId: String(userId),
    status: 'running',
    progress: { syncedCount: 0, totalEstimate: null, phase: 'listings' },
    startedAt: new Date().toISOString(),
    completedAt: null,
    error: null,
  };

  activeJobs.set(jobId, job);
  persistToRedis(jobId, job);

  return jobId;
};

/**
 * Get job status.
 * @param {string} jobId
 * @returns {Object|null}
 */
const getJob = async (jobId) => {
  // Check in-memory first
  if (activeJobs.has(jobId)) {
    return activeJobs.get(jobId);
  }

  // Fallback to Redis
  const cached = await redis.get(`syncjob:${jobId}`);
  return cached || null;
};

/**
 * Get the latest job for a specific shop.
 * @param {string} shopId
 * @returns {Object|null}
 */
const getLatestJobForShop = (shopId) => {
  const shopIdStr = String(shopId);
  let latest = null;

  for (const job of activeJobs.values()) {
    if (job.shopId === shopIdStr) {
      if (!latest || job.startedAt > latest.startedAt) {
        latest = job;
      }
    }
  }

  return latest;
};

/**
 * Check if a shop has a running sync job.
 * @param {string} shopId
 * @returns {boolean}
 */
const isShopSyncing = (shopId) => {
  const shopIdStr = String(shopId);
  for (const job of activeJobs.values()) {
    if (job.shopId === shopIdStr && job.status === 'running') {
      return true;
    }
  }
  return false;
};

/**
 * Update job progress.
 */
const updateProgress = (jobId, progress) => {
  const job = activeJobs.get(jobId);
  if (job) {
    job.progress = { ...job.progress, ...progress };
    persistToRedis(jobId, job);
  }
};

/**
 * Mark job as completed.
 */
const completeJob = (jobId, result = {}) => {
  const job = activeJobs.get(jobId);
  if (job) {
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    job.progress = { ...job.progress, ...result };
    persistToRedis(jobId, job);
    scheduleCleanup(jobId);
  }
};

/**
 * Mark job as failed.
 */
const failJob = (jobId, error) => {
  const job = activeJobs.get(jobId);
  if (job) {
    job.status = 'failed';
    job.completedAt = new Date().toISOString();
    job.error = error;
    persistToRedis(jobId, job);
    scheduleCleanup(jobId);
  }
};

// --- Internal helpers ---

const persistToRedis = (jobId, job) => {
  redis.set(`syncjob:${jobId}`, job, REDIS_JOB_TTL).catch(() => {});
};

const scheduleCleanup = (jobId) => {
  setTimeout(() => {
    activeJobs.delete(jobId);
  }, JOB_TTL_MS);
};

module.exports = {
  startJob,
  getJob,
  getLatestJobForShop,
  isShopSyncing,
  updateProgress,
  completeJob,
  failJob,
};
