/**
 * API Key Reset Job
 * 
 * Daily reset of Etsy API key usage counters.
 * Called by the cron registry (jobs/index.js).
 */
const { EtsyApiKey } = require('../models/integrations');

const run = async () => {
  console.log('[CRON] Resetting Etsy API key daily counters...');
  const result = await EtsyApiKey.resetDailyCounters();
  console.log(`[CRON] API key counters reset — ${result.modifiedCount || 0} keys updated`);
};

module.exports = { run };
