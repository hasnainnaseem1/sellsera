const nodemailer = require('nodemailer');
const { AdminSettings } = require('../../models/admin');
const { defaults: defaultTemplates } = require('./defaultTemplates');
const { resolveFromEnv } = require('../../utils/helpers/urlHelper');

class EmailService {
  constructor() {
    this.transporter = null;
    this._configHash = null;
  }

  /* 
   *  SMTP Transporter (pooled, cached, auto-rebuilds on change)
   *  */
  async getTransporter() {
    const settings = await AdminSettings.getSettings();
    const ec = settings.emailSettings;

    if (!ec || !ec.smtpHost || !ec.smtpPort) {
      throw new Error('SMTP configuration is incomplete. Configure it in Admin > Integrations > Email.');
    }

    const hash = `${ec.smtpHost}|${ec.smtpPort}|${ec.smtpUser}|${ec.smtpPassword}|${!!ec.smtpSecure}`;

    if (this.transporter && this._configHash === hash) {
      return { transporter: this.transporter, settings };
    }

    if (this.transporter) {
      try { this.transporter.close(); } catch (_) { /* ignore */ }
    }

    const port = Number(ec.smtpPort);
    const useSecure = port === 465;

    this.transporter = nodemailer.createTransport({
      host: ec.smtpHost,
      port,
      secure: useSecure,
      auth: ec.smtpUser ? { user: ec.smtpUser, pass: ec.smtpPassword } : undefined,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
    });

    this._configHash = hash;
    console.log(`[EMAIL] SMTP transporter created > ${ec.smtpHost}:${port} (pool, secure=${useSecure})`);
    return { transporter: this.transporter, settings };
  }

  resetTransporter() {
    if (this.transporter) {
      try { this.transporter.close(); } catch (_) { /* ignore */ }
    }
    this.transporter = null;
    this._configHash = null;
  }

  /* 
   *  Template Engine
   *  */

  _getTemplate(settings, templateKey) {
    const custom = settings.emailTemplates && settings.emailTemplates[templateKey];
    const fallback = defaultTemplates[templateKey];
    return {
      subject: (custom && custom.subject && custom.subject.trim()) ? custom.subject.trim() : fallback.subject,
      body: (custom && custom.body && custom.body.trim()) ? custom.body.trim() : fallback.body,
    };
  }

