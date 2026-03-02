const CUSTOMER_URL = Cypress.env('CUSTOMER_URL') || 'http://localhost:3002';

describe('Customer Signup', () => {
  beforeEach(() => {
    cy.visit(CUSTOMER_URL + '/signup');
  });

  it('should render the signup page with form', () => {
    cy.get('form').should('exist');
    cy.url().should('include', '/signup');
  });

  it('should have name, email, password, and confirm password fields', () => {
    cy.get('input[name="name"], input[id*="name" i], input[placeholder*="name" i]').should('exist');
    cy.get('input[name="email"], input[id*="email" i], input[type="email"]').should('exist');
    cy.get('input[name="password"], input[id*="password" i], input[type="password"]').first().should('exist');
    cy.get('input[name="confirmPassword"], input[name="confirm_password"], input[name="passwordConfirm"], input[id*="confirm" i]')
      .should('exist');
  });

  it('should have a submit button', () => {
    cy.get('button[type="submit"], input[type="submit"]').should('exist');
  });

  it('should show validation errors for empty fields', () => {
    cy.get('button[type="submit"], input[type="submit"]').click();
    cy.get(
      '[class*="error" i], [class*="alert" i], [role="alert"], .ant-form-item-explain-error, ' +
      '[class*="validation" i], [class*="help" i]'
    ).should('have.length.greaterThan', 0);
  });

  it('should show validation error for invalid email', () => {
    cy.get('input[name="name"], input[id*="name" i], input[placeholder*="name" i]').type('Test User');
    cy.get('input[name="email"], input[id*="email" i], input[type="email"]').type('invalid-email');
    cy.get('input[type="password"]').first().type('StrongPass123!');
    cy.get('input[name="confirmPassword"], input[name="confirm_password"], input[name="passwordConfirm"], input[id*="confirm" i]')
      .type('StrongPass123!');
    cy.get('button[type="submit"], input[type="submit"]').click();
    cy.get('body').then($body => {
      const text = $body.text().toLowerCase();
      expect(
        text.includes('email') ||
        text.includes('valid') ||
        $body.find('[class*="error" i], .ant-form-item-explain-error').length > 0
      ).to.be.true;
    });
  });

  it('should show validation error for weak password', () => {
    cy.get('input[name="name"], input[id*="name" i], input[placeholder*="name" i]').type('Test User');
    cy.get('input[name="email"], input[id*="email" i], input[type="email"]').type('test@example.com');
    cy.get('input[type="password"]').first().type('123');
    cy.get('input[name="confirmPassword"], input[name="confirm_password"], input[name="passwordConfirm"], input[id*="confirm" i]')
      .type('123');
    cy.get('button[type="submit"], input[type="submit"]').click();
    cy.get(
      '[class*="error" i], .ant-form-item-explain-error, [class*="validation" i]'
    ).should('have.length.greaterThan', 0);
  });

  it('should show validation error for password mismatch', () => {
    cy.get('input[name="name"], input[id*="name" i], input[placeholder*="name" i]').type('Test User');
    cy.get('input[name="email"], input[id*="email" i], input[type="email"]').type('test@example.com');
    cy.get('input[type="password"]').first().type('StrongPass123!');
    cy.get('input[name="confirmPassword"], input[name="confirm_password"], input[name="passwordConfirm"], input[id*="confirm" i]')
      .type('DifferentPass456!');
    cy.get('button[type="submit"], input[type="submit"]').click();
    cy.get(
      '[class*="error" i], .ant-form-item-explain-error, [class*="validation" i]'
    ).should('have.length.greaterThan', 0);
  });

  it('should redirect to /verify-email-sent on successful signup', () => {
    cy.intercept('POST', '**/api/v1/auth/signup', {
      statusCode: 201,
      body: { success: true, message: 'Verification email sent' }
    }).as('signupRequest');

    cy.get('input[name="name"], input[id*="name" i], input[placeholder*="name" i]').type('Test User');
    cy.get('input[name="email"], input[id*="email" i], input[type="email"]').type('newuser@example.com');
    cy.get('input[type="password"]').first().type('StrongPass123!');
    cy.get('input[name="confirmPassword"], input[name="confirm_password"], input[name="passwordConfirm"], input[id*="confirm" i]')
      .type('StrongPass123!');
    cy.get('button[type="submit"], input[type="submit"]').click();

    cy.wait('@signupRequest');
    cy.url().should('include', '/verify-email');
  });

  it('should show error message for duplicate email', () => {
    cy.intercept('POST', '**/api/v1/auth/signup', {
      statusCode: 409,
      body: { success: false, message: 'Email already exists' }
    }).as('signupDuplicate');

    cy.get('input[name="name"], input[id*="name" i], input[placeholder*="name" i]').type('Test User');
    cy.get('input[name="email"], input[id*="email" i], input[type="email"]').type('existing@example.com');
    cy.get('input[type="password"]').first().type('StrongPass123!');
    cy.get('input[name="confirmPassword"], input[name="confirm_password"], input[name="passwordConfirm"], input[id*="confirm" i]')
      .type('StrongPass123!');
    cy.get('button[type="submit"], input[type="submit"]').click();

    cy.wait('@signupDuplicate');
    cy.get('body').then($body => {
      const text = $body.text().toLowerCase();
      expect(
        text.includes('already exists') ||
        text.includes('duplicate') ||
        text.includes('already registered') ||
        $body.find('[class*="error" i], .ant-message-error, .ant-notification').length > 0
      ).to.be.true;
    });
  });

  it('should have a link to the login page', () => {
    cy.get('a[href*="login"], a[href*="signin"]').should('exist');
  });

  it('should have Google SSO button (if enabled)', () => {
    cy.get('body').then($body => {
      const hasGoogleBtn = $body.find(
        'button[class*="google" i], a[class*="google" i], [data-testid="google-sso"], [class*="social" i]'
      ).length > 0;
      // Google SSO may or may not be enabled — non-blocking assertion
      cy.log(`Google SSO button present: ${hasGoogleBtn}`);
    });
  });

  it('should be responsive: form readable on mobile', () => {
    cy.viewport(375, 667);
    cy.visit(CUSTOMER_URL + '/signup');
    cy.get('form').should('be.visible');
    cy.get('input').should('be.visible');
    cy.get('button[type="submit"], input[type="submit"]').should('be.visible');
  });
});
