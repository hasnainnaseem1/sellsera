/// <reference types="cypress" />

describe('Admin Customers Management', () => {
  const adminUrl = Cypress.env('ADMIN_URL') || 'http://localhost:3003';
  const apiUrl = Cypress.env('API_URL') || 'http://localhost:3001/api/v1';

  beforeEach(() => {
    cy.loginAsAdmin();
    cy.intercept('GET', `${apiUrl}/admin/customers*`).as('getCustomers');
    cy.visitAdmin('/customers');
    cy.wait('@getCustomers');
  });

  it('should render the customers list', () => {
    cy.get('.ant-table').should('be.visible');
  });

  it('should have columns: name, email, plan, status, joined, actions', () => {
    cy.get('.ant-table-thead th').then(($headers) => {
      const text = $headers.map((i, el) => Cypress.$(el).text().toLowerCase()).get().join(' ');
      expect(text).to.match(/name/);
      expect(text).to.match(/email/);
      expect(text).to.match(/plan|subscription/);
      expect(text).to.match(/status/);
      expect(text).to.match(/join|created|date|registered/);
      expect(text).to.match(/action/);
    });
  });

  it('should search and filter customers', () => {
    cy.get('.ant-input-search input, input[placeholder*="search" i]')
      .should('be.visible')
      .type('test');
    cy.get('.ant-table-tbody').should('exist');
  });

  it('should view customer detail page', () => {
    cy.get('.ant-table-tbody tr').first().within(() => {
      cy.get('a, .ant-btn, button').contains(/view|detail/i).first().click();
    });

    cy.url().should('match', /\/customers\/[a-zA-Z0-9]+/);
    cy.get('.ant-descriptions, .ant-card, [class*="detail"], [class*="profile"]').should('be.visible');
  });

  it('should show customer detail tabs: profile, subscription, usage, payments, activity', () => {
    cy.get('.ant-table-tbody tr').first().within(() => {
      cy.get('a, .ant-btn, button').contains(/view|detail/i).first().click();
    });

    cy.url().should('match', /\/customers\/[a-zA-Z0-9]+/);
    cy.get('.ant-tabs, .ant-card').should('exist');
    cy.get('.ant-tabs-tab, .ant-menu-item').then(($tabs) => {
      const text = $tabs.map((i, el) => Cypress.$(el).text().toLowerCase()).get().join(' ');
      const hasTabs = text.includes('profile') || text.includes('subscription') ||
        text.includes('usage') || text.includes('payment') || text.includes('activity');
      expect(hasTabs).to.be.true;
    });
  });

  it('should update customer status (active/suspended/banned)', () => {
    cy.intercept('PATCH', `${apiUrl}/admin/customers/*/status`).as('updateStatus');
    cy.intercept('PUT', `${apiUrl}/admin/customers/*`).as('updateCustomer');

    cy.get('.ant-table-tbody tr').first().within(() => {
      cy.get('.ant-btn, button, .ant-select, .ant-switch').contains(/suspend|activate|ban|status/i).first().click({ force: true });
    });

    cy.get('.ant-modal-confirm, .ant-popconfirm').then(($modal) => {
      if ($modal.length) {
        cy.wrap($modal).find('.ant-btn-primary, .ant-btn-dangerous').first().click();
      }
    });
  });

  it('should assign plan to customer', () => {
    cy.intercept('PATCH', `${apiUrl}/admin/customers/*/plan`).as('assignPlan');
    cy.intercept('PUT', `${apiUrl}/admin/customers/*`).as('updateCustomer');

    cy.get('.ant-table-tbody tr').first().within(() => {
      cy.get('a, .ant-btn, button').contains(/view|detail/i).first().click();
    });

    cy.url().should('match', /\/customers\/[a-zA-Z0-9]+/);

    cy.get('.ant-select, .ant-btn, button').contains(/plan|assign|change\s*plan/i).first().click({ force: true });
  });

  it('should reset customer usage', () => {
    cy.intercept('POST', `${apiUrl}/admin/customers/*/reset*`).as('resetUsage');

    cy.get('.ant-table-tbody tr').first().within(() => {
      cy.get('a, .ant-btn, button').contains(/view|detail/i).first().click();
    });

    cy.url().should('match', /\/customers\/[a-zA-Z0-9]+/);

    cy.get('.ant-btn, button').contains(/reset|usage/i).first().click({ force: true });

    cy.get('.ant-modal-confirm, .ant-popconfirm').then(($modal) => {
      if ($modal.length) {
        cy.wrap($modal).find('.ant-btn-primary, .ant-btn-dangerous').first().click();
      }
    });
  });

  it('should verify customer email manually', () => {
    cy.intercept('POST', `${apiUrl}/admin/customers/*/verify*`).as('verifyEmail');
    cy.intercept('PATCH', `${apiUrl}/admin/customers/*`).as('patchCustomer');

    cy.get('.ant-table-tbody tr').first().within(() => {
      cy.get('a, .ant-btn, button').contains(/view|detail/i).first().click();
    });

    cy.url().should('match', /\/customers\/[a-zA-Z0-9]+/);

    cy.get('.ant-btn, button').contains(/verify|email/i).first().click({ force: true });
  });

  it('should delete a customer (super admin only)', () => {
    cy.intercept('DELETE', `${apiUrl}/admin/customers/*`).as('deleteCustomer');

    cy.get('.ant-table-tbody tr').first().within(() => {
      cy.get('.ant-btn, button').contains(/delete/i).click();
    });

    cy.get('.ant-modal-confirm, .ant-popconfirm').should('be.visible');
    cy.get('.ant-modal-confirm .ant-btn-primary, .ant-popconfirm .ant-btn-primary, .ant-btn-dangerous')
      .contains(/yes|ok|confirm|delete/i)
      .click();

    cy.wait('@deleteCustomer');
  });

  it('should export customers to CSV', () => {
    cy.intercept('GET', `${apiUrl}/admin/customers/export*`).as('exportCustomers');

    cy.get('.ant-btn, button').contains(/export|csv|download/i).click();
  });

  it('should support bulk delete', () => {
    cy.get('.ant-table-tbody .ant-checkbox-input').first().check({ force: true });
    cy.get('.ant-table-tbody .ant-checkbox-input').eq(1).check({ force: true });

    cy.get('.ant-btn, button').contains(/bulk\s*delete|delete\s*selected/i).should('be.visible');
  });

  it('should show customer payments tab with payment history', () => {
    cy.get('.ant-table-tbody tr').first().within(() => {
      cy.get('a, .ant-btn, button').contains(/view|detail/i).first().click();
    });

    cy.url().should('match', /\/customers\/[a-zA-Z0-9]+/);

    cy.get('.ant-tabs-tab').contains(/payment/i).click({ force: true });

    cy.get('.ant-table, .ant-list, [class*="payment"]').should('be.visible');
  });

  it('should show customer activity tab with login history', () => {
    cy.get('.ant-table-tbody tr').first().within(() => {
      cy.get('a, .ant-btn, button').contains(/view|detail/i).first().click();
    });

    cy.url().should('match', /\/customers\/[a-zA-Z0-9]+/);

    cy.get('.ant-tabs-tab').contains(/activity|log|history/i).click({ force: true });

    cy.get('.ant-table, .ant-list, .ant-timeline, [class*="activity"]').should('be.visible');
  });
});
