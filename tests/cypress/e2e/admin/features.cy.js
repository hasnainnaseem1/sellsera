/// <reference types="cypress" />

describe('Admin Features Management', () => {
  const adminUrl = Cypress.env('ADMIN_URL') || 'http://localhost:3003';
  const apiUrl = Cypress.env('API_URL') || 'http://localhost:3001/api/v1';

  beforeEach(() => {
    cy.loginAsAdmin();
    cy.intercept('GET', `${apiUrl}/admin/features*`).as('getFeatures');
    cy.visitAdmin('/features');
    cy.wait('@getFeatures');
  });

  it('should render the features list', () => {
    cy.get('.ant-table').should('be.visible');
  });

  it('should have columns: name, key, type, status, actions', () => {
    cy.get('.ant-table-thead th').then(($headers) => {
      const text = $headers.map((i, el) => Cypress.$(el).text().toLowerCase()).get().join(' ');
      expect(text).to.match(/name/);
      expect(text).to.match(/key/);
      expect(text).to.match(/type/);
      expect(text).to.match(/status|active/);
      expect(text).to.match(/action/);
    });
  });

  it('should create a feature via modal form', () => {
    cy.intercept('POST', `${apiUrl}/admin/features`).as('createFeature');

    cy.get('.ant-btn-primary').contains(/create|add|new/i).click();
    cy.get('.ant-modal, .ant-drawer').should('be.visible');

    cy.get('.ant-modal, .ant-drawer').within(() => {
      cy.get('input[id*="name"], input[name="name"], input[placeholder*="name" i]').first().type(`Test Feature ${Date.now()}`);
      cy.get('input[id*="key"], input[name="key"], input[placeholder*="key" i]').first().type(`test_feature_${Date.now()}`);
      cy.get('button[type="submit"], .ant-btn-primary').click();
    });

    cy.wait('@createFeature');
    cy.get('.ant-message-success, .ant-notification-notice-success').should('be.visible');
  });

  it('should edit a feature', () => {
    cy.intercept('PUT', `${apiUrl}/admin/features/*`).as('updateFeature');

    cy.get('.ant-table-tbody tr').first().within(() => {
      cy.get('.ant-btn, button').contains(/edit/i).click();
    });

    cy.get('.ant-modal, .ant-drawer').should('be.visible');

    cy.get('.ant-modal, .ant-drawer').within(() => {
      cy.get('input[id*="name"], input[name="name"]').first().clear().type('Updated Feature Name');
      cy.get('button[type="submit"], .ant-btn-primary').click();
    });

    cy.wait('@updateFeature');
  });

  it('should delete a feature', () => {
    cy.intercept('DELETE', `${apiUrl}/admin/features/*`).as('deleteFeature');

    cy.get('.ant-table-tbody tr').first().within(() => {
      cy.get('.ant-btn, button').contains(/delete/i).click();
    });

    cy.get('.ant-modal-confirm, .ant-popconfirm').should('be.visible');
    cy.get('.ant-modal-confirm .ant-btn-primary, .ant-popconfirm .ant-btn-primary, .ant-btn-dangerous')
      .contains(/yes|ok|confirm|delete/i)
      .click();

    cy.wait('@deleteFeature');
  });

  it('should toggle feature status', () => {
    cy.intercept('PATCH', `${apiUrl}/admin/features/*`).as('toggleFeature');
    cy.intercept('PUT', `${apiUrl}/admin/features/*`).as('updateFeature');

    cy.get('.ant-table-tbody tr').first().within(() => {
      cy.get('.ant-switch').first().click({ force: true });
    });
  });

  it('should support feature types: boolean, numeric, text', () => {
    cy.get('.ant-btn-primary').contains(/create|add|new/i).click();
    cy.get('.ant-modal, .ant-drawer').should('be.visible');

    cy.get('.ant-modal, .ant-drawer').within(() => {
      cy.get('.ant-select, select, [id*="type"], [name="type"]').first().click({ force: true });
    });

    cy.get('.ant-select-dropdown .ant-select-item, .ant-select-item-option').then(($options) => {
      const text = $options.map((i, el) => Cypress.$(el).text().toLowerCase()).get().join(' ');
      expect(text).to.match(/boolean|numeric|text|number|string/);
    });
  });

  it('should show error on duplicate feature key', () => {
    cy.intercept('POST', `${apiUrl}/admin/features`, {
      statusCode: 400,
      body: { success: false, message: 'Feature key already exists' }
    }).as('createFeatureDuplicate');

    cy.get('.ant-btn-primary').contains(/create|add|new/i).click();
    cy.get('.ant-modal, .ant-drawer').should('be.visible');

    cy.get('.ant-modal, .ant-drawer').within(() => {
      cy.get('input[id*="name"], input[name="name"]').first().type('Duplicate Feature');
      cy.get('input[id*="key"], input[name="key"]').first().type('existing_key');
      cy.get('button[type="submit"], .ant-btn-primary').click();
    });

    cy.wait('@createFeatureDuplicate');
    cy.get('.ant-message-error, .ant-notification-notice-error, .ant-form-item-explain-error').should('be.visible');
  });

  it('should support bulk delete', () => {
    cy.get('.ant-table-tbody .ant-checkbox-input').first().check({ force: true });
    cy.get('.ant-table-tbody .ant-checkbox-input').eq(1).check({ force: true });

    cy.get('.ant-btn, button').contains(/bulk\s*delete|delete\s*selected/i).should('be.visible');
  });

  it('should support export CSV', () => {
    cy.get('.ant-btn, button').contains(/export|csv|download/i).click();
  });
});
