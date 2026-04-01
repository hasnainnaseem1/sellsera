/**
 * Tag Analyzer Controller
 * 
 * POST /api/v1/customer/tag-analyzer          → Analyze tags for a listing
 * 
 * Feature key: tag_analysis
 * 
 * Per-tag scoring:
 * - Quality score (0-100): length, multi-word, relevance to title
 * - Competition: search result count
 * - Status: Excellent (>=80), Good (60-79), Needs Work (<60)
 * - Suggestions for low-scoring tags
 */

const { SerpCostLog, KeywordSearch, TagAnalysis } = require('../../models/customer');
const etsyApi = require('../../services/etsy/etsyApiService');
const redis = require('../../services/cache/redisService');
const { CODE_TO_LOCATION } = require('../../utils/constants/etsyCountries');
const { isPlanAllowed } = require('../../utils/constants/countryTiers');
const crypto = require('crypto');
const log = require('../../utils/logger')('TagAnalyzer');

const SERP_COST_PER_REQ = 0.0025;

/**
 * POST /api/v1/customer/tag-analyzer
 */
const analyzeTags = async (req, res) => {
  try {
    const { tags, title, category, country: rawCountry } = req.body;
    const country = (rawCountry || 'US').toUpperCase().trim();

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one tag is required',
      });
    }

    // Plan-tier country gating
    const planName = req.user?.planSnapshot?.planName || 'free';
    if (!isPlanAllowed(planName, country)) {
      return res.status(403).json({
        success: false,
        errorCode: 'UPGRADE_REQUIRED',
        message: `Your current plan does not include access to the ${country} market. Please upgrade.`,
      });
    }

    // Title is optional — use empty string if not provided
    const listingTitle = (title && typeof title === 'string') ? title : '';

    const tagList = tags
      .map(t => (typeof t === 'string' ? t.trim() : ''))
      .filter(t => t.length > 0)
      .slice(0, 13);

    // Build search params with country support
    const baseSearchParams = { limit: 25 };
    if (country && country !== 'GLOBAL') {
      const loc = CODE_TO_LOCATION[country] || country;
      baseSearchParams.shop_location = loc;
    }

    let totalSerpCalls = 0;
    const results = [];

    for (const tag of tagList) {
      const cacheKey = `tag:${hashKey(tag)}`;
      let tagData = await redis.get(cacheKey);

      if (!tagData) {
        // Search Etsy for this tag to get competition
        const searchResult = await etsyApi.publicRequest(
          'GET',
          '/v3/application/listings/active',
          { params: { ...baseSearchParams, keywords: tag } }
        );
        totalSerpCalls++;

        const totalResults = searchResult.success ? (searchResult.data.count || 0) : 0;

        tagData = {
          totalResults,
          competitionLevel: totalResults > 100000 ? 'high' : totalResults > 10000 ? 'medium' : 'low',
        };

        await redis.set(cacheKey, tagData, 21600);
      }

      // Quality score — title is optional, scoring adjusts when absent
      const qualityScore = scoreTag(tag, listingTitle, category);

      // Overall score = quality weighted with competition inverse
      const competitionPenalty = tagData.competitionLevel === 'high' ? 0.7
        : tagData.competitionLevel === 'medium' ? 0.85 : 1.0;
      const overallScore = Math.round(qualityScore.score * competitionPenalty);

      // Convert competition level string to numeric (0-100) for frontend
      const competitionNumeric = tagData.totalResults > 100000 ? 85
        : tagData.totalResults > 50000 ? 70
        : tagData.totalResults > 10000 ? 50
        : tagData.totalResults > 1000 ? 30
        : 15;

      const status = overallScore >= 80 ? 'excellent' : overallScore >= 60 ? 'good' : 'needs_work';

      results.push({
        tag,
        score: overallScore,
        qualityScore: qualityScore.score,
        overallScore,
        volume: tagData.totalResults,
        competition: competitionNumeric,
        status,
        competitionLevel: tagData.competitionLevel,
        totalResults: tagData.totalResults,
        details: qualityScore.details,
        suggestion: status === 'needs_work' ? generateSuggestion(tag, listingTitle) : null,
      });
    }

    // Summary stats
    const avgScore = Math.round(results.reduce((s, r) => s + r.overallScore, 0) / results.length);
    const excellent = results.filter(r => r.status === 'excellent').length;
    const good = results.filter(r => r.status === 'good').length;
    const needsWork = results.filter(r => r.status === 'needs_work').length;

    // Log SERP cost
    if (totalSerpCalls > 0) {
      await SerpCostLog.create({
        userId: req.userId,
        featureKey: 'tag_analysis',
        action: `tag_analysis:${tagList.length}_tags`,
        requestCount: totalSerpCalls,
        costUsd: totalSerpCalls * SERP_COST_PER_REQ,
        cacheHit: false,
      });
    }

    const summary = {
      totalTags: results.length,
      maxTags: 13,
      averageScore: avgScore,
      excellent,
      good,
      needsWork,
      missingTags: Math.max(0, 13 - tagList.length),
    };

    const suggestedReplacements = needsWork > 0
      ? await getReplacementSuggestions(req.userId, tagList, listingTitle)
      : [];

    // Persist analysis to DB
    try {
      await TagAnalysis.create({
        userId: req.userId,
        listingTitle,
        category: category || '',
        country,
        tags: results,
        summary,
        suggestedReplacements,
      });
    } catch (saveErr) {
      log.warn('Failed to save tag analysis:', saveErr.message);
    }

    return res.json({
      success: true,
      data: {
        tags: results,
        summary,
        suggestedReplacements,
      },
    });
  } catch (error) {
    log.error('Tag analysis error:', error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: 'Failed to analyze tags',
    });
  }
};

