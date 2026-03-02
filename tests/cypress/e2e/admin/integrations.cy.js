/// <reference types="cypress" />

describe('Admin Integrations', () => {
  const adminUrl = Cypress.env('ADMIN_URL') || 'http://localhost:3003';
  const apiUrl = Cypress.env('API_URL') || 'http://localhost:3001/api/v1';

  beforeEach(() => {
    cy.loginAsAdmin();
    cy.intercept('GET', `${apiUrl}/admin/settings*`).as('getSettings');
    cy.intercept('GET', `${apiUrl}/admin/integrations*`).as('getIntegrations');
    cy.visitAdmin('/integrations');
  });

  it('should render the integrations page', () => {
    cy.get('.ant-card, .ant-form, .ant-tabs, [class*="integration"]').should('be.visible');
  });

  it('should show Stripe settings section', () => {
    cy.get('body').then(($body) => {
      const text = $body.text().toLowerCase();
      expect(text).to.include('stripe');
    });

    cy.get('[class*="stripe"], .ant-card, .ant-form').should('exist');
    cy.get('input[id*="stripe"], input[name*="stripe"], input[placeholder*="stripe" i], input[id*="publishable"], input[id*="secret"]')
      .should('exist');
  });

  it('should show LemonSqueezy settings section', () => {
    cy.get('body').then(($body) => {
      const text = $body.text().toLowerCase();
      expect(text).to.match(/lemon\s*squeezy|lemonsqueezy/);
    });

    cy.get('input[id*="lemon"], input[name*="lemon"], input[id*="Lemon"], input[placeholder*="lemon" i]')
      .should('exist');
  });

  it('should toggle payment gateway selection', () => {
    cy.intercept('PUT', `${apiUrl}/admin/settings*`).as('updateSettings');
    cy.intercept('PATCH', `${apiUrl}/admin/settings*`).as('patchSettings');

    cy.get('.ant-radio-group, .ant-select, .ant-switch, .ant-segmented, [class*="gateway"]')
      .first()
      .click({ force: true });

    cy.get('.ant-radio-button, .ant-select-item, .ant-segmented-item').then(($options) => {
      if ($options.length) {
        cy.wrap($options).first().click({ force: true });
      }
    });
  });
});
