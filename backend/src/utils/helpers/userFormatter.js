/**
 * Format user response based on account type
 * - Customer users: include subscription fields
 * - Admin users: exclude subscription fields (they don't need marketplace features)
 */
const formatUserResponse = (user, options = {}) => {
  const {
    includePermissions = false,
    includeSensitiveData = false,
  } = options;

  const baseUser = {
    id: user._id,
    name: user.name,
    email: user.email,
    accountType: user.accountType,
    role: user.role,
    customRole: user.customRole,
    status: user.status,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
  };

  // Add customer-specific fields
  if (user.accountType === 'customer') {
    baseUser.plan = user.plan;
    baseUser.analysisCount = user.analysisCount;
    baseUser.analysisLimit = user.analysisLimit;
    baseUser.subscriptionStatus = user.subscriptionStatus;
  }

  // Add admin-specific fields
  if (user.accountType === 'admin') {
    baseUser.department = user.department;
    baseUser.assignedBy = user.assignedBy;
  }

  // Add optional fields
  if (includeSensitiveData) {
    baseUser.lastLogin = user.lastLogin;
    baseUser.lastLoginIP = user.lastLoginIP;
    baseUser.loginAttempts = user.loginAttempts;
    baseUser.lockUntil = user.lockUntil;
  }

  if (includePermissions && user.accountType === 'admin') {
    baseUser.permissions = user.permissions;
  }

  return baseUser;
};

module.exports = {
  formatUserResponse,
};
