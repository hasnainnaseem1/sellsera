/**
 * Default Email Templates
 * 
 * Each template has:
 *  - subject: Email subject line (supports {{variables}})
 *  - body:    Inner HTML body (supports {{variables}}) — gets wrapped in the layout
 * 
 * Available variables for ALL templates:
 *   {{userName}}, {{userEmail}}, {{siteName}}, {{logoUrl}},
 *   {{primaryColor}}, {{secondaryColor}}, {{supportEmail}}, {{year}}
 * 
 * Per-template variables:
 *   verification:   {{verificationLink}}
 *   welcome:        {{loginLink}}
 *   passwordReset:  {{resetLink}}
 *   planChange:     {{oldPlanName}}, {{newPlanName}}
 *   trialWarning:   {{daysRemaining}}, {{planName}}, {{upgradeLink}}
 *   trialExpired:   {{planName}}, {{upgradeLink}}
 */

const defaults = {
  verification: {
    subject: 'Verify your email – {{siteName}}',
    body: `
      <h2 style="color: {{primaryColor}}; margin: 0 0 16px;">Verify your email address</h2>
      <p>Hi {{userName}},</p>
      <p>Thanks for signing up for <strong>{{siteName}}</strong>! Please click the button below to verify your email address and activate your account.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="{{verificationLink}}" target="_blank" rel="noopener noreferrer"
           style="background: linear-gradient(to right, {{primaryColor}}, {{secondaryColor}}); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
          Verify Email Address
        </a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:</p>
      <p style="color: {{primaryColor}}; font-size: 13px; word-break: break-all;">{{verificationLink}}</p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
        This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
      </p>
    `,
  },
  welcome: {
    subject: 'Welcome to {{siteName}}!',
    body: `
      <h2 style="color: {{primaryColor}}; margin: 0 0 16px;">Welcome aboard, {{userName}}! 🎉</h2>
      <p>Your account on <strong>{{siteName}}</strong> has been created and verified successfully.</p>
      <p>Here's what you can do next:</p>
      <ul style="line-height: 2; color: #374151;">
        <li>Explore your dashboard and tools</li>
        <li>Check out your subscription plan and features</li>
        <li>Upgrade anytime for more powerful features</li>
      </ul>
      <div style="text-align: center; margin: 32px 0;">
        <a href="{{loginLink}}" target="_blank" rel="noopener noreferrer"
           style="background: linear-gradient(to right, {{primaryColor}}, {{secondaryColor}}); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
          Go to Dashboard
        </a>
      </div>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
        You're receiving this because you signed up for {{siteName}}.
      </p>
    `,
  },
  passwordReset: {
    subject: 'Reset your password – {{siteName}}',
    body: `
      <h2 style="color: {{primaryColor}}; margin: 0 0 16px;">Reset your password</h2>
      <p>Hi {{userName}},</p>
      <p>We received a request to reset the password for your <strong>{{siteName}}</strong> account.</p>
      <p>Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="{{resetLink}}" target="_blank" rel="noopener noreferrer"
           style="background: linear-gradient(to right, {{primaryColor}}, {{secondaryColor}}); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
          Reset Password
        </a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:</p>
      <p style="color: {{primaryColor}}; font-size: 13px; word-break: break-all;">{{resetLink}}</p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
        If you didn't request a password reset, you can safely ignore this email. Your password will not change.
      </p>
    `,
  },
  planChange: {
    subject: 'Your plan has been updated – {{siteName}}',
    body: `
      <h2 style="color: {{primaryColor}}; margin: 0 0 16px;">Plan Updated</h2>
      <p>Hi {{userName}},</p>
      <p>Your subscription plan on <strong>{{siteName}}</strong> has been changed:</p>
      <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
        <span style="color: #6b7280; font-size: 16px;">{{oldPlanName}}</span>
        <span style="color: {{primaryColor}}; font-size: 20px; margin: 0 16px;">→</span>
        <span style="color: {{primaryColor}}; font-size: 18px; font-weight: bold;">{{newPlanName}}</span>
      </div>
      <p>Your new features and limits are now active. Visit your dashboard to see what's included.</p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
        If you didn't make this change, please contact support immediately.
      </p>
    `,
  },
  trialWarning: {
    subject: 'Your trial expires in {{daysRemaining}} day(s) – {{siteName}}',
    body: `
      <h2 style="color: #faad14; margin: 0 0 16px;">⏳ Your trial is ending soon</h2>
      <p>Hi {{userName}},</p>
      <p>Your free trial of <strong>{{planName}}</strong> on <strong>{{siteName}}</strong> expires in <strong>{{daysRemaining}} day(s)</strong>.</p>
      <p>To keep using all your features without interruption, upgrade now:</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="{{upgradeLink}}" target="_blank" rel="noopener noreferrer"
           style="background: linear-gradient(to right, {{primaryColor}}, {{secondaryColor}}); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
          Upgrade Now
        </a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">After your trial ends, your account will be limited. You can upgrade at any time.</p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
        You're receiving this because you're on a trial with {{siteName}}.
      </p>
    `,
  },
  trialExpired: {
    subject: 'Your trial has expired – {{siteName}}',
    body: `
      <h2 style="color: #ff4d4f; margin: 0 0 16px;">Your trial has ended</h2>
      <p>Hi {{userName}},</p>
      <p>Your free trial of <strong>{{planName}}</strong> on <strong>{{siteName}}</strong> has expired.</p>
      <p>Don't worry — your data is safe! Upgrade to a paid plan to regain full access to all your features.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="{{upgradeLink}}" target="_blank" rel="noopener noreferrer"
           style="background: linear-gradient(to right, {{primaryColor}}, {{secondaryColor}}); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
          Choose a Plan
        </a>
      </div>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
        You're receiving this because your trial with {{siteName}} has ended.
      </p>
    `,
  },
  paymentConfirmation: {
    subject: 'Payment Received – {{siteName}}',
    body: `
      <h2 style="color: {{primaryColor}}; margin: 0 0 16px;">Payment Confirmed ✓</h2>
      <p>Hi {{userName}},</p>
      <p>We've received your payment for <strong>{{siteName}}</strong>. Here are the details:</p>

      <!-- Invoice / Receipt -->
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <table width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px; color: #374151;">
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Invoice No.</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600;">{{invoiceNumber}}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Date</td>
            <td style="padding: 6px 0; text-align: right;">{{paymentDate}}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Plan</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600;">{{planName}}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Billing Cycle</td>
            <td style="padding: 6px 0; text-align: right;">{{billingCycle}}</td>
          </tr>
          <tr>
            <td colspan="2" style="border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 8px;"></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 16px; font-weight: 700; color: {{primaryColor}};">Total Paid</td>
            <td style="padding: 6px 0; text-align: right; font-size: 20px; font-weight: 800; color: {{primaryColor}};">{{amount}} {{currency}}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 28px 0;">
        <a href="{{receiptUrl}}" target="_blank" rel="noopener noreferrer"
           style="background: linear-gradient(to right, {{primaryColor}}, {{secondaryColor}}); color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">
          Download Invoice
        </a>
        <a href="{{dashboardUrl}}" target="_blank" rel="noopener noreferrer"
           style="color: {{primaryColor}}; padding: 12px 20px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
          Go to Dashboard →
        </a>
      </div>

      <p style="color: #6b7280; font-size: 13px;">Your subscription is now <strong>active</strong>. All plan features are available immediately.</p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
        This is an automated receipt from {{siteName}}. If you have questions about this charge, contact us at {{supportEmail}}.
      </p>
    `,
  },
  paymentFailed: {
    subject: 'Payment Failed – Action Required – {{siteName}}',
    body: `
      <h2 style="color: #ff4d4f; margin: 0 0 16px;">⚠️ Payment Failed</h2>
      <p>Hi {{userName}},</p>
      <p>We were unable to process your payment for <strong>{{planName}}</strong> on <strong>{{siteName}}</strong>.</p>

      <div style="background: #fff2f0; border: 1px solid #ffccc7; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <table width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px; color: #374151;">
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Plan</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600;">{{planName}}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Amount</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #ff4d4f;">{{amount}} {{currency}}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Date</td>
            <td style="padding: 6px 0; text-align: right;">{{paymentDate}}</td>
          </tr>
        </table>
      </div>

      <p>Please update your payment method to avoid service interruption:</p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="{{billingUrl}}" target="_blank" rel="noopener noreferrer"
           style="background: linear-gradient(to right, #ff4d4f, #ff7875); color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">
          Update Payment Method
        </a>
      </div>

      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
        If you believe this is an error, please contact us at {{supportEmail}}.
      </p>
    `,
  },
};

