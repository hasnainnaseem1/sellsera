/**
 * Keyword Controller
 * 
 * POST /api/v1/customer/keywords/search        → Basic keyword search
 * POST /api/v1/customer/keywords/deep-analysis  → Deep keyword analysis (20 sub-queries per seed)
 * GET  /api/v1/customer/keywords/history        → Keyword search history
 * 
 * Feature keys: keyword_search, keyword_deep_analysis
 */

const { KeywordSearch } = require('../../models/customer');
const { SerpCostLog } = require('../../models/customer');
const etsyApi = require('../../services/etsy/etsyApiService');
const redis = require('../../services/cache/redisService');
const crypto = require('crypto');

const SERP_COST_PER_REQ = 0.0025;

/**
 * POST /api/v1/customer/keywords/search
 * Basic keyword search — returns related keywords with volume estimates.
 */
const searchKeywords = async (req, res) => {
  try {
    const { keyword } = req.body;

    if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Keyword is required',
      });
    }

    const seedKeyword = keyword.trim().substring(0, 100);
    const cacheKey = `kw:${hashKey(seedKeyword)}`;

    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      // Save search record even for cached results (but don't charge SERP cost)
      await KeywordSearch.create({
        userId: req.userId,
        seedKeyword,
        searchType: 'basic',
        results: cached,
        resultCount: cached.length,
        serpCallCount: 0,
      });

      return res.json({
        success: true,
        data: { keyword: seedKeyword, results: cached, cached: true },
      });
    }

    // Fetch from Etsy search API
    const searchResult = await etsyApi.publicRequest(
      'GET',
      '/v3/application/listings/active',
      { params: { keywords: seedKeyword, limit: 100, sort_on: 'score' } }
    );

    let serpCalls = 1;
    const results = [];

    if (searchResult.success) {
      const totalResults = searchResult.data.count || 0;

      // Extract keyword suggestions from listing tags
      const tagFrequency = {};
      for (const listing of (searchResult.data.results || [])) {
        for (const tag of (listing.tags || [])) {
          const normalized = tag.toLowerCase().trim();
          if (normalized && normalized !== seedKeyword.toLowerCase()) {
            tagFrequency[normalized] = (tagFrequency[normalized] || 0) + 1;
          }
        }
      }

      // Sort by frequency, take top 20
      const topKeywords = Object.entries(tagFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);

      for (const [kw, freq] of topKeywords) {
        const competitionPct = Math.min(100, Math.round((freq / Math.max(totalResults / 100, 1)) * 100));
        const volumeTier = estimateVolumeTier(totalResults * (freq / topKeywords[0]?.[1] || 1));
        const opportunityScore = calculateOpportunityScore(totalResults, competitionPct);

        results.push({
          keyword: kw,
          estimatedVolume: Math.round(totalResults * (freq / (topKeywords[0]?.[1] || 1))),
          volumeTier,
          competitionPct,
          competitionLevel: competitionPct > 70 ? 'high' : competitionPct > 30 ? 'medium' : 'low',
          trend: 'stable',
          opportunityScore,
          ctrProxy: 0,
        });
      }

      results.sort((a, b) => b.opportunityScore - a.opportunityScore);
    }

    // Cache results
    await redis.set(cacheKey, results, 21600); // 6 hours

    // Save to DB
    await KeywordSearch.create({
      userId: req.userId,
      seedKeyword,
      searchType: 'basic',
      results,
      resultCount: results.length,
      serpCallCount: serpCalls,
    });

    // Log SERP cost
    await SerpCostLog.create({
      userId: req.userId,
      featureKey: 'keyword_search',
      action: `keyword_search:${seedKeyword}`,
      requestCount: serpCalls,
      costUsd: serpCalls * SERP_COST_PER_REQ,
      cacheHit: false,
    });

    return res.json({
      success: true,
      data: { keyword: seedKeyword, results, cached: false },
    });
  } catch (error) {
    console.error('Keyword search error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to search keywords',
    });
  }
};

/**
 * POST /api/v1/customer/keywords/deep-analysis
 * Deep keyword analysis — 20 sub-queries per seed keyword.
 */
