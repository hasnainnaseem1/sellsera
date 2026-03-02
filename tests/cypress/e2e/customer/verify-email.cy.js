const CUSTOMER_URL = Cypress.env('CUSTOMER_URL') || 'http://localhost:3002';

describe('Customer Email Verification', () => {

  describe('Verify Email Sent Page (/verify-email-sent)', () => {
    beforeEach(() => {
      cy.visit(CUSTOMER_URL + '/verify-email-sent', { failOnStatusCode: false });
    });

    it('should show "check your email" message', () => {
      cy.get('body').should('be.visible');
      cy.get('body').then($body => {
        const text = $body.text().toLowerCase();
        expect(
          text.includes('check your email') ||
          text.includes('verification') ||
          text.includes('verify') ||
          text.includes('email sent') ||
          text.includes('confirm your email')
        ).to.be.true;
      });
    });

    it('should have a resend verification email button', () => {
      cy.get(
        'button, a'
      ).then($elements => {
        const resendBtn = $elements.filter((i, el) => {
          const text = el.textContent.toLowerCase();
          return text.includes('resend') || text.includes('send again') || text.includes('re-send');
        });
        expect(resendBtn.length).to.be.greaterThan(0);
      });
    });

    it('should resend verification email when button is clicked', () => {
      cy.intercept('POST', '**/api/v1/auth/resend-verification*', {
        statusCode: 200,
        body: { success: true, message: 'Verification email resent' }
      }).as('resendVerification');

      cy.get('button, a').then($elements => {
        const resendBtn = $elements.filter((i, el) => {
          const text = el.textContent.toLowerCase();
          return text.includes('resend') || text.includes('send again') || text.includes('re-send');
        });
        if (resendBtn.length > 0) {
          cy.wrap(resendBtn.first()).click();
          cy.wait('@resendVerification');
          cy.get('body').then($body => {
            const text = $body.text().toLowerCase();
            expect(
              text.includes('sent') ||
              text.includes('success') ||
              $body.find('.ant-message-success, [class*="success" i]').length > 0
            ).to.be.true;
          });
        }
      });
    });
  });

  describe('Verify Email Token Page (/verify-email/:token)', () => {
    it('should verify email with valid token and show success', () => {
      cy.intercept('GET', '**/api/v1/auth/verify-email/*', {
        statusCode: 200,
        body: { success: true, message: 'Email verified successfully' }
      }).as('verifyEmail');

      cy.intercept('POST', '**/api/v1/auth/verify-email/*', {
        statusCode: 200,
        body: { success: true, message: 'Email verified successfully' }
      }).as('verifyEmailPost');

      cy.visit(CUSTOMER_URL + '/verify-email/valid-test-token-123', { failOnStatusCode: false });
      cy.get('body').should('be.visible');
      cy.get('body').then($body => {
        const text = $body.text().toLowerCase();
        expect(
          text.includes('verified') ||
          text.includes('success') ||
          text.includes('confirmed') ||
          text.includes('login')
        ).to.be.true;
      });
    });

    it('should show error for invalid token', () => {
      cy.intercept('GET', '**/api/v1/auth/verify-email/*', {
        statusCode: 400,
        body: { success: false, message: 'Invalid or expired token' }
      }).as('verifyEmailFailed');

      cy.intercept('POST', '**/api/v1/auth/verify-email/*', {
        statusCode: 400,
        body: { success: false, message: 'Invalid or expired token' }
      }).as('verifyEmailFailedPost');

      cy.visit(CUSTOMER_URL + '/verify-email/invalid-token-xyz', { failOnStatusCode: false });
      cy.get('body').should('be.visible');
      cy.get('body').then($body => {
        const text = $body.text().toLowerCase();
        expect(
          text.includes('invalid') ||
          text.includes('expired') ||
          text.includes('error') ||
          text.includes('failed')
        ).to.be.true;
      });
    });

    it('should show appropriate message for already verified email', () => {
      cy.intercept('GET', '**/api/v1/auth/verify-email/*', {
        statusCode: 200,
        body: { success: true, message: 'Email already verified' }
      }).as('alreadyVerified');

      cy.intercept('POST', '**/api/v1/auth/verify-email/*', {
        statusCode: 200,
        body: { success: true, message: 'Email already verified' }
      }).as('alreadyVerifiedPost');

      cy.visit(CUSTOMER_URL + '/verify-email/already-verified-token', { failOnStatusCode: false });
      cy.get('body').should('be.visible');
      cy.get('body').then($body => {
        const text = $body.text().toLowerCase();
        expect(
          text.includes('already verified') ||
          text.includes('verified') ||
          text.includes('success') ||
          text.includes('login')
        ).to.be.true;
      });
    });
  });
});
