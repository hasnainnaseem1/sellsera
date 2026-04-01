/**
 * Logistics Controller
 *
 * GET  /api/v1/customer/logistics/delivery-status     → Delivery status for orders
 * GET  /api/v1/customer/logistics/sales-map            → Sales geographic distribution
 * GET  /api/v1/customer/logistics/sales-map/history    → Historical geo snapshots
 * POST /api/v1/customer/logistics/sync-receipts        → Manual receipt sync
 *
 * Feature keys: delivery_tracking, sales_map (boolean features)
 */

const { ShopReceipt, SalesGeoSnapshot } = require('../../models/customer');
const log = require('../../utils/logger')('Logistics');

const REGION_MAP = {
  US: { codes: ['US'], flag: '🇺🇸', label: 'United States' },
  UK: { codes: ['GB'], flag: '🇬🇧', label: 'United Kingdom' },
  CA: { codes: ['CA'], flag: '🇨🇦', label: 'Canada' },
  AU: { codes: ['AU'], flag: '🇦🇺', label: 'Australia' },
  EU: {
    codes: [
      'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
      'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
      'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
    ],
    flag: '🇪🇺',
    label: 'Europe',
  },
};

function getRegionInfo(countryIso) {
  if (!countryIso) return { key: 'OTHER', flag: '🌍', label: 'Other' };
  const upper = countryIso.toUpperCase();
  for (const [key, cfg] of Object.entries(REGION_MAP)) {
    if (cfg.codes.includes(upper)) return { key, flag: cfg.flag, label: cfg.label };
  }
  return { key: 'OTHER', flag: '🌍', label: 'Other' };
}

/* ─── period string → date filter ─── */

function periodToDate(period) {
  const now = new Date();
  switch (period) {
    case '7d':  return new Date(now.getTime() - 7 * 86400000);
    case '30d': return new Date(now.getTime() - 30 * 86400000);
    case '90d': return new Date(now.getTime() - 90 * 86400000);
    case 'all': return null;
    default:    return new Date(now.getTime() - 30 * 86400000);
  }
}

/**
 * GET /delivery-status
 * Paginated orders with status summary & search.
 */
const getDeliveryStatus = async (req, res) => {
  try {
    const shopId = req.etsyShop._id;
    const {
      status, search, page = 1, limit = 25,
      sort = '-createdTstamp',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

    const filter = { shopId };

    // Status filter
    if (status) {
      const valid = ['paid', 'shipped', 'in_transit', 'delivered', 'completed', 'cancelled', 'refunded'];
      if (valid.includes(status)) filter.status = status;
    }

    // Search filter
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { etsyReceiptId: { $regex: q, $options: 'i' } },
        { 'items.title': { $regex: q, $options: 'i' } },
        { city: { $regex: q, $options: 'i' } },
        { state: { $regex: q, $options: 'i' } },
        { countryIso: { $regex: q, $options: 'i' } },
      ];
    }

    const [receipts, total, statusCounts] = await Promise.all([
      ShopReceipt.find(filter)
        .sort(sort)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      ShopReceipt.countDocuments(filter),
      ShopReceipt.aggregate([
        { $match: { shopId: req.etsyShop._id } },
        { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: '$grandTotal' } } },
      ]),
    ]);

    // Build summary counts
    const summary = {};
    for (const s of statusCounts) {
      summary[s._id] = { count: s.count, revenue: Math.round(s.revenue * 100) / 100 };
    }

    // Map receipts to frontend-friendly shape
    const orders = receipts.map(r => ({
      receiptId: r.etsyReceiptId,
      _id: r._id,
      status: r.status,
      items: r.items || [],
      destination: [r.city, r.state, r.countryIso].filter(Boolean).join(', ') || '—',
      countryIso: r.countryIso,
      grandTotal: r.grandTotal || 0,
      currencyCode: r.currencyCode || 'USD',
      carrier: r.shipment?.carrier || null,
      trackingCode: r.shipment?.trackingCode || null,
      shippedAt: r.shipment?.shippedAt || null,
      estimatedDelivery: r.shipment?.estimatedDelivery || null,
      deliveredAt: r.shipment?.deliveredAt || null,
      createdAt: r.createdTstamp,
      updatedAt: r.updatedTstamp,
    }));

    return res.json({
      success: true,
      data: {
        orders,
        summary,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    log.error('getDeliveryStatus error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve delivery status',
    });
  }
};

