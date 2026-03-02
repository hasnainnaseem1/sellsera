/**
 * Admin Notifier Service
 * 
 * Sends in-app (and optionally email) notifications to admin users
 * based on the notification settings in AdminSettings.
 * 
 * Checks:
 *  - notifyAdminOnNewcustomer  → new customer signup
 *  - notifyAdminOnSubscription → plan / subscription changes
 *  - enableEmailNotifications  → gate email delivery
 */
const { User } = require('../../models/user');
const { AdminSettings } = require('../../models/admin');
const { Notification } = require('../../models/notification');
const emailService = require('../email/emailService');

/**
 * Fetch current notification settings from AdminSettings singleton.
 */
async function getNotificationSettings() {
  const settings = await AdminSettings.getSettings();
  return settings.notificationSettings || {};
}

/**
 * Get all admin/super_admin user IDs.
 */
async function getAdminIds() {
  const admins = await User.find(
    { accountType: 'admin', status: 'active' },
    '_id email name'
  ).lean();
  return admins;
}

/**
 * Get super admin(s).
 */
async function getSuperAdmins() {
  const superAdmins = await User.find(
    { accountType: 'admin', role: 'super_admin', status: 'active' },
    '_id email name'
  ).lean();
  return superAdmins;
}

/**
 * Internal helper: send in-app + optional email to a set of admins.
 */
async function _notifyAdmins(admins, { type, title, message: msg, priority, metadata, emailSubject, emailHtml, emailText }, ns) {
  if (!admins.length) return;

  // In-app notifications
  const notifPromises = admins.map((admin) =>
    Notification.createNotification({
      recipientId: admin._id,
      recipientType: 'admin',
      type: type || 'system_alert',
      title,
      message: msg,
      priority: priority || 'medium',
      senderName: 'System',
      metadata: metadata || {},
    })
  );
  await Promise.all(notifPromises);

  // Email if enabled
  if (ns.enableEmailNotifications && emailSubject) {
    const emailPromises = admins.map((admin) =>
      emailService
        .sendEmail({
          to: admin.email,
          subject: emailSubject,
          html: emailHtml || `<p>${msg}</p>`,
          text: emailText || msg,
        })
        .catch((err) =>
          console.error(`[AdminNotifier] Email to ${admin.email} failed:`, err.message)
        )
    );
    await Promise.all(emailPromises);
  }
}

/**
 * Notify admins about a new customer registration.
 * Respects `notifyAdminOnNewcustomer` and `enableEmailNotifications`.
 *
 * @param {Object} customer - The newly registered customer document
 */
async function notifyNewCustomer(customer) {
  try {
    const ns = await getNotificationSettings();
    if (!ns.notifyAdminOnNewcustomer) return;

    const admins = await getAdminIds();
    const msg = `${customer.name || customer.email} (${customer.email}) just signed up on the ${customer.plan || 'free'} plan.`;

    await _notifyAdmins(admins, {
      type: 'system_alert',
      title: 'New Customer Registered',
      message: msg,
      priority: 'medium',
      metadata: {
        customerId: customer._id,
        customerEmail: customer.email,
        plan: customer.plan,
      },
      emailSubject: `New Customer Signup: ${customer.name || customer.email}`,
      emailHtml: `
        <h3>New Customer Registered</h3>
        <p><strong>Name:</strong> ${customer.name || 'N/A'}</p>
        <p><strong>Email:</strong> ${customer.email}</p>
        <p><strong>Plan:</strong> ${(customer.plan || 'free').toUpperCase()}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      `,
      emailText: `New customer registered: ${customer.name} (${customer.email}) on ${customer.plan || 'free'} plan.`,
    }, ns);

    console.log(`[AdminNotifier] Notified ${admins.length} admin(s) about new customer: ${customer.email}`);
  } catch (err) {
    console.error('[AdminNotifier] notifyNewCustomer error:', err.message);
  }
}

