/// <reference types="cypress" />

describe('Admin Login Page', () => {
  const adminUrl = Cypress.env('ADMIN_URL') || 'http://localhost:3003';
  const apiUrl = Cypress.env('API_URL') || 'http://localhost:3001/api/v1';

  beforeEach(() => {
    cy.visit(`${adminUrl}/login`);
  });

  it('should render the login form', () => {
    cy.get('form').should('be.visible');
    cy.get('.ant-form').should('exist');
  });

  it('should have email and password inputs', () => {
    cy.get('input[type="email"], input[id*="email"], input[name="email"], input[placeholder*="email" i]')
      .should('be.visible');
    cy.get('input[type="password"], input[id*="password"], input[name="password"], input[placeholder*="password" i]')
      .should('be.visible');
  });

  it('should have a submit button', () => {
    cy.get('button[type="submit"], .ant-btn-primary')
      .should('be.visible')
      .and('contain.text', /log\s*in|sign\s*in|submit/i);
  });

  it('should show validation errors on empty submit', () => {
    cy.get('button[type="submit"], .ant-btn-primary').click();
    cy.get('.ant-form-item-explain-error, .ant-form-item-has-error')
      .should('be.visible');
  });

  it('should show error on wrong credentials', () => {
    cy.intercept('POST', `${apiUrl}/auth/login`).as('loginRequest');

    cy.get('input[type="email"], input[id*="email"], input[name="email"], input[placeholder*="email" i]')
      .type('wrong@example.com');
    cy.get('input[type="password"], input[id*="password"], input[name="password"], input[placeholder*="password" i]')
      .type('wrongpassword123');
    cy.get('button[type="submit"], .ant-btn-primary').click();

    cy.wait('@loginRequest');
    cy.get('.ant-message-error, .ant-alert-error, .ant-notification-notice-error, .ant-form-item-explain-error')
      .should('be.visible');
  });

  it('should redirect to dashboard on successful login', () => {
    cy.intercept('POST', `${apiUrl}/auth/login`, {
      statusCode: 200,
      body: {
        success: true,
        data: {
          token: 'fake-jwt-token',
          user: { id: '1', name: 'Admin', email: 'admin@test.com', role: 'super_admin' }
        }
      }
    }).as('loginRequest');

    cy.get('input[type="email"], input[id*="email"], input[name="email"], input[placeholder*="email" i]')
      .type('admin@test.com');
    cy.get('input[type="password"], input[id*="password"], input[name="password"], input[placeholder*="password" i]')
      .type('password123');
    cy.get('button[type="submit"], .ant-btn-primary').click();

    cy.wait('@loginRequest');
    cy.url().should('not.include', '/login');
  });

  it('should have a "Forgot Password?" link that navigates to /forgot-password', () => {
    cy.contains(/forgot\s*password/i).should('be.visible').click();
    cy.url().should('include', '/forgot-password');
  });

  it('should have the login form centered and styled', () => {
    cy.get('form, .ant-form').should('be.visible');
    cy.get('form, .ant-form').then(($form) => {
      const rect = $form[0].getBoundingClientRect();
      const windowWidth = Cypress.config('viewportWidth');
      const formCenter = rect.left + rect.width / 2;
      expect(formCenter).to.be.closeTo(windowWidth / 2, windowWidth * 0.2);
    });
  });

  it('should be responsive and readable on mobile (375px)', () => {
    cy.viewport(375, 667);
    cy.get('form, .ant-form').should('be.visible');
    cy.get('input[type="email"], input[id*="email"], input[name="email"], input[placeholder*="email" i]')
      .should('be.visible');
    cy.get('input[type="password"], input[id*="password"], input[name="password"], input[placeholder*="password" i]')
      .should('be.visible');
    cy.get('button[type="submit"], .ant-btn-primary').should('be.visible');
  });

  it('should display logo or branding on the login page', () => {
    cy.get('img[alt*="logo" i], .logo, [class*="logo"], [class*="brand"], h1, .ant-typography')
      .should('be.visible');
  });
});
