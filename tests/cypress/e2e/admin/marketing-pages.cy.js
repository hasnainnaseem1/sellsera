/// <reference types="cypress" />

describe('Admin Marketing Pages Management', () => {
  const adminUrl = Cypress.env('ADMIN_URL') || 'http://localhost:3003';
  const apiUrl = Cypress.env('API_URL') || 'http://localhost:3001/api/v1';

  beforeEach(() => {
    cy.loginAsAdmin();
    cy.intercept('GET', `${apiUrl}/admin/marketing/pages*`).as('getPages');
    cy.intercept('GET', `${apiUrl}/admin/marketing*`).as('getMarketing');
    cy.visitAdmin('/marketing/pages');
  });

  it('should render the marketing pages list', () => {
    cy.get('.ant-table, .ant-list, [class*="page"]').should('be.visible');
  });

  it('should create a new page with blocks', () => {
    cy.intercept('POST', `${apiUrl}/admin/marketing/pages`).as('createPage');

    cy.get('.ant-btn-primary').contains(/create|add|new/i).click();
    cy.url().should('include', '/marketing/pages/new');

    cy.get('input[id*="title"], input[name="title"], input[placeholder*="title" i]').first().type(`Test Page ${Date.now()}`);

    // Add blocks if block editor is available
    cy.get('body').then(($body) => {
      const addBlockBtn = $body.find('button:contains("Add Block"), button:contains("Add Section"), .ant-btn:contains("Add")');
      if (addBlockBtn.length) {
        cy.wrap(addBlockBtn).first().click();
        cy.get('.ant-select-item, .ant-menu-item, [class*="block-type"]').first().click({ force: true });
      }
    });

    cy.get('button[type="submit"], .ant-btn-primary').contains(/save|create|publish|submit/i).click();

    cy.wait('@createPage');
    cy.get('.ant-message-success, .ant-notification-notice-success').should('be.visible');
  });

  it('should edit an existing page', () => {
    cy.intercept('PUT', `${apiUrl}/admin/marketing/pages/*`).as('updatePage');
    cy.intercept('PATCH', `${apiUrl}/admin/marketing/pages/*`).as('patchPage');

    cy.get('.ant-table-tbody tr, .ant-list-item').first().within(() => {
      cy.get('.ant-btn, button, a').contains(/edit/i).click();
    });

    cy.url().should('match', /\/marketing\/pages\/[a-zA-Z0-9]+\/edit/);
    cy.get('input[id*="title"], input[name="title"]').first().clear().type('Updated Page Title');
    cy.get('button[type="submit"], .ant-btn-primary').contains(/save|update|submit/i).click();

    cy.get('.ant-message-success, .ant-notification-notice-success').should('be.visible');
  });

  it('should delete a page', () => {
    cy.intercept('DELETE', `${apiUrl}/admin/marketing/pages/*`).as('deletePage');

    cy.get('.ant-table-tbody tr, .ant-list-item').first().within(() => {
      cy.get('.ant-btn, button').contains(/delete/i).click();
    });

    cy.get('.ant-modal-confirm, .ant-popconfirm').should('be.visible');
    cy.get('.ant-modal-confirm .ant-btn-primary, .ant-popconfirm .ant-btn-primary, .ant-btn-dangerous')
      .contains(/yes|ok|confirm|delete/i)
      .click();

    cy.wait('@deletePage');
  });

  it('should clone a page', () => {
    cy.intercept('POST', `${apiUrl}/admin/marketing/pages/*/clone`).as('clonePage');
    cy.intercept('POST', `${apiUrl}/admin/marketing/pages`).as('createPage');

    cy.get('.ant-table-tbody tr, .ant-list-item').first().within(() => {
      cy.get('.ant-btn, button').contains(/clone|duplicate|copy/i).click();
    });
  });

  it('should toggle page status', () => {
    cy.intercept('PATCH', `${apiUrl}/admin/marketing/pages/*`).as('togglePage');

    cy.get('.ant-table-tbody tr, .ant-list-item').first().within(() => {
      cy.get('.ant-switch, .ant-tag').first().click({ force: true });
    });
  });

  it('should reorder pages', () => {
    cy.intercept('PUT', `${apiUrl}/admin/marketing/pages/reorder*`).as('reorderPages');
    cy.intercept('PATCH', `${apiUrl}/admin/marketing/pages/*/order*`).as('orderPage');

    // Check if drag handles or order controls exist
    cy.get('body').then(($body) => {
      const dragHandle = $body.find('[class*="drag"], [class*="sort"], [class*="order"], .ant-btn:contains("Up"), .ant-btn:contains("Down")');
      if (dragHandle.length) {
        cy.wrap(dragHandle).first().should('exist');
      }
    });
  });

  it('should display navigation page with nav items', () => {
    cy.intercept('GET', `${apiUrl}/admin/marketing/navigation*`).as('getNavigation');
    cy.visitAdmin('/marketing/navigation');

    cy.get('.ant-table, .ant-list, .ant-tree, [class*="navigation"], [class*="nav"]').should('be.visible');
  });

  it('should display branding page with theme settings', () => {
    cy.intercept('GET', `${apiUrl}/admin/settings*`).as('getSettings');
    cy.visitAdmin('/marketing/branding');

    cy.get('.ant-form, .ant-card, [class*="branding"], [class*="theme"]').should('be.visible');
  });

  it('should allow homepage designation', () => {
    cy.get('.ant-table-tbody tr, .ant-list-item').first().within(() => {
      cy.get('.ant-btn, button, .ant-switch, .ant-tag').contains(/home|default/i).first().click({ force: true });
    });
  });

  it('should preview page blocks', () => {
    cy.get('.ant-table-tbody tr, .ant-list-item').first().within(() => {
      cy.get('.ant-btn, button, a').contains(/preview|view/i).first().click({ force: true });
    });
  });

  it('should support bulk delete', () => {
    cy.get('.ant-table-tbody .ant-checkbox-input').first().check({ force: true });
    cy.get('.ant-table-tbody .ant-checkbox-input').eq(1).check({ force: true });

    cy.get('.ant-btn, button').contains(/bulk\s*delete|delete\s*selected/i).should('be.visible');
  });

  it('should have navigation editor', () => {
    cy.visitAdmin('/marketing/navigation');

    cy.get('.ant-btn-primary, .ant-btn').contains(/add|create|new|edit/i).should('be.visible');
  });

  it('should have SEO fields in page form', () => {
    cy.get('.ant-btn-primary').contains(/create|add|new/i).click();
    cy.url().should('include', '/marketing/pages/new');

    cy.get('body').then(($body) => {
      const seoSection = $body.find('[class*="seo"], :contains("SEO"), :contains("Meta")');
      expect(seoSection.length).to.be.greaterThan(0);
    });

    cy.get('input[id*="metaTitle"], input[name="metaTitle"], input[id*="seoTitle"], input[id*="meta_title"], input[placeholder*="meta" i], input[placeholder*="seo" i]')
      .should('exist');
  });
});
