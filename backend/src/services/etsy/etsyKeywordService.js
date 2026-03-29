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

/**
 * Search Etsy for a keyword and return enriched results.
 * @param {string} keyword - The seed keyword
 * @param {number} limit - Number of listings to fetch (default 100)
 * @returns {{ success, listings, totalResults, error, code }}
 */
const fetchListings = async (keyword, limit = 100) => {
  const result = await etsyApi.publicRequest(
    'GET',
    '/v3/application/listings/active',
    { params: { keywords: keyword, limit, sort_on: 'score' } }
  );

  if (!result.success) {
    return {
      success: false,
      listings: [],
      totalResults: 0,
      error: result.error,
      code: result.code || 'API_ERROR',
    };
  }

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
 * @param {string} seedKeyword
 * @returns {{ success, results: Array, totalResults: number, serpCalls: number, error, errorCode }}
 */
const getRelatedKeywords = async (seedKeyword) => {
  // Fetch top-100 listings for the seed keyword
  const primary = await fetchListings(seedKeyword, 100);

  if (!primary.success) {
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

  const listings = primary.listings;
  const totalResults = primary.totalResults;

  // Extract autocomplete-style bigrams from top-ranked titles
  const autocompleteSuggestions = new Set();
  const seedFirstWord = seedKeyword.toLowerCase().split(' ')[0];
  for (const l of listings.slice(0, 25)) {
    const titleWords = l.title.toLowerCase().split(/[\s\-–—,|·]+/).filter(w => w.length > 2);
    for (let i = 0; i < titleWords.length - 1; i++) {
      const bigram = `${titleWords[i]} ${titleWords[i + 1]}`;
      if (bigram.includes(seedFirstWord)) {
        autocompleteSuggestions.add(bigram);
      }
    }
  }

  // Build tag frequency, view, and favorites accumulators
  const tagFrequency = {};
  const tagViewAccum = {};
  const tagFavorites = {};
  for (const listing of listings) {
    for (const tag of (listing.tags || [])) {
      const normalized = tag.toLowerCase().trim();
      if (normalized && normalized !== seedKeyword.toLowerCase()) {
        tagFrequency[normalized] = (tagFrequency[normalized] || 0) + 1;
        tagViewAccum[normalized] = (tagViewAccum[normalized] || 0) + (listing.views || 0);
        tagFavorites[normalized] = (tagFavorites[normalized] || 0) + (listing.num_favorers || 0);
      }
    }
  }

  // Sort by frequency, take top 25 candidates
  const topKeywords = Object.entries(tagFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25);

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
  results.splice(20);

  return {
    success: true,
    results,
    totalResults,
    serpCalls: 1,
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
  const trend = favViewRatio > 0.05 ? 'up' : favViewRatio > 0.02 ? 'stable' : 'down';

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
 * @returns {{ success, data, serpCalls, error, errorCode }}
 */
const deepAnalyzeKeyword = async (seedKeyword) => {
  // Primary search — get top listings + aggregate data
  const primary = await fetchListings(seedKeyword, 100);

  if (!primary.success) {
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
  const trend = favViewRatio > 0.05 ? 'up' : favViewRatio > 0.02 ? 'stable' : 'down';
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
      const kwResult = await fetchListings(rel.keyword, 25);
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

  return {
    success: true,
    data: {
      keyword: seedKeyword,
      volume: totalResults,
      competition: competitionPct,
      avgPrice,
      totalListings: totalResults,
      ctr: ctrProxy > 0 ? `${ctrProxy}%` : '—',
      seasonality: 'year-round',
      trend,
      trendPct,
      monthlyData: [],
      relatedKeywords: enrichedRelated,
      suggestedTags,
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
  const cacheKey = `kw:comp:${hashKey(keyword)}`;
  const cached = await redis.get(cacheKey);
  if (cached) return cached;

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
