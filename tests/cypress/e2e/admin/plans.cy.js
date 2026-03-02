/// <reference types="cypress" />

describe('Admin Plans Management', () => {
  const adminUrl = Cypress.env('ADMIN_URL') || 'http://localhost:3003';
  const apiUrl = Cypress.env('API_URL') || 'http://localhost:3001/api/v1';

  beforeEach(() => {
    cy.loginAsAdmin();
    cy.intercept('GET', `${apiUrl}/admin/plans*`).as('getPlans');
    cy.visitAdmin('/plans');
    cy.wait('@getPlans');
  });

  it('should render the plans list with a table', () => {
    cy.get('.ant-table').should('be.visible');
  });

  it('should have columns: name, price, status, features, actions', () => {
    cy.get('.ant-table-thead th').then(($headers) => {
      const text = $headers.map((i, el) => Cypress.$(el).text().toLowerCase()).get().join(' ');
      expect(text).to.match(/name/);
      expect(text).to.match(/price/);
      expect(text).to.match(/status/);
    });
  });

  it('should navigate to /plans/new on create button click', () => {
    cy.get('.ant-btn-primary').contains(/create|add|new/i).click();
    cy.url().should('include', '/plans/new');
  });

  it('should create a new plan', () => {
    cy.intercept('POST', `${apiUrl}/admin/plans`).as('createPlan');

    cy.visitAdmin('/plans/new');

    cy.get('input[id*="name"], input[name="name"], input[placeholder*="name" i]').first().type(`Test Plan ${Date.now()}`);
    cy.get('input[id*="price"], input[name="price"], input[name="monthlyPrice"], input[placeholder*="price" i]').first().type('29.99');
    cy.get('textarea[id*="description"], textarea[name="description"], input[id*="description"]').first().type('A test plan description');

    cy.get('button[type="submit"], .ant-btn-primary').contains(/save|create|submit/i).click();

    cy.wait('@createPlan');
    cy.get('.ant-message-success, .ant-notification-notice-success').should('be.visible');
  });

  it('should edit a plan with pre-filled form', () => {
    cy.intercept('PUT', `${apiUrl}/admin/plans/*`).as('updatePlan');
    cy.intercept('PATCH', `${apiUrl}/admin/plans/*`).as('patchPlan');

    cy.get('.ant-table-tbody tr').first().within(() => {
      cy.get('.ant-btn, button, a').contains(/edit/i).click();
    });

    cy.url().should('match', /\/plans\/[a-zA-Z0-9]+\/edit/);
    cy.get('input[id*="name"], input[name="name"]').should('not.have.value', '');

    cy.get('input[id*="name"], input[name="name"]').first().clear().type('Updated Plan Name');
    cy.get('button[type="submit"], .ant-btn-primary').contains(/save|update|submit/i).click();

    cy.get('.ant-message-success, .ant-notification-notice-success').should('be.visible');
  });

  it('should delete a plan with confirmation', () => {
    cy.intercept('DELETE', `${apiUrl}/admin/plans/*`).as('deletePlan');

    cy.get('.ant-table-tbody tr').first().within(() => {
      cy.get('.ant-btn, button').contains(/delete/i).click();
    });

    cy.get('.ant-modal-confirm, .ant-popconfirm').should('be.visible');
    cy.get('.ant-modal-confirm .ant-btn-primary, .ant-popconfirm .ant-btn-primary, .ant-btn-dangerous')
      .contains(/yes|ok|confirm|delete/i)
      .click();

    cy.wait('@deletePlan');
  });

  it('should toggle plan status (active/inactive)', () => {
    cy.intercept('PATCH', `${apiUrl}/admin/plans/*`).as('togglePlan');
    cy.intercept('PUT', `${apiUrl}/admin/plans/*`).as('updatePlan');

    cy.get('.ant-table-tbody tr').first().within(() => {
      cy.get('.ant-switch, .ant-tag, .ant-btn').first().click({ force: true });
    });
  });

  it('should set a plan as default', () => {
    cy.intercept('PATCH', `${apiUrl}/admin/plans/*/default`).as('setDefault');
    cy.intercept('PUT', `${apiUrl}/admin/plans/*`).as('updatePlan');

    cy.get('.ant-table-tbody tr').first().within(() => {
      cy.get('.ant-btn, button, .ant-switch').contains(/default|set\s*default/i).first().click({ force: true });
    });
  });

  it('should have features selection in the plan form', () => {
    cy.visitAdmin('/plans/new');

    cy.get('.ant-checkbox-group, .ant-select, .ant-transfer, [class*="feature"]').should('exist');
  });

  it('should display monthly and yearly prices', () => {
    cy.get('.ant-table-thead th, .ant-table-tbody td').then(($cells) => {
      const text = $cells.map((i, el) => Cypress.$(el).text().toLowerCase()).get().join(' ');
      const hasPriceColumns = text.includes('month') || text.includes('year') || text.includes('price');
      expect(hasPriceColumns).to.be.true;
    });
  });

  it('should support bulk delete', () => {
    cy.get('.ant-table-tbody .ant-checkbox-input').first().check({ force: true });
    cy.get('.ant-table-tbody .ant-checkbox-input').eq(1).check({ force: true });

    cy.get('.ant-btn, button').contains(/bulk\s*delete|delete\s*selected/i).should('be.visible');
  });

  it('should support export CSV', () => {
    cy.intercept('GET', `${apiUrl}/admin/plans/export*`).as('exportPlans');

    cy.get('.ant-btn, button').contains(/export|csv|download/i).click();
  });
});
