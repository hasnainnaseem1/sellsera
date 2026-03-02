const CUSTOMER_URL = Cypress.env('CUSTOMER_URL') || 'http://localhost:3002';

describe('Customer Login', () => {
  beforeEach(() => {
    cy.visit(CUSTOMER_URL + '/login');
  });

  it('should render the login page with form', () => {
    cy.get('form').should('exist');
    cy.url().should('include', '/login');
  });

  it('should have email and password inputs', () => {
    cy.get('input[name="email"], input[id*="email" i], input[type="email"]').should('exist');
    cy.get('input[name="password"], input[id*="password" i], input[type="password"]').should('exist');
  });

  it('should have a submit button', () => {
    cy.get('button[type="submit"], input[type="submit"]').should('exist');
  });

  it('should show validation errors on empty submit', () => {
    cy.get('button[type="submit"], input[type="submit"]').click();
    cy.get(
      '[class*="error" i], [role="alert"], .ant-form-item-explain-error, ' +
      '[class*="validation" i], [class*="help" i]'
    ).should('have.length.greaterThan', 0);
  });

  it('should show error on wrong credentials', () => {
    cy.intercept('POST', '**/api/v1/auth/login', {
      statusCode: 401,
      body: { success: false, message: 'Invalid email or password' }
    }).as('loginFailed');

    cy.get('input[name="email"], input[id*="email" i], input[type="email"]').type('wrong@example.com');
    cy.get('input[name="password"], input[id*="password" i], input[type="password"]').type('WrongPassword123!');
    cy.get('button[type="submit"], input[type="submit"]').click();

    cy.wait('@loginFailed');
    cy.get('body').then($body => {
      const text = $body.text().toLowerCase();
      expect(
        text.includes('invalid') ||
        text.includes('incorrect') ||
        text.includes('wrong') ||
        text.includes('error') ||
        $body.find('[class*="error" i], .ant-message-error, .ant-notification').length > 0
      ).to.be.true;
    });
  });

  it('should redirect to /dashboard on successful login', () => {
    cy.intercept('POST', '**/api/v1/auth/login', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          token: 'fake-jwt-token',
          user: { id: '1', name: 'Test User', email: 'test@example.com' }
        }
      }
    }).as('loginSuccess');

    cy.get('input[name="email"], input[id*="email" i], input[type="email"]').type('test@example.com');
    cy.get('input[name="password"], input[id*="password" i], input[type="password"]').type('StrongPass123!');
    cy.get('button[type="submit"], input[type="submit"]').click();

    cy.wait('@loginSuccess');
    cy.url().should('include', '/dashboard');
  });

  it('should have a "Forgot Password?" link to /forgot-password', () => {
    cy.get('a[href*="forgot"], a[href*="reset"]').should('exist');
    cy.get('a[href*="forgot"], a[href*="reset"]').then($link => {
      const href = $link.attr('href');
      expect(href).to.match(/forgot|reset/i);
    });
  });

  it('should have a "Sign Up" link to /signup', () => {
    cy.get('a[href*="signup"], a[href*="register"]').should('exist');
  });

  it('should have Google SSO button (if enabled)', () => {
    cy.get('body').then($body => {
      const hasGoogleBtn = $body.find(
        'button[class*="google" i], a[class*="google" i], [data-testid="google-sso"], [class*="social" i]'
      ).length > 0;
      cy.log(`Google SSO button present: ${hasGoogleBtn}`);
    });
  });

  it('should be responsive', () => {
    cy.viewport(375, 667);
    cy.visit(CUSTOMER_URL + '/login');
    cy.get('form').should('be.visible');
    cy.get('input').should('be.visible');
    cy.get('button[type="submit"], input[type="submit"]').should('be.visible');
  });
});
