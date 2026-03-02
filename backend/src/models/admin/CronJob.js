/**
 * CronJob Model
 * 
 * Stores custom cron jobs created by admins via the Integrations page.
 * System (built-in) jobs are NOT stored here — they live in the job registry.
 */
const mongoose = require('mongoose');

const cronJobSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^[a-zA-Z0-9_-]+$/, 'Key must be alphanumeric (underscores/hyphens allowed)'],
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    schedule: {
      type: String,
      required: true,
      trim: true,
    },
    scheduleLabel: {
      type: String,
      default: '',
    },
    /**
     * The type of action this job performs.
     * 'http'         — makes an HTTP request to the configured URL.
     * 'log'          — simply logs a message (useful for testing).
     * 'email'        — sends a custom email using configured SMTP.
     * 'cleanup'      — removes old records from the database.
     * 'notification' — creates an in-app admin notification.
     * 'backup'       — exports database collections to JSON files.
     */
    actionType: {
      type: String,
      enum: ['http', 'log', 'email', 'cleanup', 'notification', 'backup'],
      default: 'log',
    },
    /** HTTP action config */
    httpConfig: {
      url: { type: String, default: '' },
      method: { type: String, enum: ['GET', 'POST', 'PUT', 'DELETE'], default: 'GET' },
      headers: { type: mongoose.Schema.Types.Mixed, default: {} },
      body: { type: String, default: '' },
    },
    /** Log message (for actionType='log') */
    logMessage: {
      type: String,
      default: 'Custom cron job executed',
    },
    /** Email action config (for actionType='email') */
    emailConfig: {
      to: { type: String, default: '' },         // comma-separated recipients
      subject: { type: String, default: '' },
      body: { type: String, default: '' },        // HTML body
    },
    /** Cleanup action config (for actionType='cleanup') */
    cleanupConfig: {
      target: {
        type: String,
        enum: ['activityLogs', 'notifications', 'unverifiedUsers', 'expiredSessions', 'failedJobs'],
        default: 'activityLogs',
      },
      olderThanDays: { type: Number, default: 30 },
    },
    /** Notification action config (for actionType='notification') */
    notificationConfig: {
      title: { type: String, default: '' },
      message: { type: String, default: '' },
      notificationType: {
        type: String,
        enum: ['system_alert', 'new_feature', 'admin_message'],
        default: 'system_alert',
      },
    },
    /** Backup action config (for actionType='backup') */
    backupConfig: {
      collections: { type: [String], default: [] }, // e.g. ['users', 'analyses', 'activitylogs']
      outputDir: { type: String, default: 'backups' },
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    lastRun: Date,
    lastStatus: {
      type: String,
      enum: ['success', 'error', null],
      default: null,
    },
    lastError: String,
    runCount: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CronJob', cronJobSchema);