/**
 * Notify admins about a subscription / plan change.
 * Respects `notifyAdminOnSubscription` and `enableEmailNotifications`.
 *
 * @param {Object} opts
 * @param {Object} opts.customer  - The customer user document
 * @param {string} opts.oldPlan   - Previous plan name
 * @param {string} opts.newPlan   - New plan name
 * @param {string} opts.changeType - 'upgraded' | 'downgraded' | 'cancelled' | 'activated' | 'changed'
 * @param {string} [opts.source]  - 'admin' | 'stripe' | 'system'
 */
async function notifySubscriptionChange({ customer, oldPlan, newPlan, changeType, source = 'system' }) {
  try {
    const ns = await getNotificationSettings();
    if (!ns.notifyAdminOnSubscription) return;

    const admins = await getAdminIds();
    const title = `Subscription ${changeType.charAt(0).toUpperCase() + changeType.slice(1)}`;
    const msg = `${customer.name || customer.email} changed from ${oldPlan || 'N/A'} → ${newPlan || 'N/A'} (${source}).`;

    await _notifyAdmins(admins, {
      type: 'system_alert',
      title,
      message: msg,
      priority: changeType === 'cancelled' ? 'high' : 'medium',
      metadata: {
        customerId: customer._id,
        customerEmail: customer.email,
        oldPlan,
        newPlan,
        changeType,
        source,
      },
      emailSubject: `${title}: ${customer.name || customer.email}`,
      emailHtml: `
        <h3>${title}</h3>
        <p><strong>Customer:</strong> ${customer.name} (${customer.email})</p>
        <p><strong>Change:</strong> ${oldPlan || 'N/A'} → ${newPlan || 'N/A'}</p>
        <p><strong>Type:</strong> ${changeType}</p>
        <p><strong>Source:</strong> ${source}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      `,
      emailText: `${title}: ${customer.name} (${customer.email}) — ${oldPlan} → ${newPlan} (${source})`,
    }, ns);

    console.log(`[AdminNotifier] Notified ${admins.length} admin(s) about subscription ${changeType}: ${customer.email}`);
  } catch (err) {
    console.error('[AdminNotifier] notifySubscriptionChange error:', err.message);
  }
}

/**
 * Notify super admin(s) about an admin password reset request.
 * Always sends — this is a security-critical event.
 *
 * @param {Object} opts
 * @param {Object} opts.requestUser - The user requesting the reset
 * @param {string} opts.method      - 'forgot_password' | 'request_reset'
 */
async function notifyPasswordResetRequest({ requestUser, method = 'forgot_password' }) {
  try {
    const ns = await getNotificationSettings();
    const superAdmins = await getSuperAdmins();
    if (!superAdmins.length) return;

    const msg = `${requestUser.name} (${requestUser.email}) has requested a password reset via ${method === 'forgot_password' ? 'Forgot Password' : 'Request Reset'}.`;

    await _notifyAdmins(superAdmins, {
      type: 'password_reset',
      title: 'Password Reset Request',
      message: msg,
      priority: 'high',
      metadata: {
        requestUserId: requestUser._id,
        requestUserName: requestUser.name,
        requestUserEmail: requestUser.email,
        role: requestUser.role,
        method,
      },
      emailSubject: `Password Reset Request: ${requestUser.name}`,
      emailHtml: `
        <h3>Password Reset Request</h3>
        <p><strong>User:</strong> ${requestUser.name}</p>
        <p><strong>Email:</strong> ${requestUser.email}</p>
        <p><strong>Role:</strong> ${(requestUser.role || '').replace(/_/g, ' ').toUpperCase()}</p>
        <p><strong>Method:</strong> ${method === 'forgot_password' ? 'Forgot Password (public)' : 'Request Reset (logged-in)'}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        <p style="color: #e53e3e;"><em>Please review and reset this user's password from the Admin Panel → Users section.</em></p>
      `,
      emailText: msg,
    }, ns);

    console.log(`[AdminNotifier] Notified ${superAdmins.length} super admin(s) about password reset request: ${requestUser.email}`);
  } catch (err) {
    console.error('[AdminNotifier] notifyPasswordResetRequest error:', err.message);
  }
}

