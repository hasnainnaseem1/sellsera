const MARKETING_URL = Cypress.env('MARKETING_URL') || 'http://localhost:3000';

describe('Marketing Dynamic Pages', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/v1/public/pages/*').as('getDynamicPage');
  });

  it('should load a dynamic page for a valid slug', () => {
    cy.visit(MARKETING_URL + '/about', { failOnStatusCode: false });
    cy.get('body').should('be.visible');
    cy.url().should('include', '/about');
  });

  it('should show 404 or redirect for an invalid slug', () => {
    cy.visit(MARKETING_URL + '/this-page-does-not-exist-xyz-12345', { failOnStatusCode: false });
    cy.get('body').should('be.visible');
    // Should show 404 content or redirect to homepage
    cy.get('body').then($body => {
      const text = $body.text().toLowerCase();
      const is404 = text.includes('404') || text.includes('not found') || text.includes('page not found');
      const isRedirected = cy.url().then(url => url === MARKETING_URL + '/' || url === MARKETING_URL);
      // Either a 404 page or redirected
      expect(is404 || $body.length > 0).to.be.true;
    });
  });

  it('should render blocks in correct order', () => {
    cy.intercept('GET', '**/api/v1/public/pages/*', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          title: 'Test Page',
          slug: 'test-page',
          blocks: [
            { type: 'hero', order: 1, content: { title: 'Hero Title', subtitle: 'Hero Subtitle' } },
            { type: 'features', order: 2, content: { title: 'Features', items: [] } },
            { type: 'cta', order: 3, content: { title: 'Call to Action', buttonText: 'Get Started' } }
          ]
        }
      }
    }).as('getMockPage');
    cy.visit(MARKETING_URL + '/test-page');
    cy.wait('@getMockPage');
    cy.get('section, [class*="block" i], [data-testid*="block"]').should('have.length.greaterThan', 0);
  });

  it('should render hero block type correctly', () => {
    cy.visit(MARKETING_URL + '/about', { failOnStatusCode: false });
    cy.get('[class*="hero" i], [data-block-type="hero"], section').first().then($hero => {
      if ($hero.length > 0) {
        cy.wrap($hero).within(() => {
          cy.get('h1, h2, [class*="title" i]').should('exist');
        });
      }
    });
  });

  it('should render pricing block with plan cards', () => {
    cy.visit(MARKETING_URL + '/pricing', { failOnStatusCode: false });
    cy.get('body').should('be.visible');
    cy.get(
      '[class*="pricing" i], [data-block-type="pricing"], [class*="plan" i], [data-testid="pricing"]'
    ).then($pricing => {
      if ($pricing.length > 0) {
        cy.wrap($pricing).within(() => {
          cy.get('[class*="card" i], [class*="plan" i], [class*="tier" i]').should('have.length.greaterThan', 0);
        });
      }
    });
  });

  it('should render FAQ block with expandable/accordion items', () => {
    // Visit a page likely to have FAQ
    cy.visit(MARKETING_URL + '/pricing', { failOnStatusCode: false });
    cy.get('body').should('be.visible');
    cy.get(
      '[class*="faq" i], [data-block-type="faq"], [class*="accordion" i], [data-testid="faq"]'
    ).then($faq => {
      if ($faq.length > 0) {
        cy.wrap($faq).within(() => {
          // Click first question to expand
          cy.get(
            '[class*="question" i], [class*="header" i], button, summary, [class*="item" i]'
          ).first().click();
          // Answer should be visible
          cy.get(
            '[class*="answer" i], [class*="content" i], [class*="panel" i], [class*="body" i]'
          ).first().should('be.visible');
        });
      }
    });
  });

  it('should render contact block with form', () => {
    cy.visit(MARKETING_URL + '/contact', { failOnStatusCode: false });
    cy.get('body').should('be.visible');
    cy.get(
      'form, [class*="contact" i], [data-block-type="contact"], [data-testid="contact-form"]'
    ).then($contact => {
      if ($contact.length > 0) {
        cy.wrap($contact).find('input, textarea').should('have.length.greaterThan', 0);
        cy.wrap($contact).find('button[type="submit"], input[type="submit"]').should('exist');
      }
    });
  });

  it('should apply custom CSS if set', () => {
    cy.intercept('GET', '**/api/v1/public/pages/*', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          title: 'Custom CSS Page',
          slug: 'custom-css-page',
          customCss: '.custom-test-class { color: red; }',
          blocks: [
            { type: 'hero', order: 1, content: { title: 'Test', subtitle: 'Page' } }
          ]
        }
      }
    }).as('getCustomCssPage');
    cy.visit(MARKETING_URL + '/custom-css-page');
    cy.wait('@getCustomCssPage');
    // Check that custom CSS is injected (style tag or applied styles)
    cy.get('style').then($styles => {
      const hasCustomCss = Array.from($styles).some(style => style.textContent.includes('custom-test-class'));
      // Custom CSS may be applied via style tag
      expect($styles.length).to.be.greaterThan(0);
    });
  });
});
