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
const keywordService = require('../../services/etsy/etsyKeywordService');
const redis = require('../../services/cache/redisService');
const crypto = require('crypto');
const log = require('../../utils/logger')('KeywordCtrl');

const SERP_COST_PER_REQ = 0.0025;

// Plan-based result limits for keyword search
const PLAN_RESULT_LIMITS = {
  'Free': 5,
  'Starter': 25,
  'Pro': 75,
  'Elite': Infinity,
};

/**
 * POST /api/v1/customer/keywords/search
 * Basic keyword search — returns related keywords with volume estimates.
 */
const searchKeywords = async (req, res) => {
  try {
    const { keyword, country } = req.body;
    log.info(`searchKeywords: userId=${req.userId} keyword="${keyword}" country=${country || 'ALL'}`);

    if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Keyword is required',
      });
    }

    const seedKeyword = keyword.trim().substring(0, 100);
    const countryCode = (country && typeof country === 'string') ? country.trim().toUpperCase() : null;
    const cacheKey = `kw:${hashKey(seedKeyword + (countryCode || ''))}`;

    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      await KeywordSearch.create({
        userId: req.userId,
        seedKeyword,
        searchType: 'basic',
        results: cached,
        resultCount: cached.length,
        serpCallCount: 0,
      });

      // Plan-based slicing on cached results too
      const planName = req.user?.planSnapshot?.planName || 'Free';
      const maxResults = PLAN_RESULT_LIMITS[planName] ?? 5;
      const slicedCached = Number.isFinite(maxResults) ? cached.slice(0, maxResults) : cached;

      return res.json({
        success: true,
        data: {
          keyword: seedKeyword,
          results: slicedCached,
          cached: true,
          totalKeywords: cached.length,
          returnedKeywords: slicedCached.length,
          plan: planName,
        },
      });
    }

    // Use the keyword service for the actual estimation
    const searchData = await keywordService.getRelatedKeywords(seedKeyword, { country: countryCode });

    // Distinguish API error from genuine 0 results
    if (!searchData.success) {
      log.error(`searchKeywords: API FAILED for "${seedKeyword}" - errorCode=${searchData.errorCode} detail=${searchData.error}`);
      return res.status(502).json({
        success: false,
        message: 'Unable to fetch keyword data from Etsy',
        errorCode: searchData.errorCode,
        detail: searchData.error,
      });
    }

    const results = searchData.results;

    log.info(`searchKeywords: SUCCESS for "${seedKeyword}" - ${results.length} results, ${searchData.serpCalls} SERP calls`);

    // Cache full results (even if empty — means the keyword genuinely has no data)
    await redis.set(cacheKey, results, 21600);

    // Save full results to DB
    await KeywordSearch.create({
      userId: req.userId,
      seedKeyword,
      searchType: 'basic',
      results,
      resultCount: results.length,
      serpCallCount: searchData.serpCalls,
    });

    // Log SERP cost
    if (searchData.serpCalls > 0) {
      await SerpCostLog.create({
        userId: req.userId,
        featureKey: 'keyword_search',
        action: `keyword_search:${seedKeyword}`,
        requestCount: searchData.serpCalls,
        costUsd: searchData.serpCalls * SERP_COST_PER_REQ,
        cacheHit: false,
      });
    }

    // Plan-based result slicing — return only what the plan allows
    const planName = req.user?.planSnapshot?.planName || 'Free';
    const maxResults = PLAN_RESULT_LIMITS[planName] ?? 5;
    const slicedResults = Number.isFinite(maxResults) ? results.slice(0, maxResults) : results;

    return res.json({
      success: true,
      data: {
        keyword: seedKeyword,
        results: slicedResults,
        cached: false,
        totalResults: searchData.totalResults,
        totalKeywords: results.length,
        returnedKeywords: slicedResults.length,
        plan: planName,
      },
    });
  } catch (error) {
    log.error(`searchKeywords: EXCEPTION - ${error.message}`, error.stack);
    return res.status(500).json({
      success: false,
      message: 'Failed to search keywords',
    });
  }
};

/**
 * POST /api/v1/customer/keywords/deep-analysis
 * Deep keyword analysis — aggregate stats with related keywords & tag suggestions.
 */
const deepAnalysis = async (req, res) => {
  try {
    const { keyword, country } = req.body;

    if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Keyword is required',
      });
    }

    const seedKeyword = keyword.trim().substring(0, 100);
    const countryCode = (country && typeof country === 'string') ? country.trim().toUpperCase() : null;
    const cacheKey = `kw:deep:${hashKey(seedKeyword + (countryCode || ''))}`;

    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      await KeywordSearch.create({
        userId: req.userId,
        seedKeyword,
        searchType: 'deep',
        results: cached.relatedKeywords || [],
        resultCount: (cached.relatedKeywords || []).length,
        serpCallCount: 0,
      });

      return res.json({
        success: true,
        data: cached,
      });
    }

    // Use the keyword service for deep analysis
    const analysis = await keywordService.deepAnalyzeKeyword(seedKeyword, { country: countryCode });

    // Distinguish API error from genuine 0 results
    if (!analysis.success) {
      return res.status(502).json({
        success: false,
        message: 'Unable to fetch keyword data from Etsy',
        errorCode: analysis.errorCode,
        detail: analysis.error,
      });
    }

    const data = analysis.data;

    // Cache the full analysis
    await redis.set(cacheKey, data, 21600);

    // Save to DB
    await KeywordSearch.create({
      userId: req.userId,
      seedKeyword,
      searchType: 'deep',
      results: data.relatedKeywords || [],
      resultCount: (data.relatedKeywords || []).length,
      serpCallCount: analysis.serpCalls,
    });

    // Log SERP cost
    if (analysis.serpCalls > 0) {
      await SerpCostLog.create({
        userId: req.userId,
        featureKey: 'keyword_deep_analysis',
        action: `deep_analysis:${seedKeyword}`,
        requestCount: analysis.serpCalls,
        costUsd: analysis.serpCalls * SERP_COST_PER_REQ,
        cacheHit: false,
      });
    }

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    log.error(`deepAnalysis: EXCEPTION - ${error.message}`, error.stack);
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
    log.error('Keyword history error:', error.message);
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

module.exports = { searchKeywords, deepAnalysis, getKeywordHistory };
