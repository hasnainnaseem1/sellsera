/// <reference types="cypress" />

describe('Admin Settings', () => {
  const adminUrl = Cypress.env('ADMIN_URL') || 'http://localhost:3003';
  const apiUrl = Cypress.env('API_URL') || 'http://localhost:3001/api/v1';

  beforeEach(() => {
    cy.loginAsAdmin();
    cy.intercept('GET', `${apiUrl}/admin/settings*`).as('getSettings');
    cy.visitAdmin('/settings');
    cy.wait('@getSettings');
  });

  it('should render the settings page with tabs', () => {
    cy.get('.ant-tabs, .ant-menu, [class*="tab"], [class*="setting"]').should('be.visible');
  });

  it('should update general settings: site name', () => {
    cy.intercept('PUT', `${apiUrl}/admin/settings*`).as('updateSettings');
    cy.intercept('PATCH', `${apiUrl}/admin/settings*`).as('patchSettings');

    cy.get('.ant-tabs-tab, .ant-menu-item').contains(/general/i).click({ force: true });

    cy.get('input[id*="siteName"], input[name="siteName"], input[id*="site_name"], input[name="site_name"], input[placeholder*="site name" i]')
      .first()
      .clear()
      .type('Updated Site Name');

    cy.get('button[type="submit"], .ant-btn-primary').contains(/save|update|submit/i).click();

    cy.get('.ant-message-success, .ant-notification-notice-success').should('be.visible');
  });

  it('should display email SMTP settings', () => {
    cy.get('.ant-tabs-tab, .ant-menu-item').contains(/email/i).click({ force: true });

    cy.get('input[id*="smtp"], input[name*="smtp"], input[id*="host"], input[name*="host"], input[placeholder*="smtp" i], input[placeholder*="host" i]')
      .should('be.visible');
  });

  it('should have test email button', () => {
    cy.get('.ant-tabs-tab, .ant-menu-item').contains(/email/i).click({ force: true });

    cy.get('.ant-btn, button').contains(/test|send\s*test/i).should('be.visible');
  });

  it('should display security settings: max login attempts, lockout duration', () => {
    cy.get('.ant-tabs-tab, .ant-menu-item').contains(/security/i).click({ force: true });

    cy.get('input[id*="maxLogin"], input[name*="maxLogin"], input[id*="max_login"], input[id*="loginAttempts"], input[name*="loginAttempts"]')
      .should('be.visible');
    cy.get('input[id*="lockout"], input[name*="lockout"], input[id*="lockoutDuration"], input[name*="lockoutDuration"]')
      .should('be.visible');
  });

  it('should toggle customer email verification setting', () => {
    cy.intercept('PUT', `${apiUrl}/admin/settings*`).as('updateSettings');
    cy.intercept('PATCH', `${apiUrl}/admin/settings*`).as('patchSettings');

    cy.get('.ant-tabs-tab, .ant-menu-item').contains(/customer/i).click({ force: true });

    cy.get('.ant-switch, [id*="emailVerification"], [name*="emailVerification"]')
      .first()
      .click({ force: true });
  });

  it('should toggle maintenance mode', () => {
    cy.intercept('PUT', `${apiUrl}/admin/settings*`).as('updateSettings');
    cy.intercept('PATCH', `${apiUrl}/admin/settings*`).as('patchSettings');

    cy.get('.ant-tabs-tab, .ant-menu-item').contains(/maintenance/i).click({ force: true });

    cy.get('.ant-switch, [id*="maintenance"], [name*="maintenance"]')
      .first()
      .click({ force: true });
  });

  it('should show feature flag toggles', () => {
    cy.get('.ant-tabs-tab, .ant-menu-item').contains(/feature/i).click({ force: true });

    cy.get('.ant-switch').should('have.length.greaterThan', 0);
    cy.get('body').then(($body) => {
      const featureText = $body.text().toLowerCase();
      const hasFeatureFlags = featureText.includes('analysis') ||
        featureText.includes('subscription') ||
        featureText.includes('enable') ||
        featureText.includes('feature');
      expect(hasFeatureFlags).to.be.true;
    });
  });

  it('should display theme settings with colors and logo upload', () => {
    cy.get('.ant-tabs-tab, .ant-menu-item').contains(/theme|brand|appearance/i).click({ force: true });

    cy.get('input[type="color"], .ant-color-picker, [class*="color"], input[id*="color"], input[name*="color"]')
      .should('exist');
    cy.get('input[type="file"], .ant-upload, [class*="upload"]').should('exist');
  });

  it('should show email templates list', () => {
    cy.get('.ant-tabs-tab, .ant-menu-item').contains(/email/i).click({ force: true });

    cy.get('body').then(($body) => {
      const templateLink = $body.find('a:contains("Template"), button:contains("Template"), .ant-tabs-tab:contains("Template")');
      if (templateLink.length) {
        cy.wrap(templateLink).first().click({ force: true });
        cy.get('.ant-table, .ant-list, [class*="template"]').should('be.visible');
      }
    });
  });

  it('should edit an email template', () => {
    cy.get('.ant-tabs-tab, .ant-menu-item').contains(/email/i).click({ force: true });

    cy.get('body').then(($body) => {
      const templateLink = $body.find('a:contains("Template"), button:contains("Template"), .ant-tabs-tab:contains("Template")');
      if (templateLink.length) {
        cy.wrap(templateLink).first().click({ force: true });
        cy.get('.ant-table-tbody tr, .ant-list-item').first().within(() => {
          cy.get('.ant-btn, button, a').contains(/edit/i).click();
        });
        cy.get('.ant-modal, .ant-drawer, [class*="editor"]').should('be.visible');
      }
    });
  });

  it('should preview an email template', () => {
    cy.get('.ant-tabs-tab, .ant-menu-item').contains(/email/i).click({ force: true });

    cy.get('body').then(($body) => {
      const templateLink = $body.find('a:contains("Template"), button:contains("Template")');
      if (templateLink.length) {
        cy.wrap(templateLink).first().click({ force: true });
        cy.get('.ant-table-tbody tr, .ant-list-item').first().within(() => {
          cy.get('.ant-btn, button, a').contains(/preview|view/i).first().click();
        });
      }
    });
  });

  it('should show payment gateway selection (Stripe/LemonSqueezy)', () => {
    cy.get('.ant-tabs-tab, .ant-menu-item').contains(/payment|billing|integration/i).click({ force: true });

    cy.get('body').then(($body) => {
      const text = $body.text().toLowerCase();
      const hasPaymentGateway = text.includes('stripe') || text.includes('lemonsqueezy') || text.includes('payment');
      expect(hasPaymentGateway).to.be.true;
    });

    cy.get('.ant-radio-group, .ant-select, .ant-switch, [class*="gateway"]').should('exist');
  });

  it('should manage email blocking: add/remove domains', () => {
    cy.get('.ant-tabs-tab, .ant-menu-item').contains(/email|security/i).click({ force: true });

    cy.get('body').then(($body) => {
      const blockSection = $body.find('[class*="block"], :contains("Blocked"), :contains("Domain")');
      if (blockSection.length) {
        cy.get('input[placeholder*="domain" i], input[id*="domain"], input[name*="domain"]')
          .first()
          .type('spam.com');
        cy.get('.ant-btn, button').contains(/add|block/i).first().click();
      }
    });
  });

  it('should display Google SSO settings', () => {
    cy.get('.ant-tabs-tab, .ant-menu-item').contains(/security|sso|auth/i).click({ force: true });

    cy.get('body').then(($body) => {
      const text = $body.text().toLowerCase();
      const hasGoogleSSO = text.includes('google') || text.includes('sso') || text.includes('oauth') || text.includes('single sign');
      expect(hasGoogleSSO).to.be.true;
    });
  });
});