const deepAnalysis = async (req, res) => {
  try {
    const { keyword } = req.body;

    if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Keyword is required',
      });
    }

    const seedKeyword = keyword.trim().substring(0, 100);
    const cacheKey = `kw:deep:${hashKey(seedKeyword)}`;

    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      await KeywordSearch.create({
        userId: req.userId,
        seedKeyword,
        searchType: 'deep',
        results: cached,
        resultCount: cached.length,
        serpCallCount: 0,
      });

      return res.json({
        success: true,
        data: { keyword: seedKeyword, results: cached, cached: true },
      });
    }

    // First, get related keywords via basic search
    const searchResult = await etsyApi.publicRequest(
      'GET',
      '/v3/application/listings/active',
      { params: { keywords: seedKeyword, limit: 100, sort_on: 'score' } }
    );

    let serpCalls = 1;
    const relatedKeywords = new Set();

    if (searchResult.success) {
      for (const listing of (searchResult.data.results || [])) {
        for (const tag of (listing.tags || [])) {
          relatedKeywords.add(tag.toLowerCase().trim());
        }
      }
    }

    // Take top 20 unique related keywords
    const keywordsToAnalyze = [...relatedKeywords]
      .filter(k => k !== seedKeyword.toLowerCase() && k.length > 2)
      .slice(0, 20);

    // Deep analyze each keyword
    const results = [];

    for (const kw of keywordsToAnalyze) {
      const kwCacheKey = `kw:vol:${hashKey(kw)}`;
      let kwData = await redis.get(kwCacheKey);

      if (!kwData) {
        const kwResult = await etsyApi.publicRequest(
          'GET',
          '/v3/application/listings/active',
          { params: { keywords: kw, limit: 25 } }
        );
        serpCalls++;

        if (kwResult.success) {
          const totalResults = kwResult.data.count || 0;
          const listings = kwResult.data.results || [];

          // Competition: % of first-page listings with exact-match tag
          const exactTagMatches = listings.filter(l =>
            (l.tags || []).some(t => t.toLowerCase() === kw)
          ).length;
          const competitionPct = Math.round((exactTagMatches / Math.max(listings.length, 1)) * 100);

          // CTR proxy: top-3 avg views / total results
          const top3Views = listings.slice(0, 3).reduce((sum, l) => sum + (l.views || 0), 0) / 3;
          const ctrProxy = totalResults > 0 ? Math.round((top3Views / totalResults) * 10000) / 100 : 0;

          kwData = {
            keyword: kw,
            estimatedVolume: totalResults,
            volumeTier: estimateVolumeTier(totalResults),
            competitionPct,
            competitionLevel: competitionPct > 70 ? 'high' : competitionPct > 30 ? 'medium' : 'low',
            trend: 'stable',
            opportunityScore: calculateOpportunityScore(totalResults, competitionPct),
            ctrProxy,
          };

          await redis.set(kwCacheKey, kwData, 21600);
        }
      }

      if (kwData) {
        results.push(kwData);
      }
    }

    results.sort((a, b) => b.opportunityScore - a.opportunityScore);

    // Cache
    await redis.set(cacheKey, results, 21600);

    // Save
    await KeywordSearch.create({
      userId: req.userId,
      seedKeyword,
      searchType: 'deep',
      results,
      resultCount: results.length,
      serpCallCount: serpCalls,
    });

    // Log SERP cost
    await SerpCostLog.create({
      userId: req.userId,
      featureKey: 'keyword_deep_analysis',
      action: `deep_analysis:${seedKeyword}`,
      requestCount: serpCalls,
      costUsd: serpCalls * SERP_COST_PER_REQ,
      cacheHit: false,
    });

    return res.json({
      success: true,
      data: { keyword: seedKeyword, results, cached: false, serpCalls },
    });
  } catch (error) {
    console.error('Deep keyword analysis error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to perform deep analysis',
    });
  }
};

/**
 * GET /api/v1/customer/keywords/history
 */
const getKeywordHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { userId: req.userId };
    if (type) query.searchType = type;

    const [searches, total] = await Promise.all([
      KeywordSearch.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('seedKeyword searchType resultCount serpCallCount createdAt'),
      KeywordSearch.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: {
        searches,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Keyword history error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve keyword history',
    });
  }
};

// --- Helpers ---

function hashKey(str) {
  return crypto.createHash('md5').update(str.toLowerCase()).digest('hex').substring(0, 12);
}

function estimateVolumeTier(resultCount) {
  if (resultCount > 50000) return 'very_high';
  if (resultCount > 10000) return 'high';
  if (resultCount > 1000) return 'medium';
  return 'low';
}

function calculateOpportunityScore(volume, competitionPct) {
  // Opportunity = volume signal × (1 - competition)
  const volumeNorm = Math.min(1, Math.log10(Math.max(volume, 1)) / 5); // log-scale 0-1
  const compNorm = competitionPct / 100;
  return Math.round(volumeNorm * (1 - compNorm) * 100);
}

module.exports = { searchKeywords, deepAnalysis, getKeywordHistory };
