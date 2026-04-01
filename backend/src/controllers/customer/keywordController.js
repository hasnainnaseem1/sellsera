/**
 * Keyword Controller
 * 
 * POST /api/v1/customer/keywords/search        → Basic keyword search
 * POST /api/v1/customer/keywords/deep-analysis  → Deep keyword analysis (20 sub-queries per seed)
 * GET  /api/v1/customer/keywords/history        → Keyword search history
 * GET  /api/v1/customer/keywords/trending        → Trending keywords from snapshot data
 * 
 * Feature keys: keyword_search, keyword_deep_analysis
 */

const { KeywordSearch } = require('../../models/customer');
const { SerpCostLog } = require('../../models/customer');
const KeywordSnapshot = require('../../models/customer/KeywordSnapshot');
const seedKeywordCategories = require('../../utils/constants/seedKeywords').categories;
const keywordService = require('../../services/etsy/etsyKeywordService');
const redis = require('../../services/cache/redisService');
const crypto = require('crypto');
const log = require('../../utils/logger')('KeywordCtrl');
const { isPlanAllowed, getRequiredPlan } = require('../../utils/constants/countryTiers');

const SERP_COST_PER_REQ = 0.0025;

// Plan-based result limits for keyword search
// Keys are lowercase for case-insensitive matching.
// Covers both Phase 1 names (Starter, Elite) and Phase 2 names (Basic, Pro Plus).
const PLAN_RESULT_LIMITS = {
  'free':      5,
  'basic':     25,
  'starter':   25,
  'pro':       75,
  'pro plus':  Infinity,
  'pro_plus':  Infinity,
  'elite':     Infinity,
  'unlimited': Infinity,
};

/**
 * Resolve how many keyword results the user's plan allows.
 * Uses planSnapshot.planName with case-insensitive matching.
 * Falls back to the feature-level limit from checkFeatureAccess if plan name is missing.
 */