/**
 * GET /sales-map
 * Aggregate sales by country/region with period filter.
 * Query params: period (7d|30d|90d|all, default 30d)
 */
const getSalesMap = async (req, res) => {
  try {
    const shopId = req.etsyShop._id;
    const period = req.query.period || '30d';
    const since = periodToDate(period);

    const matchStage = {
      shopId,
      status: { $nin: ['cancelled', 'refunded'] },
    };
    if (since) matchStage.createdTstamp = { $gte: since };

    // Country-level aggregation with top city
    const countryData = await ShopReceipt.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { country: '$countryIso', city: '$city' },
          orders: { $sum: 1 },
          revenue: { $sum: '$grandTotal' },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    // Group by country, find top city per country
    const countryMap = {};
    for (const row of countryData) {
      const iso = row._id.country || 'UNKNOWN';
      if (!countryMap[iso]) {
        countryMap[iso] = { orders: 0, revenue: 0, topCity: null, topCityOrders: 0 };
      }
      countryMap[iso].orders += row.orders;
      countryMap[iso].revenue += row.revenue;
      if (row._id.city && row.orders > countryMap[iso].topCityOrders) {
        countryMap[iso].topCity = row._id.city;
        countryMap[iso].topCityOrders = row.orders;
      }
    }

    // Build region breakdown
    const regionMap = {};
    let totalOrders = 0;
    let totalRevenue = 0;

    for (const [iso, stats] of Object.entries(countryMap)) {
      const info = getRegionInfo(iso);
      if (!regionMap[info.key]) {
        regionMap[info.key] = { region: info.label, flag: info.flag, orders: 0, revenue: 0, topCity: null, topCityOrders: 0 };
      }
      regionMap[info.key].orders += stats.orders;
      regionMap[info.key].revenue += stats.revenue;
      if (stats.topCity && stats.orders > (regionMap[info.key].topCityOrders || 0)) {
        regionMap[info.key].topCity = stats.topCity;
        regionMap[info.key].topCityOrders = stats.orders;
      }
      totalOrders += stats.orders;
      totalRevenue += stats.revenue;
    }

    // Build sorted regions array with percentages
    const regions = Object.entries(regionMap)
      .map(([key, r]) => ({
        key,
        region: r.region,
        flag: r.flag,
        orders: r.orders,
        revenue: Math.round(r.revenue * 100) / 100,
        pct: totalOrders > 0 ? Math.round((r.orders / totalOrders) * 1000) / 10 : 0,
        topCity: r.topCity || '—',
      }))
      .sort((a, b) => b.orders - a.orders);

    // Country-level detail
    const countries = Object.entries(countryMap)
      .map(([iso, stats]) => ({
        countryIso: iso,
        orders: stats.orders,
        revenue: Math.round(stats.revenue * 100) / 100,
        topCity: stats.topCity || null,
        region: getRegionInfo(iso).label,
      }))
      .sort((a, b) => b.orders - a.orders);

    return res.json({
      success: true,
      data: {
        regions,
        countries,
        totalOrders,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        period,
      },
    });
  } catch (error) {
    log.error('getSalesMap error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve sales map data',
    });
  }
};

/**
 * GET /sales-map/history
 */
const getSalesMapHistory = async (req, res) => {
  try {
    const shopId = req.etsyShop._id;
    const limitNum = Math.min(24, Math.max(1, parseInt(req.query.limit, 10) || 6));

    const snapshots = await SalesGeoSnapshot.find({ shopId })
      .sort({ capturedAt: -1 })
      .limit(limitNum)
      .lean();

    return res.json({
      success: true,
      data: { snapshots },
    });
  } catch (error) {
    log.error('getSalesMapHistory error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve sales map history',
    });
  }
};

/**
 * POST /sync-receipts
 * Trigger a manual receipt sync from Etsy.
 */
const syncReceipts = async (req, res) => {
  try {
    const shopSync = require('../../services/etsy/shopSyncService');
    const result = await shopSync.syncReceipts(req.etsyShop);

    if (!result.success) {
      return res.status(502).json({
        success: false,
        message: result.error || 'Failed to sync receipts from Etsy',
      });
    }

    return res.json({
      success: true,
      data: { syncedCount: result.syncedCount },
      message: `Synced ${result.syncedCount} receipts from Etsy`,
    });
  } catch (error) {
    log.error('syncReceipts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to sync receipts',
    });
  }
};

module.exports = {
  getDeliveryStatus,
  getSalesMap,
  getSalesMapHistory,
  syncReceipts,
};