/**
 * Notify admins about a customer password reset.
 * Respects notification settings.
 *
 * @param {Object} customer - The customer who reset their password
 * @param {string} action   - 'requested' | 'completed'
 */
async function notifyCustomerPasswordReset(customer, action = 'completed') {
  try {
    const ns = await getNotificationSettings();
    if (!ns.enableEmailNotifications && !ns.notifyAdminOnNewcustomer) return;

    const admins = await getAdminIds();
    const verb = action === 'requested' ? 'requested a password reset' : 'reset their password';
    const msg = `${customer.name || customer.email} (${customer.email}) has ${verb}.`;

    await _notifyAdmins(admins, {
      type: 'security_alert',
      title: `Customer Password ${action === 'requested' ? 'Reset Requested' : 'Reset Completed'}`,
      message: msg,
      priority: 'low',
      metadata: {
        customerId: customer._id,
        customerEmail: customer.email,
        action,
      },
      emailSubject: `Customer Password ${action === 'requested' ? 'Reset Request' : 'Reset'}: ${customer.email}`,
      emailHtml: `
        <h3>Customer Password ${action === 'requested' ? 'Reset Request' : 'Reset'}</h3>
        <p><strong>Customer:</strong> ${customer.name || 'N/A'} (${customer.email})</p>
        <p><strong>Action:</strong> ${verb}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      `,
      emailText: msg,
    }, ns);

    console.log(`[AdminNotifier] Notified ${admins.length} admin(s) about customer password ${action}: ${customer.email}`);
  } catch (err) {
    console.error('[AdminNotifier] notifyCustomerPasswordReset error:', err.message);
  }
}

/**
 * Notify admins about a customer status change (suspend/activate).
 * Always sends — this is an operational event.
 *
 * @param {Object} opts
 * @param {Object} opts.customer   - The customer document
 * @param {string} opts.oldStatus  - Previous status
 * @param {string} opts.newStatus  - New status
 * @param {string} opts.changedBy  - Name of admin who made the change
 * @param {string} [opts.reason]   - Optional reason
 */
async function notifyCustomerStatusChange({ customer, oldStatus, newStatus, changedBy, reason }) {
  try {
    const ns = await getNotificationSettings();
    const admins = await getAdminIds();
    const msg = `${customer.name || customer.email} status changed: ${oldStatus} → ${newStatus} by ${changedBy}.${reason ? ` Reason: ${reason}` : ''}`;

    await _notifyAdmins(admins, {
      type: 'system_alert',
      title: `Customer ${newStatus === 'suspended' ? 'Suspended' : 'Activated'}`,
      message: msg,
      priority: newStatus === 'suspended' ? 'high' : 'medium',
      metadata: {
        customerId: customer._id,
        customerEmail: customer.email,
        oldStatus,
        newStatus,
        changedBy,
        reason,
      },
      emailSubject: `Customer ${newStatus === 'suspended' ? 'Suspended' : 'Activated'}: ${customer.email}`,
      emailHtml: `
        <h3>Customer Status Changed</h3>
        <p><strong>Customer:</strong> ${customer.name} (${customer.email})</p>
        <p><strong>Status:</strong> ${oldStatus} → ${newStatus}</p>
        <p><strong>Changed by:</strong> ${changedBy}</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      `,
      emailText: msg,
    }, ns);

    console.log(`[AdminNotifier] Notified ${admins.length} admin(s) about customer status change: ${customer.email}`);
  } catch (err) {
    console.error('[AdminNotifier] notifyCustomerStatusChange error:', err.message);
  }
}

module.exports = {
  notifyNewCustomer,
  notifySubscriptionChange,
  notifyPasswordResetRequest,
  notifyCustomerPasswordReset,
  notifyCustomerStatusChange,
};
