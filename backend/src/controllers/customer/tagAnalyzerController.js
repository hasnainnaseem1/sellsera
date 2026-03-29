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

const { SerpCostLog } = require('../../models/customer');
const { KeywordSearch } = require('../../models/customer');
const etsyApi = require('../../services/etsy/etsyApiService');
const redis = require('../../services/cache/redisService');
const crypto = require('crypto');

const SERP_COST_PER_REQ = 0.0025;

/**
 * POST /api/v1/customer/tag-analyzer
 */
const analyzeTags = async (req, res) => {
  try {
    const { tags, title, category } = req.body;

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one tag is required',
      });
    }

    // Title is optional — use empty string if not provided
    const listingTitle = (title && typeof title === 'string') ? title : '';

    const tagList = tags
      .map(t => (typeof t === 'string' ? t.trim() : ''))
      .filter(t => t.length > 0)
      .slice(0, 13);

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
          { params: { keywords: tag, limit: 25 } }
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

    return res.json({
      success: true,
      data: {
        tags: results,
        summary: {
          totalTags: results.length,
          maxTags: 13,
          averageScore: avgScore,
          excellent,
          good,
          needsWork,
          missingTags: Math.max(0, 13 - tagList.length),
        },
        suggestedReplacements: needsWork > 0
          ? await getReplacementSuggestions(req.userId, tagList, listingTitle)
          : [],
      },
    });
  } catch (error) {
    console.error('Tag analysis error:', error.message);
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
  const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const tagWords = tag.toLowerCase().split(/\s+/);

  // Suggest adding a title word to make it more relevant
  const unusedTitleWord = titleWords.find(w => !tagWords.includes(w));
  if (unusedTitleWord && tag.split(/\s+/).length < 3) {
    return `Try "${tag} ${unusedTitleWord}" for better relevance`;
  }

  if (tag.split(/\s+/).length === 1) {
    return 'Use multi-word phrases instead of single words for better targeting';
  }

  return 'Consider replacing with a more relevant long-tail keyword';
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

    // Sort by score, return top 5 suggestions
    return [...keywordPool.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  } catch {
    return [];
  }
}

module.exports = { analyzeTags };
