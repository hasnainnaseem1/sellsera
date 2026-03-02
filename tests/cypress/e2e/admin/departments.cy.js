/// <reference types="cypress" />

describe('Admin Departments Management', () => {
  const adminUrl = Cypress.env('ADMIN_URL') || 'http://localhost:3003';
  const apiUrl = Cypress.env('API_URL') || 'http://localhost:3001/api/v1';

  beforeEach(() => {
    cy.loginAsAdmin();
    cy.intercept('GET', `${apiUrl}/admin/departments*`).as('getDepartments');
    cy.visitAdmin('/departments');
  });

  it('should render the departments page', () => {
    cy.get('.ant-table, .ant-list, .ant-card, [class*="department"]').should('be.visible');
  });

  it('should create a new department', () => {
    cy.intercept('POST', `${apiUrl}/admin/departments`).as('createDepartment');

    cy.get('.ant-btn-primary').contains(/create|add|new/i).click();
    cy.get('.ant-modal, .ant-drawer').should('be.visible');

    cy.get('.ant-modal, .ant-drawer').within(() => {
      cy.get('input[id*="name"], input[name="name"], input[placeholder*="name" i]').first().type(`Test Department ${Date.now()}`);
      cy.get('button[type="submit"], .ant-btn-primary').click();
    });

    cy.wait('@createDepartment');
    cy.get('.ant-message-success, .ant-notification-notice-success').should('be.visible');
  });

  it('should edit a department', () => {
    cy.intercept('PUT', `${apiUrl}/admin/departments/*`).as('updateDepartment');

    cy.get('.ant-table-tbody tr, .ant-list-item, .ant-card').first().within(() => {
      cy.get('.ant-btn, button').contains(/edit/i).click();
    });

    cy.get('.ant-modal, .ant-drawer').should('be.visible');

    cy.get('.ant-modal, .ant-drawer').within(() => {
      cy.get('input[id*="name"], input[name="name"]').first().clear().type('Updated Department');
      cy.get('button[type="submit"], .ant-btn-primary').click();
    });

    cy.wait('@updateDepartment');
  });

  it('should delete a department', () => {
    cy.intercept('DELETE', `${apiUrl}/admin/departments/*`).as('deleteDepartment');

    cy.get('.ant-table-tbody tr, .ant-list-item, .ant-card').first().within(() => {
      cy.get('.ant-btn, button').contains(/delete/i).click();
    });

    cy.get('.ant-modal-confirm, .ant-popconfirm').should('be.visible');
    cy.get('.ant-modal-confirm .ant-btn-primary, .ant-popconfirm .ant-btn-primary, .ant-btn-dangerous')
      .contains(/yes|ok|confirm|delete/i)
      .click();

    cy.wait('@deleteDepartment');
  });

  it('should filter by active/inactive status', () => {
    cy.get('.ant-select, .ant-radio-group, .ant-tabs, [class*="filter"]').first().click({ force: true });

    cy.get('.ant-select-dropdown .ant-select-item, .ant-radio-button, .ant-tabs-tab').then(($items) => {
      const text = $items.map((i, el) => Cypress.$(el).text().toLowerCase()).get().join(' ');
      const hasStatusFilter = text.includes('active') || text.includes('inactive') || text.includes('all');
      expect(hasStatusFilter).to.be.true;
    });
  });

  it('should have a seed defaults button', () => {
    cy.intercept('POST', `${apiUrl}/admin/departments/seed*`).as('seedDepartments');

    cy.get('.ant-btn, button').contains(/seed|default|reset/i).should('be.visible').click();

    cy.get('.ant-modal-confirm, .ant-popconfirm').then(($modal) => {
      if ($modal.length) {
        cy.wrap($modal).find('.ant-btn-primary').first().click();
      }
    });
  });
});
