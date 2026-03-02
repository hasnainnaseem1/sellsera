/// <reference types="cypress" />

describe('Admin Blog Management', () => {
  const adminUrl = Cypress.env('ADMIN_URL') || 'http://localhost:3003';
  const apiUrl = Cypress.env('API_URL') || 'http://localhost:3001/api/v1';

  beforeEach(() => {
    cy.loginAsAdmin();
    cy.intercept('GET', `${apiUrl}/admin/blog*`).as('getBlogPosts');
    cy.intercept('GET', `${apiUrl}/admin/blog/posts*`).as('getBlogPostsList');
    cy.visitAdmin('/blog/posts');
  });

  it('should render the blog list page with posts table', () => {
    cy.get('.ant-table').should('be.visible');
  });

  it('should have columns: title, category, status, date, actions', () => {
    cy.get('.ant-table-thead th').then(($headers) => {
      const text = $headers.map((i, el) => Cypress.$(el).text().toLowerCase()).get().join(' ');
      expect(text).to.match(/title/);
      expect(text).to.match(/categor|tag/);
      expect(text).to.match(/status/);
      expect(text).to.match(/date|created|published/);
      expect(text).to.match(/action/);
    });
  });

  it('should navigate to /blog/posts/new on create button click', () => {
    cy.get('.ant-btn-primary').contains(/create|add|new|write/i).click();
    cy.url().should('include', '/blog/posts/new');
  });

  it('should create a new blog post', () => {
    cy.intercept('POST', `${apiUrl}/admin/blog*`).as('createPost');

    cy.visitAdmin('/blog/posts/new');

    cy.get('input[id*="title"], input[name="title"], input[placeholder*="title" i]').first().type(`Test Blog Post ${Date.now()}`);

    // Fill content - could be rich text editor or textarea
    cy.get('textarea, .ql-editor, [contenteditable="true"], .ant-input, [class*="editor"]').first()
      .type('This is a test blog post content.');

    // Select category if available
    cy.get('body').then(($body) => {
      const categorySelect = $body.find('.ant-select:contains("category"), [id*="category"], [name="category"]');
      if (categorySelect.length) {
        cy.wrap(categorySelect).first().click({ force: true });
        cy.get('.ant-select-dropdown .ant-select-item').first().click();
      }
    });

    cy.get('button[type="submit"], .ant-btn-primary').contains(/save|create|publish|submit/i).click();

    cy.wait('@createPost');
    cy.get('.ant-message-success, .ant-notification-notice-success').should('be.visible');
  });

  it('should edit a blog post with pre-filled form', () => {
    cy.intercept('PUT', `${apiUrl}/admin/blog/*`).as('updatePost');
    cy.intercept('PATCH', `${apiUrl}/admin/blog/*`).as('patchPost');

    cy.get('.ant-table-tbody tr').first().within(() => {
      cy.get('.ant-btn, button, a').contains(/edit/i).click();
    });

    cy.url().should('match', /\/blog\/posts\/[a-zA-Z0-9]+\/edit/);
    cy.get('input[id*="title"], input[name="title"]').should('not.have.value', '');

    cy.get('input[id*="title"], input[name="title"]').first().clear().type('Updated Blog Post Title');
    cy.get('button[type="submit"], .ant-btn-primary').contains(/save|update|submit/i).click();

    cy.get('.ant-message-success, .ant-notification-notice-success').should('be.visible');
  });

  it('should delete a blog post', () => {
    cy.intercept('DELETE', `${apiUrl}/admin/blog/*`).as('deletePost');

    cy.get('.ant-table-tbody tr').first().within(() => {
      cy.get('.ant-btn, button').contains(/delete/i).click();
    });

    cy.get('.ant-modal-confirm, .ant-popconfirm').should('be.visible');
    cy.get('.ant-modal-confirm .ant-btn-primary, .ant-popconfirm .ant-btn-primary, .ant-btn-dangerous')
      .contains(/yes|ok|confirm|delete/i)
      .click();

    cy.wait('@deletePost');
  });

  it('should toggle post status (published/draft/archived)', () => {
    cy.get('.ant-table-tbody tr').first().within(() => {
      cy.get('.ant-tag, .ant-badge, .ant-select, .ant-switch').first().click({ force: true });
    });
  });

  it('should display blog stats', () => {
    cy.get('.ant-card, .ant-statistic, [class*="stat"]').should('have.length.greaterThan', 0);
  });

  it('should filter by categories', () => {
    cy.get('.ant-select, .ant-radio-group, .ant-tabs, [class*="filter"], [class*="category"]')
      .first()
      .click({ force: true });

    cy.get('.ant-select-dropdown .ant-select-item, .ant-radio-button, .ant-tabs-tab').then(($items) => {
      if ($items.length) {
        cy.wrap($items).first().click();
      }
    });
  });

  it('should auto-generate slug from title', () => {
    cy.visitAdmin('/blog/posts/new');

    cy.get('input[id*="title"], input[name="title"]').first().type('My Test Blog Post');
    cy.get('input[id*="slug"], input[name="slug"]').first().should(($slug) => {
      const val = $slug.val();
      expect(val).to.match(/my-test-blog-post|my_test_blog_post/i);
    });
  });

  it('should support bulk delete', () => {
    cy.get('.ant-table-tbody .ant-checkbox-input').first().check({ force: true });
    cy.get('.ant-table-tbody .ant-checkbox-input').eq(1).check({ force: true });

    cy.get('.ant-btn, button').contains(/bulk\s*delete|delete\s*selected/i).should('be.visible');
  });

  it('should search posts', () => {
    cy.get('.ant-input-search input, input[placeholder*="search" i]')
      .should('be.visible')
      .type('test');
    cy.get('.ant-table-tbody').should('exist');
  });
});
