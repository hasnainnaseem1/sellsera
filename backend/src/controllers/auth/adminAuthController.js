const jwt = require('jsonwebtoken');
const { User } = require('../../models/user');
const { ActivityLog } = require('../../models/admin');
const { Notification } = require('../../models/notification');
const { getClientIP } = require('../../utils/helpers/ipHelper');
const { notifyPasswordResetRequest } = require('../../services/notification/adminNotifier');
const { getSecuritySettings, msToJwtExpiry, validatePassword } = require('../../utils/helpers/securityHelper');

// Generate JWT token with dynamic session timeout
const generateToken = (userId, sessionTimeoutMs) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured in the environment variables');
  }
  const expiresIn = sessionTimeoutMs ? msToJwtExpiry(sessionTimeoutMs) : '7d';
  return jwt.sign(
    { userId }, 
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

// @route   POST /api/admin/auth/login
// @desc    Login admin
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Get client IP
    const clientIP = getClientIP(req);

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find admin user
    const user = await User.findOne({ 
      email, 
      accountType: 'admin' 
    }).populate('customRole', 'name permissions');
    
    if (!user) {
      // Log failed login attempt (non-critical)
      try {
        await ActivityLog.logActivity({
          userId: null,
          userName: 'Unknown',
          userEmail: email,
          userRole: 'unknown',
          action: 'login',
          actionType: 'auth',
          description: 'Failed login attempt - user not found',
          ipAddress: clientIP,
          userAgent: req.get('user-agent'),
          status: 'failed',
          errorMessage: 'User not found or not an admin'
        });
      } catch (logErr) {
        console.error('Failed to log activity:', logErr.message);
      }
      
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials or insufficient privileges'
      });
    }

    // Fetch dynamic security settings (use defaults if fails)
    let secSettings;
    try {
      secSettings = await getSecuritySettings();
    } catch (secErr) {
      console.error('Failed to get security settings, using defaults:', secErr.message);
      secSettings = { maxLoginAttempts: 5, lockoutDuration: 1800000, sessionTimeout: 604800000 };
    }

    // Check if account is locked
    if (user.isLocked()) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked due to too many failed login attempts. Please try again later.'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      // Increment login attempts with dynamic settings (non-critical)
      try {
        await user.incLoginAttempts(secSettings.maxLoginAttempts, secSettings.lockoutDuration);
      } catch (incErr) {
        console.error('Failed to increment login attempts:', incErr.message);
      }
      
      // Log failed login (non-critical)
      try {
        const roleLabel = user.role === 'super_admin' ? 'Super Admin' : 
                          user.role === 'custom' ? 'Custom Role' :
                          user.role.charAt(0).toUpperCase() + user.role.slice(1);
        
        await ActivityLog.logActivity({
          userId: user._id,
          userName: user.name,
          userEmail: user.email,
          userRole: user.role,
          action: 'login',
          actionType: 'auth',
          description: `Failed ${roleLabel} login attempt - incorrect password`,
          ipAddress: clientIP,
          userAgent: req.get('user-agent'),
          status: 'failed',
          errorMessage: 'Incorrect password'
        });
      } catch (logErr) {
        console.error('Failed to log activity:', logErr.message);
      }
      
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check account status
    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended. Please contact the system administrator.'
      });
    }

    if (user.status === 'banned') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been banned.'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your account is not active. Please contact the system administrator.'
      });
    }

    // Reset login attempts on successful login (non-critical)
    try {
      await user.resetLoginAttempts();
    } catch (resetErr) {
      console.error('Failed to reset login attempts:', resetErr.message);
    }

    // Update last login using updateOne to avoid save hooks/version conflicts (non-critical)
    try {
      await User.updateOne(
        { _id: user._id },
        { $set: { lastLogin: new Date(), lastLoginIP: clientIP } }
      );
    } catch (updateErr) {
      console.error('Failed to update lastLogin:', updateErr.message);
    }

    // Log successful login (non-critical)
    try {
      const roleLabel = user.role === 'super_admin' ? 'Super Admin' : 
                        user.role === 'custom' ? 'Custom Role' :
                        user.role.charAt(0).toUpperCase() + user.role.slice(1);
      
      await ActivityLog.logActivity({
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        action: 'login',
        actionType: 'auth',
        description: `Successful ${roleLabel} login`,
        ipAddress: clientIP,
        userAgent: req.get('user-agent'),
        status: 'success'
      });
    } catch (logErr) {
      console.error('Failed to log login activity:', logErr.message);
    }

    // Generate token with dynamic session timeout (CRITICAL)
    const token = generateToken(user._id, secSettings.sessionTimeout);

    // Get permissions
    let permissions = [];
    try {
      permissions = await user.getPermissions();
    } catch (permErr) {
      console.error('Failed to get permissions:', permErr.message);
    }

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        accountType: user.accountType,
        role: user.role,
        department: user.department,
        timezone: user.timezone,
        permissions: permissions,
        passwordChangeRequired: user.passwordChangeRequired,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error logging in'
    });
  }
};

