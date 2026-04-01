/**
 * Etsy Keyword Service
 * 
 * Encapsulates all keyword-related business logic:
 * - Estimated search volume (hybrid algorithm)
 * - Competition scoring
 * - Trend detection
 * - Related keyword extraction
 * - Deep keyword analysis with pricing, suggested tags, etc.
 * 
 * Etsy does NOT provide search volume directly.
 * We estimate it using a 5-signal hybrid approach:
 *   1. Total search results (base demand)
 *   2. Title bigram autocomplete patterns (frequency signal)
 *   3. Tag frequency across top listings (competition signal)
 *   4. View density / engagement (quality signal)
 *   5. Favorites-to-views ratio (trend signal)
 */

const etsyApi = require('./etsyApiService');
const redis = require('../cache/redisService');
const crypto = require('crypto');
const log = require('../../utils/logger')('KeywordService');
const { CODE_TO_LOCATION } = require('../../utils/constants/etsyCountries');
const { getInterestOverTime } = require('../google/googleTrendsService');

/**
 * Search Etsy for a keyword and return enriched results.
 * @param {string} keyword - The seed keyword
 * @param {number} limit - Number of listings to fetch (default 100)
 * @param {Object} [options] - { country, offset }
 * @returns {{ success, listings, totalResults, error, code }}
 */
const fetchListings = async (keyword, limit = 100, options = {}) => {
  const { country, offset } = options;
  log.info(`fetchListings: keyword="${keyword}" limit=${limit} offset=${offset || 0} country=${country || 'ALL'}`);

  const params = { keywords: keyword, limit, sort_on: 'score' };
  if (offset) params.offset = offset;
  if (country && country.toUpperCase() !== 'GLOBAL') {
    params.shop_location = CODE_TO_LOCATION[country] || country;
  }

  const result = await etsyApi.publicRequest(
    'GET',
    '/v3/application/listings/active',
    { params }
  );

  if (!result.success) {
    log.error(`fetchListings: FAILED for "${keyword}" - code=${result.code} error=${result.error}`);
    return {
      success: false,
      listings: [],
      totalResults: 0,
      error: result.error,
      code: result.code || 'API_ERROR',
    };
  }

  log.info(`fetchListings: SUCCESS for "${keyword}" - ${result.data.count || 0} total, ${(result.data.results || []).length} returned`);
  return {
    success: true,
    listings: result.data.results || [],
    totalResults: result.data.count || 0,
    error: null,
    code: null,
  };
};

/**
 * Extract related keywords from listing tags with volume estimation.
 * This is the core "eRank-style" algorithm.
 *
 * Pagination strategy:
 *   - Always fires page 1 first to get totalResults count.
 *   - Then fires up to 4 more pages (offsets 100-400) concurrently via Promise.allSettled.
 *   - Listings are deduplicated by listing_id across all pages.
 *   - All unique tags are frequency-counted, top 200 candidates are enriched.
 *
 * @param {string} seedKeyword
 * @param {Object} [options] - { country }
 * @returns {{ success, results: Array, totalResults: number, serpCalls: number, error, errorCode }}
 */
