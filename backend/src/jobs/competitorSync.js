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
      const shopRes = await etsyApi.publicRequest(
        'GET',
        `/v3/application/shops/${watch.etsyShopId}`
      );
      if (!shopRes.success) {
        failed++;
        continue;
      }

      const shop = shopRes.data;

      const listingsRes = await etsyApi.publicRequest(
        'GET',
        `/v3/application/shops/${watch.etsyShopId}/listings/active`,
        { params: { limit: 50, sort_on: 'score' } }
      );

      const topListings = (listingsRes.success && listingsRes.data?.results)
        ? listingsRes.data.results.map(l => ({
            listingId: String(l.listing_id),
            title: l.title,
            price: l.price?.amount ? l.price.amount / l.price.divisor : 0,
            views: l.views || 0,
            favorites: l.num_favorers || 0,
            tags: l.tags || [],
          }))
        : [];

      const avgPrice = topListings.length
        ? Math.round(topListings.reduce((sum, l) => sum + l.price, 0) / topListings.length * 100) / 100
        : 0;

      // Get previous snapshot to calculate daily delta
      const prevSnap = await CompetitorSnapshot.findOne({ watchId: watch._id })
        .sort({ capturedAt: -1 });
      const dailyDelta = prevSnap ? (shop.transaction_sold_count || 0) - prevSnap.totalSales : 0;

      const snapshot = await CompetitorSnapshot.create({
        watchId: watch._id,
        shopName: watch.shopName,
        totalSales: shop.transaction_sold_count || 0,
        totalListings: shop.listing_active_count || 0,
        avgPrice,
        rating: shop.review_average || 0,
        reviewCount: shop.review_count || 0,
        topListings,
      });

      await CompetitorWatch.findByIdAndUpdate(watch._id, {
        shopCountry: shop.shipping_from_country_iso || shop.shop_location_country_iso || '',
        iconUrl: shop.icon_url_fullxfull || '',
        latestSnapshot: {
          totalSales: snapshot.totalSales,
          totalListings: snapshot.totalListings,
          avgPrice: snapshot.avgPrice,
          rating: shop.review_average || 0,
          reviewCount: shop.review_count || 0,
          dailySalesDelta: dailyDelta,
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