// @route   GET /api/admin/auth/me
// @desc    Get current admin user
// @access  Private (Admin)
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('-password')
      .populate('customRole', 'name permissions');
    
    const permissions = await user.getPermissions();

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        accountType: user.accountType,
        role: user.role,
        customRole: user.customRole,
        department: user.department,
        timezone: user.timezone,
        permissions: permissions,
        status: user.status,
        lastLogin: user.lastLogin,
        lastLoginIP: user.lastLoginIP,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Get admin user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user data'
    });
  }
};

// @route   POST /api/admin/auth/logout
// @desc    Logout admin
// @access  Private (Admin)
const logout = async (req, res) => {
  try {
    const clientIP = getClientIP(req);

    // Log logout activity
    await ActivityLog.logActivity({
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'logout',
      actionType: 'auth',
      description: 'Admin logged out',
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Admin logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging out'
    });
  }
};

// @route   POST /api/admin/auth/change-password
// @desc    Change admin password (super admin only, or first login for all admins)
// @access  Private (Admin)
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const clientIP = getClientIP(req);

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }

    // Validate password against security settings
    const secSettings = await getSecuritySettings();
    const pwdCheck = await validatePassword(newPassword, secSettings);
    if (!pwdCheck.valid) {
      return res.status(400).json({
        success: false,
        message: pwdCheck.message
      });
    }

    const user = await User.findById(req.userId);

    // Check if user is allowed to change password
    // Super admin can always change password
    // Other admins can only change password if passwordChangeRequired is true (first login)
    if (user.role !== 'super_admin' && !user.passwordChangeRequired) {
      return res.status(403).json({
        success: false,
        message: 'You cannot change your password. Contact your super admin to request a password reset.'
      });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    // If this was a first-login password change, mark it as complete
    if (user.passwordChangeRequired) {
      user.passwordChangeRequired = false;
    }
    await user.save();

    // Log password change
    await ActivityLog.logActivity({
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: 'password_reset',
      actionType: 'auth',
      description: user.role === 'super_admin' 
        ? 'Super admin password changed' 
        : 'First login password changed successfully',
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password'
    });
  }
};

// @route   PUT /api/admin/auth/profile
// @desc    Update admin profile
// @access  Private (Admin)
const updateProfile = async (req, res) => {
  try {
    const { timezone, name, avatar } = req.body;
    const clientIP = getClientIP(req);

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update allowed fields
    if (timezone !== undefined) {
      user.timezone = timezone;
    }
    if (name !== undefined) {
      user.name = name;
    }
    if (avatar !== undefined) {
      user.avatar = avatar || null;
    }

    user.updatedAt = Date.now();
    await user.save();

    // Log profile update
    await ActivityLog.logActivity({
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: 'profile_update',
      actionType: 'user',
      description: 'Admin profile updated',
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    // Return updated user without password
    const userObj = user.toObject();
    delete userObj.password;
    
    // Include permissions in response
    userObj.permissions = await user.getPermissions();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: userObj
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
};

// @route   POST /api/admin/auth/forgot-password
// @desc    Request password reset (public - for users who forgot password)
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const clientIP = getClientIP(req);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email'
      });
    }

    // Find user
    const user = await User.findOne({ email, accountType: 'admin' });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No admin account found with this email'
      });
    }

    // Super admin can reset their own password
    if (user.role === 'super_admin') {
      // Generate reset token
      const resetToken = require('crypto').randomBytes(32).toString('hex');
      user.passwordResetToken = require('crypto').createHash('sha256').update(resetToken).digest('hex');
      user.passwordResetExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      await user.save();

      // Log this request
      await ActivityLog.logActivity({
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        action: 'password_reset_request',
        actionType: 'security',
        description: 'Super Admin requested password reset',
        ipAddress: clientIP,
        userAgent: req.get('user-agent'),
        status: 'success'
      });

      res.json({
        success: true,
        message: 'Password reset link sent to your email',
        note: 'In production, this would send an email with reset link',
        resetToken: resetToken // For testing only, remove in production
      });
    } else {
      // Non-super-admin users need super admin to reset their password
      // Find super admin
      const superAdmin = await User.findOne({ role: 'super_admin', accountType: 'admin' });
      
      if (!superAdmin) {
        return res.status(500).json({
          success: false,
          message: 'No Super Admin found in the system. Please contact your administrator.'
        });
      }

      // Notify super admin(s) with in-app + email notification
      notifyPasswordResetRequest({ requestUser: user, method: 'forgot_password' }).catch(() => {});

      // Log the password reset request
      await ActivityLog.logActivity({
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        action: 'password_reset',
        actionType: 'auth',
        targetModel: 'User',
        targetId: superAdmin._id,
        targetName: superAdmin.name,
        description: `${user.name} requested password reset (forgot password)`,
        ipAddress: clientIP,
        userAgent: req.get('user-agent'),
        status: 'success'
      });

      res.json({
        success: true,
        message: `A password reset request has been sent to ${superAdmin.name}`,
        needsAdminHelp: true,
        superAdminName: superAdmin.name,
        superAdminEmail: superAdmin.email,
        note: 'You will receive a notification once your password has been reset. You can then login with the new password.'
      });
    }

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing password reset request'
    });
  }
};

