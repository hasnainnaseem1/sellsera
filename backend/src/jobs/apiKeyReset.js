/**
 * API Key Reset Job
 * 
 * Daily reset of Etsy API key usage counters.
 * Called by the cron registry (jobs/index.js).
 */
const { EtsyApiKey } = require('../models/integrations');
const log = require('../utils/logger')('CronKeyReset');

const run = async () => {
  log.info('Resetting Etsy API key daily counters...');
  const result = await EtsyApiKey.resetDailyCounters();
  log.info(`API key counters reset — ${result.modifiedCount || 0} keys updated`);
};

module.exports = { run };
