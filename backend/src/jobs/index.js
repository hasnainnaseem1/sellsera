/**
 * Cron Job Registry
 * 
 * Manages both built-in (system) and custom (DB-stored) scheduled jobs.
 * Called once from server.js after DB connection is established.
 */
const cron = require('node-cron');
const trialExpiry = require('./trialExpiry');
const trialWarning = require('./trialWarning');
const usageReset = require('./usageReset');
const shopSync = require('./shopSync');
const competitorSync = require('./competitorSync');
const apiKeyReset = require('./apiKeyReset');

/* ─── Built-in system jobs ─── */
const systemJobs = {
  trialExpiry: {
    name: 'Trial Expiry Check',
    description: 'Expires overdue trial accounts',
    schedule: '0 * * * *',
    scheduleLabel: 'Every hour',
    system: true,
    enabled: true,
    lastRun: null,
    lastStatus: null,
    lastError: null,
    runCount: 0,
    task: null,
  },
  trialWarning: {
    name: 'Trial Warning Emails',
    description: 'Sends warning emails 3 days before trial expiry',
    schedule: '0 9 * * *',
    scheduleLabel: 'Daily at 9:00 AM',
    system: true,
    enabled: true,
    lastRun: null,
    lastStatus: null,
    lastError: null,
    runCount: 0,
    task: null,
  },
  usageReset: {
    name: 'Monthly Usage Reset',
    description: 'Resets usage counters for users past their reset date',
    schedule: '0 * * * *',
    scheduleLabel: 'Every hour',
    system: true,
    enabled: true,
    lastRun: null,
    lastStatus: null,
    lastError: null,
    runCount: 0,
    task: null,
  },
  shopSync: {
    name: 'Daily Etsy Shop Sync',
    description: 'Syncs listings and receipts for all active Etsy shops',
    schedule: '0 3 * * *',
    scheduleLabel: 'Daily at 3:00 AM',
    system: true,
    enabled: true,
    lastRun: null,
    lastStatus: null,
    lastError: null,
    runCount: 0,
    task: null,
  },
  competitorSync: {
    name: 'Daily Competitor Sync',
    description: 'Captures new snapshots for all active competitor watches',
    schedule: '0 4 * * *',
    scheduleLabel: 'Daily at 4:00 AM',
    system: true,
    enabled: true,
    lastRun: null,
    lastStatus: null,
    lastError: null,
    runCount: 0,
    task: null,
  },
  apiKeyReset: {
    name: 'Daily API Key Counter Reset',
    description: 'Resets daily usage counters for Etsy API keys',
    schedule: '0 0 * * *',
    scheduleLabel: 'Daily at midnight',
    system: true,
    enabled: true,
    lastRun: null,
    lastStatus: null,
    lastError: null,
    runCount: 0,
    task: null,
  },
};

const systemRunners = {
  trialExpiry: trialExpiry.run,
  trialWarning: trialWarning.run,
  usageReset: usageReset.run,
  shopSync: shopSync.run,
  competitorSync: competitorSync.run,
  apiKeyReset: apiKeyReset.run,
};

/* ─── Custom jobs (loaded from DB at init, keyed by DB _id) ─── */
const customJobs = {}; // key → { ...meta, task }

