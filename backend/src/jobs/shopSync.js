/**
 * Shop Sync Job
 * 
 * Daily sync of listings and receipts for all active Etsy shops.
 * Called by the cron registry (jobs/index.js).
 */
const { shopSyncService } = require('../services/etsy');
const log = require('../utils/logger')('CronShopSync');

const run = async () => {
  log.info('Starting daily shop sync for all active shops...');
  const results = await shopSyncService.syncAllShops();
  log.info(`Shop sync complete — ${results.synced} synced, ${results.failed} failed, ${results.skipped} skipped`);
};

module.exports = { run };
