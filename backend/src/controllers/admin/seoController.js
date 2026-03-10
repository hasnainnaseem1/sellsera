const { AdminSettings, SeoRedirect } = require('../../models/admin');
const { resolveFromReq, toRelativeUploadPath, stripUploadHosts } = require('../../utils/helpers/urlHelper');
const { safeSave } = require('../../utils/helpers/safeDbOps');

/**
 * GET /api/v1/admin/seo/settings
 * Get SEO settings
 */
const getSettings = async (req, res) => {
  try {
    const settings = await AdminSettings.getSettings();
    res.json(resolveFromReq({ success: true, seoSettings: settings.seoSettings || {} }, req));
  } catch (err) {
    console.error('Error fetching SEO settings:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch SEO settings' });
  }
};

/**
 * PUT /api/v1/admin/seo/settings
 * Update SEO settings
 */
const updateSettings = async (req, res) => {
  try {
    const {
      googleAnalyticsId,
      googleSearchConsoleVerification,
      bingVerification,
      defaultOgImage,
      socialLinks,
      socialLinksEnabled,
      customSocialLinks,
      enableSitemap,
      robotsTxtCustom,
      customHeadScripts,
      enableSchemaMarkup,
    } = req.body;

    const settings = await AdminSettings.getSettings();

    if (!settings.seoSettings) settings.seoSettings = {};

    if (googleAnalyticsId !== undefined) settings.seoSettings.googleAnalyticsId = googleAnalyticsId;
    if (googleSearchConsoleVerification !== undefined) settings.seoSettings.googleSearchConsoleVerification = googleSearchConsoleVerification;
    if (bingVerification !== undefined) settings.seoSettings.bingVerification = bingVerification;
    if (defaultOgImage !== undefined) settings.seoSettings.defaultOgImage = toRelativeUploadPath(defaultOgImage);
    if (socialLinks !== undefined) settings.seoSettings.socialLinks = socialLinks;
    if (socialLinksEnabled !== undefined) settings.seoSettings.socialLinksEnabled = socialLinksEnabled;
    if (customSocialLinks !== undefined) settings.seoSettings.customSocialLinks = stripUploadHosts(customSocialLinks);
    if (enableSitemap !== undefined) settings.seoSettings.enableSitemap = enableSitemap;
    if (robotsTxtCustom !== undefined) settings.seoSettings.robotsTxtCustom = robotsTxtCustom;
    if (customHeadScripts !== undefined) settings.seoSettings.customHeadScripts = customHeadScripts;
    if (enableSchemaMarkup !== undefined) settings.seoSettings.enableSchemaMarkup = enableSchemaMarkup;

    settings.markModified('seoSettings');
    await safeSave(settings);

    res.json(resolveFromReq({ success: true, seoSettings: settings.seoSettings }, req));
  } catch (err) {
    console.error('Error updating SEO settings:', err);
    res.status(500).json({ success: false, message: 'Failed to update SEO settings' });
  }
};

/**
 * GET /api/v1/admin/seo/redirects
 * List all redirects
 */
const getRedirects = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { fromPath: { $regex: search, $options: 'i' } },
        { toPath: { $regex: search, $options: 'i' } },
        { note: { $regex: search, $options: 'i' } },
      ];
    }
    if (status === 'active') filter.isActive = true;
    if (status === 'inactive') filter.isActive = false;

    const total = await SeoRedirect.countDocuments(filter);
    const redirects = await SeoRedirect.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      success: true,
      redirects,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Error fetching redirects:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch redirects' });
  }
};

/**
 * POST /api/v1/admin/seo/redirects
 * Create a new redirect
 */
const createRedirect = async (req, res) => {
  try {
    const { fromPath, toPath, statusCode, note } = req.body;

    if (!fromPath || !toPath) {
      return res.status(400).json({ success: false, message: 'fromPath and toPath are required' });
    }

    // Normalize paths
    const normalizedFrom = fromPath.startsWith('/') ? fromPath : `/${fromPath}`;
    const normalizedTo = toPath.startsWith('/') || toPath.startsWith('http') ? toPath : `/${toPath}`;

    // Check for existing
    const existing = await SeoRedirect.findOne({ fromPath: normalizedFrom });
    if (existing) {
      return res.status(400).json({ success: false, message: 'A redirect from this path already exists' });
    }

    // Prevent circular redirects
    if (normalizedFrom === normalizedTo) {
      return res.status(400).json({ success: false, message: 'Cannot redirect a path to itself' });
    }

    const redirect = new SeoRedirect({
      fromPath: normalizedFrom,
      toPath: normalizedTo,
      statusCode: statusCode || 301,
      note: note || '',
      createdBy: req.user?._id,
    });

    await safeSave(redirect);
    res.status(201).json({ success: true, redirect });
  } catch (err) {
    console.error('Error creating redirect:', err);
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'A redirect from this path already exists' });
    }
    res.status(500).json({ success: false, message: 'Failed to create redirect' });
  }
};

/**
 * PUT /api/v1/admin/seo/redirects/:id
 * Update a redirect
 */
const updateRedirect = async (req, res) => {
  try {
    const { fromPath, toPath, statusCode, isActive, note } = req.body;
    const redirect = await SeoRedirect.findById(req.params.id);
    if (!redirect) {
      return res.status(404).json({ success: false, message: 'Redirect not found' });
    }

    if (fromPath !== undefined) {
      const normalized = fromPath.startsWith('/') ? fromPath : `/${fromPath}`;
      // Check uniqueness
      const existing = await SeoRedirect.findOne({ fromPath: normalized, _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(400).json({ success: false, message: 'A redirect from this path already exists' });
      }
      redirect.fromPath = normalized;
    }
    if (toPath !== undefined) redirect.toPath = toPath.startsWith('/') || toPath.startsWith('http') ? toPath : `/${toPath}`;
    if (statusCode !== undefined) redirect.statusCode = statusCode;
    if (isActive !== undefined) redirect.isActive = isActive;
    if (note !== undefined) redirect.note = note;

    await safeSave(redirect);
    res.json({ success: true, redirect });
  } catch (err) {
    console.error('Error updating redirect:', err);
    res.status(500).json({ success: false, message: 'Failed to update redirect' });
  }
};

/**
 * DELETE /api/v1/admin/seo/redirects/:id
 * Delete a redirect
 */
const deleteRedirect = async (req, res) => {
  try {
    const redirect = await SeoRedirect.findByIdAndDelete(req.params.id);
    if (!redirect) {
      return res.status(404).json({ success: false, message: 'Redirect not found' });
    }
    res.json({ success: true, message: 'Redirect deleted' });
  } catch (err) {
    console.error('Error deleting redirect:', err);
    res.status(500).json({ success: false, message: 'Failed to delete redirect' });
  }
};

/**
 * PUT /api/v1/admin/seo/redirects/:id/toggle
 * Toggle redirect active status
 */
const toggleRedirect = async (req, res) => {
  try {
    const redirect = await SeoRedirect.findById(req.params.id);
    if (!redirect) {
      return res.status(404).json({ success: false, message: 'Redirect not found' });
    }
    redirect.isActive = !redirect.isActive;
    await safeSave(redirect);
    res.json({ success: true, redirect });
  } catch (err) {
    console.error('Error toggling redirect:', err);
    res.status(500).json({ success: false, message: 'Failed to toggle redirect' });
  }
};

module.exports = {
  getSettings,
  updateSettings,
  getRedirects,
  createRedirect,
  updateRedirect,
  deleteRedirect,
  toggleRedirect,
};