// --- Helpers ---

function scoreTag(tag, title, category) {
  let score = 0;
  const details = {};

  // Length: 2-20 chars ideal
  const len = tag.length;
  if (len >= 2 && len <= 20) {
    score += 25;
    details.lengthOk = true;
  } else {
    score += 5;
    details.lengthOk = false;
  }

  // Multi-word bonus (long-tail is better)
  const wordCount = tag.split(/\s+/).length;
  details.wordCount = wordCount;
  if (wordCount >= 3) {
    score += 30;
  } else if (wordCount === 2) {
    score += 20;
  } else {
    score += 5;
  }

  // Relevance to title (Jaccard similarity)
  const titleWords = new Set(title.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const tagWords = new Set(tag.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const intersection = [...tagWords].filter(w => titleWords.has(w)).length;
  const union = new Set([...titleWords, ...tagWords]).size;
  const jaccardSim = union > 0 ? intersection / union : 0;
  details.relevance = Math.round(jaccardSim * 100);

  score += Math.round(jaccardSim * 30);

  // Category match bonus
  if (category && tag.toLowerCase().includes(category.toLowerCase().split(/[\s\/]/)[0])) {
    score += 15;
    details.categoryMatch = true;
  } else {
    details.categoryMatch = false;
  }

  return { score: Math.min(100, score), details };
}

function generateSuggestion(tag, title) {
  const MAX_TAG_LEN = 20; // Etsy's per-tag character limit
  const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const tagWords = tag.toLowerCase().split(/\s+/);

  // Suggest adding a title word — only if the result fits Etsy's 20-char limit
  const unusedTitleWord = titleWords.find(w => !tagWords.includes(w));
  if (unusedTitleWord && tag.split(/\s+/).length < 3) {
    const combined = `${tag} ${unusedTitleWord}`;
    if (combined.length <= MAX_TAG_LEN) {
      return `Try "${combined}" for better relevance`;
    }
    // Combined too long — suggest a shorter alternative
    const shorterWord = titleWords.find(w => !tagWords.includes(w) && (`${tag} ${w}`).length <= MAX_TAG_LEN);
    if (shorterWord) {
      return `Try "${tag} ${shorterWord}" for better relevance`;
    }
  }

  if (tag.length > MAX_TAG_LEN) {
    return `Tag exceeds ${MAX_TAG_LEN} chars — shorten to fit Etsy's limit`;
  }

  if (tag.split(/\s+/).length === 1) {
    return 'Use multi-word phrases (under 20 chars) for better targeting';
  }

  return 'Consider replacing with a relevant long-tail keyword (max 20 chars)';
}

function hashKey(str) {
  return crypto.createHash('md5').update(str.toLowerCase()).digest('hex').substring(0, 12);
}

/**
 * Cross-reference user's existing keyword research to find high-traffic keywords
 * that could replace low-performing tags.
 */
async function getReplacementSuggestions(userId, currentTags, title) {
  try {
    // Get user's most recent keyword research results
    const recentSearches = await KeywordSearch.find({ userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('results');

    if (recentSearches.length === 0) return [];

    // Collect all researched keywords with their scores
    const keywordPool = new Map();
    const currentTagSet = new Set(currentTags.map(t => t.toLowerCase()));
    const titleLower = title.toLowerCase();

    for (const search of recentSearches) {
      for (const kw of (search.results || [])) {
        const kwLower = kw.keyword.toLowerCase();
        // Skip keywords already in tags
        if (currentTagSet.has(kwLower)) continue;
        // Prefer keywords relevant to the listing title
        const titleWords = titleLower.split(/\s+/).filter(w => w.length > 2);
        const kwWords = kwLower.split(/\s+/);
        const overlap = kwWords.some(w => titleWords.includes(w));

        const relevanceBoost = overlap ? 1.5 : 1.0;
        const score = (kw.demandScore || kw.opportunityScore || 50) * relevanceBoost;

        if (!keywordPool.has(kwLower) || keywordPool.get(kwLower).score < score) {
          keywordPool.set(kwLower, {
            keyword: kw.keyword,
            score: Math.round(score),
            estimatedVolume: kw.estimatedVolume || 0,
            competitionLevel: kw.competitionLevel || 'unknown',
            source: 'keyword_research',
          });
        }
      }
    }

    // Sort by score, filter to Etsy's 20-char tag limit, return top 5
    return [...keywordPool.values()]
      .filter(k => k.keyword.length <= 20)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  } catch {
    return [];
  }
}

/**
 * GET /api/v1/customer/tag-analyzer/history
 */
const getTagHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [analyses, total] = await Promise.all([
      TagAnalysis.find({ userId: req.userId })
        .sort({ analyzedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('listingTitle category country tags summary analyzedAt'),
      TagAnalysis.countDocuments({ userId: req.userId }),
    ]);

    return res.json({
      success: true,
      data: {
        analyses,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    log.error('Tag history error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve tag analysis history',
    });
  }
};

module.exports = { analyzeTags, getTagHistory };
