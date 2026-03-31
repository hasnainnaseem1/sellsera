/**
 * Daily Keyword Snapshot Job
 *
 * Captures a daily snapshot of metrics for the top historically-searched
 * keywords.  After 30+ days of data, real week-over-week and month-over-month
 * trend comparisons become possible via KeywordSnapshot.getTrend().
 *
 * Schedule: 0 2 * * *  (daily at 2:00 AM UTC)
 *
 * Safety:
 *   - Reserves RESERVED_QUOTA API calls for live user traffic.
 *   - Pauses DELAY_MS between keywords to stay under Etsy's 5 QPS limit.
 *   - Gracefully handles duplicate-key errors (re-run safety).
 */
const KeywordSearch = require('../models/customer/KeywordSearch');
const KeywordSnapshot = require('../models/customer/KeywordSnapshot');
const { fetchListings } = require('../services/etsy/etsyKeywordService');
const rateLimiter = require('../services/etsy/rateLimiter');
const log = require('../utils/logger')('CronKeywordSnapshot');

const MAX_KEYWORDS = 500;
const RESERVED_QUOTA = 1000;
const LISTINGS_PER_KEYWORD = 25;
const DELAY_MS = 200;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const run = async () => {
  // ── 1. Check remaining API quota ──
  const status = await rateLimiter.getStatus();
  const remaining = status.qpd.limit - status.qpd.current;
  log.info(`Quota check: ${remaining} calls remaining (reserve ${RESERVED_QUOTA})`);

  if (remaining < RESERVED_QUOTA + 10) {
    log.warn('Insufficient API quota for snapshot job — skipping');
    return;
  }

  const budget = remaining - RESERVED_QUOTA;

  // ── 2. Aggregate the most-searched keywords (last 90 days) ──
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const topKeywords = await KeywordSearch.aggregate([
    { $match: { createdAt: { $gte: ninetyDaysAgo } } },
    { $group: { _id: { $toLower: '$seedKeyword' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: MAX_KEYWORDS },
  ]);

  if (!topKeywords.length) {
    log.info('No keyword search history found — nothing to snapshot');
    return;
  }

  const keywordsToProcess = topKeywords.slice(0, Math.min(topKeywords.length, budget));
  log.info(`Snapshotting ${keywordsToProcess.length} keywords (budget ${budget} calls)`);

  // ── 3. Today's snapshot date (midnight UTC) ──
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let saved = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of keywordsToProcess) {
    const keyword = entry._id; // already lowercase from $toLower
    try {
      // Re-check quota every 50 keywords
      if (saved > 0 && saved % 50 === 0) {
        const midCheck = await rateLimiter.getStatus();
        const midRemaining = midCheck.qpd.limit - midCheck.qpd.current;
        if (midRemaining < RESERVED_QUOTA) {
          log.warn(`Quota low (${midRemaining} left) — stopping early after ${saved} snapshots`);
          break;
        }
      }

      const result = await fetchListings(keyword, LISTINGS_PER_KEYWORD);
      if (!result.success) {
        log.warn(`fetchListings failed for "${keyword}": ${result.error}`);
        errors++;
        await sleep(DELAY_MS);
        continue;
      }

      const listings = result.listings || [];
      const totalResults = result.totalResults || 0;
      const sampleSize = listings.length;

      // Compute snapshot metrics
      let totalViews = 0;
      let totalFavorites = 0;
      let tagMatchCount = 0;
      const kwLower = keyword.toLowerCase();

      for (const listing of listings) {
        totalViews += listing.views || 0;
        totalFavorites += listing.num_favorers || 0;
        const tags = (listing.tags || []).map((t) => t.toLowerCase());
        if (tags.includes(kwLower)) tagMatchCount++;
      }

      const avgViews = sampleSize > 0 ? Math.round(totalViews / sampleSize) : 0;
      const avgFavorites = sampleSize > 0 ? Math.round(totalFavorites / sampleSize) : 0;
      const competitionPct = sampleSize > 0
        ? Math.round((tagMatchCount / sampleSize) * 10000) / 100
        : 0;
      const favViewRatio = totalViews > 0
        ? Math.round((totalFavorites / totalViews) * 10000) / 10000
        : 0;

      await KeywordSnapshot.create({
        keyword,
        country: null, // Global snapshot
        totalResults,
        avgViews,
        avgFavorites,
        competitionPct,
        favViewRatio,
        sampleSize,
        serpCalls: 1,
        snapshotDate: today,
      });

      saved++;
      await sleep(DELAY_MS);
    } catch (err) {
      if (err.code === 11000) {
        // Duplicate key — already snapshotted today
        skipped++;
      } else {
        log.error(`Snapshot error for "${keyword}":`, err.message);
        errors++;
      }
      await sleep(DELAY_MS);
    }
  }

  log.info(`Snapshot complete: ${saved} saved, ${skipped} skipped (dup), ${errors} errors`);
};

module.exports = { run };