const getRelatedKeywords = async (seedKeyword, options = {}) => {
  const { country } = options;
  const MAX_PAGES = 5;
  const PAGE_SIZE = 100;

  log.info(`getRelatedKeywords: seed="${seedKeyword}" country=${country || 'ALL'} maxPages=${MAX_PAGES}`);

  // ── Page 1 (sequential — need totalResults before deciding how many extra pages) ──
  const primary = await fetchListings(seedKeyword, PAGE_SIZE, { country });

  if (!primary.success) {
    log.error(`getRelatedKeywords: primary fetch FAILED for "${seedKeyword}" - code=${primary.code}`);
    return {
      success: false,
      results: [],
      totalResults: 0,
      serpCalls: 1,
      error: primary.error,
      errorCode: primary.code,
    };
  }

  if (primary.totalResults === 0 || primary.listings.length === 0) {
    return {
      success: true,
      results: [],
      totalResults: 0,
      serpCalls: 1,
      error: null,
      errorCode: null,
    };
  }

  // Deduplicate by listing_id using a Map
  const listingMap = new Map();
  for (const l of primary.listings) {
    listingMap.set(l.listing_id, l);
  }
  const totalResults = primary.totalResults;
  let serpCalls = 1;
  let pagesSucceeded = 1;
  let pagesFailed = 0;

  // ── Pages 2-5 (concurrent via Promise.allSettled) ──
  const extraPageCount = Math.min(MAX_PAGES - 1, Math.ceil(totalResults / PAGE_SIZE) - 1);

  if (extraPageCount > 0) {
    const pageFetches = [];
    for (let p = 1; p <= extraPageCount; p++) {
      pageFetches.push(
        fetchListings(seedKeyword, PAGE_SIZE, { country, offset: p * PAGE_SIZE })
      );
    }

    log.info(`getRelatedKeywords: firing ${pageFetches.length} extra pages concurrently (offsets ${
      Array.from({ length: extraPageCount }, (_, i) => (i + 1) * PAGE_SIZE).join(', ')
    })`);

    const settled = await Promise.allSettled(pageFetches);

    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      serpCalls++;

      if (result.status === 'fulfilled' && result.value?.success && result.value.listings?.length > 0) {
        for (const l of result.value.listings) {
          listingMap.set(l.listing_id, l); // dedup by listing_id
        }
        pagesSucceeded++;
      } else {
        pagesFailed++;
        const reason = result.status === 'rejected'
          ? result.reason?.message
          : result.value?.error || 'empty page';
        log.warn(`getRelatedKeywords: page ${i + 2} failed — ${reason}`);
      }
    }
  }

  const listings = Array.from(listingMap.values());
  log.info(`getRelatedKeywords: ${listings.length} unique listings from ${pagesSucceeded}/${serpCalls} successful pages (${pagesFailed} failed)`);

  // ── Autocomplete bigram extraction (scan up to 100 top-ranked listings) ──
  const autocompleteSuggestions = new Set();
  const seedWords = seedKeyword.toLowerCase().split(/\s+/);
  for (const l of listings.slice(0, 100)) {
    const titleWords = l.title.toLowerCase().split(/[\s\-–—,|·]+/).filter(w => w.length > 2);
    for (let i = 0; i < titleWords.length - 1; i++) {
      const bigram = `${titleWords[i]} ${titleWords[i + 1]}`;
      if (seedWords.some(sw => bigram.includes(sw))) {
        autocompleteSuggestions.add(bigram);
      }
    }
  }

  // ── Tag frequency, view & favorites accumulators (deduplicated listings) ──
  const tagFrequency = {};
  const tagViewAccum = {};
  const tagFavorites = {};
  const seedLower = seedKeyword.toLowerCase();

  for (const listing of listings) {
    for (const tag of (listing.tags || [])) {
      const normalized = tag.toLowerCase().trim();
      if (normalized && normalized !== seedLower) {
        tagFrequency[normalized] = (tagFrequency[normalized] || 0) + 1;
        tagViewAccum[normalized] = (tagViewAccum[normalized] || 0) + (listing.views || 0);
        tagFavorites[normalized] = (tagFavorites[normalized] || 0) + (listing.num_favorers || 0);
      }
    }
  }

  const uniqueTagCount = Object.keys(tagFrequency).length;
  log.info(`getRelatedKeywords: ${uniqueTagCount} unique tags extracted from ${listings.length} listings`);

  // ── Rank & enrich top 200 candidates ──
  const topKeywords = Object.entries(tagFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 200);

  const maxFreq = topKeywords[0]?.[1] || 1;
  const results = [];

  for (const [kw, freq] of topKeywords) {
    const analysis = analyzeKeyword(kw, {
      freq, maxFreq, totalResults, listings,
      tagViewAccum, tagFavorites, autocompleteSuggestions,
    });
    results.push(analysis);
  }

  results.sort((a, b) => b.demandScore - a.demandScore);

  log.info(`getRelatedKeywords: SUCCESS for "${seedKeyword}" — ${results.length} keywords ranked, totalResults=${totalResults}, serpCalls=${serpCalls}`);

  return {
    success: true,
    results,
    totalResults,
    serpCalls,
    error: null,
    errorCode: null,
  };
};

