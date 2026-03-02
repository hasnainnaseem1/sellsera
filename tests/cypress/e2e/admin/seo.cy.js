/// <reference types="cypress" />

describe('Admin SEO Management', () => {
  const adminUrl = Cypress.env('ADMIN_URL') || 'http://localhost:3003';
  const apiUrl = Cypress.env('API_URL') || 'http://localhost:3001/api/v1';

  beforeEach(() => {
    cy.loginAsAdmin();
  });

  describe('SEO Settings', () => {
    beforeEach(() => {
      cy.intercept('GET', `${apiUrl}/admin/seo*`).as('getSeoSettings');
      cy.intercept('GET', `${apiUrl}/admin/settings*`).as('getSettings');
      cy.visitAdmin('/seo/settings');
    });

    it('should render the SEO settings page', () => {
      cy.get('.ant-form, .ant-card, [class*="seo"]').should('be.visible');
    });

    it('should update meta title and description', () => {
      cy.intercept('PUT', `${apiUrl}/admin/seo*`).as('updateSeo');
      cy.intercept('PATCH', `${apiUrl}/admin/seo*`).as('patchSeo');
      cy.intercept('PUT', `${apiUrl}/admin/settings*`).as('updateSettings');

      cy.get('input[id*="metaTitle"], input[name*="metaTitle"], input[id*="title"], input[name*="title"], input[placeholder*="title" i]')
        .first()
        .clear()
        .type('Updated Meta Title');

      cy.get('textarea[id*="metaDescription"], textarea[name*="metaDescription"], textarea[id*="description"], textarea[name*="description"], textarea[placeholder*="description" i]')
        .first()
        .clear()
        .type('Updated meta description for SEO');

      cy.get('button[type="submit"], .ant-btn-primary').contains(/save|update|submit/i).click();

      cy.get('.ant-message-success, .ant-notification-notice-success').should('be.visible');
    });
  });

  describe('SEO Redirects', () => {
    beforeEach(() => {
      cy.intercept('GET', `${apiUrl}/admin/seo/redirects*`).as('getRedirects');
      cy.visitAdmin('/seo/redirects');
    });

    it('should list redirects in a table', () => {
      cy.get('.ant-table').should('be.visible');
    });

    it('should create a new redirect with from/to paths', () => {
      cy.intercept('POST', `${apiUrl}/admin/seo/redirects`).as('createRedirect');

      cy.get('.ant-btn-primary').contains(/create|add|new/i).click();
      cy.get('.ant-modal, .ant-drawer').should('be.visible');

      cy.get('.ant-modal, .ant-drawer').within(() => {
        cy.get('input[id*="from"], input[name*="from"], input[placeholder*="from" i]').first().type('/old-page');
        cy.get('input[id*="to"], input[name*="to"], input[placeholder*="to" i]').first().type('/new-page');
        cy.get('button[type="submit"], .ant-btn-primary').click();
      });

      cy.wait('@createRedirect');
      cy.get('.ant-message-success, .ant-notification-notice-success').should('be.visible');
    });

    it('should edit a redirect', () => {
      cy.intercept('PUT', `${apiUrl}/admin/seo/redirects/*`).as('updateRedirect');

      cy.get('.ant-table-tbody tr').first().within(() => {
        cy.get('.ant-btn, button').contains(/edit/i).click();
      });

      cy.get('.ant-modal, .ant-drawer').should('be.visible');

      cy.get('.ant-modal, .ant-drawer').within(() => {
        cy.get('input[id*="to"], input[name*="to"]').first().clear().type('/updated-page');
        cy.get('button[type="submit"], .ant-btn-primary').click();
      });

      cy.wait('@updateRedirect');
    });

    it('should delete a redirect', () => {
      cy.intercept('DELETE', `${apiUrl}/admin/seo/redirects/*`).as('deleteRedirect');

      cy.get('.ant-table-tbody tr').first().within(() => {
        cy.get('.ant-btn, button').contains(/delete/i).click();
      });

      cy.get('.ant-modal-confirm, .ant-popconfirm').should('be.visible');
      cy.get('.ant-modal-confirm .ant-btn-primary, .ant-popconfirm .ant-btn-primary, .ant-btn-dangerous')
        .contains(/yes|ok|confirm|delete/i)
        .click();

      cy.wait('@deleteRedirect');
    });

    it('should toggle redirect active/inactive', () => {
      cy.intercept('PATCH', `${apiUrl}/admin/seo/redirects/*`).as('toggleRedirect');

      cy.get('.ant-table-tbody tr').first().within(() => {
        cy.get('.ant-switch').first().click({ force: true });
      });
    });

    it('should show error on duplicate fromPath', () => {
      cy.intercept('POST', `${apiUrl}/admin/seo/redirects`, {
        statusCode: 400,
        body: { success: false, message: 'Redirect from path already exists' }
      }).as('createRedirectDuplicate');

      cy.get('.ant-btn-primary').contains(/create|add|new/i).click();
      cy.get('.ant-modal, .ant-drawer').should('be.visible');

      cy.get('.ant-modal, .ant-drawer').within(() => {
        cy.get('input[id*="from"], input[name*="from"]').first().type('/existing-path');
        cy.get('input[id*="to"], input[name*="to"]').first().type('/some-page');
        cy.get('button[type="submit"], .ant-btn-primary').click();
      });

      cy.wait('@createRedirectDuplicate');
      cy.get('.ant-message-error, .ant-notification-notice-error, .ant-form-item-explain-error').should('be.visible');
    });

    it('should support redirect status codes (301, 302)', () => {
      cy.get('.ant-btn-primary').contains(/create|add|new/i).click();
      cy.get('.ant-modal, .ant-drawer').should('be.visible');

      cy.get('.ant-modal, .ant-drawer').within(() => {
        cy.get('.ant-select, select, [id*="statusCode"], [id*="status_code"], [name*="statusCode"]').first().click({ force: true });
      });

      cy.get('.ant-select-dropdown .ant-select-item').then(($options) => {
        const text = $options.map((i, el) => Cypress.$(el).text()).get().join(' ');
        expect(text).to.match(/301|302/);
      });
    });
  });

  describe('SEO Debug', () => {
    it('should render the SEO debug page', () => {
      cy.intercept('GET', `${apiUrl}/admin/seo/debug*`).as('getSeoDebug');
      cy.visitAdmin('/seo/debug');

      cy.get('.ant-card, .ant-table, [class*="debug"], [class*="seo"]').should('be.visible');
    });
  });
});
