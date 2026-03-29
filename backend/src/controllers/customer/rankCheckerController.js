/**
 * Rank Checker Controller
 * 
 * POST /api/v1/customer/rank-checker         → Check ranking for keywords
 * GET  /api/v1/customer/rank-checker/history  → Get rank check history
 * 
 * Feature key: bulk_rank_check
 * 
 * Two modes:
 * 1. With etsyListingId — scan Etsy search results to find where the listing ranks
 * 2. Without etsyListingId — auto-detect from user's connected shop listings
 */

const { RankCheck } = require('../../models/customer');
const { SerpCostLog } = require('../../models/customer');
const { EtsyListing } = require('../../models/integrations');
const etsyApi = require('../../services/etsy/etsyApiService');
const redis = require('../../services/cache/redisService');
const crypto = require('crypto');

const SERP_COST_PER_REQ = 0.0025;
const PAGES_TO_SCAN = 3; // 3 pages × 48 results = 144 positions

/**
 * POST /api/v1/customer/rank-checker
 * Check keyword rankings. If etsyListingId is provided, finds exact rank.
 * Otherwise, searches user's connected shop for all listings and checks them.
 */
const checkRankings = async (req, res) => {
  try {
    let { etsyListingId, keywords, listingTitle } = req.body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one keyword is required',
      });
    }

    const keywordList = keywords
      .map(k => (typeof k === 'string' ? k.trim() : ''))
      .filter(k => k.length > 0)
      .slice(0, 50);

    // If no specific listing, get all user's listings for matching
    let shopListingIds = [];
    if (!etsyListingId && req.etsyShop) {
      const userListings = await EtsyListing.find(
        { shopId: req.etsyShop.shopId },
        { etsyListingId: 1 }
      ).limit(200).lean();
      shopListingIds = userListings.map(l => String(l.etsyListingId));
    }

    const targetListingId = etsyListingId ? String(etsyListingId) : null;
    const results = [];
    let totalSerpCalls = 0;

    // Check for previous rank data (for change calculation)
    const previousCheck = await RankCheck.findOne({ userId: req.userId })
      .sort({ checkedAt: -1 })
      .select('results')
      .lean();
    const previousRanks = new Map();
    if (previousCheck) {
      for (const r of (previousCheck.results || [])) {
        if (r.keyword && r.rank != null) {
          previousRanks.set(r.keyword.toLowerCase(), r.rank);
        }
      }
    }

    for (const keyword of keywordList) {
      const cacheKey = `rank:${targetListingId || 'shop'}:${hashKey(keyword)}`;
      let rankData = await redis.get(cacheKey);

      if (rankData) {
        // Add change/trend from previous
        const prevRank = previousRanks.get(keyword.toLowerCase());
        rankData.change = prevRank != null && rankData.rank != null ? prevRank - rankData.rank : 0;
        rankData.trend = rankData.change > 0 ? 'up' : rankData.change < 0 ? 'down' : 'stable';
        results.push(rankData);
        continue;
      }

      // Scan search results
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

        // Try to find a specific listing or any of user's listings
        for (let idx = 0; idx < listings.length; idx++) {
          const lid = String(listings[idx].listing_id);
          if (targetListingId ? lid === targetListingId : shopListingIds.includes(lid)) {
            rank = (p * 48) + idx + 1;
            page = p + 1;
            found = true;
            break;
          }
        }

        if ((p + 1) * 48 >= totalResults) break;
      }

      const prevRank = previousRanks.get(keyword.toLowerCase());
      const change = prevRank != null && rank != null ? prevRank - rank : 0;

      rankData = {
        keyword,
        rank: found ? rank : null,
        page: found ? page : Math.ceil(((rank || totalResults) + 1) / 48),
        volume: totalResults,
        found,
        change,
        trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
      };

      await redis.set(cacheKey, rankData, 21600);
      results.push(rankData);
    }

    // Save to DB
    const rankCheck = await RankCheck.create({
      userId: req.userId,
      etsyListingId: targetListingId || 'shop',
      listingTitle: listingTitle || '',
      results,
      keywordCount: keywordList.length,
      serpCallCount: totalSerpCalls,
    });

    if (totalSerpCalls > 0) {
      await SerpCostLog.create({
        userId: req.userId,
        featureKey: 'bulk_rank_check',
        action: `rank_check:${targetListingId || 'shop'}`,
        requestCount: totalSerpCalls,
        costUsd: totalSerpCalls * SERP_COST_PER_REQ,
        cacheHit: false,
      });
    }

    return res.json({
      success: true,
      data: {
        checkId: rankCheck._id,
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
