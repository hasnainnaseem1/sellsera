/**
 * Competitor Sync Job
 * 
 * Daily refresh of all active competitor watches.
 * Captures a new snapshot for each watched competitor shop.
 */
const { CompetitorWatch, CompetitorSnapshot } = require('../models/customer');
const etsyApi = require('../services/etsy/etsyApiService');
const log = require('../utils/logger')('CronCompetitor');

const run = async () => {
  log.info('Starting daily competitor sync...');

  const watches = await CompetitorWatch.find({ status: 'active' }).lean();
  let refreshed = 0;
  let failed = 0;

  for (const watch of watches) {
    try {
      // Fetch shop data from Etsy public API
      const shopRes = await etsyApi.publicRequest(`/shops/${watch.etsyShopId}`);
      if (!shopRes.success) {
        failed++;
        continue;
      }

      const shop = shopRes.data;

      // Fetch top active listings
      const listingsRes = await etsyApi.publicRequest(
        `/shops/${watch.etsyShopId}/listings/active?limit=25&sort_on=score`
      );

      const topListings = (listingsRes.success && listingsRes.data?.results)
        ? listingsRes.data.results.slice(0, 10).map(l => ({
            etsyListingId: String(l.listing_id),
            title: l.title,
            price: l.price?.amount ? l.price.amount / l.price.divisor : 0,
            tags: l.tags || [],
          }))
        : [];

      // Create snapshot
      const snapshot = await CompetitorSnapshot.create({
        watchId: watch._id,
        shopName: watch.shopName,
        totalSales: shop.transaction_sold_count || 0,
        totalListings: shop.listing_active_count || 0,
        avgPrice: topListings.length
          ? topListings.reduce((sum, l) => sum + l.price, 0) / topListings.length
          : 0,
        topListings,
      });

      // Update denormalized latest snapshot
      await CompetitorWatch.findByIdAndUpdate(watch._id, {
        latestSnapshot: {
          totalSales: snapshot.totalSales,
          totalListings: snapshot.totalListings,
          avgPrice: snapshot.avgPrice,
          capturedAt: snapshot.capturedAt,
        },
      });

      refreshed++;
    } catch (err) {
      log.error(`Competitor sync error for ${watch.shopName}:`, err.message);
      failed++;
    }
  }

  log.info(`Competitor sync complete — ${refreshed} refreshed, ${failed} failed out of ${watches.length}`);
};

module.exports = { run };
