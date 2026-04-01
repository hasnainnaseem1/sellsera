/**
 * Daily Keyword Snapshot Job — 5-Layer Data Collection
 *
 * Layer 1: Etsy listing data (totalResults, views, favorites, competition)
 * Layer 2: Google Trends interest (12-month relative search interest)
 * Layer 3: Listing freshness (new listing %, average listing age)
 * Layer 4: Engagement velocity (views/day, favorites/day per listing)
 * Layer 5: Fusion score (weighted ensemble of all signals)
 *
 * Schedule: 0 2 * * *  (daily at 2:00 AM UTC)
 *
 * Safety:
 *   - Reserves RESERVED_QUOTA Etsy API calls for live user traffic.
 *   - Google Trends is rate-limited to 1 request per 4 seconds.
 *   - Gracefully handles duplicate-key errors (re-run safety).
 */
const KeywordSearch = require('../models/customer/KeywordSearch');
const KeywordSnapshot = require('../models/customer/KeywordSnapshot');
const { fetchListings } = require('../services/etsy/etsyKeywordService');
const rateLimiter = require('../services/etsy/rateLimiter');
const { getInterestOverTime } = require('../services/google/googleTrendsService');
const seedKeywords = require('../utils/constants/seedKeywords');
const log = require('../utils/logger')('CronKeywordSnapshot');

const BATCH_SIZE = 300;          // keywords per nightly run
const RESERVED_QUOTA = 1000;
const LISTINGS_PER_KEYWORD = 25;
const ETSY_DELAY_MS = 200;
const TRENDS_DELAY_MS = 4000;    // Google Trends needs more spacing

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ─── Fusion Score Weights (Layer 5) ─── */
const WEIGHTS = {
  etsyVolume: 0.25,     // totalResults signal
  googleTrends: 0.30,   // Google Trends interest
  freshness: 0.15,      // market entry rate
  velocity: 0.15,       // engagement velocity
  lowCompetition: 0.15, // inverse competition bonus
};

/**
 * Compute fusion score from all layer signals (0-100).
 */
function computeFusionScore(data) {
  // Normalize each signal to 0-1 range
  const volNorm = Math.min(1, Math.log10(Math.max(data.totalResults, 1)) / 6); // log scale, 1M = 1.0
  const trendsNorm = (data.googleTrends?.interest ?? 0) / 100;
  const freshNorm = Math.min(1, (data.freshness?.newListingPct ?? 0) / 30); // 30% = max hot
  const velNorm = Math.min(1, (data.velocity?.avgViewsPerDay ?? 0) / 50);  // 50 views/day = max
  const compNorm = 1 - Math.min(1, (data.competitionPct ?? 0) / 100);      // lower = better

  const raw =
    WEIGHTS.etsyVolume * volNorm +
    WEIGHTS.googleTrends * trendsNorm +
    WEIGHTS.freshness * freshNorm +
    WEIGHTS.velocity * velNorm +
    WEIGHTS.lowCompetition * compNorm;

  return Math.round(raw * 100);
}