/**
 * Analyze a single keyword using the 5-signal hybrid algorithm.
 */
function analyzeKeyword(kw, ctx) {
  const { freq, maxFreq, totalResults, listings, tagViewAccum, tagFavorites, autocompleteSuggestions } = ctx;

  // Signal 1: Frequency-weighted volume
  const freqRatio = freq / maxFreq;
  const rawVolume = totalResults * freqRatio;

  // Signal 2: Engagement multiplier (view density)
  const avgViews = (tagViewAccum[kw] || 0) / freq;
  const engagementMultiplier = Math.min(2.0, 1 + (Math.log10(Math.max(avgViews, 1)) / 5));

  // Signal 3: Autocomplete boost
  const autocompleteBoost = autocompleteSuggestions.has(kw) ? 1.3 : 1.0;

  const estimatedVolume = Math.round(rawVolume * engagementMultiplier * autocompleteBoost);

  // Competition % — proportion of top-100 listings using this tag
  const competitionPct = Math.min(100, Math.round((freq / listings.length) * 100));

  // Demand Score — weighted: volume 45%, engagement 25%, low-competition 30%
  const volumeNorm = Math.min(1, Math.log10(Math.max(estimatedVolume, 1)) / 5);
  const compNorm = competitionPct / 100;
  const engageNorm = Math.min(1, Math.log10(Math.max(avgViews, 1)) / 4);
  const demandScore = Math.round(
    (volumeNorm * 0.45 + engageNorm * 0.25 + (1 - compNorm) * 0.30) * 100
  );

  // CTR proxy
  const tagListings = listings.filter(l => (l.tags || []).some(t => t.toLowerCase() === kw));
  const top3Views = tagListings.slice(0, 3).reduce((sum, l) => sum + (l.views || 0), 0) / 3;
  const ctrProxy = totalResults > 0 ? Math.round((top3Views / totalResults) * 10000) / 100 : 0;

  // Trend signal — favorites-to-views ratio
  const avgFavs = (tagFavorites[kw] || 0) / freq;
  const favViewRatio = avgViews > 0 ? avgFavs / avgViews : 0;
  const trend = favViewRatio > 0.05 ? 'rising' : favViewRatio > 0.02 ? 'stable' : 'declining';

  return {
    keyword: kw,
    searches: estimatedVolume,
    clicks: Math.max(0, Math.round(estimatedVolume * ctrProxy / 100)),
    ctr: ctrProxy > 0 ? `${ctrProxy}%` : '—',
    competition: competitionPct,
    trend,
    // Extended fields for internal use / DB storage
    demandScore,
    estimatedVolume,
    volumeTier: estimateVolumeTier(estimatedVolume),
    competitionPct,
    competitionLevel: competitionPct > 70 ? 'high' : competitionPct > 30 ? 'medium' : 'low',
    opportunityScore: calculateOpportunityScore(estimatedVolume, competitionPct),
    ctrProxy,
  };
}

/**
 * Deep-analyze a single keyword.
 * Returns volume, competition, avgPrice, totalListings, trend, related keywords, and suggested tags.
 * 
 * @param {string} seedKeyword
 * @param {Object} [options] - { country }
 * @returns {{ success, data, serpCalls, error, errorCode }}
 */