/* ─── Helpers ─── */
const buildCustomRunner = (job) => {
  /* ── HTTP Request ── */
  if (job.actionType === 'http') {
    return async () => {
      const url = job.httpConfig?.url;
      if (!url) throw new Error('HTTP URL not configured');
      const opts = {
        method: job.httpConfig.method || 'GET',
        headers: { 'Content-Type': 'application/json', ...(job.httpConfig.headers || {}) },
      };
      if (['POST', 'PUT'].includes(opts.method) && job.httpConfig.body) {
        opts.body = job.httpConfig.body;
      }
      const res = await fetch(url, opts);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    };
  }

  /* ── Email ── */
  if (job.actionType === 'email') {
    return async () => {
      const cfg = job.emailConfig;
      if (!cfg?.to) throw new Error('Email recipients not configured');
      if (!cfg?.subject) throw new Error('Email subject not configured');
      const emailService = require('../services/email/emailService');
      await emailService.sendEmail({
        to: cfg.to, // comma-separated is fine for nodemailer
        subject: cfg.subject,
        html: cfg.body || '<p>Scheduled email from cron job</p>',
      });
      console.log(`[CUSTOM-CRON] Email sent to ${cfg.to}`);
    };
  }

  /* ── Database Cleanup ── */
  if (job.actionType === 'cleanup') {
    return async () => {
      const cfg = job.cleanupConfig;
      const target = cfg?.target || 'activityLogs';
      const days = cfg?.olderThanDays || 30;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      let deleted = 0;

      if (target === 'activityLogs') {
        const { ActivityLog } = require('../models/admin');
        const result = await ActivityLog.deleteMany({ createdAt: { $lt: cutoff } });
        deleted = result.deletedCount;
      } else if (target === 'notifications') {
        const { Notification } = require('../models/notification');
        const result = await Notification.deleteMany({ createdAt: { $lt: cutoff } });
        deleted = result.deletedCount;
      } else if (target === 'unverifiedUsers') {
        const { User } = require('../models/user');
        const result = await User.deleteMany({
          isEmailVerified: false,
          accountType: 'customer',
          createdAt: { $lt: cutoff },
        });
        deleted = result.deletedCount;
      } else if (target === 'expiredSessions') {
        // Clean expired password-reset tokens and verification tokens
        const { User } = require('../models/user');
        const result = await User.updateMany(
          { 'resetPasswordExpires': { $lt: new Date() } },
          { $unset: { resetPasswordToken: 1, resetPasswordExpires: 1 } }
        );
        deleted = result.modifiedCount;
      } else if (target === 'failedJobs') {
        const CronJobModel = require('../models/admin/CronJob');
        // Reset failed job error state (not delete the jobs)
        const result = await CronJobModel.updateMany(
          { lastStatus: 'error' },
          { $set: { lastError: null, lastStatus: null } }
        );
        deleted = result.modifiedCount;
      }
      console.log(`[CUSTOM-CRON] Cleanup "${target}": removed/cleaned ${deleted} records older than ${days} days`);
    };
  }

  /* ── In-App Notification ── */
  if (job.actionType === 'notification') {
    return async () => {
      const cfg = job.notificationConfig;
      if (!cfg?.title) throw new Error('Notification title not configured');
      const { Notification } = require('../models/notification');
      const { User } = require('../models/user');

      // Find all admin users to send notification to
      const admins = await User.find({ accountType: 'admin' }).select('_id').lean();
      if (!admins.length) throw new Error('No admin users found');

      const docs = admins.map((admin) => ({
        recipientId: admin._id,
        recipientType: 'admin',
        type: cfg.notificationType || 'system_alert',
        title: cfg.title,
        message: cfg.message || cfg.title,
        priority: 'medium',
      }));
      await Notification.insertMany(docs);
      console.log(`[CUSTOM-CRON] Notification "${cfg.title}" sent to ${admins.length} admin(s)`);
    };
  }

  /* ── Database Backup ── */
  if (job.actionType === 'backup') {
    return async () => {
      const fs = require('fs');
      const path = require('path');
      const mongoose = require('mongoose');
      const cfg = job.backupConfig;
      const collections = cfg?.collections?.length ? cfg.collections : ['users', 'analyses', 'activitylogs'];
      const outputDir = path.resolve(cfg?.outputDir || 'backups');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const batchDir = path.join(outputDir, `backup-${timestamp}`);

      // Ensure output directory exists
      fs.mkdirSync(batchDir, { recursive: true });

      for (const collName of collections) {
        try {
          const coll = mongoose.connection.collection(collName);
          const docs = await coll.find({}).toArray();
          const filePath = path.join(batchDir, `${collName}.json`);
          fs.writeFileSync(filePath, JSON.stringify(docs, null, 2));
          console.log(`[CUSTOM-CRON] Backup: ${collName} → ${docs.length} docs exported`);
        } catch (err) {
          console.error(`[CUSTOM-CRON] Backup: failed to export "${collName}" — ${err.message}`);
        }
      }
      console.log(`[CUSTOM-CRON] Backup complete → ${batchDir}`);
    };
  }

  // default: log
  return async () => {
    console.log(`[CUSTOM-CRON] ${job.logMessage || 'Custom job executed'}`);
  };
};