// @route   POST /api/admin/auth/reset-password
// @desc    Reset password using token (for super admin)
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body;

    if (!resetToken || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    // Validate password against security settings
    const secSettings = await getSecuritySettings();
    const pwdCheck = await validatePassword(newPassword, secSettings);
    if (!pwdCheck.valid) {
      return res.status(400).json({
        success: false,
        message: pwdCheck.message
      });
    }

    // Hash token and find user
    const hashedToken = require('crypto').createHash('sha256').update(resetToken).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is invalid or has expired'
      });
    }

    // Update password
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password'
    });
  }
};

// @route   POST /api/admin/auth/reset-password-for-user
// @desc    Super admin can reset another admin's password
// @access  Private (Super Admin only)
const resetPasswordForUser = async (req, res) => {
  try {
    const { userId, newPassword } = req.body;

    // Only super admin can do this
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only Super Admin can reset other users passwords'
      });
    }

    if (!userId || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide userId and new password'
      });
    }

    // Validate password against security settings
    const secSettings = await getSecuritySettings();
    const pwdCheck = await validatePassword(newPassword, secSettings);
    if (!pwdCheck.valid) {
      return res.status(400).json({
        success: false,
        message: pwdCheck.message
      });
    }

    const targetUser = await User.findById(userId);

    if (!targetUser || targetUser.accountType !== 'admin') {
      return res.status(404).json({
        success: false,
        message: 'Admin user not found'
      });
    }

    // Prevent super admin from resetting super admin password
    if (targetUser.role === 'super_admin' && targetUser._id.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Cannot reset another Super Admin password'
      });
    }

    // Reset password
    targetUser.password = newPassword;
    targetUser.passwordResetToken = undefined;
    targetUser.passwordResetExpires = undefined;
    // Set passwordChangeRequired for non-super-admin users
    if (targetUser.role !== 'super_admin') {
      targetUser.passwordChangeRequired = true;
    }
    await targetUser.save();

    // Log this action
    const clientIP = getClientIP(req);
    await ActivityLog.logActivity({
      userId: req.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'password_reset',
      actionType: 'security',
      targetModel: 'User',
      targetId: targetUser._id,
      targetName: targetUser.name,
      description: `Reset password for admin user: ${targetUser.email}`,
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.json({
      success: true,
      message: `Password reset successfully for ${targetUser.name}. They can now login with the new password.`,
      resetUser: {
        id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email
      }
    });

  } catch (error) {
    console.error('Reset password for user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting user password'
    });
  }
};

// @route   POST /api/admin/auth/request-password-reset
// @desc    Non-super-admin users request password reset from super admin
// @access  Private (Admin - non-super-admin only)
const requestPasswordReset = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const clientIP = getClientIP(req);

    // Only non-super-admin users can request reset
    if (user.role === 'super_admin') {
      return res.status(400).json({
        success: false,
        message: 'Super Admin can use the forgot password feature instead'
      });
    }

    // Check if there's an active super admin
    const superAdmin = await User.findOne({ role: 'super_admin', accountType: 'admin' });
    if (!superAdmin) {
      return res.status(500).json({
        success: false,
        message: 'No Super Admin found in the system'
      });
    }

    // Log the password reset request
    await ActivityLog.logActivity({
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: 'password_reset',
      actionType: 'auth',
      targetModel: 'User',
      targetId: superAdmin._id,
      targetName: superAdmin.name,
      description: `${user.name} (${user.email}) requested password reset`,
      ipAddress: clientIP,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    // Notify super admin(s) with in-app + email notification
    notifyPasswordResetRequest({ requestUser: user, method: 'request_reset' }).catch(() => {});

    res.json({
      success: true,
      message: `Password reset request sent to Super Admin. You will be notified once your password is reset.`,
      superAdminEmail: superAdmin.email
    });

  } catch (error) {
    console.error('Request password reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting password reset request'
    });
  }
};

module.exports = {
  login,
  getMe,
  logout,
  changePassword,
  updateProfile,
  forgotPassword,
  resetPassword,
  resetPasswordForUser,
  requestPasswordReset
};
