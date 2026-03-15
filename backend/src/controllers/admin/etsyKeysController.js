/**
 * Admin Etsy API Keys Controller
 * 
 * CRUD for the EtsyApiKey pool used for key rotation.
 * Only accessible to super_admin / admin users.
 */
const { EtsyApiKey } = require('../../models/integrations');
const { encrypt } = require('../../utils/encryption');

/**
 * GET /api/v1/admin/etsy-keys
 * List all API keys (credentials masked).
 */
const listKeys = async (req, res) => {
  try {
    const keys = await EtsyApiKey.find()
      .select('-sharedSecret')
      .sort({ createdAt: -1 })
      .lean();

    // Mask API keys for display
    const masked = keys.map(k => ({
      ...k,
      apiKey: k.apiKey
        ? `${k.apiKey.slice(0, 6)}...${k.apiKey.slice(-4)}`
        : '',
    }));

    return res.json({ success: true, data: masked });
  } catch (error) {
    console.error('[AdminEtsyKeys] listKeys error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list API keys' });
  }
};

/**
 * POST /api/v1/admin/etsy-keys
 * Add a new API key to the pool.
 */
const addKey = async (req, res) => {
  try {
    const { label, clientId, clientSecret } = req.body;

    if (!label || !clientId || !clientSecret) {
      return res.status(400).json({
        success: false,
        message: 'Label, client ID, and client secret are required',
      });
    }

    // Check for duplicate apiKey
    const existing = await EtsyApiKey.findOne({ apiKey: clientId.trim() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An API key with this client ID already exists',
      });
    }

    const key = await EtsyApiKey.create({
      label: label.trim(),
      apiKey: clientId.trim(),
      sharedSecret: encrypt(clientSecret.trim()),
      status: 'active',
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: 'API key added successfully',
      data: {
        _id: key._id,
        label: key.label,
        apiKey: `${key.apiKey.slice(0, 6)}...${key.apiKey.slice(-4)}`,
        status: key.status,
        createdAt: key.createdAt,
      },
    });
  } catch (error) {
    console.error('[AdminEtsyKeys] addKey error:', error);
    return res.status(500).json({ success: false, message: 'Failed to add API key' });
  }
};

/**
 * PUT /api/v1/admin/etsy-keys/:id
 * Update label or rotate secret.
 */
const updateKey = async (req, res) => {
  try {
    const { label, clientSecret, status } = req.body;
    const key = await EtsyApiKey.findById(req.params.id);
    if (!key) {
      return res.status(404).json({ success: false, message: 'API key not found' });
    }

    if (label) key.label = label.trim();
    if (clientSecret) key.sharedSecret = encrypt(clientSecret.trim());
    if (status && ['active', 'disabled'].includes(status)) key.status = status;

    await key.save();

    return res.json({
      success: true,
      message: 'API key updated successfully',
      data: {
        _id: key._id,
        label: key.label,
        status: key.status,
      },
    });
  } catch (error) {
    console.error('[AdminEtsyKeys] updateKey error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update API key' });
  }
};

/**
 * DELETE /api/v1/admin/etsy-keys/:id
 * Remove an API key from the pool.
 */
const deleteKey = async (req, res) => {
  try {
    const key = await EtsyApiKey.findByIdAndDelete(req.params.id);
    if (!key) {
      return res.status(404).json({ success: false, message: 'API key not found' });
    }

    return res.json({ success: true, message: 'API key removed' });
  } catch (error) {
    console.error('[AdminEtsyKeys] deleteKey error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete API key' });
  }
};

/**
 * POST /api/v1/admin/etsy-keys/:id/toggle
 * Toggle key active/disabled.
 */
const toggleKey = async (req, res) => {
  try {
    const key = await EtsyApiKey.findById(req.params.id);
    if (!key) {
      return res.status(404).json({ success: false, message: 'API key not found' });
    }

    key.status = key.status === 'active' ? 'disabled' : 'active';
    if (key.status === 'active') key.errorCount = 0;
    await key.save();

    return res.json({
      success: true,
      message: `API key ${key.status === 'active' ? 'enabled' : 'disabled'}`,
      data: { _id: key._id, status: key.status },
    });
  } catch (error) {
    console.error('[AdminEtsyKeys] toggleKey error:', error);
    return res.status(500).json({ success: false, message: 'Failed to toggle API key' });
  }
};

module.exports = {
  listKeys,
  addKey,
  updateKey,
  deleteKey,
  toggleKey,
};
