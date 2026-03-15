/**
 * Rank Checker Controller
 * 
 * POST /api/v1/customer/rank-checker         → Check ranking for keywords
 * GET  /api/v1/customer/rank-checker/history  → Get rank check history
 * 
 * Feature key: bulk_rank_check
 */

const { RankCheck } = require('../../models/customer');
const { SerpCostLog } = require('../../models/customer');
const etsyApi = require('../../services/etsy/etsyApiService');
const redis = require('../../services/cache/redisService');
const crypto = require('crypto');

const SERP_COST_PER_REQ = 0.0025;
const PAGES_TO_SCAN = 5; // 5 pages × 48 results = 240 results max

/**
 * POST /api/v1/customer/rank-checker
 * Check where a listing ranks for given keywords.
 */
const checkRankings = async (req, res) => {
  try {
    const { etsyListingId, keywords, listingTitle } = req.body;

    if (!etsyListingId) {
      return res.status(400).json({
        success: false,
        message: 'Etsy listing ID is required',
      });
    }

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one keyword is required',
      });
    }

    // Limit to 50 keywords per request
    const keywordList = keywords
      .map(k => (typeof k === 'string' ? k.trim() : ''))
      .filter(k => k.length > 0)
      .slice(0, 50);

    const targetListingId = String(etsyListingId);
    const results = [];
    let totalSerpCalls = 0;

    for (const keyword of keywordList) {
      const cacheKey = `rank:${targetListingId}:${hashKey(keyword)}`;
      let rankData = await redis.get(cacheKey);

      if (rankData) {
        results.push(rankData);
        continue;
      }

      // Scan up to 5 pages for the listing
      let found = false;
      let rank = null;
      let page = null;
      let totalResults = 0;

      for (let p = 0; p < PAGES_TO_SCAN && !found; p++) {
        const searchResult = await etsyApi.publicRequest(
          'GET',
          '/v3/application/listings/active',
          { params: { keywords: keyword, limit: 48, offset: p * 48, sort_on: 'score' } }
        );
        totalSerpCalls++;

        if (!searchResult.success) break;

        if (p === 0) {
          totalResults = searchResult.data.count || 0;
        }

        const listings = searchResult.data.results || [];
        const idx = listings.findIndex(l => String(l.listing_id) === targetListingId);

        if (idx !== -1) {
          rank = (p * 48) + idx + 1;
          page = p + 1;
          found = true;
        }

        // Don't scan more pages if we've exceeded total results
        if ((p + 1) * 48 >= totalResults) break;
      }

      rankData = {
        keyword,
        rank: found ? rank : null,
        page: found ? page : null,
        totalResults,
        found,
      };

      // Cache for 6 hours
      await redis.set(cacheKey, rankData, 21600);
      results.push(rankData);
    }

    // Save to DB
    const rankCheck = await RankCheck.create({
      userId: req.userId,
      etsyListingId: targetListingId,
      listingTitle: listingTitle || '',
      results,
      keywordCount: keywordList.length,
      serpCallCount: totalSerpCalls,
    });

    // Log SERP cost
    if (totalSerpCalls > 0) {
      await SerpCostLog.create({
        userId: req.userId,
        featureKey: 'bulk_rank_check',
        action: `rank_check:${targetListingId}`,
        requestCount: totalSerpCalls,
        costUsd: totalSerpCalls * SERP_COST_PER_REQ,
        cacheHit: false,
      });
    }

    return res.json({
      success: true,
      data: {
        checkId: rankCheck._id,
        etsyListingId: targetListingId,
        results,
        totalSerpCalls,
      },
    });
  } catch (error) {
    console.error('Rank check error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to check rankings',
    });
  }
};

/**
 * GET /api/v1/customer/rank-checker/history
 */
const getRankHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [checks, total] = await Promise.all([
      RankCheck.find({ userId: req.userId })
        .sort({ checkedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('etsyListingId listingTitle keywordCount results checkedAt'),
      RankCheck.countDocuments({ userId: req.userId }),
    ]);

    return res.json({
      success: true,
      data: {
        checks,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Rank history error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve rank check history',
    });
  }
};

function hashKey(str) {
  return crypto.createHash('md5').update(str.toLowerCase()).digest('hex').substring(0, 12);
}

module.exports = { checkRankings, getRankHistory };