/** List of all template keys — used for validation */
const TEMPLATE_KEYS = Object.keys(defaults);

/** Variables available per template type */
const TEMPLATE_VARIABLES = {
  verification: ['userName', 'userEmail', 'siteName', 'logoUrl', 'primaryColor', 'secondaryColor', 'supportEmail', 'year', 'verificationLink'],
  welcome: ['userName', 'userEmail', 'siteName', 'logoUrl', 'primaryColor', 'secondaryColor', 'supportEmail', 'year', 'loginLink'],
  passwordReset: ['userName', 'userEmail', 'siteName', 'logoUrl', 'primaryColor', 'secondaryColor', 'supportEmail', 'year', 'resetLink'],
  planChange: ['userName', 'userEmail', 'siteName', 'logoUrl', 'primaryColor', 'secondaryColor', 'supportEmail', 'year', 'oldPlanName', 'newPlanName'],
  trialWarning: ['userName', 'userEmail', 'siteName', 'logoUrl', 'primaryColor', 'secondaryColor', 'supportEmail', 'year', 'daysRemaining', 'planName', 'upgradeLink'],
  trialExpired: ['userName', 'userEmail', 'siteName', 'logoUrl', 'primaryColor', 'secondaryColor', 'supportEmail', 'year', 'planName', 'upgradeLink'],
  paymentConfirmation: ['userName', 'userEmail', 'siteName', 'logoUrl', 'primaryColor', 'secondaryColor', 'supportEmail', 'year', 'invoiceNumber', 'paymentDate', 'planName', 'billingCycle', 'amount', 'currency', 'receiptUrl', 'dashboardUrl'],
  paymentFailed: ['userName', 'userEmail', 'siteName', 'logoUrl', 'primaryColor', 'secondaryColor', 'supportEmail', 'year', 'planName', 'amount', 'currency', 'paymentDate', 'billingUrl'],
};

module.exports = { defaults, TEMPLATE_KEYS, TEMPLATE_VARIABLES };