function getResultLimit(req) {
  const planName = req.user?.planSnapshot?.planName;
  const key = (planName || '').toLowerCase().trim();

  log.info(`getResultLimit: planSnapshot.planName="${planName}" key="${key}" featureAccess.limit=${req.featureAccess?.limit}`);

  if (key && PLAN_RESULT_LIMITS[key] !== undefined) {
    return { limit: PLAN_RESULT_LIMITS[key], plan: planName };
  }

  // Fallback: if planName is unknown, use featureAccess.limit (set by checkFeatureAccess middleware)
  // High feature limits (500+) indicate a premium plan → don't slice at all
  const featureLimit = req.featureAccess?.limit;
  if (featureLimit && featureLimit >= 500) {
    return { limit: Infinity, plan: planName || 'unknown (feature-limit-based)' };
  }

  // Last resort: default to Free
  log.warn(`getResultLimit: could not resolve plan for user ${req.userId}, defaulting to Free (5)`);
  return { limit: 5, plan: planName || 'Free' };
}

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

    // Validate country against user's plan tier
    if (countryCode) {
      const planName = req.user?.planSnapshot?.planName || '';
      if (!isPlanAllowed(planName, countryCode)) {
        const required = getRequiredPlan(countryCode);
        log.warn(`searchKeywords: BLOCKED country=${countryCode} for plan="${planName}" (requires ${required})`);
        return res.status(403).json({
          success: false,
          errorCode: 'UPGRADE_REQUIRED',
          message: `The ${countryCode} market is available on the ${required} plan and above. Please upgrade to access this region.`,
          requiredPlan: required,
        });
      }
    }

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
      const { limit: maxCached, plan: cachedPlan } = getResultLimit(req);
      const slicedCached = Number.isFinite(maxCached) ? cached.slice(0, maxCached) : cached;
      log.info(`searchKeywords(cached): plan="${cachedPlan}" limit=${maxCached} total=${cached.length} returned=${slicedCached.length}`);

      return res.json({
        success: true,
        data: {
          keyword: seedKeyword,
          results: slicedCached,
          cached: true,
          totalKeywords: cached.length,
          returnedKeywords: slicedCached.length,
          plan: cachedPlan,
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
    const { limit: maxResults, plan: resolvedPlan } = getResultLimit(req);
    const slicedResults = Number.isFinite(maxResults) ? results.slice(0, maxResults) : results;
    log.info(`searchKeywords: plan="${resolvedPlan}" limit=${maxResults} total=${results.length} returned=${slicedResults.length}`);

    // ── Enrich with snapshot data (fusion score, Google Trends, freshness) ──
    const kwList = slicedResults.map(r => (r.keyword || '').toLowerCase());
    let snapshotMap = {};
    try {
      const snapshots = await KeywordSnapshot.find({
        keyword: { $in: kwList },
      })
        .sort({ snapshotDate: -1 })
        .lean();
      // Keep only the most recent snapshot per keyword
      for (const snap of snapshots) {
        if (!snapshotMap[snap.keyword]) {
          snapshotMap[snap.keyword] = snap;
        }
      }
    } catch (snapErr) {
      log.warn(`searchKeywords: snapshot enrichment failed: ${snapErr.message}`);
    }

    const enrichedResults = slicedResults.map(r => {
      const snap = snapshotMap[(r.keyword || '').toLowerCase()];
      if (!snap) return r;
      return {
        ...r,
        fusionScore: snap.fusionScore,
        googleTrendsInterest: snap.googleTrends?.interest ?? null,
        googleTrendDirection: snap.googleTrends?.trend ?? null,
        marketFreshness: snap.freshness?.marketSignal ?? null,
        velocityPerDay: snap.velocity?.avgViewsPerDay ?? null,
        snapshotDate: snap.snapshotDate,
      };
    });

    return res.json({
      success: true,
      data: {
        keyword: seedKeyword,
        results: enrichedResults,
        cached: false,
        totalResults: searchData.totalResults,
        totalKeywords: results.length,
        returnedKeywords: slicedResults.length,
        plan: resolvedPlan,
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

    // Validate country against user's plan tier
    if (countryCode) {
      const planName = req.user?.planSnapshot?.planName || '';
      if (!isPlanAllowed(planName, countryCode)) {
        const required = getRequiredPlan(countryCode);
        return res.status(403).json({
          success: false,
          errorCode: 'UPGRADE_REQUIRED',
          message: `The ${countryCode} market is available on the ${required} plan and above. Please upgrade to access this region.`,
          requiredPlan: required,
        });
      }
    }

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

    // ── Enrich with snapshot intelligence ──
    let snapshot = null;
    try {
      const snap = await KeywordSnapshot.findOne({ keyword: seedKeyword.toLowerCase() })
        .sort({ snapshotDate: -1 })
        .select('fusionScore googleTrends freshness velocity snapshotDate')
        .lean();
      if (snap) {
        snapshot = {
          fusionScore: snap.fusionScore,
          googleTrends: snap.googleTrends?.interest || null,
          googleTrendDirection: snap.googleTrends?.trend || null,
          marketSignal: snap.freshness?.marketSignal || null,
          velocityPerDay: snap.velocity?.avgViewsPerDay || null,
          snapshotDate: snap.snapshotDate,
        };
      }
    } catch (snapErr) {
      log.warn(`deepAnalysis: snapshot enrichment failed: ${snapErr.message}`);
    }

    // Merge snapshot into data
    const enrichedData = { ...data, snapshot };

    // Cache the full analysis
    await redis.set(cacheKey, enrichedData, 21600);

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
      data: enrichedData,
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

/**
 * GET /api/v1/customer/keywords/trending
 * Returns trending keywords from snapshot data — rising, hot, declining.
 * Plan-based tiering: Free=5 (all locked), Basic=3, Pro=5, Pro Plus=7
 * Query params: category (optional), limit (default 30)
 */

// How many *visible* (unlocked) trending keywords each plan gets
const TRENDING_PLAN_LIMITS = {
  'free':      0,  // Free sees 5 but all blurred/locked
  'basic':     3,
  'starter':   3,
  'pro':       5,
  'pro plus':  7,
  'pro_plus':  7,
  'elite':     Infinity,
  'unlimited': Infinity,
};

// Total keywords to return (visible + locked preview)
const TRENDING_DISPLAY_COUNT = {
  'free':      5,
  'basic':     7,
  'starter':   7,
  'pro':       10,
  'pro plus':  7,
  'pro_plus':  7,
  'elite':     30,
  'unlimited': 30,
};

function getTrendingLimit(planName) {
  const key = (planName || '').toLowerCase().trim();
  return {
    visible: TRENDING_PLAN_LIMITS[key] ?? 0,
    total: TRENDING_DISPLAY_COUNT[key] ?? 5,
    plan: planName || 'Free',
  };
}

const getTrendingKeywords = async (req, res) => {
  try {
    const { category, limit = 30, country } = req.query;
    const maxLimit = Math.min(parseInt(limit) || 30, 100);

    // Sanitize country: accept 2-letter ISO codes, default null (global)
    const requestedCountry = (country && /^[A-Za-z]{2}$/.test(country))
      ? country.toUpperCase()
      : null;

    // Build keyword filter based on category
    let keywordFilter = {};
    if (category && seedKeywordCategories[category]) {
      keywordFilter = { keyword: { $in: seedKeywordCategories[category].map(k => k.toLowerCase()) } };
    }

    // Get the most recent snapshot date
    const latestSnapshot = await KeywordSnapshot.findOne()
      .sort({ snapshotDate: -1 })
      .select('snapshotDate')
      .lean();

    if (!latestSnapshot) {
      return res.json({
        success: true,
        data: { trending: [], categories: Object.keys(seedKeywordCategories), lastUpdated: null, country: requestedCountry },
      });
    }

    const latestDate = latestSnapshot.snapshotDate;

    // Try country-specific snapshots first, fallback to global (null)
    let resolvedCountry = requestedCountry;
    let latest = [];

    if (requestedCountry) {
      latest = await KeywordSnapshot.find({
        ...keywordFilter,
        snapshotDate: latestDate,
        country: requestedCountry,
        fusionScore: { $ne: null },
      })
        .sort({ fusionScore: -1 })
        .limit(maxLimit * 3)
        .select('keyword totalResults avgViews avgFavorites competitionPct fusionScore googleTrends freshness velocity snapshotDate country')
        .lean();
    }

    // Fallback to global if no country-specific data
    if (!latest.length) {
      resolvedCountry = null;
      latest = await KeywordSnapshot.find({
        ...keywordFilter,
        snapshotDate: latestDate,
        country: null,
        fusionScore: { $ne: null },
      })
        .sort({ fusionScore: -1 })
        .limit(maxLimit * 3)
        .select('keyword totalResults avgViews avgFavorites competitionPct fusionScore googleTrends freshness velocity snapshotDate country')
        .lean();
    }

    if (!latest.length) {
      return res.json({
        success: true,
        data: { trending: [], categories: Object.keys(seedKeywordCategories), lastUpdated: latestDate, country: resolvedCountry },
      });
    }

    // Get previous snapshots for WoW comparison (same country scope)
    const prevDate = new Date(latestDate);
    prevDate.setDate(prevDate.getDate() - 7);

    const prevSnapshots = await KeywordSnapshot.find({
      keyword: { $in: latest.map(s => s.keyword) },
      country: resolvedCountry,
      snapshotDate: { $gte: prevDate, $lt: latestDate },
    })
      .select('keyword fusionScore totalResults')
      .lean();

    // Build prev lookup (average if multiple)
    const prevMap = {};
    for (const p of prevSnapshots) {
      if (!prevMap[p.keyword]) prevMap[p.keyword] = { scores: [], results: [] };
      prevMap[p.keyword].scores.push(p.fusionScore || 0);
      prevMap[p.keyword].results.push(p.totalResults || 0);
    }

    // Enrich with trend direction
    const enriched = latest.map(snap => {
      const prev = prevMap[snap.keyword];
      let trendDirection = 'new'; // no prior data
      let fusionChange = null;
      let volumeChange = null;

      if (prev && prev.scores.length > 0) {
        const avgPrevScore = prev.scores.reduce((a, b) => a + b, 0) / prev.scores.length;
        const avgPrevResults = prev.results.reduce((a, b) => a + b, 0) / prev.results.length;
        fusionChange = avgPrevScore > 0
          ? Math.round(((snap.fusionScore - avgPrevScore) / avgPrevScore) * 100)
          : null;
        volumeChange = avgPrevResults > 0
          ? Math.round(((snap.totalResults - avgPrevResults) / avgPrevResults) * 100)
          : null;

        if (fusionChange > 5) trendDirection = 'rising';
        else if (fusionChange < -5) trendDirection = 'declining';
        else trendDirection = 'stable';
      }

      // Determine category
      let kwCategory = null;
      for (const [catName, catKeywords] of Object.entries(seedKeywordCategories)) {
        if (catKeywords.some(k => k.toLowerCase() === snap.keyword)) {
          kwCategory = catName;
          break;
        }
      }

      return {
        keyword: snap.keyword,
        fusionScore: snap.fusionScore,
        totalResults: snap.totalResults,
        avgViews: snap.avgViews,
        avgFavorites: snap.avgFavorites,
        competition: snap.competitionPct,
        googleTrends: snap.googleTrends?.interest || null,
        googleTrendDirection: snap.googleTrends?.trend || null,
        freshness: snap.freshness?.marketSignal || null,
        velocity: snap.velocity?.avgViewsPerDay || null,
        trendDirection,
        fusionChange,
        volumeChange,
        category: kwCategory,
        snapshotDate: snap.snapshotDate,
      };
    });

    // Sort: rising first, then by fusion score
    enriched.sort((a, b) => {
      const dirOrder = { rising: 0, new: 1, stable: 2, declining: 3 };
      const dA = dirOrder[a.trendDirection] ?? 2;
      const dB = dirOrder[b.trendDirection] ?? 2;
      if (dA !== dB) return dA - dB;
      return (b.fusionScore || 0) - (a.fusionScore || 0);
    });

    // ── Plan-based tiering ──
    const planName = req.user?.planSnapshot?.planName;
    const { visible, total, plan: resolvedPlan } = getTrendingLimit(planName);
    const isFree = (resolvedPlan || '').toLowerCase().trim() === 'free' || !planName;

    const sliced = enriched.slice(0, total);

    // Mark keywords as locked/unlocked based on plan
    const tiered = sliced.map((kw, idx) => {
      const isLocked = isFree ? true : idx >= visible;
      return {
        ...kw,
        isLocked,
        // Mask sensitive data for locked keywords
        ...(isLocked ? {
          keyword: kw.keyword, // keep keyword name visible (blurred in UI)
          fusionScore: kw.fusionScore,
          trendDirection: kw.trendDirection,
          // Redact detailed metrics
          totalResults: null,
          avgViews: null,
          avgFavorites: null,
          competition: null,
          googleTrends: null,
          googleTrendDirection: null,
          freshness: null,
          velocity: null,
          fusionChange: null,
          volumeChange: null,
        } : {}),
      };
    });

    return res.json({
      success: true,
      data: {
        trending: tiered,
        categories: Object.keys(seedKeywordCategories),
        lastUpdated: latestDate,
        plan: resolvedPlan,
        visibleLimit: visible,
        totalLimit: total,
        country: resolvedCountry,
        requestedCountry: requestedCountry,
        isFallback: requestedCountry !== null && resolvedCountry === null,
      },
    });
  } catch (error) {
    log.error('Trending keywords error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve trending keywords',
    });
  }
};

module.exports = { searchKeywords, deepAnalysis, getKeywordHistory, getTrendingKeywords };
