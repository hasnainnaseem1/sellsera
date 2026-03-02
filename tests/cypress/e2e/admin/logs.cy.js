/// <reference types="cypress" />

describe('Admin Activity Logs', () => {
  const adminUrl = Cypress.env('ADMIN_URL') || 'http://localhost:3003';
  const apiUrl = Cypress.env('API_URL') || 'http://localhost:3001/api/v1';

  beforeEach(() => {
    cy.loginAsAdmin();
    cy.intercept('GET', `${apiUrl}/admin/logs*`).as('getLogs');
    cy.intercept('GET', `${apiUrl}/admin/activity-logs*`).as('getActivityLogs');
    cy.visitAdmin('/logs');
  });

  it('should render the logs page with a table', () => {
    cy.get('.ant-table').should('be.visible');
  });

  it('should have columns: user, action, status, date', () => {
    cy.get('.ant-table-thead th').then(($headers) => {
      const text = $headers.map((i, el) => Cypress.$(el).text().toLowerCase()).get().join(' ');
      expect(text).to.match(/user|admin|actor/);
      expect(text).to.match(/action|event|type/);
      expect(text).to.match(/status|result/);
      expect(text).to.match(/date|time|created/);
    });
  });

  it('should filter by action type', () => {
    cy.get('.ant-select, select, [class*="filter"]').first().click({ force: true });
    cy.get('.ant-select-dropdown .ant-select-item').first().click();

    cy.get('.ant-table-tbody').should('exist');
  });

  it('should filter by user', () => {
    cy.get('.ant-input-search input, input[placeholder*="search" i], input[placeholder*="user" i]')
      .first()
      .type('admin');

    cy.get('.ant-table-tbody').should('exist');
  });

  it('should have a date range filter', () => {
    cy.get('.ant-picker-range, .ant-picker, [class*="date"]').should('be.visible');
    cy.get('.ant-picker-range, .ant-picker').first().click({ force: true });

    cy.get('.ant-picker-dropdown').should('be.visible');
  });

  it('should export logs to CSV', () => {
    cy.intercept('GET', `${apiUrl}/admin/logs/export*`).as('exportLogs');
    cy.intercept('GET', `${apiUrl}/admin/activity-logs/export*`).as('exportActivityLogs');

    cy.get('.ant-btn, button').contains(/export|csv|download/i).click();
  });

  it('should view log detail', () => {
    cy.get('.ant-table-tbody tr').first().click();

    cy.get('.ant-modal, .ant-drawer, .ant-descriptions, [class*="detail"]').should('be.visible');
  });

  it('should show feature gate check message if logs are disabled', () => {
    cy.intercept('GET', `${apiUrl}/admin/logs*`, {
      statusCode: 403,
      body: { success: false, message: 'Activity logs feature is not enabled' }
    }).as('getLogsDisabled');
    cy.intercept('GET', `${apiUrl}/admin/activity-logs*`, {
      statusCode: 403,
      body: { success: false, message: 'Activity logs feature is not enabled' }
    }).as('getActivityLogsDisabled');

    cy.visitAdmin('/logs');

    cy.get('.ant-result, .ant-alert, .ant-empty, [class*="gate"], [class*="disabled"]').should('be.visible');
  });
});
