/**
 * Competitor Controller
 *
 * POST   /api/v1/customer/competitors/watch            → Add competitor to watch list
 * DELETE /api/v1/customer/competitors/watch/:id         → Remove competitor
 * GET    /api/v1/customer/competitors/watch             → Get watch list with latest data
 * GET    /api/v1/customer/competitors/:id/snapshots     → Get snapshot history
 * GET    /api/v1/customer/competitors/:id/sales         → Get sales data (daily delta)
 * POST   /api/v1/customer/competitors/:id/refresh       → Force refresh a competitor
 * POST   /api/v1/customer/competitors/refresh-all       → Refresh all competitors
 * GET    /api/v1/customer/competitors/sales/overview     → Aggregated sales overview
 *
 * Feature keys: competitor_tracking, competitor_sales
 */

const { CompetitorWatch, CompetitorSnapshot, SerpCostLog } = require('../../models/customer');
const etsyApi = require('../../services/etsy/etsyApiService');
const redis = require('../../services/cache/redisService');
const crypto = require('crypto');
const log = require('../../utils/logger')('Competitor');

const SERP_COST_PER_REQ = 0.0025;

/* ─── helpers ─── */

function hashKey(str) {
  return crypto.createHash('md5').update(str.toLowerCase()).digest('hex').substring(0, 12);
}

/**
 * Fetch shop + top listings from Etsy.
 * Returns { shopData, serpCalls } or { shopData: null } on failure.
 */
async function fetchShopData(shopNameOrId) {
  let serpCalls = 0;
  let shop = null;

  // If it's a numeric ID, fetch directly; otherwise search by name
  const isNumericId = /^\d+$/.test(String(shopNameOrId));

  if (isNumericId) {
    const shopResult = await etsyApi.publicRequest(
      'GET',
      `/v3/application/shops/${shopNameOrId}`
    );
    serpCalls++;
    if (!shopResult.success) return { shopData: null, serpCalls };
    shop = shopResult.data;
  } else {
    // Etsy v3 requires numeric shop_id in path — use findShops endpoint for name lookup
    const searchResult = await etsyApi.publicRequest(
      'GET',
      '/v3/application/shops',
      { params: { shop_name: shopNameOrId } }
    );
    serpCalls++;

    if (!searchResult.success || !searchResult.data?.results?.length) {
      return { shopData: null, serpCalls };
    }

    // Find exact match (case-insensitive)
    const match = searchResult.data.results.find(
      s => s.shop_name.toLowerCase() === shopNameOrId.toLowerCase()
    ) || searchResult.data.results[0];

    // Fetch full shop details using numeric ID
    const shopResult = await etsyApi.publicRequest(
      'GET',
      `/v3/application/shops/${match.shop_id}`
    );
    serpCalls++;
    if (!shopResult.success) return { shopData: null, serpCalls };
    shop = shopResult.data;
  }

  const listingsResult = await etsyApi.publicRequest(
    'GET',
    `/v3/application/shops/${shop.shop_id}/listings/active`,
    { params: { limit: 25, sort_on: 'score' } }
  );
  serpCalls++;

  const allListings = listingsResult.success ? (listingsResult.data.results || []) : [];
  const topListings = allListings.slice(0, 10).map(l => ({
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

  return {
    shopData: {
      etsyShopId: String(shop.shop_id),
      shopName: shop.shop_name,
      totalSales: shop.transaction_sold_count || 0,
      totalListings: shop.listing_active_count || 0,
      rating: shop.review_average || 0,
      reviewCount: shop.review_count || 0,
      shopCountry: shop.shipping_from_country_iso || shop.shop_location_country_iso || '',
      iconUrl: shop.icon_url_fullxfull || '',
      avgPrice,
      topListings,
    },
    serpCalls,
  };
}

/* ─── POST /watch ─── */

const addCompetitor = async (req, res) => {
  try {
    const { shopName } = req.body;

    if (!shopName || typeof shopName !== 'string') {
      return res.status(400).json({ success: false, message: 'Shop name is required' });
    }

    const cleanName = shopName.trim().replace(/[^a-zA-Z0-9\-_]/g, '');
    if (!cleanName) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shop name. Use only letters, numbers, and hyphens.',
      });
    }

    const existing = await CompetitorWatch.findOne({
      userId: req.userId,
      shopId: req.etsyShop._id,
      shopName: { $regex: new RegExp(`^${cleanName}$`, 'i') },
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'You are already tracking this shop' });
    }

    const cacheKey = `competitor:${hashKey(cleanName)}`;
    let shopData = await redis.get(cacheKey);
    let serpCalls = 0;

    if (!shopData) {
      const result = await fetchShopData(cleanName);
      serpCalls = result.serpCalls;
      shopData = result.shopData;

      if (!shopData) {
        return res.status(404).json({
          success: false,
          message: 'Etsy shop not found. Please check the shop name.',
        });
      }
      await redis.set(cacheKey, shopData, 3600);
    }

    const watch = await CompetitorWatch.create({
      userId: req.userId,
      shopId: req.etsyShop._id,
      shopName: shopData.shopName,
      etsyShopId: shopData.etsyShopId,
      shopCountry: shopData.shopCountry,
      iconUrl: shopData.iconUrl,
      latestSnapshot: {
        totalSales: shopData.totalSales,
        totalListings: shopData.totalListings,
        avgPrice: shopData.avgPrice,
        rating: shopData.rating,
        reviewCount: shopData.reviewCount,
        dailySalesDelta: 0,
        capturedAt: new Date(),
      },
      status: 'active',
    });

    await CompetitorSnapshot.create({
      watchId: watch._id,
      shopName: shopData.shopName,
      totalSales: shopData.totalSales,
      totalListings: shopData.totalListings,
      avgPrice: shopData.avgPrice,
      rating: shopData.rating,
      reviewCount: shopData.reviewCount,
      topListings: shopData.topListings,
    });

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

    return res.status(201).json({ success: true, data: watch });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'You are already tracking this shop' });
    }
    log.error('Add competitor error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to add competitor' });
  }
};