  _interpolate(template, variables) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] !== undefined ? variables[key] : match;
    });
  }

  _commonVars(settings, user) {
    user = user || {};
    const siteName = (settings.themeSettings && settings.themeSettings.companyName) || settings.siteName || 'Our Platform';
    return {
      userName: user.name || 'there',
      userEmail: user.email || '',
      siteName,
      logoUrl: resolveFromEnv((settings.themeSettings && settings.themeSettings.logoUrl) || ''),
      primaryColor: (settings.themeSettings && settings.themeSettings.primaryColor) || '#7C3AED',
      secondaryColor: (settings.themeSettings && settings.themeSettings.secondaryColor) || '#3B82F6',
      supportEmail: settings.supportEmail || '',
      year: new Date().getFullYear().toString(),
    };
  }

  _wrapInLayout(innerHtml, vars) {
    const logoBlock = vars.logoUrl
      ? '<div style="text-align: center; margin-bottom: 24px;"><img src="' + vars.logoUrl + '" alt="' + vars.siteName + '" style="max-height: 48px; max-width: 200px;" /></div>'
      : '';

    return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>' +
      '<body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: Arial, sans-serif;">' +
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f7;"><tr><td style="padding: 32px 16px;">' +
      '<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">' +
      '<tr><td style="background: linear-gradient(to right, ' + vars.primaryColor + ', ' + vars.secondaryColor + '); height: 6px;"></td></tr>' +
      '<tr><td style="padding: 32px 32px 0 32px;">' + logoBlock + '</td></tr>' +
      '<tr><td style="padding: 0 32px 32px 32px; color: #1f2937; font-size: 15px; line-height: 1.6;">' + innerHtml + '</td></tr>' +
      '<tr><td style="padding: 16px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">' +
      '<p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ' + vars.year + ' ' + vars.siteName + '. All rights reserved.</p>' +
      (vars.supportEmail ? '<p style="color: #9ca3af; font-size: 12px; margin: 4px 0 0;">Need help? <a href="mailto:' + vars.supportEmail + '" style="color: ' + vars.primaryColor + ';">' + vars.supportEmail + '</a></p>' : '') +
      '</td></tr></table></td></tr></table></body></html>';
  }

  _buildEmail(settings, templateKey, extraVars, user) {
    extraVars = extraVars || {};
    user = user || {};
    const template = this._getTemplate(settings, templateKey);
    const vars = Object.assign({}, this._commonVars(settings, user), extraVars);
    const subject = this._interpolate(template.subject, vars);
    const innerHtml = this._interpolate(template.body, vars);
    const html = this._wrapInLayout(innerHtml, vars);
    const text = innerHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return { subject, html, text };
  }

  /* 
   *  Send Methods (all template-driven)
   *  */

  async sendVerificationEmail(user, verificationLink) {
    try {
      const { transporter, settings } = await this.getTransporter();
      const ec = settings.emailSettings;
      const siteName = (settings.themeSettings && settings.themeSettings.companyName) || settings.siteName || 'Our Platform';
      const fromName = ec.fromName || siteName;
      const { subject, html, text } = this._buildEmail(settings, 'verification', { verificationLink }, user);
      const info = await transporter.sendMail({ from: '"' + fromName + '" <' + ec.fromEmail + '>', to: user.email, subject, html, text });
      console.log('Verification email sent:', info.messageId, '>', user.email);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Failed to send verification email:', error.message);
      if (process.env.NODE_ENV === 'development') {
        console.log('\n[DEV] Verification link for', user.email, ':\n', verificationLink, '\n');
      }
      return { success: false, error: error.message };
    }
  }

  async sendWelcomeEmail(user, loginLink) {
    try {
      const { transporter, settings } = await this.getTransporter();
      const ec = settings.emailSettings;
      const siteName = (settings.themeSettings && settings.themeSettings.companyName) || settings.siteName || 'Our Platform';
      const fromName = ec.fromName || siteName;
      const effectiveLoginLink = loginLink || process.env.CUSTOMER_FRONTEND_URL || 'http://localhost:3002';
      const { subject, html, text } = this._buildEmail(settings, 'welcome', { loginLink: effectiveLoginLink }, user);
      const info = await transporter.sendMail({ from: '"' + fromName + '" <' + ec.fromEmail + '>', to: user.email, subject, html, text });
      console.log('Welcome email sent:', info.messageId, '>', user.email);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Failed to send welcome email:', error.message);
      return { success: false, error: error.message };
    }
  }

  async sendPasswordResetEmail(user, resetLink) {
    try {
      const { transporter, settings } = await this.getTransporter();
      const ec = settings.emailSettings;
      const siteName = (settings.themeSettings && settings.themeSettings.companyName) || settings.siteName || 'Our Platform';
      const fromName = ec.fromName || siteName;
      const { subject, html, text } = this._buildEmail(settings, 'passwordReset', { resetLink }, user);
      const info = await transporter.sendMail({ from: '"' + fromName + '" <' + ec.fromEmail + '>', to: user.email, subject, html, text });
      console.log('Password reset email sent:', info.messageId, '>', user.email);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Failed to send password reset email:', error.message);
      if (process.env.NODE_ENV === 'development') {
        console.log('\n[DEV] Password reset link for', user.email, ':\n', resetLink, '\n');
      }
      return { success: false, error: error.message };
    }
  }

  async sendPlanChangeEmail(user, oldPlanName, newPlanName) {
    try {
      const { transporter, settings } = await this.getTransporter();
      const ec = settings.emailSettings;
      const siteName = (settings.themeSettings && settings.themeSettings.companyName) || settings.siteName || 'Our Platform';
      const fromName = ec.fromName || siteName;
      const { subject, html, text } = this._buildEmail(settings, 'planChange', { oldPlanName: oldPlanName || 'None', newPlanName: newPlanName || 'Unknown' }, user);
      const info = await transporter.sendMail({ from: '"' + fromName + '" <' + ec.fromEmail + '>', to: user.email, subject, html, text });
      console.log('Plan change email sent:', info.messageId, '>', user.email);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Failed to send plan change email:', error.message);
      return { success: false, error: error.message };
    }
  }

  async sendTrialWarningEmail(user, daysRemaining) {
    try {
      const { transporter, settings } = await this.getTransporter();
      const ec = settings.emailSettings;
      const siteName = (settings.themeSettings && settings.themeSettings.companyName) || settings.siteName || 'Our Platform';
      const fromName = ec.fromName || siteName;
      const customerUrl = process.env.CUSTOMER_FRONTEND_URL || 'http://localhost:3002';
      const { subject, html, text } = this._buildEmail(settings, 'trialWarning', { daysRemaining: String(daysRemaining), planName: (user.planSnapshot && user.planSnapshot.planName) || 'your plan', upgradeLink: customerUrl + '/plans' }, user);
      const info = await transporter.sendMail({ from: '"' + fromName + '" <' + ec.fromEmail + '>', to: user.email, subject, html, text });
      console.log('Trial warning email sent:', info.messageId, '>', user.email);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Failed to send trial warning email:', error.message);
      return { success: false, error: error.message };
    }
  }

  async sendTrialExpiredEmail(user) {
    try {
      const { transporter, settings } = await this.getTransporter();
      const ec = settings.emailSettings;
      const siteName = (settings.themeSettings && settings.themeSettings.companyName) || settings.siteName || 'Our Platform';
      const fromName = ec.fromName || siteName;
      const customerUrl = process.env.CUSTOMER_FRONTEND_URL || 'http://localhost:3002';
      const { subject, html, text } = this._buildEmail(settings, 'trialExpired', { planName: (user.planSnapshot && user.planSnapshot.planName) || 'your plan', upgradeLink: customerUrl + '/plans' }, user);
      const info = await transporter.sendMail({ from: '"' + fromName + '" <' + ec.fromEmail + '>', to: user.email, subject, html, text });
      console.log('Trial expired email sent:', info.messageId, '>', user.email);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Failed to send trial expired email:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send payment confirmation / receipt email
   * @param {Object} user - user document
   * @param {Object} payment - { planName, amount, currency, billingCycle, receiptUrl, invoiceNumber, paidAt }
   */
  async sendPaymentConfirmationEmail(user, payment) {
    try {
      const { transporter, settings } = await this.getTransporter();
      const ec = settings.emailSettings;
      const siteName = (settings.themeSettings && settings.themeSettings.companyName) || settings.siteName || 'Our Platform';
      const fromName = ec.fromName || siteName;
      const customerUrl = process.env.CUSTOMER_FRONTEND_URL || 'http://localhost:3002';

      const paidDate = payment.paidAt ? new Date(payment.paidAt) : new Date();
      const dateStr = paidDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

      const vars = {
        planName: payment.planName || user.planSnapshot?.planName || 'Subscription',
        amount: '$' + (payment.amount || 0).toFixed(2),
        currency: (payment.currency || 'USD').toUpperCase(),
        billingCycle: payment.billingCycle ? payment.billingCycle.charAt(0).toUpperCase() + payment.billingCycle.slice(1) : 'Monthly',
        invoiceNumber: payment.invoiceNumber || ('INV-' + Date.now().toString(36).toUpperCase()),
        paymentDate: dateStr,
        receiptUrl: payment.receiptUrl || (customerUrl + '/settings?tab=billing'),
        dashboardUrl: customerUrl + '/dashboard',
      };

      const { subject, html, text } = this._buildEmail(settings, 'paymentConfirmation', vars, user);
      const info = await transporter.sendMail({ from: '"' + fromName + '" <' + ec.fromEmail + '>', to: user.email, subject, html, text });
      console.log('Payment confirmation email sent:', info.messageId, '>', user.email);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Failed to send payment confirmation email:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send payment failed notification email
   * @param {Object} user - user document
   * @param {Object} payment - { planName, amount, currency }
   */
  async sendPaymentFailedEmail(user, payment) {
    try {
      const { transporter, settings } = await this.getTransporter();
      const ec = settings.emailSettings;
      const siteName = (settings.themeSettings && settings.themeSettings.companyName) || settings.siteName || 'Our Platform';
      const fromName = ec.fromName || siteName;
      const customerUrl = process.env.CUSTOMER_FRONTEND_URL || 'http://localhost:3002';

      const vars = {
        planName: payment.planName || user.planSnapshot?.planName || 'Subscription',
        amount: '$' + (payment.amount || 0).toFixed(2),
        currency: (payment.currency || 'USD').toUpperCase(),
        paymentDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        billingUrl: customerUrl + '/settings?tab=billing',
      };

      const { subject, html, text } = this._buildEmail(settings, 'paymentFailed', vars, user);
      const info = await transporter.sendMail({ from: '"' + fromName + '" <' + ec.fromEmail + '>', to: user.email, subject, html, text });
      console.log('Payment failed email sent:', info.messageId, '>', user.email);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Failed to send payment failed email:', error.message);
      return { success: false, error: error.message };
    }
  }

  /* 
   *  Utility Methods
   *  */

  async sendTestEmail(recipientEmail) {
    try {
      this.resetTransporter();
      const { transporter, settings } = await this.getTransporter();
      const ec = settings.emailSettings;
      const port = Number(ec.smtpPort);
      const actualSecure = port === 465;
      const tlsMode = actualSecure ? 'SSL/TLS (implicit)' : 'STARTTLS (upgrade)';
      const siteName = (settings.themeSettings && settings.themeSettings.companyName) || settings.siteName || 'Your SaaS Platform';
      const vars = this._commonVars(settings, { name: 'Admin', email: recipientEmail });
      const innerHtml = '<h2 style="color: ' + vars.primaryColor + '; margin: 0 0 16px;">Email Configuration Test</h2>' +
        '<p>Hello!</p>' +
        '<p>This is a test email sent from <strong>' + siteName + '</strong>.</p>' +
        '<p>If you received this email, your SMTP configuration is working correctly!</p>' +
        '<hr style="border: 1px solid #e5e7eb; margin: 20px 0;">' +
        '<p style="color: #6b7280; font-size: 14px;"><strong>SMTP Details:</strong><br>' +
        'Host: ' + ec.smtpHost + '<br>Port: ' + port + '<br>Encryption: ' + tlsMode + '<br>' +
        'User: ' + ec.smtpUser + '<br>From: "' + ec.fromName + '" &lt;' + ec.fromEmail + '&gt;</p>' +
        '<p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">Sent on ' + new Date().toLocaleString() + '</p>';
      const html = this._wrapInLayout(innerHtml, vars);
      const info = await transporter.sendMail({ from: '"' + (ec.fromName || 'Test') + '" <' + ec.fromEmail + '>', to: recipientEmail, subject: 'Test Email from ' + siteName, html });
      console.log('Test email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId, message: 'Test email sent to ' + recipientEmail };
    } catch (error) {
      console.error('Failed to send test email:', error);
      throw error;
    }
  }

  async sendEmail({ to, subject, html, text }) {
    try {
      const { transporter, settings } = await this.getTransporter();
      const ec = settings.emailSettings;
      const info = await transporter.sendMail({ from: '"' + (ec.fromName || 'Notification') + '" <' + ec.fromEmail + '>', to, subject, html, text });
      console.log('Email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  async verifyConnection() {
    try {
      this.resetTransporter();
      const { transporter } = await this.getTransporter();
      await transporter.verify();
      return { success: true, message: 'SMTP connection verified successfully' };
    } catch (error) {
      console.error('SMTP verification failed:', error);
      return { success: false, message: error.message };
    }
  }

  async previewTemplate(templateKey, customTemplate) {
    const settings = await AdminSettings.getSettings();
    const sampleUser = { name: 'John Doe', email: 'john@example.com' };
    const customerUrl = process.env.CUSTOMER_FRONTEND_URL || 'http://localhost:3002';
    const sampleVars = {
      verificationLink: customerUrl + '/verify-email/sample-token-123',
      loginLink: customerUrl,
      resetLink: customerUrl + '/reset-password?token=sample-token-123',
      oldPlanName: 'Free',
      newPlanName: 'Pro',
      daysRemaining: '3',
      planName: 'Starter',
      upgradeLink: customerUrl + '/plans',
      invoiceNumber: 'INV-' + Date.now().toString(36).toUpperCase(),
      paymentDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      amount: '$29.00',
      currency: 'USD',
      billingCycle: 'Monthly',
      receiptUrl: customerUrl + '/settings?tab=billing',
      dashboardUrl: customerUrl + '/dashboard',
      billingUrl: customerUrl + '/settings?tab=billing',
    };
    if (customTemplate) {
      var vars = Object.assign({}, this._commonVars(settings, sampleUser), sampleVars);
      var subject2 = this._interpolate(customTemplate.subject || '', vars);
      var innerHtml2 = this._interpolate(customTemplate.body || '', vars);
      var html2 = this._wrapInLayout(innerHtml2, vars);
      return { subject: subject2, html: html2 };
    }
    var result = this._buildEmail(settings, templateKey, sampleVars, sampleUser);
    return { subject: result.subject, html: result.html };
  }
}

module.exports = new EmailService();