const deepAnalyzeKeyword = async (seedKeyword, options = {}) => {
  const { country } = options;
  log.info(`deepAnalyzeKeyword: seedKeyword="${seedKeyword}" country=${country || 'ALL'}`);
  // Primary search — get top listings + aggregate data
  const primary = await fetchListings(seedKeyword, 100, { country });

  if (!primary.success) {
    log.error(`deepAnalyzeKeyword: primary fetch FAILED for "${seedKeyword}" - code=${primary.code}`);
    return {
      success: false,
      data: null,
      serpCalls: 1,
      error: primary.error,
      errorCode: primary.code,
    };
  }

  const listings = primary.listings;
  const totalResults = primary.totalResults;

  if (totalResults === 0 || listings.length === 0) {
    return {
      success: true,
      data: {
        keyword: seedKeyword,
        volume: 0,
        competition: 0,
        avgPrice: 0,
        totalListings: 0,
        ctr: '—',
        seasonality: 'year-round',
        trend: 'stable',
        trendPct: 0,
        monthlyData: [],
        relatedKeywords: [],
        suggestedTags: [],
      },
      serpCalls: 1,
      error: null,
      errorCode: null,
    };
  }

  // Aggregate pricing
  const prices = listings
    .map(l => parseFloat(l.price?.amount || l.price) / (l.price?.divisor || 100))
    .filter(p => p > 0 && !isNaN(p));
  const avgPrice = prices.length > 0
    ? Math.round(prices.reduce((s, p) => s + p, 0) / prices.length * 100) / 100
    : 0;

  // ── Price Distribution ──
  let priceDistribution = null;
  if (prices.length > 0) {
    const sorted = [...prices].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const medianPrice = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
    const buckets = [
      { range: '$0–10', min: 0, max: 10 },
      { range: '$10–25', min: 10, max: 25 },
      { range: '$25–50', min: 25, max: 50 },
      { range: '$50–100', min: 50, max: 100 },
      { range: '$100+', min: 100, max: Infinity },
    ];
    priceDistribution = {
      min: Math.round(sorted[0] * 100) / 100,
      max: Math.round(sorted[sorted.length - 1] * 100) / 100,
      median: Math.round(medianPrice * 100) / 100,
      avg: avgPrice,
      ranges: buckets.map(b => {
        const count = prices.filter(p => p >= b.min && (b.max === Infinity ? true : p < b.max)).length;
        return { range: b.range, count, pct: Math.round((count / prices.length) * 100) };
      }),
    };
  }

  // Competition: tag frequency for seed keyword
  const exactTagMatches = listings.filter(l =>
    (l.tags || []).some(t => t.toLowerCase() === seedKeyword.toLowerCase())
  ).length;
  const competitionPct = Math.round((exactTagMatches / Math.max(listings.length, 1)) * 100);

  // CTR proxy
  const top3Views = listings.slice(0, 3).reduce((sum, l) => sum + (l.views || 0), 0) / 3;
  const ctrProxy = totalResults > 0 ? Math.round((top3Views / totalResults) * 10000) / 100 : 0;

  // Engagement & trend
  const avgViews = listings.reduce((s, l) => s + (l.views || 0), 0) / listings.length;
  const avgFavs = listings.reduce((s, l) => s + (l.num_favorers || 0), 0) / listings.length;
  const favViewRatio = avgViews > 0 ? avgFavs / avgViews : 0;
  const trend = favViewRatio > 0.05 ? 'rising' : favViewRatio > 0.02 ? 'stable' : 'declining';
  const trendPct = Math.round(favViewRatio * 100);

  // Extract related keywords from tags
  const tagFrequency = {};
  for (const listing of listings) {
    for (const tag of (listing.tags || [])) {
      const normalized = tag.toLowerCase().trim();
      if (normalized && normalized !== seedKeyword.toLowerCase() && normalized.length > 2) {
        tagFrequency[normalized] = (tagFrequency[normalized] || 0) + 1;
      }
    }
  }

  // Top related keywords sorted by frequency
  const relatedKeywords = Object.entries(tagFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([kw, freq]) => ({
      keyword: kw,
      relevance: Math.round((freq / listings.length) * 100),
    }));

  // Suggested tags: top 13 most frequent tags (Etsy max is 13)
  const suggestedTags = Object.entries(tagFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 13)
    .map(([kw]) => kw);

  // Deep sub-queries: analyze top 10 related keywords for volume data
  let serpCalls = 1;
  const deepResults = [];

  const keywordsToDeepScan = relatedKeywords.slice(0, 10);

  for (const rel of keywordsToDeepScan) {
    const kwCacheKey = `kw:vol:${hashKey(rel.keyword)}`;
    let kwData = await redis.get(kwCacheKey);

    if (!kwData) {
      const kwResult = await fetchListings(rel.keyword, 25, { country });
      serpCalls++;

      if (kwResult.success) {
        const kwTotal = kwResult.totalResults;
        const kwListings = kwResult.listings;

        const kwExactTag = kwListings.filter(l =>
          (l.tags || []).some(t => t.toLowerCase() === rel.keyword)
        ).length;
        const kwComp = Math.round((kwExactTag / Math.max(kwListings.length, 1)) * 100);

        kwData = {
          keyword: rel.keyword,
          searches: kwTotal,
          competition: kwComp,
          trend: 'stable',
          opportunityScore: calculateOpportunityScore(kwTotal, kwComp),
        };

        await redis.set(kwCacheKey, kwData, 21600);
      }
    }

    if (kwData) {
      deepResults.push(kwData);
    }
  }

  // Enrich relatedKeywords with volume data from deep scan
  const deepMap = new Map(deepResults.map(d => [d.keyword, d]));
  const enrichedRelated = relatedKeywords.map(rk => {
    const deep = deepMap.get(rk.keyword);
    return {
      keyword: rk.keyword,
      relevance: rk.relevance,
      searches: deep?.searches || 0,
      competition: deep?.competition || 0,
    };
  });

  // ── Competitor Listings with SEO Scores (top 5) ──
  const seedLower = seedKeyword.toLowerCase();
  const competitors = listings.slice(0, 5).map(l => {
    const tags = (l.tags || []).map(t => t.toLowerCase().trim());

    // Tag score (30 pts): seed keyword in tags (15) + tag fill ratio (15)
    const hasSeedTag = tags.includes(seedLower) ? 15 : 0;
    const tagFill = Math.round((tags.length / 13) * 15);
    const tagScore = hasSeedTag + tagFill;

    // Title score (25 pts): seed keyword in title (15) + title length optimal 80-140 (10)
    const titleText = (l.title || '');
    const hasSeedTitle = titleText.toLowerCase().includes(seedLower) ? 15 : 0;
    const tLen = titleText.length;
    const titleLenScore = (tLen >= 80 && tLen <= 140) ? 10 : (tLen >= 40 ? 5 : 0);
    const titleScore = hasSeedTitle + titleLenScore;

    // Engagement score (25 pts): views (15) + favorites (10), log-scaled
    const views = l.views || 0;
    const favs = l.num_favorers || 0;
    const viewScore = Math.min(15, Math.round(Math.log10(Math.max(views, 1)) * 3));
    const favScore = Math.min(10, Math.round(Math.log10(Math.max(favs, 1)) * 2.5));
    const engagementScore = viewScore + favScore;

    // Price competitiveness (20 pts): proximity to market average
    const listingPrice = parseFloat(l.price?.amount || l.price) / (l.price?.divisor || 100);
    const priceDiff = avgPrice > 0 ? Math.abs(listingPrice - avgPrice) / avgPrice : 0;
    const priceScore = Math.max(0, Math.round(20 * (1 - Math.min(priceDiff, 1))));

    const seoScore = Math.min(100, tagScore + titleScore + engagementScore + priceScore);

    // Listing age in days
    const createdTs = l.created_timestamp ? l.created_timestamp * 1000 : null;
    const listingAge = createdTs ? Math.round((Date.now() - createdTs) / (86400000)) : null;

    return {
      title: titleText,
      price: Math.round(listingPrice * 100) / 100,
      views,
      favorites: favs,
      listingAge,
      seoScore,
      seoBreakdown: { tags: tagScore, title: titleScore, engagement: engagementScore, price: priceScore },
      url: `https://www.etsy.com/listing/${l.listing_id}`,
    };
  });

  // ── Google Trends Monthly Data ──
  let monthlyData = [];
  let seasonality = 'year-round';
  let trendFromGoogle = null;
  try {
    const geoCode = (country && country.toUpperCase() !== 'GLOBAL') ? country : '';
    const trendsResult = await getInterestOverTime(seedKeyword, { geo: geoCode });
    if (trendsResult.success && trendsResult.weekly && trendsResult.weekly.length > 0) {
      // Aggregate weekly data into monthly buckets
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyMap = {};
      for (const w of trendsResult.weekly) {
        const d = new Date(w.time);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (!monthlyMap[key]) monthlyMap[key] = { sum: 0, count: 0, month: monthNames[d.getMonth()], time: d.getTime() };
        monthlyMap[key].sum += w.value;
        monthlyMap[key].count++;
      }
      monthlyData = Object.values(monthlyMap)
        .sort((a, b) => a.time - b.time)
        .map(m => ({ month: m.month, vol: Math.round(m.sum / m.count) }));

      seasonality = trendsResult.seasonality || 'year-round';
      trendFromGoogle = trendsResult.trend;
    }
  } catch (tErr) {
    log.warn(`deepAnalyzeKeyword: Google Trends failed for "${seedKeyword}": ${tErr.message}`);
  }

  // Use Google Trends direction if available, otherwise fall back to fav-view heuristic
  const finalTrend = trendFromGoogle || trend;

  return {
    success: true,
    data: {
      keyword: seedKeyword,
      volume: totalResults,
      competition: competitionPct,
      avgPrice,
      totalListings: totalResults,
      ctr: ctrProxy > 0 ? `${ctrProxy}%` : '—',
      seasonality,
      trend: finalTrend,
      trendPct,
      monthlyData,
      relatedKeywords: enrichedRelated,
      suggestedTags,
      priceDistribution,
      competitors,
    },
    serpCalls,
    error: null,
    errorCode: null,
  };
};

