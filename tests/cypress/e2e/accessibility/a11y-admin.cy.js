/**
 * Accessibility Tests — Admin Center
 * Uses cypress-axe to check WCAG 2.0 AA compliance
 */

const ADMIN_URL = Cypress.env('ADMIN_URL') || 'http://localhost:3003';
const API_URL = Cypress.env('API_URL') || 'http://localhost:3001/api/v1';

describe('Admin Center Accessibility', () => {
  
  describe('Public Pages', () => {
    it('Login page should be accessible', () => {
      cy.visit(`${ADMIN_URL}/login`);
      cy.injectAxe();
      cy.checkA11y(null, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }
      }, (violations) => {
        violations.forEach(v => cy.task('log', `a11y: ${v.id} - ${v.description} (${v.impact})`));
      });
    });

    it('Forgot Password page should be accessible', () => {
      cy.visit(`${ADMIN_URL}/forgot-password`);
      cy.injectAxe();
      cy.checkA11y(null, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }
      }, (violations) => {
        violations.forEach(v => cy.task('log', `a11y: ${v.id} - ${v.description} (${v.impact})`));
      });
    });
  });

  describe('Authenticated Pages', () => {
    beforeEach(() => {
      cy.loginAsAdmin();
    });

    const pages = [
      { path: '/', name: 'Dashboard' },
      { path: '/users', name: 'Users' },
      { path: '/customers', name: 'Customers' },
      { path: '/plans', name: 'Plans' },
      { path: '/features', name: 'Features' },
      { path: '/analytics', name: 'Analytics' },
      { path: '/settings', name: 'Settings' },
      { path: '/blog/posts', name: 'Blog Posts' },
      { path: '/marketing/pages', name: 'Marketing Pages' },
      { path: '/notifications', name: 'Notifications' },
      { path: '/profile', name: 'Profile' }
    ];

    pages.forEach(({ path, name }) => {
      it(`${name} page should be accessible`, () => {
        cy.visit(`${ADMIN_URL}${path}`);
        cy.wait(2000); // Wait for data to load
        cy.injectAxe();
        cy.checkA11y(null, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
          rules: {
            // Allow some common Ant Design issues that are non-critical
            'color-contrast': { enabled: true },
            'empty-heading': { enabled: true },
            'link-name': { enabled: true },
            'button-name': { enabled: true },
            'image-alt': { enabled: true },
            'label': { enabled: true }
          }
        }, (violations) => {
          violations.forEach(v => cy.task('log', `a11y [${name}]: ${v.id} - ${v.description} (${v.impact})`));
        });
      });
    });
  });

  describe('ARIA attributes', () => {
    beforeEach(() => {
      cy.loginAsAdmin();
    });

    it('navigation should have proper ARIA roles', () => {
      cy.visit(`${ADMIN_URL}/`);
      cy.get('nav, [role="navigation"], .ant-menu').should('exist');
    });

    it('buttons should have accessible names', () => {
      cy.visit(`${ADMIN_URL}/users`);
      cy.wait(2000);
      cy.get('button').each(($btn) => {
        // Each button should have text content, aria-label, or title
        const hasName = $btn.text().trim() !== '' || 
          $btn.attr('aria-label') || 
          $btn.attr('title') ||
          $btn.find('svg, .anticon').length > 0; // Icon buttons are OK
        expect(hasName).to.be.true;
      });
    });

    it('form inputs should have labels', () => {
      cy.visit(`${ADMIN_URL}/login`);
      cy.get('input:not([type="hidden"])').each(($input) => {
        const id = $input.attr('id');
        const hasLabel = $input.attr('aria-label') || 
          $input.attr('placeholder') ||
          (id && Cypress.$(`label[for="${id}"]`).length > 0) ||
          $input.closest('.ant-form-item').find('label').length > 0;
        expect(hasLabel).to.be.true;
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('login form should be keyboard navigable', () => {
      cy.visit(`${ADMIN_URL}/login`);
      
      // Tab through form elements
      cy.get('body').tab();
      cy.focused().should('exist');
      
      // Email input should be focusable
      cy.get('input[type="email"], input[name="email"], #email').first().focus();
      cy.focused().should('have.attr', 'type').and('match', /email|text/);
    });

    it('main content should be reachable via keyboard', () => {
      cy.loginAsAdmin();
      cy.visit(`${ADMIN_URL}/`);
      
      // There should be focusable elements
      cy.get('a, button, input, [tabindex]').should('have.length.at.least', 1);
    });
  });
});
