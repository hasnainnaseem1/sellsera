/// <reference types="cypress" />

describe('Admin Roles Management', () => {
  const adminUrl = Cypress.env('ADMIN_URL') || 'http://localhost:3003';
  const apiUrl = Cypress.env('API_URL') || 'http://localhost:3001/api/v1';

  beforeEach(() => {
    cy.loginAsAdmin();
    cy.intercept('GET', `${apiUrl}/admin/roles*`).as('getRoles');
    cy.visitAdmin('/roles');
  });

  it('should render the roles page', () => {
    cy.get('.ant-table, .ant-list, .ant-card, [class*="role"]').should('be.visible');
  });

  it('should create a role with name and permissions', () => {
    cy.intercept('POST', `${apiUrl}/admin/roles`).as('createRole');

    cy.get('.ant-btn-primary').contains(/create|add|new/i).click();
    cy.get('.ant-modal, .ant-drawer').should('be.visible');

    cy.get('.ant-modal, .ant-drawer').within(() => {
      cy.get('input[id*="name"], input[name="name"], input[placeholder*="name" i]').first().type(`Test Role ${Date.now()}`);

      // Select permissions
      cy.get('.ant-checkbox-input, .ant-switch').first().check({ force: true });
      cy.get('.ant-checkbox-input, .ant-switch').eq(1).check({ force: true });

      cy.get('button[type="submit"], .ant-btn-primary').click();
    });

    cy.wait('@createRole');
    cy.get('.ant-message-success, .ant-notification-notice-success').should('be.visible');
  });

  it('should edit a role and update permissions', () => {
    cy.intercept('PUT', `${apiUrl}/admin/roles/*`).as('updateRole');

    cy.get('.ant-table-tbody tr, .ant-list-item, .ant-card').first().within(() => {
      cy.get('.ant-btn, button').contains(/edit/i).click();
    });

    cy.get('.ant-modal, .ant-drawer').should('be.visible');

    cy.get('.ant-modal, .ant-drawer').within(() => {
      cy.get('input[id*="name"], input[name="name"]').first().clear().type('Updated Role Name');
      cy.get('button[type="submit"], .ant-btn-primary').click();
    });

    cy.wait('@updateRole');
  });

  it('should delete a role', () => {
    cy.intercept('DELETE', `${apiUrl}/admin/roles/*`).as('deleteRole');

    cy.get('.ant-table-tbody tr, .ant-list-item, .ant-card').first().within(() => {
      cy.get('.ant-btn, button').contains(/delete/i).click();
    });

    cy.get('.ant-modal-confirm, .ant-popconfirm').should('be.visible');
    cy.get('.ant-modal-confirm .ant-btn-primary, .ant-popconfirm .ant-btn-primary, .ant-btn-dangerous')
      .contains(/yes|ok|confirm|delete/i)
      .click();

    cy.wait('@deleteRole');
  });

  it('should list all available permissions', () => {
    cy.get('.ant-btn-primary').contains(/create|add|new/i).click();
    cy.get('.ant-modal, .ant-drawer').should('be.visible');

    cy.get('.ant-modal, .ant-drawer').within(() => {
      cy.get('.ant-checkbox, .ant-switch, [class*="permission"]').should('have.length.greaterThan', 2);
    });
  });

  it('should show error on duplicate role name', () => {
    cy.intercept('POST', `${apiUrl}/admin/roles`, {
      statusCode: 400,
      body: { success: false, message: 'Role name already exists' }
    }).as('createRoleDuplicate');

    cy.get('.ant-btn-primary').contains(/create|add|new/i).click();
    cy.get('.ant-modal, .ant-drawer').should('be.visible');

    cy.get('.ant-modal, .ant-drawer').within(() => {
      cy.get('input[id*="name"], input[name="name"]').first().type('Admin');
      cy.get('.ant-checkbox-input').first().check({ force: true });
      cy.get('button[type="submit"], .ant-btn-primary').click();
    });

    cy.wait('@createRoleDuplicate');
    cy.get('.ant-message-error, .ant-notification-notice-error, .ant-form-item-explain-error').should('be.visible');
  });

  it('should show feature gate message if roles feature is disabled', () => {
    cy.intercept('GET', `${apiUrl}/admin/roles*`, {
      statusCode: 403,
      body: { success: false, message: 'Custom roles feature is not enabled' }
    }).as('getRolesDisabled');

    cy.visitAdmin('/roles');
    cy.wait('@getRolesDisabled');

    cy.get('.ant-result, .ant-alert, .ant-empty, [class*="gate"], [class*="disabled"]').should('be.visible');
  });

  it('should support bulk delete', () => {
    cy.get('.ant-table-tbody .ant-checkbox-input').first().check({ force: true });
    cy.get('.ant-table-tbody .ant-checkbox-input').eq(1).check({ force: true });

    cy.get('.ant-btn, button').contains(/bulk\s*delete|delete\s*selected/i).should('be.visible');
  });
});
