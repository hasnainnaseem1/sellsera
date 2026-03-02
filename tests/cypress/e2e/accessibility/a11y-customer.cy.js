/**
 * Accessibility Tests — Customer Center
 * Uses cypress-axe to check WCAG 2.0 AA compliance
 */

const CUSTOMER_URL = Cypress.env('CUSTOMER_URL') || 'http://localhost:3002';

describe('Customer Center Accessibility', () => {
  
  describe('Public Pages', () => {
    const publicPages = [
      { path: '/login', name: 'Login' },
      { path: '/signup', name: 'Signup' },
      { path: '/forgot-password', name: 'Forgot Password' }
    ];

    publicPages.forEach(({ path, name }) => {
      it(`${name} page should be accessible`, () => {
        cy.visit(`${CUSTOMER_URL}${path}`);
        cy.injectAxe();
        cy.checkA11y(null, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }
        }, (violations) => {
          violations.forEach(v => cy.task('log', `a11y [${name}]: ${v.id} - ${v.description} (${v.impact})`));
        });
      });
    });
  });

  describe('Authenticated Pages', () => {
    beforeEach(() => {
      cy.loginAsCustomer();
    });

    const protectedPages = [
      { path: '/dashboard', name: 'Dashboard' },
      { path: '/settings', name: 'Settings' },
      { path: '/settings?tab=profile', name: 'Profile Tab' },
      { path: '/settings?tab=billing', name: 'Billing Tab' },
      { path: '/settings?tab=plans', name: 'Plans Tab' }
    ];

    protectedPages.forEach(({ path, name }) => {
      it(`${name} page should be accessible`, () => {
        cy.visit(`${CUSTOMER_URL}${path}`);
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

  describe('Form Accessibility', () => {
    it('signup form inputs have proper labels', () => {
      cy.visit(`${CUSTOMER_URL}/signup`);
      cy.get('input:not([type="hidden"])').each(($input) => {
        const hasLabel = $input.attr('aria-label') || 
          $input.attr('placeholder') ||
          $input.closest('.ant-form-item, [class*="form-group"]').find('label').length > 0;
        expect(hasLabel).to.be.true;
      });
    });

    it('login form inputs have proper labels', () => {
      cy.visit(`${CUSTOMER_URL}/login`);
      cy.get('input:not([type="hidden"])').each(($input) => {
        const hasLabel = $input.attr('aria-label') || 
          $input.attr('placeholder') ||
          $input.closest('.ant-form-item, [class*="form-group"]').find('label').length > 0;
        expect(hasLabel).to.be.true;
      });
    });
  });

  describe('Color Contrast', () => {
    it('login page meets contrast requirements', () => {
      cy.visit(`${CUSTOMER_URL}/login`);
      cy.injectAxe();
      cy.checkA11y(null, {
        runOnly: { type: 'rule', values: ['color-contrast'] }
      }, (violations) => {
        violations.forEach(v => cy.task('log', `contrast: ${v.nodes.length} element(s) fail`));
      });
    });
  });
});
