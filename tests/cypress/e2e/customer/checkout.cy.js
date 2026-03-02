const CUSTOMER_URL = Cypress.env('CUSTOMER_URL') || 'http://localhost:3002';

describe('Customer Checkout', () => {

  describe('Checkout Success Page (/checkout/success)', () => {
    beforeEach(() => {
      cy.intercept('GET', '**/api/v1/auth/me', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            id: 'user-123',
            name: 'Test User',
            email: 'test@example.com',
            emailVerified: true,
            plan: 'pro',
            role: 'user'
          }
        }
      }).as('getMe');
    });

    it('should render the checkout success page', () => {
      cy.visit(CUSTOMER_URL + '/checkout/success', {
        onBeforeLoad(win) {
          win.localStorage.setItem('token', 'fake-jwt-token');
        },
        failOnStatusCode: false
      });
      cy.get('body').should('be.visible');
      cy.url().should('include', '/checkout/success');
    });

    it('should show success message and receipt info', () => {
      cy.visit(CUSTOMER_URL + '/checkout/success', {
        onBeforeLoad(win) {
          win.localStorage.setItem('token', 'fake-jwt-token');
        },
        failOnStatusCode: false
      });
      cy.get('body').then($body => {
        const text = $body.text().toLowerCase();
        expect(
          text.includes('success') ||
          text.includes('thank you') ||
          text.includes('payment') ||
          text.includes('confirmed') ||
          text.includes('complete') ||
          text.includes('receipt')
        ).to.be.true;
      });
    });

    it('should have a link to dashboard or billing', () => {
      cy.visit(CUSTOMER_URL + '/checkout/success', {
        onBeforeLoad(win) {
          win.localStorage.setItem('token', 'fake-jwt-token');
        },
        failOnStatusCode: false
      });
      cy.get('a, button').then($elements => {
        const navLink = $elements.filter((i, el) => {
          const text = el.textContent.toLowerCase();
          const href = (el.getAttribute('href') || '').toLowerCase();
          return text.includes('dashboard') || text.includes('billing') ||
                 text.includes('go to') || text.includes('continue') ||
                 href.includes('dashboard') || href.includes('billing');
        });
        expect(navLink.length).to.be.greaterThan(0);
      });
    });
  });

  describe('Checkout Cancel Page (/checkout/cancel)', () => {
    beforeEach(() => {
      cy.intercept('GET', '**/api/v1/auth/me', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            id: 'user-123',
            name: 'Test User',
            email: 'test@example.com',
            emailVerified: true,
            plan: 'free',
            role: 'user'
          }
        }
      }).as('getMe');
    });

    it('should render the checkout cancel page', () => {
      cy.visit(CUSTOMER_URL + '/checkout/cancel', {
        onBeforeLoad(win) {
          win.localStorage.setItem('token', 'fake-jwt-token');
        },
        failOnStatusCode: false
      });
      cy.get('body').should('be.visible');
      cy.url().should('include', '/checkout/cancel');
    });

    it('should show cancellation message', () => {
      cy.visit(CUSTOMER_URL + '/checkout/cancel', {
        onBeforeLoad(win) {
          win.localStorage.setItem('token', 'fake-jwt-token');
        },
        failOnStatusCode: false
      });
      cy.get('body').then($body => {
        const text = $body.text().toLowerCase();
        expect(
          text.includes('cancel') ||
          text.includes('cancelled') ||
          text.includes('not completed') ||
          text.includes('did not complete') ||
          text.includes('try again') ||
          text.includes('payment was not')
        ).to.be.true;
      });
    });

    it('should have a link to plans page', () => {
      cy.visit(CUSTOMER_URL + '/checkout/cancel', {
        onBeforeLoad(win) {
          win.localStorage.setItem('token', 'fake-jwt-token');
        },
        failOnStatusCode: false
      });
      cy.get('a, button').then($elements => {
        const plansLink = $elements.filter((i, el) => {
          const text = el.textContent.toLowerCase();
          const href = (el.getAttribute('href') || '').toLowerCase();
          return text.includes('plan') || text.includes('pricing') ||
                 text.includes('try again') || text.includes('go back') ||
                 href.includes('plan') || href.includes('pricing') || href.includes('settings');
        });
        expect(plansLink.length).to.be.greaterThan(0);
      });
    });
  });
});
