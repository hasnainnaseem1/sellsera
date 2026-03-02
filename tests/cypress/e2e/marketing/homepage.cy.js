const MARKETING_URL = Cypress.env('MARKETING_URL') || 'http://localhost:3000';

describe('Marketing Homepage', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/v1/public/home').as('getHomePage');
  });

  it('should load the homepage successfully', () => {
    cy.visit(MARKETING_URL + '/');
    cy.wait('@getHomePage');
    cy.get('body').should('be.visible');
    cy.title().should('not.be.empty');
  });

  it('should have a navigation bar with logo and links', () => {
    cy.visit(MARKETING_URL + '/');
    cy.wait('@getHomePage');
    cy.get('nav, header, [data-testid="navbar"]').should('exist').within(() => {
      cy.get('img[alt*="logo" i], a[class*="logo" i], [data-testid="logo"]').should('be.visible');
      cy.get('a').should('have.length.greaterThan', 0);
    });
  });

  it('should have a footer with links', () => {
    cy.visit(MARKETING_URL + '/');
    cy.wait('@getHomePage');
    cy.get('footer, [data-testid="footer"]').should('exist').within(() => {
      cy.get('a').should('have.length.greaterThan', 0);
    });
  });

  it('should render dynamic blocks (hero, features, pricing, CTA sections)', () => {
    cy.visit(MARKETING_URL + '/');
    cy.wait('@getHomePage');
    // Check that at least some content blocks are rendered
    cy.get('[class*="hero" i], [data-testid="hero"], [class*="block" i], section').should('have.length.greaterThan', 0);
  });

  it('should have hero section with title, subtitle, and CTA button', () => {
    cy.visit(MARKETING_URL + '/');
    cy.wait('@getHomePage');
    cy.get('[class*="hero" i], [data-testid="hero"], section').first().within(() => {
      cy.get('h1, h2, [class*="title" i]').should('exist');
      cy.get('p, [class*="subtitle" i], [class*="description" i]').should('exist');
      cy.get('a, button').should('have.length.greaterThan', 0);
    });
  });

  it('should have working navigation links', () => {
    cy.visit(MARKETING_URL + '/');
    cy.wait('@getHomePage');
    cy.get('nav a, header a').first().then($link => {
      const href = $link.attr('href');
      if (href && !href.startsWith('http') && !href.startsWith('mailto')) {
        cy.wrap($link).click();
        cy.url().should('not.eq', MARKETING_URL + '/');
      }
    });
  });

  it('should be responsive across viewport sizes', () => {
    // Desktop
    cy.viewport(1280, 720);
    cy.visit(MARKETING_URL + '/');
    cy.wait('@getHomePage');
    cy.get('body').should('be.visible');

    // Tablet
    cy.viewport(768, 1024);
    cy.visit(MARKETING_URL + '/');
    cy.get('body').should('be.visible');

    // Mobile
    cy.viewport(375, 667);
    cy.visit(MARKETING_URL + '/');
    cy.get('body').should('be.visible');
  });

  it('should load within 5 seconds (performance)', () => {
    const start = Date.now();
    cy.visit(MARKETING_URL + '/');
    cy.wait('@getHomePage');
    cy.get('body').should('be.visible').then(() => {
      const loadTime = Date.now() - start;
      expect(loadTime).to.be.lessThan(5000);
    });
  });

  it('should have SEO meta title and description', () => {
    cy.visit(MARKETING_URL + '/');
    cy.wait('@getHomePage');
    cy.title().should('not.be.empty');
    cy.get('head meta[name="description"]').should('have.attr', 'content').and('not.be.empty');
  });

  it('should intercept and receive data from GET /api/v1/public/home', () => {
    cy.visit(MARKETING_URL + '/');
    cy.wait('@getHomePage').then((interception) => {
      expect(interception.response.statusCode).to.be.oneOf([200, 304]);
      expect(interception.response.body).to.exist;
    });
  });
});
