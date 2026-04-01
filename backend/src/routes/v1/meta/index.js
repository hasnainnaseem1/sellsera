const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { User } = require('../../../models/user');
const { ETSY_COUNTRIES } = require('../../../utils/constants/etsyCountries');
const { isPlanAllowed, getRequiredPlan } = require('../../../utils/constants/countryTiers');
const etsyApi = require('../../../services/etsy/etsyApiService');
const redis = require('../../../services/cache/redisService');
const log = require('../../../utils/logger')('MetaRoutes');

/**
 * Optional auth — attaches req.user if a valid Bearer token is present.
 * Does NOT reject unauthenticated requests (meta routes stay public).
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('planSnapshot plan').lean();
      if (user) req.user = user;
    }
  } catch {
    // Token invalid / expired — proceed as unauthenticated
  }
  next();
};

// @route   GET /api/v1/meta/countries
// @desc    List supported Etsy countries with plan-based lock metadata
// @access  Public (optional auth enriches with lock info)
router.get('/countries', optionalAuth, (req, res) => {
  const planName = req.user?.planSnapshot?.planName || req.user?.plan || '';

  // Always add the "Global" option first (all sellers, no country filter)
  const globalEntry = {
    value: 'Global',
    label: '🌍 Global (All Countries)',
    name: 'Global',
    isLocked: !isPlanAllowed(planName, 'Global'),
    requiredPlan: getRequiredPlan('Global'),
  };

  const countries = ETSY_COUNTRIES.map(c => ({
    value: c.code,
    label: `${c.flag} ${c.name}`,
    name: c.name,
    isLocked: !isPlanAllowed(planName, c.code),
    requiredPlan: getRequiredPlan(c.code),
  }));

  res.json({ success: true, data: [globalEntry, ...countries] });
});

// @route   GET /api/v1/meta/categories
// @desc    Etsy seller taxonomy — real-time categories + subcategories (cached 24h)
// @access  Public
router.get('/categories', async (req, res) => {
  try {
    // Check Redis cache first (taxonomy rarely changes)
    const CACHE_KEY = 'etsy:seller_taxonomy';
    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    // Fetch from Etsy API
    const result = await etsyApi.publicRequest(
      'GET',
      '/v3/application/seller-taxonomy/nodes'
    );

    if (!result.success || !result.data?.results) {
      log.warn('Failed to fetch Etsy taxonomy:', result.error);
      return res.status(502).json({
        success: false,
        message: 'Unable to fetch Etsy categories at this time',
      });
    }

    // Build parent→children tree from flat list
    const nodes = result.data.results;
    const nodeMap = new Map();
    const roots = [];

    // Index all nodes
    for (const n of nodes) {
      nodeMap.set(n.id, {
        value: String(n.id),
        label: n.name,
        id: n.id,
        parentId: n.parent_id,
        children: [],
      });
    }

    // Build tree
    for (const n of nodes) {
      const node = nodeMap.get(n.id);
      if (n.parent_id && nodeMap.has(n.parent_id)) {
        nodeMap.get(n.parent_id).children.push(node);
      } else {
        roots.push(node);
      }
    }

    // Sort alphabetically at each level
    const sortTree = (items) => {
      items.sort((a, b) => a.label.localeCompare(b.label));
      for (const item of items) {
        if (item.children.length > 0) sortTree(item.children);
        else delete item.children; // Remove empty arrays for cleaner JSON
      }
    };
    sortTree(roots);

    // Cache for 24 hours
    await redis.set(CACHE_KEY, roots, 86400);
    log.info(`Taxonomy cached: ${roots.length} top-level categories, ${nodes.length} total nodes`);

    res.json({ success: true, data: roots });
  } catch (error) {
    log.error('Categories endpoint error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to load categories' });
  }
});

module.exports = router;
