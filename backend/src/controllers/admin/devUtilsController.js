const { User } = require('../../models/user');
const { ActivityLog } = require('../../models/admin');
const { getClientIP } = require('../../utils/helpers/ipHelper');
const { safeSave, safeActivityLog } = require('../../utils/helpers/safeDbOps');

/**
 * POST /api/v1/admin/dev-utils/verify-customer
 * Manually verify a customer email (for testing without SMTP)
 */
const verifyCustomer = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    // Find the customer
    const customer = await User.findOne({ 
      email, 
      accountType: 'customer' 
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    // Already verified
    if (customer.isEmailVerified && customer.status === 'active') {
      return res.json({
        success: true,
        message: 'Customer is already verified',
        customer: {
          name: customer.name,
          email: customer.email,
          status: customer.status,
          isEmailVerified: customer.isEmailVerified,
        },
      });
    }

    // Verify the customer
    customer.isEmailVerified = true;
    customer.status = 'active';
    customer.emailVerificationToken = undefined;
    customer.emailVerificationExpires = undefined;
    await safeSave(customer);

    // Log the activity
    await safeActivityLog(ActivityLog, {
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'customer_verified_manually',
      actionType: 'update',
      targetModel: 'User',
      targetId: customer._id,
      targetName: customer.name,
      description: `Admin ${req.user.name} manually verified customer: ${customer.email}`,
      ipAddress: getClientIP(req),
      userAgent: req.get('user-agent'),
      status: 'success',
      metadata: {
        customerEmail: customer.email,
        reason: 'Testing without SMTP',
      },
    });

    res.json({
      success: true,
      message: 'Customer verified successfully',
      customer: {
        name: customer.name,
        email: customer.email,
        status: customer.status,
        isEmailVerified: customer.isEmailVerified,
      },
    });

  } catch (error) {
    console.error('Verify customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying customer',
    });
  }
};

/**
 * POST /api/v1/admin/dev-utils/create-test-customer
 * Create a test customer with auto-verification (for testing)
 */
const createTestCustomer = async (req, res) => {
  try {
    const { name, email, password = 'test123456' } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered',
      });
    }

    // Create test customer with verification already done
    const user = new User({
      name,
      email,
      password,
      accountType: 'customer',
      role: 'customer',
      status: 'active',
      plan: 'free',
      analysisLimit: 1,
      analysisCount: 0,
      isEmailVerified: true, // Auto-verified
    });

    await safeSave(user);

    // Log activity
    await safeActivityLog(ActivityLog, {
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'test_customer_created',
      actionType: 'create',
      targetModel: 'User',
      targetId: user._id,
      targetName: user.name,
      description: `Admin ${req.user.name} created test customer: ${user.email}`,
      ipAddress: getClientIP(req),
      userAgent: req.get('user-agent'),
      status: 'success',
      metadata: {
        customerEmail: user.email,
        autoVerified: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Test customer created successfully (auto-verified)',
      customer: {
        name: user.name,
        email: user.email,
        password: password,
        status: user.status,
        isEmailVerified: user.isEmailVerified,
      },
      loginCredentials: {
        email: user.email,
        password: password,
      },
    });

  } catch (error) {
    console.error('Create test customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating test customer',
    });
  }
};

module.exports = {
  verifyCustomer,
  createTestCustomer,
};
