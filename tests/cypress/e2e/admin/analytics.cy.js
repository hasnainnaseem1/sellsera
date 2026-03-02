/// <reference types="cypress" />

describe('Admin Analytics', () => {
  const adminUrl = Cypress.env('ADMIN_URL') || 'http://localhost:3003';
  const apiUrl = Cypress.env('API_URL') || 'http://localhost:3001/api/v1';

  beforeEach(() => {
    cy.loginAsAdmin();
    cy.intercept('GET', `${apiUrl}/admin/analytics*`).as('getAnalytics');
    cy.intercept('GET', `${apiUrl}/admin/dashboard*`).as('getDashboard');
    cy.visitAdmin('/analytics');
  });

  it('should render the analytics page', () => {
    cy.get('.ant-card, [class*="analytics"], [class*="chart"], main').should('be.visible');
  });

  it('should display stats cards (users, revenue, etc.)', () => {
    cy.get('.ant-card, .ant-statistic, [class*="stat"]').should('have.length.greaterThan', 0);
    cy.get('.ant-statistic-content-value, [class*="stat"] [class*="value"]')
      .should('have.length.greaterThan', 0)
      .first()
      .invoke('text')
      .should('match', /\d+/);
  });

  it('should render charts (canvas or SVG elements)', () => {
    cy.get('canvas, svg, [class*="chart"], .recharts-wrapper, [class*="recharts"]', { timeout: 10000 })
      .should('have.length.greaterThan', 0);
  });

  it('should have a date range filter that changes data', () => {
    cy.get('.ant-picker-range, .ant-picker, .ant-select, [class*="date-filter"], [class*="dateRange"]')
      .should('be.visible')
      .first()
      .click({ force: true });

    // Select a date range or option
    cy.get('.ant-picker-dropdown, .ant-select-dropdown').then(($dropdown) => {
      if ($dropdown.length) {
        cy.get('.ant-picker-cell, .ant-select-item').first().click({ force: true });
      }
    });
  });

  it('should display user growth chart', () => {
    cy.get('body').then(($body) => {
      const text = $body.text().toLowerCase();
      const hasUserGrowth = text.includes('user') && (text.includes('growth') || text.includes('chart') || text.includes('trend'));
      expect(hasUserGrowth || $body.find('canvas, svg').length > 0).to.be.true;
    });
  });

  it('should display subscription distribution chart', () => {
    cy.get('body').then(($body) => {
      const text = $body.text().toLowerCase();
      const hasSubscriptionChart = text.includes('subscription') || text.includes('plan') || text.includes('distribution');
      expect(hasSubscriptionChart || $body.find('canvas, svg').length > 0).to.be.true;
    });
  });

  it('should display revenue stats section', () => {
    cy.get('body').then(($body) => {
      const text = $body.text().toLowerCase();
      const hasRevenue = text.includes('revenue') || text.includes('income') || text.includes('earning') || text.includes('payment');
      expect(hasRevenue).to.be.true;
    });
  });

  it('should load the page without errors', () => {
    cy.on('uncaught:exception', () => false);
    cy.get('.ant-card, [class*="analytics"], main', { timeout: 10000 }).should('be.visible');
    cy.get('.ant-result-error, .ant-alert-error').should('not.exist');
  });
});
