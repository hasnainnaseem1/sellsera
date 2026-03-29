const log = require('../../utils/logger')('Marketing');
const MarketingPage = require('../../models/admin/MarketingPage');
const { AdminSettings } = require('../../models/admin');
const { resolveFromReq } = require('../../utils/helpers/urlHelper');

/**
 * GET /api/v1/public/site
 * Get site branding & settings for the marketing website
 */
const getSiteSettings = async (req, res) => {
  try {
    const settings = await AdminSettings.getSettings();
    const theme = settings.themeSettings || {};
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json(resolveFromReq({
      success: true,
      site: {
        // General fields
        siteName: settings.siteName || '',
        siteDescription: settings.siteDescription || '',
        contactEmail: settings.contactEmail || '',
        supportEmail: settings.supportEmail || '',
        // Full themeSettings object (for frontend flexibility)
        themeSettings: theme,
        // Flattened theme fields (backward compatibility)
        appName: theme.appName || settings.siteName || '',
        primaryColor: theme.primaryColor || '#7c3aed',
        secondaryColor: theme.secondaryColor || '#3b82f6',
        accentColor: theme.accentColor || '#f59e0b',
        logoUrl: theme.logoUrl || '',
        logoSmallUrl: theme.logoSmallUrl || '',
        faviconUrl: theme.faviconUrl || '',
        companyName: theme.companyName || theme.appName || settings.siteName || '',
        appTagline: theme.appTagline || '',
        appDescription: theme.appDescription || '',
        primaryService: theme.primaryService || '',
        secondaryService: theme.secondaryService || '',
        targetPlatform: theme.targetPlatform || '',
        toolType: theme.toolType || '',
        welcomeTitle: theme.welcomeTitle || '',
        welcomeMessage: theme.welcomeMessage || '',
        emailVerificationMessage: theme.emailVerificationMessage || '',
        // Feature flags
        enableCustomerSignup: settings.features?.enableCustomerSignup !== false,
        enableLogin: settings.features?.enableLogin !== false,
        enableAnalysis: settings.features?.enableAnalysis !== false,
        enableSubscriptions: settings.features?.enableSubscriptions !== false,
        // Google SSO (only expose clientId when enabled — never expose clientSecret)
        googleSSO: {
          enabled: settings.googleSSOSettings?.enabled || false,
          clientId: settings.googleSSOSettings?.enabled ? (settings.googleSSOSettings?.clientId || '') : '',
        },
        // Maintenance mode
        maintenance: {
          enabled: settings.maintenanceMode?.enabled || false,
          message: settings.maintenanceMode?.message || 'We are currently performing maintenance. Please check back soon.',
        },
      },
    }, req));
  } catch (err) {
    log.error('Error fetching site settings:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch site settings' });
  }
};

/**
 * GET /api/v1/public/navigation
 * Get navigation links for the marketing website
 */
const getNavigation = async (req, res) => {
  try {
    const pages = await MarketingPage.find({
      showInNavigation: true,
      status: 'published',
    })
      .select('title slug navigationOrder navigationLabel isHomePage')
      .sort({ navigationOrder: 1 });

    const navigation = pages.map(p => ({
      label: p.navigationLabel || p.title,
      slug: p.slug,
      path: p.isHomePage ? '/' : `/${p.slug}`,
    }));

    res.json({ success: true, navigation });
  } catch (err) {
    log.error('Error fetching navigation:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch navigation' });
  }
};

/**
 * GET /api/v1/public/pages
 * Get all published pages (minimal data for routing)
 */
const getPages = async (req, res) => {
  try {
    const pages = await MarketingPage.find({ status: 'published' })
      .select('title slug isHomePage metaTitle metaDescription navigationOrder')
      .sort({ navigationOrder: 1 });

    res.json({ success: true, pages });
  } catch (err) {
    log.error('Error fetching pages:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch pages' });
  }
};

/**
 * GET /api/v1/public/pages/:slug
 * Get a single published page by slug (full content)
 */
const getPageBySlug = async (req, res) => {
  try {
    const page = await MarketingPage.findOne({
      slug: req.params.slug,
      status: 'published',
    }).select('-lastEditedBy -__v');

    if (!page) {
      return res.status(404).json({ success: false, message: 'Page not found' });
    }

    // Filter out hidden blocks
    const visibleBlocks = page.blocks.filter(b => b.visible !== false);

    res.json(resolveFromReq({
      success: true,
      page: {
        ...page.toObject(),
        blocks: visibleBlocks,
      },
    }, req));
  } catch (err) {
    log.error('Error fetching page:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch page' });
  }
};

/**
 * GET /api/v1/public/pages/home
 * Get the homepage
 */
const getHomePage = async (req, res) => {
  try {
    const page = await MarketingPage.findOne({
      isHomePage: true,
      status: 'published',
    }).select('-lastEditedBy -__v');

    if (!page) {
      return res.status(404).json({ success: false, message: 'Homepage not configured' });
    }

    const visibleBlocks = page.blocks.filter(b => b.visible !== false);

    res.json(resolveFromReq({
      success: true,
      page: {
        ...page.toObject(),
        blocks: visibleBlocks,
      },
    }, req));
  } catch (err) {
    log.error('Error fetching homepage:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch homepage' });
  }
};

module.exports = {
  getSiteSettings,
  getNavigation,
  getPages,
  getPageBySlug,
  getHomePage,
};