/**
 * Get competition data for a single keyword (lightweight).
 * Used by tag analyzer and listing audit.
 * @param {string} keyword
 * @returns {{ totalResults, competitionPct, competitionLevel }}
 */
const getCompetitionData = async (keyword) => {
  log.info(`getCompetitionData: keyword="${keyword}"`);
  const cacheKey = `kw:comp:${hashKey(keyword)}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    log.debug(`getCompetitionData: cache HIT for "${keyword}"`);
    return cached;
  }

  const result = await fetchListings(keyword, 5);

  const data = {
    totalResults: result.success ? result.totalResults : 0,
    competitionPct: 0,
    competitionLevel: 'unknown',
  };

  if (result.success && result.totalResults > 0) {
    data.competitionLevel = result.totalResults > 100000 ? 'high'
      : result.totalResults > 10000 ? 'medium' : 'low';
    data.competitionPct = result.totalResults > 100000 ? 80
      : result.totalResults > 10000 ? 50 : 20;
  }

  await redis.set(cacheKey, data, 21600);
  return data;
};

// ── Helpers ──

function hashKey(str) {
  return crypto.createHash('md5').update(str.toLowerCase()).digest('hex').substring(0, 12);
}

function estimateVolumeTier(count) {
  if (count > 50000) return 'very_high';
  if (count > 10000) return 'high';
  if (count > 1000) return 'medium';
  return 'low';
}

function calculateOpportunityScore(volume, competitionPct) {
  const volumeNorm = Math.min(1, Math.log10(Math.max(volume, 1)) / 5);
  const compNorm = competitionPct / 100;
  return Math.round(volumeNorm * (1 - compNorm) * 100);
}

module.exports = {
  fetchListings,
  getRelatedKeywords,
  deepAnalyzeKeyword,
  getCompetitionData,
  analyzeKeyword,
  estimateVolumeTier,
  calculateOpportunityScore,
};
