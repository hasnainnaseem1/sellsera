/**
 * Logistics Controller
 * 
 * GET  /api/v1/customer/logistics/delivery-status   → Get delivery status for orders
 * GET  /api/v1/customer/logistics/sales-map          → Get sales geographic distribution
 * GET  /api/v1/customer/logistics/sales-map/history  → Get historical geo snapshots
 * 
 * Feature keys: delivery_tracking, sales_map (boolean features)
 */

const { ShopReceipt, SalesGeoSnapshot } = require('../../models/customer');

const REGION_MAP = {
  US: ['US'],
  UK: ['GB'],
  CA: ['CA'],
  AU: ['AU'],
  EU: [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
    'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
    'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  ],
};

function getRegion(countryIso) {
  if (!countryIso) return 'OTHER';
  const upper = countryIso.toUpperCase();
  for (const [region, codes] of Object.entries(REGION_MAP)) {
    if (codes.includes(upper)) return region;
  }
  return 'OTHER';
}

/**
 * GET /api/v1/customer/logistics/delivery-status
 * Returns orders grouped by delivery status with optional filters.
 * Query params: status, page, limit, sort
 */
const getDeliveryStatus = async (req, res) => {
  try {
    const shopId = req.etsyShop._id;
    const { status, page = 1, limit = 25, sort = '-createdTstamp' } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

    const filter = { shopId };
    if (status) {
      const validStatuses = ['paid', 'shipped', 'in_transit', 'delivered', 'completed', 'cancelled', 'refunded'];
      if (validStatuses.includes(status)) {
        filter.status = status;
      }
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

    const summary = {};
    for (const s of statusCounts) {
      summary[s._id] = { count: s.count, revenue: s.revenue };
    }

    return res.json({
      success: true,
      data: {
        receipts,
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
    console.error('[LogisticsController] getDeliveryStatus error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve delivery status',
    });
  }
};

/**
 * GET /api/v1/customer/logistics/sales-map
 * Aggregate current sales by country/region from receipts.
 * Query params: months (default 3, max 12)
 */
const getSalesMap = async (req, res) => {
  try {
    const shopId = req.etsyShop._id;
    const months = Math.min(12, Math.max(1, parseInt(req.query.months, 10) || 3));
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const pipeline = [
      {
        $match: {
          shopId,
          createdTstamp: { $gte: since },
          status: { $nin: ['cancelled', 'refunded'] },
        },
      },
      {
        $group: {
          _id: '$countryIso',
          orders: { $sum: 1 },
          revenue: { $sum: '$grandTotal' },
        },
      },
      { $sort: { revenue: -1 } },
    ];

    const countryData = await ShopReceipt.aggregate(pipeline);

    // Build region breakdown
    const regionBreakdown = {
      US: { orders: 0, revenue: 0 },
      UK: { orders: 0, revenue: 0 },
      EU: { orders: 0, revenue: 0 },
      CA: { orders: 0, revenue: 0 },
      AU: { orders: 0, revenue: 0 },
      OTHER: { orders: 0, revenue: 0 },
    };

    const countryBreakdown = [];
    let totalOrders = 0;
    let totalRevenue = 0;

    for (const row of countryData) {
      const region = getRegion(row._id);
      regionBreakdown[region].orders += row.orders;
      regionBreakdown[region].revenue += row.revenue;
      totalOrders += row.orders;
      totalRevenue += row.revenue;
      countryBreakdown.push({
        countryIso: row._id || 'UNKNOWN',
        orders: row.orders,
        revenue: row.revenue,
        region,
      });
    }

    return res.json({
      success: true,
      data: {
        regionBreakdown,
        countryBreakdown,
        totalOrders,
        totalRevenue,
        periodMonths: months,
      },
    });
  } catch (error) {
    console.error('[LogisticsController] getSalesMap error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve sales map data',
    });
  }
};

/**
 * GET /api/v1/customer/logistics/sales-map/history
 * Returns saved SalesGeoSnapshot documents for trend analysis.
 * Query params: limit (default 6, max 24)
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
    console.error('[LogisticsController] getSalesMapHistory error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve sales map history',
    });
  }
};

module.exports = {
  getDeliveryStatus,
  getSalesMap,
  getSalesMapHistory,
};
