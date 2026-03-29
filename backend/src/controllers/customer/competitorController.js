/**
 * Competitor Controller
 * 
 * POST   /api/v1/customer/competitors/watch         → Add competitor to watch list
 * DELETE /api/v1/customer/competitors/watch/:id      → Remove competitor
 * GET    /api/v1/customer/competitors/watch          → Get watch list with latest data
 * GET    /api/v1/customer/competitors/:id/snapshot   → Get snapshot history for a competitor
 * GET    /api/v1/customer/competitors/:id/sales      → Get sales data (daily delta)
 * POST   /api/v1/customer/competitors/:id/refresh    → Force refresh a competitor's data
 * 
 * Feature keys: competitor_tracking, competitor_sales
 */

const { CompetitorWatch, CompetitorSnapshot, SerpCostLog } = require('../../models/customer');
const etsyApi = require('../../services/etsy/etsyApiService');
const redis = require('../../services/cache/redisService');
const crypto = require('crypto');
const log = require('../../utils/logger')('Competitor');

const SERP_COST_PER_REQ = 0.0025;

/**
 * POST /api/v1/customer/competitors/watch
 * Add a competitor shop to the watch list.
 */
const addCompetitor = async (req, res) => {
  try {
    const { shopName } = req.body;

    if (!shopName || typeof shopName !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Shop name is required',
      });
    }

    const cleanName = shopName.trim().replace(/[^a-zA-Z0-9\-_]/g, '');
    if (!cleanName) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shop name. Use only letters, numbers, and hyphens.',
      });
    }

    // Check if already watching
    const existing = await CompetitorWatch.findOne({
      userId: req.userId,
      shopName: { $regex: new RegExp(`^${cleanName}$`, 'i') },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'You are already tracking this shop',
      });
    }

    // Fetch shop info from Etsy
    const cacheKey = `competitor:${hashKey(cleanName)}`;
    let shopData = await redis.get(cacheKey);
    let serpCalls = 0;

    if (!shopData) {
      const shopResult = await etsyApi.publicRequest(
        'GET',
        `/v3/application/shops/${cleanName}`
      );
      serpCalls++;

      if (!shopResult.success) {
        return res.status(404).json({
          success: false,
          message: 'Etsy shop not found. Please check the shop name.',
        });
      }

      const shop = shopResult.data;

      // Get top listings
      const listingsResult = await etsyApi.publicRequest(
        'GET',
        `/v3/application/shops/${shop.shop_id}/listings`,
        { params: { limit: 10, sort_on: 'score' } }
      );
      serpCalls++;

      const topListings = (listingsResult.success ? listingsResult.data.results : [])
        .map(l => ({
          listingId: String(l.listing_id),
          title: l.title || '',
          price: l.price?.amount ? l.price.amount / l.price.divisor : 0,
          views: l.views || 0,
          favorites: l.num_favorers || 0,
          tags: l.tags || [],
        }));

      const avgPrice = topListings.length > 0
        ? Math.round(topListings.reduce((s, l) => s + l.price, 0) / topListings.length * 100) / 100
        : 0;

      shopData = {
        etsyShopId: String(shop.shop_id),
        shopName: shop.shop_name,
        totalSales: shop.transaction_sold_count || 0,
        totalListings: shop.listing_active_count || 0,
        avgPrice,
        topListings,
      };

      await redis.set(cacheKey, shopData, 3600); // 1 hour
    }

    // Create watch entry
    const watch = await CompetitorWatch.create({
      userId: req.userId,
      shopName: shopData.shopName,
      etsyShopId: shopData.etsyShopId,
      latestSnapshot: {
        totalSales: shopData.totalSales,
        totalListings: shopData.totalListings,
        avgPrice: shopData.avgPrice,
        dailySalesDelta: 0,
        capturedAt: new Date(),
      },
      status: 'active',
    });

    // Create first snapshot
    await CompetitorSnapshot.create({
      watchId: watch._id,
      shopName: shopData.shopName,
      totalSales: shopData.totalSales,
      totalListings: shopData.totalListings,
      avgPrice: shopData.avgPrice,
      topListings: shopData.topListings,
    });

    // Log SERP cost
    if (serpCalls > 0) {
      await SerpCostLog.create({
        userId: req.userId,
        featureKey: 'competitor_tracking',
        action: `add_competitor:${shopData.shopName}`,
        requestCount: serpCalls,
        costUsd: serpCalls * SERP_COST_PER_REQ,
        cacheHit: false,
      });
    }

    return res.status(201).json({
      success: true,
      data: watch,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You are already tracking this shop',
      });
    }
    log.error('Add competitor error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to add competitor',
    });
  }
};

/**
 * DELETE /api/v1/customer/competitors/watch/:id
 */
const removeCompetitor = async (req, res) => {
  try {
    const watch = await CompetitorWatch.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!watch) {
      return res.status(404).json({
        success: false,
        message: 'Competitor not found',
      });
    }

    // Clean up snapshots
    await CompetitorSnapshot.deleteMany({ watchId: watch._id });

    return res.json({
      success: true,
      message: 'Competitor removed from watch list',
    });
  } catch (error) {
    log.error('Remove competitor error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove competitor',
    });
  }
};

/**
 * GET /api/v1/customer/competitors/watch
 * Get all tracked competitors with latest snapshot data.
 */
const getWatchList = async (req, res) => {
  try {
    const competitors = await CompetitorWatch.find({ userId: req.userId })
      .sort({ addedAt: -1 });

    return res.json({
      success: true,
      data: competitors,
    });
  } catch (error) {
    log.error('Get watch list error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve competitor list',
    });
  }
};

