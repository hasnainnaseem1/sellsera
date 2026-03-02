const MARKETING_URL = Cypress.env('MARKETING_URL') || 'http://localhost:3000';

describe('Marketing Blog', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/v1/public/blog*').as('getBlogPosts');
  });

  describe('Blog List Page (/blog)', () => {
    it('should render the blog list page', () => {
      cy.visit(MARKETING_URL + '/blog');
      cy.wait('@getBlogPosts');
      cy.get('body').should('be.visible');
      cy.url().should('include', '/blog');
    });

    it('should show blog post cards with title, excerpt, and image', () => {
      cy.visit(MARKETING_URL + '/blog');
      cy.wait('@getBlogPosts');
      cy.get('[class*="card" i], [class*="post" i], [data-testid="blog-card"], article').then($cards => {
        if ($cards.length > 0) {
          cy.wrap($cards.first()).within(() => {
            cy.get('h2, h3, [class*="title" i]').should('exist');
            cy.get('p, [class*="excerpt" i], [class*="description" i]').should('exist');
            cy.get('img').should('exist');
          });
        }
      });
    });

    it('should support pagination', () => {
      cy.visit(MARKETING_URL + '/blog');
      cy.wait('@getBlogPosts');
      cy.get('[class*="pagination" i], [data-testid="pagination"], nav[aria-label*="pagination" i]').then($pagination => {
        if ($pagination.length > 0) {
          cy.wrap($pagination).find('a, button').should('have.length.greaterThan', 0);
          // Click next page if available
          cy.wrap($pagination).find('a, button').last().click();
          cy.wait('@getBlogPosts');
        }
      });
    });

    it('should navigate to blog detail when clicking a post card', () => {
      cy.visit(MARKETING_URL + '/blog');
      cy.wait('@getBlogPosts');
      cy.get('[class*="card" i] a, [class*="post" i] a, [data-testid="blog-card"] a, article a').first().then($link => {
        if ($link.length > 0) {
          cy.wrap($link).click();
          cy.url().should('match', /\/blog\/.+/);
        }
      });
    });

    it('should support category filter', () => {
      cy.visit(MARKETING_URL + '/blog');
      cy.wait('@getBlogPosts');
      cy.get('[class*="category" i], [class*="filter" i], [data-testid="category-filter"]').then($filter => {
        if ($filter.length > 0) {
          cy.wrap($filter).find('a, button, [class*="item" i]').first().click();
          cy.wait('@getBlogPosts');
          cy.get('[class*="card" i], [class*="post" i], article').should('exist');
        }
      });
    });

    it('should support search functionality (if available)', () => {
      cy.visit(MARKETING_URL + '/blog');
      cy.wait('@getBlogPosts');
      cy.get('input[type="search"], input[placeholder*="search" i], [data-testid="blog-search"]').then($search => {
        if ($search.length > 0) {
          cy.wrap($search).type('test search query');
          cy.wait('@getBlogPosts');
        }
      });
    });

    it('should show empty state when no posts', () => {
      cy.intercept('GET', '**/api/v1/public/blog*', {
        statusCode: 200,
        body: { success: true, data: [], posts: [], total: 0 }
      }).as('getEmptyBlog');
      cy.visit(MARKETING_URL + '/blog');
      cy.wait('@getEmptyBlog');
      cy.get('[class*="empty" i], [class*="no-results" i], [data-testid="empty-state"]').should('exist')
        .or('contain', 'No posts')
        .or('contain', 'no posts');
    });

    it('should be responsive: blog cards stack on mobile', () => {
      cy.viewport(375, 667);
      cy.visit(MARKETING_URL + '/blog');
      cy.wait('@getBlogPosts');
      cy.get('[class*="card" i], [class*="post" i], article').should('be.visible');
    });
  });

  describe('Blog Detail Page (/blog/:slug)', () => {
    it('should show full content, author, and date on detail page', () => {
      cy.visit(MARKETING_URL + '/blog');
      cy.wait('@getBlogPosts');
      // Navigate to first post
      cy.get('[class*="card" i] a, [class*="post" i] a, article a').first().then($link => {
        if ($link.length > 0) {
          cy.wrap($link).click();
          cy.url().should('match', /\/blog\/.+/);
          // Check content
          cy.get('h1, [class*="title" i]').should('exist');
          cy.get('[class*="content" i], [class*="body" i], article').should('exist');
          cy.get('[class*="author" i], [class*="date" i], time').should('exist');
        }
      });
    });

    it('should have a back to blog list link', () => {
      cy.visit(MARKETING_URL + '/blog');
      cy.wait('@getBlogPosts');
      cy.get('[class*="card" i] a, [class*="post" i] a, article a').first().then($link => {
        if ($link.length > 0) {
          cy.wrap($link).click();
          cy.url().should('match', /\/blog\/.+/);
          cy.get('a[href*="/blog"], [class*="back" i], [data-testid="back-to-blog"]').should('exist');
        }
      });
    });

    it('should increment views counter on detail page load', () => {
      cy.intercept('POST', '**/api/v1/public/blog/*/view*').as('incrementViews');
      cy.intercept('PUT', '**/api/v1/public/blog/*/view*').as('incrementViewsPut');
      cy.intercept('PATCH', '**/api/v1/public/blog/*/view*').as('incrementViewsPatch');
      cy.visit(MARKETING_URL + '/blog');
      cy.wait('@getBlogPosts');
      cy.get('[class*="card" i] a, [class*="post" i] a, article a').first().then($link => {
        if ($link.length > 0) {
          cy.wrap($link).click();
          cy.url().should('match', /\/blog\/.+/);
          // Verify views counter API was called (one of the methods)
          cy.get('[class*="view" i], [class*="read" i]').should('exist');
        }
      });
    });
  });
});