/* ─── DELETE /watch/:id ─── */

const removeCompetitor = async (req, res) => {
  try {
    const watch = await CompetitorWatch.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
      shopId: req.etsyShop._id,
    });
    if (!watch) {
      return res.status(404).json({ success: false, message: 'Competitor not found' });
    }
    await CompetitorSnapshot.deleteMany({ watchId: watch._id });
    return res.json({ success: true, message: 'Competitor removed from watch list' });
  } catch (error) {
    log.error('Remove competitor error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to remove competitor' });
  }
};

/* ─── GET /watch ─── */

const getWatchList = async (req, res) => {
  try {
    // Backfill: assign shopId to any orphaned watches (created before shopId was set)
    await CompetitorWatch.updateMany(
      { userId: req.userId, $or: [{ shopId: null }, { shopId: { $exists: false } }] },
      { $set: { shopId: req.etsyShop._id } }
    );

    const watches = await CompetitorWatch.find({ userId: req.userId, shopId: req.etsyShop._id })
      .sort({ addedAt: -1 })
      .lean();

    return res.json({ success: true, data: { watches } });
  } catch (error) {
    log.error('Get watch list error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to retrieve competitor list' });
  }
};

/* ─── GET /:id/snapshots ─── */

const getSnapshotHistory = async (req, res) => {
  try {
    const watch = await CompetitorWatch.findOne({
      _id: req.params.id,
      userId: req.userId,
      shopId: req.etsyShop._id,
    });
    if (!watch) {
      return res.status(404).json({ success: false, message: 'Competitor not found' });
    }

    const { page = 1, limit = 30 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [snapshots, total] = await Promise.all([
      CompetitorSnapshot.find({ watchId: watch._id })
        .sort({ capturedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
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
    return res.status(500).json({ success: false, message: 'Failed to retrieve snapshot history' });
  }
};

/* ─── GET /:id/sales ─── */

const getSalesData = async (req, res) => {
  try {
    const watch = await CompetitorWatch.findOne({
      _id: req.params.id,
      userId: req.userId,
      shopId: req.etsyShop._id,
    });
    if (!watch) {
      return res.status(404).json({ success: false, message: 'Competitor not found' });
    }

    const snapshots = await CompetitorSnapshot.find({ watchId: watch._id })
      .sort({ capturedAt: -1 })
      .limit(30)
      .select('totalSales totalListings avgPrice rating capturedAt')
      .lean();

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

    let trendPct = 0;
    if (salesTrend.length >= 14) {
      const recent7 = salesTrend.slice(0, 7).reduce((s, d) => s + d.dailyDelta, 0);
      const prev7 = salesTrend.slice(7, 14).reduce((s, d) => s + d.dailyDelta, 0);
      trendPct = prev7 > 0 ? Math.round((recent7 - prev7) / prev7 * 100) : 0;
    }

    const latestDelta = watch.latestSnapshot?.dailySalesDelta || 0;

    return res.json({
      success: true,
      data: {
        shopName: watch.shopName,
        currentSales: watch.latestSnapshot?.totalSales || 0,
        dailySalesDelta: latestDelta,
        avgPrice: watch.latestSnapshot?.avgPrice || 0,
        estRevenue: Math.round(latestDelta * (watch.latestSnapshot?.avgPrice || 0) * 100) / 100,
        trend: trendPct > 0 ? 'up' : trendPct < 0 ? 'down' : 'stable',
        trendPct,
        salesTrend,
      },
    });
  } catch (error) {
    log.error('Sales data error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to retrieve sales data' });
  }
};

/* ─── GET /sales/overview ─── */

const salesOverview = async (req, res) => {
  try {
    // Backfill: assign shopId to any orphaned watches
    await CompetitorWatch.updateMany(
      { userId: req.userId, $or: [{ shopId: null }, { shopId: { $exists: false } }] },
      { $set: { shopId: req.etsyShop._id } }
    );

    const watches = await CompetitorWatch.find({ userId: req.userId, shopId: req.etsyShop._id, status: 'active' })
      .sort({ addedAt: -1 })
      .lean();

    const rows = [];
    for (const w of watches) {
      const snaps = await CompetitorSnapshot.find({ watchId: w._id })
        .sort({ capturedAt: -1 })
        .limit(2)
        .select('totalSales totalListings avgPrice rating capturedAt topListings')
        .lean();

      const latest = snaps[0] || {};
      const prev = snaps[1] || {};
      const delta = (latest.totalSales || 0) - (prev.totalSales || 0);
      const avgP = w.latestSnapshot?.avgPrice || latest.avgPrice || 0;

      let trendPct = 0;
      const trendSnaps = await CompetitorSnapshot.find({ watchId: w._id })
        .sort({ capturedAt: -1 })
        .limit(14)
        .select('totalSales')
        .lean();

      if (trendSnaps.length >= 14) {
        let recent7 = 0, prev7 = 0;
        for (let i = 0; i < 7; i++) recent7 += (trendSnaps[i].totalSales - (trendSnaps[i + 1]?.totalSales || trendSnaps[i].totalSales));
        for (let i = 7; i < 13; i++) prev7 += (trendSnaps[i].totalSales - (trendSnaps[i + 1]?.totalSales || trendSnaps[i].totalSales));
        trendPct = prev7 > 0 ? Math.round((recent7 - prev7) / prev7 * 100) : 0;
      }

      const topListing = (latest.topListings || [])[0] || null;

      rows.push({
        _id: w._id,
        shopName: w.shopName,
        iconUrl: w.iconUrl || '',
        shopCountry: w.shopCountry || '',
        totalSales: w.latestSnapshot?.totalSales || latest.totalSales || 0,
        dailySales: delta,
        avgPrice: avgP,
        estRevenue: Math.round(delta * avgP * 100) / 100,
        listings: w.latestSnapshot?.totalListings || latest.totalListings || 0,
        rating: w.latestSnapshot?.rating || latest.rating || 0,
        trend: trendPct > 0 ? 'up' : trendPct < 0 ? 'down' : 'stable',
        trendPct,
        topListing: topListing ? { title: topListing.title, price: topListing.price, favorites: topListing.favorites } : null,
      });
    }

    const totalDailySales = rows.reduce((s, r) => s + r.dailySales, 0);
    const totalEstRevenue = rows.reduce((s, r) => s + r.estRevenue, 0);
    const topPerformer = rows.length ? rows.reduce((a, b) => a.dailySales > b.dailySales ? a : b) : null;

    return res.json({
      success: true,
      data: {
        shops: rows,
        totalDailySales,
        totalEstRevenue: Math.round(totalEstRevenue * 100) / 100,
        topPerformer: topPerformer?.shopName || null,
        shopCount: rows.length,
      },
    });
  } catch (error) {
    log.error('Sales overview error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to load sales overview' });
  }
};

/* ─── POST /:id/refresh ─── */

const refreshCompetitor = async (req, res) => {
  try {
    const watch = await CompetitorWatch.findOne({
      _id: req.params.id,
      userId: req.userId,
      shopId: req.etsyShop._id,
    });
    if (!watch) {
      return res.status(404).json({ success: false, message: 'Competitor not found' });
    }

    const { shopData, serpCalls } = await fetchShopData(watch.etsyShopId || watch.shopName);
    if (!shopData) {
      watch.status = 'error';
      watch.lastError = 'Could not fetch shop data';
      await watch.save();
      return res.status(502).json({ success: false, message: 'Failed to fetch competitor data from Etsy' });
    }

    const prevSnap = await CompetitorSnapshot.findOne({ watchId: watch._id })
      .sort({ capturedAt: -1 });
    const dailyDelta = prevSnap ? shopData.totalSales - prevSnap.totalSales : 0;

    await CompetitorSnapshot.create({
      watchId: watch._id,
      shopName: shopData.shopName,
      totalSales: shopData.totalSales,
      totalListings: shopData.totalListings,
      avgPrice: shopData.avgPrice,
      rating: shopData.rating,
      reviewCount: shopData.reviewCount,
      topListings: shopData.topListings,
    });

    watch.shopCountry = shopData.shopCountry;
    watch.iconUrl = shopData.iconUrl;
    watch.latestSnapshot = {
      totalSales: shopData.totalSales,
      totalListings: shopData.totalListings,
      avgPrice: shopData.avgPrice,
      rating: shopData.rating,
      reviewCount: shopData.reviewCount,
      dailySalesDelta: dailyDelta,
      capturedAt: new Date(),
    };
    watch.status = 'active';
    watch.lastError = null;
    await watch.save();

    await SerpCostLog.create({
      userId: req.userId,
      featureKey: 'competitor_tracking',
      action: `refresh_competitor:${watch.shopName}`,
      requestCount: serpCalls,
      costUsd: serpCalls * SERP_COST_PER_REQ,
      cacheHit: false,
    });

    return res.json({ success: true, data: watch });
  } catch (error) {
    log.error('Refresh competitor error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to refresh competitor data' });
  }
};

/* ─── POST /refresh-all ─── */

const refreshAll = async (req, res) => {
  try {
      const watches = await CompetitorWatch.find({ userId: req.userId, shopId: req.etsyShop._id, status: 'active' });
    let refreshed = 0, failed = 0, totalCalls = 0;

    for (const watch of watches) {
      try {
        const { shopData, serpCalls } = await fetchShopData(watch.etsyShopId || watch.shopName);
        totalCalls += serpCalls;

        if (!shopData) { failed++; continue; }

        const prevSnap = await CompetitorSnapshot.findOne({ watchId: watch._id })
          .sort({ capturedAt: -1 });
        const dailyDelta = prevSnap ? shopData.totalSales - prevSnap.totalSales : 0;

        await CompetitorSnapshot.create({
          watchId: watch._id,
          shopName: shopData.shopName,
          totalSales: shopData.totalSales,
          totalListings: shopData.totalListings,
          avgPrice: shopData.avgPrice,
          rating: shopData.rating,
          reviewCount: shopData.reviewCount,
          topListings: shopData.topListings,
        });

        watch.shopCountry = shopData.shopCountry;
        watch.iconUrl = shopData.iconUrl;
        watch.latestSnapshot = {
          totalSales: shopData.totalSales,
          totalListings: shopData.totalListings,
          avgPrice: shopData.avgPrice,
          rating: shopData.rating,
          reviewCount: shopData.reviewCount,
          dailySalesDelta: dailyDelta,
          capturedAt: new Date(),
        };
        watch.status = 'active';
        watch.lastError = null;
        await watch.save();
        refreshed++;
      } catch {
        failed++;
      }
    }

    if (totalCalls > 0) {
      await SerpCostLog.create({
        userId: req.userId,
        featureKey: 'competitor_tracking',
        action: 'refresh_all',
        requestCount: totalCalls,
        costUsd: totalCalls * SERP_COST_PER_REQ,
        cacheHit: false,
      });
    }

    return res.json({
      success: true,
      data: { refreshed, failed, total: watches.length },
    });
  } catch (error) {
    log.error('Refresh all error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to refresh competitors' });
  }
};

module.exports = {
  addCompetitor,
  removeCompetitor,
  getWatchList,
  getSnapshotHistory,
  getSalesData,
  refreshCompetitor,
  refreshAll,
  salesOverview,
};