const scheduleTask = (key, job, runner) => {
  if (job.task) { job.task.stop(); job.task = null; }
  if (!cron.validate(job.schedule)) {
    console.error(`[CRON] Invalid schedule for ${key}: ${job.schedule}`);
    return;
  }
  job.task = cron.schedule(job.schedule, async () => {
    if (!job.enabled) return;
    console.log(`[CRON] Running ${job.name}...`);
    try {
      await runner();
      job.lastRun = new Date();
      job.lastStatus = 'success';
      job.lastError = null;
      job.runCount++;
      // Persist stats for custom jobs
      if (!job.system) persistStats(key, job);
    } catch (err) {
      job.lastRun = new Date();
      job.lastStatus = 'error';
      job.lastError = err.message;
      console.error(`[CRON] ${job.name} error:`, err.message);
      if (!job.system) persistStats(key, job);
    }
  });
};

const persistStats = async (key, job) => {
  try {
    const CronJob = require('../models/admin/CronJob');
    await CronJob.findOneAndUpdate(
      { key },
      { lastRun: job.lastRun, lastStatus: job.lastStatus, lastError: job.lastError, runCount: job.runCount }
    );
  } catch { /* best-effort */ }
};

/* ─── Initialization ─── */
const initializeJobs = async () => {
  console.log('⏰ Initializing scheduled jobs...');

  // 1. Start system jobs
  Object.keys(systemJobs).forEach((key) => {
    scheduleTask(key, systemJobs[key], systemRunners[key]);
  });

  // 2. Load & start custom jobs from DB
  try {
    const CronJob = require('../models/admin/CronJob');
    const dbJobs = await CronJob.find({});
    for (const doc of dbJobs) {
      const entry = {
        name: doc.name,
        description: doc.description,
        schedule: doc.schedule,
        scheduleLabel: doc.scheduleLabel,
        actionType: doc.actionType,
        httpConfig: doc.httpConfig,
        logMessage: doc.logMessage,
        emailConfig: doc.emailConfig,
        cleanupConfig: doc.cleanupConfig,
        notificationConfig: doc.notificationConfig,
        backupConfig: doc.backupConfig,
        system: false,
        enabled: doc.enabled,
        lastRun: doc.lastRun || null,
        lastStatus: doc.lastStatus || null,
        lastError: doc.lastError || null,
        runCount: doc.runCount || 0,
        task: null,
      };
      customJobs[doc.key] = entry;
      if (entry.enabled) scheduleTask(doc.key, entry, buildCustomRunner(doc));
    }
    if (dbJobs.length) console.log(`   • ${dbJobs.length} custom job(s) loaded from DB`);
  } catch (err) {
    console.error('[CRON] Error loading custom jobs:', err.message);
  }

  console.log('✅ Scheduled jobs initialized:');
  console.log('   • Trial expiry check — every hour');
  console.log('   • Trial warning emails — daily at 9 AM');
  console.log('   • Usage reset — every hour');
  console.log('   • Etsy shop sync — daily at 3 AM');
  console.log('   • Competitor sync — daily at 4 AM');
  console.log('   • API key counter reset — daily at midnight');
};

/* ─── API methods ─── */

/** Get status of ALL jobs (system + custom) */
const getJobStatuses = () => {
  const list = [];
  // System
  Object.entries(systemJobs).forEach(([key, job]) => {
    list.push({
      key, name: job.name, description: job.description,
      schedule: job.schedule, scheduleLabel: job.scheduleLabel,
      enabled: job.enabled, lastRun: job.lastRun,
      lastStatus: job.lastStatus, lastError: job.lastError,
      runCount: job.runCount, system: true,
    });
  });
  // Custom
  Object.entries(customJobs).forEach(([key, job]) => {
    list.push({
      key, name: job.name, description: job.description,
      schedule: job.schedule, scheduleLabel: job.scheduleLabel,
      actionType: job.actionType,
      httpConfig: job.httpConfig,
      logMessage: job.logMessage,
      emailConfig: job.emailConfig,
      cleanupConfig: job.cleanupConfig,
      notificationConfig: job.notificationConfig,
      backupConfig: job.backupConfig,
      enabled: job.enabled, lastRun: job.lastRun,
      lastStatus: job.lastStatus, lastError: job.lastError,
      runCount: job.runCount, system: false,
    });
  });
  return list;
};