const run = async () => {
  const startTime = Date.now();

  // ── 1. Check remaining Etsy API quota ──
  const status = await rateLimiter.getStatus();
  const remaining = status.qpd.limit - status.qpd.current;
  log.info(`Quota check: ${remaining} Etsy calls remaining (reserve ${RESERVED_QUOTA})`);

  if (remaining < RESERVED_QUOTA + 10) {
    log.warn('Insufficient Etsy API quota — skipping');
    return;
  }

  const budget = remaining - RESERVED_QUOTA;

  // ── 2. Build keyword list: seed keywords + user-searched keywords ──
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Grab user-searched keywords (these always get priority)
  const userKeywords = await KeywordSearch.aggregate([
    { $match: { createdAt: { $gte: ninetyDaysAgo } } },
    { $group: { _id: { $toLower: '$seedKeyword' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 500 },
  ]);
  const userKwSet = new Set(userKeywords.map((e) => e._id));

  // Merge: user keywords first, then seed keywords (deduped)
  const fullList = [...userKwSet];
  for (const kw of seedKeywords) {
    if (!userKwSet.has(kw)) fullList.push(kw);
  }

  log.info(`Total keyword pool: ${fullList.length} (${userKwSet.size} user + ${fullList.length - userKwSet.size} seed)`);

  // ── 3. Rotating daily batch ──
  // Day-of-year determines which slice of the seed list we run.
  // User keywords always run; we fill the rest with a rotating batch.
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  );
  const totalBatches = Math.ceil(fullList.length / BATCH_SIZE);
  const batchIndex = dayOfYear % totalBatches;
  const batchStart = batchIndex * BATCH_SIZE;
  const batchEnd = Math.min(batchStart + BATCH_SIZE, fullList.length);
  const keywordsToProcess = fullList.slice(batchStart, batchEnd);

  // Ensure all user keywords are included even if outside current batch
  for (const uk of userKwSet) {
    if (!keywordsToProcess.includes(uk)) keywordsToProcess.push(uk);
  }

  // Respect Etsy API budget
  const capped = keywordsToProcess.slice(0, budget);

  if (!capped.length) {
    log.info('No keywords to process — nothing to snapshot');
    return;
  }

  log.info(`Batch ${batchIndex + 1}/${totalBatches}: processing ${capped.length} keywords (budget ${budget} Etsy calls)`);

  // ── 3. Today's snapshot date (midnight UTC) ──
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const now = Date.now();
  let saved = 0;
  let skipped = 0;
  let errors = 0;
  let trendsSuccess = 0;
  let trendsFailed = 0;

  for (const keyword of capped) {
    try {
      // Re-check Etsy quota every 50 keywords
      if (saved > 0 && saved % 50 === 0) {
        const midCheck = await rateLimiter.getStatus();
        const midRemaining = midCheck.qpd.limit - midCheck.qpd.current;
        if (midRemaining < RESERVED_QUOTA) {
          log.warn(`Etsy quota low (${midRemaining}) — stopping after ${saved}`);
          break;
        }
      }

      // ──────── Layer 1: Etsy Listing Data ────────
      const result = await fetchListings(keyword, LISTINGS_PER_KEYWORD);
      if (!result.success) {
        log.warn(`fetchListings failed for "${keyword}": ${result.error}`);
        errors++;
        await sleep(ETSY_DELAY_MS);
        continue;
      }

      const listings = result.listings || [];
      const totalResults = result.totalResults || 0;
      const sampleSize = listings.length;

      let totalViews = 0;
      let totalFavorites = 0;
      let tagMatchCount = 0;
      const kwLower = keyword.toLowerCase();

      // ──────── Layer 3 & 4: Freshness + Velocity ────────
      let newListingCount = 0;
      let totalAgeDays = 0;
      let totalViewsPerDay = 0;
      let totalFavsPerDay = 0;
      let velocitySamples = 0;

      for (const listing of listings) {
        const views = listing.views || 0;
        const favs = listing.num_favorers || 0;
        totalViews += views;
        totalFavorites += favs;

        const tags = (listing.tags || []).map((t) => t.toLowerCase());
        if (tags.includes(kwLower)) tagMatchCount++;

        // Layer 3: Listing freshness
        if (listing.created_timestamp) {
          const createdMs = listing.created_timestamp * 1000;
          const ageDays = Math.max(1, (now - createdMs) / (1000 * 60 * 60 * 24));
          totalAgeDays += ageDays;
          if (ageDays <= 30) newListingCount++;

          // Layer 4: Engagement velocity
          totalViewsPerDay += views / ageDays;
          totalFavsPerDay += favs / ageDays;
          velocitySamples++;
        }
      }

      const avgViews = sampleSize > 0 ? Math.round(totalViews / sampleSize) : 0;
      const avgFavorites = sampleSize > 0 ? Math.round(totalFavorites / sampleSize) : 0;
      const competitionPct = sampleSize > 0
        ? Math.round((tagMatchCount / sampleSize) * 10000) / 100
        : 0;
      const favViewRatio = totalViews > 0
        ? Math.round((totalFavorites / totalViews) * 10000) / 10000
        : 0;

      // Layer 3: Freshness metrics
      const newListingPct = sampleSize > 0
        ? Math.round((newListingCount / sampleSize) * 10000) / 100
        : null;
      const avgListingAgeDays = sampleSize > 0
        ? Math.round(totalAgeDays / sampleSize)
        : null;
      const marketSignal = newListingPct === null ? null :
        newListingPct >= 25 ? 'hot' :
        newListingPct >= 10 ? 'warm' : 'stagnant';

      // Layer 4: Velocity metrics
      const avgViewsPerDay = velocitySamples > 0
        ? Math.round((totalViewsPerDay / velocitySamples) * 100) / 100
        : null;
      const avgFavoritesPerDay = velocitySamples > 0
        ? Math.round((totalFavsPerDay / velocitySamples) * 100) / 100
        : null;

      // ──────── Layer 2: Google Trends ────────
      let trendsData = { interest: null, avg: null, trend: null, peak: null, trough: null, seasonality: null };
      try {
        const trendsResult = await getInterestOverTime(keyword);
        if (trendsResult.success) {
          trendsData = {
            interest: trendsResult.interest,
            avg: trendsResult.avg,
            trend: trendsResult.trend,
            peak: trendsResult.peak,
            trough: trendsResult.trough,
            seasonality: trendsResult.seasonality,
          };
          trendsSuccess++;
        } else {
          trendsFailed++;
        }
      } catch (tErr) {
        log.warn(`Google Trends failed for "${keyword}": ${tErr.message}`);
        trendsFailed++;
      }

      // ──────── Layer 5: Fusion Score ────────
      const snapshotData = {
        totalResults,
        competitionPct,
        googleTrends: trendsData,
        freshness: { newListingPct },
        velocity: { avgViewsPerDay },
      };
      const fusionScore = computeFusionScore(snapshotData);

      // ──────── Save Snapshot ────────
      await KeywordSnapshot.create({
        keyword,
        country: null,
        totalResults,
        avgViews,
        avgFavorites,
        competitionPct,
        favViewRatio,
        sampleSize,
        serpCalls: 1,
        googleTrends: trendsData,
        freshness: { newListingPct, avgListingAgeDays, marketSignal },
        velocity: { avgViewsPerDay, avgFavoritesPerDay },
        fusionScore,
        snapshotDate: today,
      });

      saved++;

      // Google Trends needs more spacing — use the larger delay
      await sleep(TRENDS_DELAY_MS);
    } catch (err) {
      if (err.code === 11000) {
        skipped++;
      } else {
        log.error(`Snapshot error for "${keyword}":`, err.message);
        errors++;
      }
      await sleep(ETSY_DELAY_MS);
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  log.info(
    `Snapshot complete in ${elapsed}s: ${saved} saved, ${skipped} skipped (dup), ${errors} errors | ` +
    `Trends: ${trendsSuccess} ok, ${trendsFailed} failed`
  );
};

module.exports = { run };
