const cronLib = require('node-cron');
const {
  getJobStatuses,
  toggleJob,
  triggerJob,
  createCustomJob,
  updateCustomJob,
  deleteCustomJob,
} = require('../../jobs');
const CronJob = require('../../models/admin/CronJob');

/**
 * GET /api/v1/admin/cron
 * Get status of all cron jobs
 */
const listJobs = async (req, res) => {
  try {
    const jobs = getJobStatuses();
    res.json({ success: true, jobs });
  } catch (error) {
    console.error('Get cron jobs error:', error);
    res.status(500).json({ success: false, message: 'Failed to get cron job statuses' });
  }
};

/**
 * POST /api/v1/admin/cron
 * Create a new custom cron job
 */
const createJob = async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only super admins can create cron jobs' });
    }
    const { key, name, description, schedule, scheduleLabel, actionType,
            httpConfig, logMessage, emailConfig, cleanupConfig,
            notificationConfig, backupConfig, enabled } = req.body;

    if (!key || !name || !schedule) {
      return res.status(400).json({ success: false, message: 'key, name, and schedule are required' });
    }
    if (!cronLib.validate(schedule)) {
      return res.status(400).json({ success: false, message: 'Invalid cron expression' });
    }
    // Check if key is already taken (system or custom)
    const existing = getJobStatuses().find((j) => j.key === key);
    if (existing) {
      return res.status(409).json({ success: false, message: `Job key "${key}" already exists` });
    }

    const doc = await CronJob.create({
      key, name, description, schedule, scheduleLabel,
      actionType: actionType || 'log',
      httpConfig, logMessage,
      emailConfig, cleanupConfig, notificationConfig, backupConfig,
      enabled: enabled !== false,
      createdBy: req.user._id,
    });

    createCustomJob(doc);
    res.status(201).json({ success: true, message: 'Custom cron job created', job: doc });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A job with this key already exists' });
    }
    console.error('Create cron job error:', error);
    res.status(500).json({ success: false, message: 'Failed to create cron job' });
  }
};

/**
 * PUT /api/v1/admin/cron/:key
 * Update a custom cron job
 */
const updateJob = async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only super admins can edit cron jobs' });
    }
    // Prevent editing system jobs
    const allJobs = getJobStatuses();
    const target = allJobs.find((j) => j.key === req.params.key);
    if (!target) return res.status(404).json({ success: false, message: 'Cron job not found' });
    if (target.system) return res.status(403).json({ success: false, message: 'System jobs cannot be edited' });

    const { name, description, schedule, scheduleLabel, actionType,
            httpConfig, logMessage, emailConfig, cleanupConfig,
            notificationConfig, backupConfig, enabled } = req.body;
    if (schedule && !cronLib.validate(schedule)) {
      return res.status(400).json({ success: false, message: 'Invalid cron expression' });
    }

    const doc = await CronJob.findOneAndUpdate(
      { key: req.params.key },
      { name, description, schedule, scheduleLabel, actionType,
        httpConfig, logMessage, emailConfig, cleanupConfig,
        notificationConfig, backupConfig, enabled },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Custom job not found in DB' });

    updateCustomJob(doc);
    res.json({ success: true, message: 'Custom cron job updated', job: doc });
  } catch (error) {
    console.error('Update cron job error:', error);
    res.status(500).json({ success: false, message: 'Failed to update cron job' });
  }
};

/**
 * DELETE /api/v1/admin/cron/:key
 * Delete a custom cron job
 */
const deleteJob = async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only super admins can delete cron jobs' });
    }
    const allJobs = getJobStatuses();
    const target = allJobs.find((j) => j.key === req.params.key);
    if (!target) return res.status(404).json({ success: false, message: 'Cron job not found' });
    if (target.system) return res.status(403).json({ success: false, message: 'System jobs cannot be deleted' });

    await CronJob.findOneAndDelete({ key: req.params.key });
    deleteCustomJob(req.params.key);

    res.json({ success: true, message: 'Custom cron job deleted' });
  } catch (error) {
    console.error('Delete cron job error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete cron job' });
  }
};

/**
 * PUT /api/v1/admin/cron/:key/toggle
 * Toggle a cron job on/off
 */
const toggleJobHandler = async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only super admins can toggle cron jobs' });
    }
    const result = toggleJob(req.params.key);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Cron job not found' });
    }
    res.json({ success: true, message: `Job ${result.enabled ? 'enabled' : 'disabled'}`, ...result });
  } catch (error) {
    console.error('Toggle cron job error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle cron job' });
  }
};

/**
 * POST /api/v1/admin/cron/:key/trigger
 * Manually trigger a cron job
 */
const triggerJobHandler = async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only super admins can trigger cron jobs' });
    }
    const allJobs = getJobStatuses();
    const target = allJobs.find((j) => j.key === req.params.key);
    if (!target) return res.status(404).json({ success: false, message: 'Cron job not found' });
    const result = await triggerJob(req.params.key);
    res.json({ success: true, message: 'Job executed successfully', ...result });
  } catch (error) {
    console.error('Trigger cron job error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to trigger cron job' });
  }
};

module.exports = {
  listJobs,
  createJob,
  updateJob,
  deleteJob,
  toggleJobHandler,
  triggerJobHandler,
};