/** Toggle a job on/off */
const toggleJob = (key) => {
  const job = systemJobs[key] || customJobs[key];
  if (!job) return null;
  job.enabled = !job.enabled;
  // Persist for custom
  if (!job.system) {
    const CronJob = require('../models/admin/CronJob');
    CronJob.findOneAndUpdate({ key }, { enabled: job.enabled }).catch(() => {});
  }
  return { key, enabled: job.enabled };
};

/** Manually trigger a job */
const triggerJob = async (key) => {
  const sysJob = systemJobs[key];
  const cusJob = customJobs[key];
  const job = sysJob || cusJob;
  if (!job) throw new Error(`Unknown job: ${key}`);

  const runner = sysJob ? systemRunners[key] : buildCustomRunner(cusJob);
  console.log(`[CRON] Manual trigger: ${job.name}`);
  try {
    await runner();
    job.lastRun = new Date();
    job.lastStatus = 'success';
    job.lastError = null;
    job.runCount++;
    if (!job.system) persistStats(key, job);
    return { success: true, lastRun: job.lastRun };
  } catch (err) {
    job.lastRun = new Date();
    job.lastStatus = 'error';
    job.lastError = err.message;
    if (!job.system) persistStats(key, job);
    throw err;
  }
};

/** Create a new custom job (from admin API) */
const createCustomJob = (doc) => {
  const entry = {
    name: doc.name,
    description: doc.description,
    schedule: doc.schedule,
    scheduleLabel: doc.scheduleLabel,
    actionType: doc.actionType,
    httpConfig: doc.httpConfig,
    logMessage: doc.logMessage,
    emailConfig: doc.emailConfig,
    cleanupConfig: doc.cleanupConfig,
    notificationConfig: doc.notificationConfig,
    backupConfig: doc.backupConfig,
    system: false,
    enabled: doc.enabled !== false,
    lastRun: null,
    lastStatus: null,
    lastError: null,
    runCount: 0,
    task: null,
  };
  customJobs[doc.key] = entry;
  if (entry.enabled) scheduleTask(doc.key, entry, buildCustomRunner(doc));
};

/** Update an existing custom job (reschedule) */
const updateCustomJob = (doc) => {
  const existing = customJobs[doc.key];
  if (existing && existing.task) { existing.task.stop(); existing.task = null; }
  const entry = {
    name: doc.name,
    description: doc.description,
    schedule: doc.schedule,
    scheduleLabel: doc.scheduleLabel,
    actionType: doc.actionType,
    httpConfig: doc.httpConfig,
    logMessage: doc.logMessage,
    emailConfig: doc.emailConfig,
    cleanupConfig: doc.cleanupConfig,
    notificationConfig: doc.notificationConfig,
    backupConfig: doc.backupConfig,
    system: false,
    enabled: doc.enabled !== false,
    lastRun: existing?.lastRun || null,
    lastStatus: existing?.lastStatus || null,
    lastError: existing?.lastError || null,
    runCount: existing?.runCount || 0,
    task: null,
  };
  customJobs[doc.key] = entry;
  if (entry.enabled) scheduleTask(doc.key, entry, buildCustomRunner(doc));
};

/** Delete a custom job */
const deleteCustomJob = (key) => {
  const job = customJobs[key];
  if (!job) return false;
  if (job.task) job.task.stop();
  delete customJobs[key];
  return true;
};

module.exports = {
  initializeJobs,
  getJobStatuses,
  toggleJob,
  triggerJob,
  createCustomJob,
  updateCustomJob,
  deleteCustomJob,
};
