/**
 * Shop Sync Job
 * 
 * Daily sync of listings and receipts for all active Etsy shops.
 * Called by the cron registry (jobs/index.js).
 */
const { shopSyncService } = require('../services/etsy');

const run = async () => {
  console.log('[CRON] Starting daily shop sync for all active shops...');
  const results = await shopSyncService.syncAllShops();
  console.log(`[CRON] Shop sync complete — ${results.synced} synced, ${results.failed} failed, ${results.skipped} skipped`);
};

module.exports = { run };