/**
 * GET /api/v1/customer/competitors/:id/snapshot
 * Get snapshot history for a specific competitor.
 */
const getSnapshotHistory = async (req, res) => {
  try {
    // Verify ownership
    const watch = await CompetitorWatch.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!watch) {
      return res.status(404).json({
        success: false,
        message: 'Competitor not found',
      });
    }

    const { page = 1, limit = 30 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [snapshots, total] = await Promise.all([
      CompetitorSnapshot.find({ watchId: watch._id })
        .sort({ capturedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      CompetitorSnapshot.countDocuments({ watchId: watch._id }),
    ]);

    return res.json({
      success: true,
      data: {
        shopName: watch.shopName,
        snapshots,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    log.error('Snapshot history error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve snapshot history',
    });
  }
};

/**
 * GET /api/v1/customer/competitors/:id/sales
 * Get sales data with daily deltas.
 */
const getSalesData = async (req, res) => {
  try {
    const watch = await CompetitorWatch.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!watch) {
      return res.status(404).json({
        success: false,
        message: 'Competitor not found',
      });
    }

    // Get last 30 snapshots for trend
    const snapshots = await CompetitorSnapshot.find({ watchId: watch._id })
      .sort({ capturedAt: -1 })
      .limit(30)
      .select('totalSales totalListings avgPrice capturedAt');

    // Calculate daily deltas
    const salesTrend = [];
    for (let i = 0; i < snapshots.length - 1; i++) {
      salesTrend.push({
        date: snapshots[i].capturedAt,
        totalSales: snapshots[i].totalSales,
        dailyDelta: snapshots[i].totalSales - snapshots[i + 1].totalSales,
        totalListings: snapshots[i].totalListings,
        avgPrice: snapshots[i].avgPrice,
      });
    }

    return res.json({
      success: true,
      data: {
        shopName: watch.shopName,
        currentSales: watch.latestSnapshot?.totalSales || 0,
        dailySalesDelta: watch.latestSnapshot?.dailySalesDelta || 0,
        salesTrend,
      },
    });
  } catch (error) {
    log.error('Sales data error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve sales data',
    });
  }
};

/**
 * POST /api/v1/customer/competitors/:id/refresh
 * Force-refresh competitor data.
 */
const refreshCompetitor = async (req, res) => {
  try {
    const watch = await CompetitorWatch.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!watch) {
      return res.status(404).json({
        success: false,
        message: 'Competitor not found',
      });
    }

    // Fetch fresh data
    const shopResult = await etsyApi.publicRequest(
      'GET',
      `/v3/application/shops/${watch.etsyShopId || watch.shopName}`
    );

    if (!shopResult.success) {
      watch.status = 'error';
      watch.lastError = 'Could not fetch shop data';
      await watch.save();
      return res.status(502).json({
        success: false,
        message: 'Failed to fetch competitor data from Etsy',
      });
    }

    const shop = shopResult.data;

    // Get top listings
    const listingsResult = await etsyApi.publicRequest(
      'GET',
      `/v3/application/shops/${shop.shop_id}/listings`,
      { params: { limit: 10, sort_on: 'score' } }
    );

    const topListings = (listingsResult.success ? listingsResult.data.results : [])
      .map(l => ({
        listingId: String(l.listing_id),
        title: l.title || '',
        price: l.price?.amount ? l.price.amount / l.price.divisor : 0,
        views: l.views || 0,
        favorites: l.num_favorers || 0,
        tags: l.tags || [],
      }));

    const avgPrice = topListings.length > 0
      ? Math.round(topListings.reduce((s, l) => s + l.price, 0) / topListings.length * 100) / 100
      : 0;

    // Calculate daily delta from previous snapshot
    const prevSnapshot = await CompetitorSnapshot.findOne({ watchId: watch._id })
      .sort({ capturedAt: -1 });

    const dailyDelta = prevSnapshot
      ? (shop.transaction_sold_count || 0) - prevSnapshot.totalSales
      : 0;

    // Create snapshot
    await CompetitorSnapshot.create({
      watchId: watch._id,
      shopName: shop.shop_name,
      totalSales: shop.transaction_sold_count || 0,
      totalListings: shop.listing_active_count || 0,
      avgPrice,
      topListings,
    });

    // Update watch with latest data
    watch.latestSnapshot = {
      totalSales: shop.transaction_sold_count || 0,
      totalListings: shop.listing_active_count || 0,
      avgPrice,
      dailySalesDelta: dailyDelta,
      capturedAt: new Date(),
    };
    watch.status = 'active';
    watch.lastError = null;
    await watch.save();

    // Log SERP cost (2 calls: shop + listings)
    await SerpCostLog.create({
      userId: req.userId,
      featureKey: 'competitor_tracking',
      action: `refresh_competitor:${watch.shopName}`,
      requestCount: 2,
      costUsd: 2 * SERP_COST_PER_REQ,
      cacheHit: false,
    });

    return res.json({
      success: true,
      data: watch,
    });
  } catch (error) {
    log.error('Refresh competitor error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to refresh competitor data',
    });
  }
};

function hashKey(str) {
  return crypto.createHash('md5').update(str.toLowerCase()).digest('hex').substring(0, 12);
}

module.exports = {
  addCompetitor,
  removeCompetitor,
  getWatchList,
  getSnapshotHistory,
  getSalesData,
  refreshCompetitor,
};
