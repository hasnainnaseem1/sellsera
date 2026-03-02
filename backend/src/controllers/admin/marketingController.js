const MarketingPage = require('../../models/admin/MarketingPage');
const { ActivityLog } = require('../../models/admin');
const { getClientIP } = require('../../utils/helpers/ipHelper');

/**
 * GET /api/v1/admin/marketing/pages
 * List all marketing pages (admin view — includes drafts)
 */
const getPages = async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) filter.title = { $regex: search, $options: 'i' };

    const pages = await MarketingPage.find(filter)
      .select('title slug status isHomePage showInNavigation navigationOrder updatedAt')
      .sort({ navigationOrder: 1, updatedAt: -1 })
      .populate('lastEditedBy', 'name');

    res.json({ success: true, pages });
  } catch (err) {
    console.error('Error fetching marketing pages:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch pages' });
  }
};

/**
 * GET /api/v1/admin/marketing/pages/:id
 * Get a single page with all content blocks
 */
const getPage = async (req, res) => {
  try {
    const page = await MarketingPage.findById(req.params.id)
      .populate('lastEditedBy', 'name');
    if (!page) {
      return res.status(404).json({ success: false, message: 'Page not found' });
    }
    res.json({ success: true, page });
  } catch (err) {
    console.error('Error fetching marketing page:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch page' });
  }
};

/**
 * POST /api/v1/admin/marketing/pages
 * Create a new marketing page
 */
const createPage = async (req, res) => {
  try {
    const { title, slug, description, metaTitle, metaDescription, metaKeywords,
            status, isHomePage, showInNavigation, navigationOrder, navigationLabel,
            blocks, customCSS } = req.body;

    const page = new MarketingPage({
      title, slug, description, metaTitle, metaDescription, metaKeywords,
      status: status || 'draft',
      isHomePage: isHomePage || false,
      showInNavigation: showInNavigation !== false,
      navigationOrder: navigationOrder || 0,
      navigationLabel: navigationLabel || '',
      blocks: blocks || [],
      customCSS: customCSS || '',
      lastEditedBy: req.user._id,
    });

    await page.save();
    res.status(201).json({ success: true, page, message: 'Page created successfully' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'A page with this slug already exists' });
    }
    console.error('Error creating marketing page:', err);
    res.status(500).json({ success: false, message: 'Failed to create page' });
  }
};

/**
 * PUT /api/v1/admin/marketing/pages/:id
 * Update a marketing page
 */
const updatePage = async (req, res) => {
  try {
    const page = await MarketingPage.findById(req.params.id);
    if (!page) {
      return res.status(404).json({ success: false, message: 'Page not found' });
    }

    const allowedFields = [
      'title', 'slug', 'description', 'metaTitle', 'metaDescription', 'metaKeywords',
      'status', 'isHomePage', 'showInNavigation', 'navigationOrder', 'navigationLabel',
      'blocks', 'customCSS'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        page[field] = req.body[field];
      }
    });

    page.lastEditedBy = req.user._id;
    await page.save();

    res.json({ success: true, page, message: 'Page updated successfully' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'A page with this slug already exists' });
    }
    console.error('Error updating marketing page:', err);
    res.status(500).json({ success: false, message: 'Failed to update page' });
  }
};

/**
 * DELETE /api/v1/admin/marketing/pages/:id
 * Delete a marketing page
 */
const deletePage = async (req, res) => {
  try {
    const page = await MarketingPage.findById(req.params.id);
    if (!page) {
      return res.status(404).json({ success: false, message: 'Page not found' });
    }
    if (page.isHomePage) {
      return res.status(400).json({ success: false, message: 'Cannot delete the homepage. Set another page as homepage first.' });
    }
    await page.deleteOne();
    res.json({ success: true, message: 'Page deleted successfully' });
  } catch (err) {
    console.error('Error deleting marketing page:', err);
    res.status(500).json({ success: false, message: 'Failed to delete page' });
  }
};

/**
 * PUT /api/v1/admin/marketing/pages/:id/status
 * Quick status toggle (publish/draft/archive)
 */
const updatePageStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['published', 'draft', 'archived'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const page = await MarketingPage.findByIdAndUpdate(
      req.params.id,
      { status, lastEditedBy: req.user._id },
      { new: true }
    );
    if (!page) {
      return res.status(404).json({ success: false, message: 'Page not found' });
    }
    res.json({ success: true, page, message: `Page ${status} successfully` });
  } catch (err) {
    console.error('Error updating page status:', err);
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
};

/**
 * POST /api/v1/admin/marketing/pages/:id/clone
 * Clone an existing marketing page
 */
const clonePage = async (req, res) => {
  try {
    const original = await MarketingPage.findById(req.params.id);
    if (!original) {
      return res.status(404).json({ success: false, message: 'Page not found' });
    }

    const cloned = new MarketingPage({
      title: `${original.title} (Copy)`,
      slug: `${original.slug}-copy-${Date.now()}`,
      description: original.description,
      metaTitle: original.metaTitle,
      metaDescription: original.metaDescription,
      metaKeywords: original.metaKeywords,
      status: 'draft',
      isHomePage: false,
      showInNavigation: false,
      navigationOrder: 99,
      navigationLabel: original.navigationLabel ? `${original.navigationLabel} (Copy)` : '',
      blocks: original.blocks || [],
      customCSS: original.customCSS || '',
      lastEditedBy: req.user._id,
    });

    await cloned.save();
    res.status(201).json({ success: true, page: cloned, message: 'Page cloned successfully' });
  } catch (err) {
    console.error('Error cloning page:', err);
    res.status(500).json({ success: false, message: 'Failed to clone page' });
  }
};

/**
 * PUT /api/v1/admin/marketing/pages/reorder
 * Reorder navigation items
 */
const reorderPages = async (req, res) => {
  try {
    const { pages } = req.body; // [{ id, navigationOrder }]
    if (!Array.isArray(pages)) {
      return res.status(400).json({ success: false, message: 'Pages array required' });
    }
    const bulkOps = pages.map(p => ({
      updateOne: {
        filter: { _id: p.id },
        update: { navigationOrder: p.navigationOrder },
      }
    }));
    await MarketingPage.bulkWrite(bulkOps);
    res.json({ success: true, message: 'Navigation order updated' });
  } catch (err) {
    console.error('Error reordering pages:', err);
    res.status(500).json({ success: false, message: 'Failed to reorder pages' });
  }
};

/**
 * GET /api/v1/admin/marketing/navigation
 * Get navigation config for marketing site
 */
const getNavigation = async (req, res) => {
  try {
    const pages = await MarketingPage.find({ showInNavigation: true, status: 'published' })
      .select('title slug navigationOrder navigationLabel')
      .sort({ navigationOrder: 1 });

    res.json({ success: true, navigation: pages });
  } catch (err) {
    console.error('Error fetching navigation:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch navigation' });
  }
};

/**
 * POST /admin/marketing/pages/bulk-delete
 * Delete multiple pages
 */
const bulkDeletePages = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide page IDs to delete' });
    }
    // Prevent deleting home page
    const homePages = await MarketingPage.find({ _id: { $in: ids }, isHomePage: true });
    if (homePages.length > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete the home page. Remove it from selection.' });
    }
    const result = await MarketingPage.deleteMany({ _id: { $in: ids } });
    await ActivityLog.logActivity({
      userId: req.userId, userName: req.user.name, userEmail: req.user.email, userRole: req.user.role,
      action: 'pages_bulk_deleted', actionType: 'delete', targetModel: 'MarketingPage',
      description: `Bulk deleted ${result.deletedCount} marketing pages`,
      ipAddress: getClientIP(req), userAgent: req.get('user-agent'), status: 'success',
    });
    res.json({ success: true, message: `${result.deletedCount} page(s) deleted successfully`, deletedCount: result.deletedCount });
  } catch (error) {
    console.error('Bulk delete marketing pages error:', error);
    res.status(500).json({ success: false, message: 'Error deleting pages' });
  }
};

module.exports = {
  getPages,
  getPage,
  createPage,
  updatePage,
  deletePage,
  updatePageStatus,
  clonePage,
  reorderPages,
  getNavigation,
  bulkDeletePages,
};
