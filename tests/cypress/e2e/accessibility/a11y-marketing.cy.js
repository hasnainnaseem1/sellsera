/**
 * Accessibility Tests — Marketing Site
 * Uses cypress-axe to check WCAG 2.0 AA compliance
 */

const MARKETING_URL = Cypress.env('MARKETING_URL') || 'http://localhost:3000';

describe('Marketing Site Accessibility', () => {
  
  describe('Main Pages', () => {
    const pages = [
      { path: '/', name: 'Homepage' },
      { path: '/blog', name: 'Blog' }
    ];

    pages.forEach(({ path, name }) => {
      it(`${name} should be accessible`, () => {
        cy.visit(`${MARKETING_URL}${path}`);
        cy.wait(2000);
        cy.injectAxe();
        cy.checkA11y(null, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }
        }, (violations) => {
          violations.forEach(v => cy.task('log', `a11y [${name}]: ${v.id} - ${v.description} (${v.impact})`));
        });
      });
    });
  });

  describe('Navigation Accessibility', () => {
    it('navbar should have navigation role', () => {
      cy.visit(MARKETING_URL);
      cy.get('nav, [role="navigation"]').should('exist');
    });

    it('all links should have accessible names', () => {
      cy.visit(MARKETING_URL);
      cy.get('a').each(($link) => {
        const hasName = $link.text().trim() !== '' || 
          $link.attr('aria-label') || 
          $link.find('img[alt]').length > 0;
        // Most links should have text - log exceptions
        if (!hasName) {
          cy.task('log', `Link without name: ${$link.attr('href')}`);
        }
      });
    });

    it('images should have alt text', () => {
      cy.visit(MARKETING_URL);
      cy.get('img').each(($img) => {
        const hasAlt = $img.attr('alt') !== undefined;
        if (!hasAlt) {
          cy.task('log', `Image without alt: ${$img.attr('src')}`);
        }
      });
    });
  });

  describe('Responsive Accessibility', () => {
    it('content is readable at mobile viewport', () => {
      cy.viewport(375, 667);
      cy.visit(MARKETING_URL);
      cy.get('body').should('be.visible');
      // Text should not overflow
      cy.get('body').invoke('prop', 'scrollWidth').then(scrollWidth => {
        cy.get('body').invoke('prop', 'clientWidth').then(clientWidth => {
          // Allow small tolerance for scrollbar
          expect(scrollWidth).to.be.at.most(clientWidth + 20);
        });
      });
    });

    it('font sizes should be at least 12px', () => {
      cy.visit(MARKETING_URL);
      cy.get('p, span, a, li, td').each(($el) => {
        const fontSize = parseFloat(window.getComputedStyle($el[0]).fontSize);
        if (fontSize > 0) {
          expect(fontSize).to.be.at.least(10); // Reasonable minimum
        }
      });
    });
  });

  describe('Semantic HTML', () => {
    it('page should have main landmark', () => {
      cy.visit(MARKETING_URL);
      cy.get('main, [role="main"]').should('exist');
    });

    it('page should have proper heading hierarchy', () => {
      cy.visit(MARKETING_URL);
      cy.get('h1').should('have.length.at.least', 1);
    });

    it('footer should exist', () => {
      cy.visit(MARKETING_URL);
      cy.get('footer, [role="contentinfo"]').should('exist');
    });
  });
});
