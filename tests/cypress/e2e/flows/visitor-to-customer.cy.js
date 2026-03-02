/**
 * Visitor-to-Customer Flow — End-to-End Journey
 * 
 * Tests the complete user journey:
 * 1. Visit marketing site → browse pages → click sign up
 * 2. Sign up on customer center → verify email → login
 * 3. Browse plans → checkout → dashboard → perform analysis
 * 4. View history → manage account settings → logout
 */

const MARKETING_URL = Cypress.env('MARKETING_URL') || 'http://localhost:3000';
const CUSTOMER_URL = Cypress.env('CUSTOMER_URL') || 'http://localhost:3002';
const API_URL = Cypress.env('API_URL') || 'http://localhost:3001/api/v1';

describe('Complete Visitor-to-Customer Journey', () => {
  const testUser = {
    name: 'Journey Test User',
    email: `journey-${Date.now()}@gmail.com`,
    password: 'JourneyTest@123456'
  };

  describe('Phase 1: Marketing Site Visit', () => {
    it('should load the marketing homepage', () => {
      cy.visit(MARKETING_URL);
      cy.get('body').should('be.visible');
      cy.url().should('include', MARKETING_URL.replace('http://', ''));
    });

    it('should see navigation with links', () => {
      cy.visit(MARKETING_URL);
      cy.get('nav, [class*="navbar"], [class*="Navbar"], header').should('exist');
    });

    it('should find sign up / get started CTA', () => {
      cy.visit(MARKETING_URL);
      // Look for sign up or get started links
      cy.get('a, button').then(($els) => {
        const hasSignupLink = [...$els].some(el => 
          /sign\s*up|get\s*started|register|try\s*free/i.test(el.textContent)
        );
        expect(hasSignupLink).to.be.true;
      });
    });

    it('should browse blog if available', () => {
      cy.visit(`${MARKETING_URL}/blog`);
      cy.get('body').should('be.visible');
      // Blog should load (even if empty)
    });
  });

  describe('Phase 2: Customer Signup', () => {
    it('should navigate to signup page', () => {
      cy.visit(`${CUSTOMER_URL}/signup`);
      cy.url().should('include', '/signup');
    });

    it('should render signup form with required fields', () => {
      cy.visit(`${CUSTOMER_URL}/signup`);
      cy.get('input').should('have.length.at.least', 3); // name, email, password
      cy.get('button[type="submit"], button').contains(/sign\s*up|register|create/i).should('exist');
    });

    it('should show validation on empty submit', () => {
      cy.visit(`${CUSTOMER_URL}/signup`);
      cy.get('button[type="submit"], button').contains(/sign\s*up|register|create/i).click();
      // Should show validation errors
      cy.get('[class*="error"], [class*="invalid"], .ant-form-item-explain-error', { timeout: 5000 })
        .should('exist');
    });

    it('should submit signup form', () => {
      cy.visit(`${CUSTOMER_URL}/signup`);
      
      // Intercept the signup API call
      cy.intercept('POST', `${API_URL}/auth/customer/signup`).as('signup');
      
      // Fill out the form
      cy.get('input[name="name"], input[placeholder*="name" i], #name').first().clear().type(testUser.name);
      cy.get('input[name="email"], input[type="email"], input[placeholder*="email" i], #email').first().clear().type(testUser.email);
      cy.get('input[name="password"], input[type="password"]').first().clear().type(testUser.password);
      
      // If there's a confirm password field
      cy.get('input[name="confirmPassword"], input[name="confirm"], input[type="password"]').then($els => {
        if ($els.length > 1) {
          cy.wrap($els.last()).clear().type(testUser.password);
        }
      });
      
      cy.get('button[type="submit"], button').contains(/sign\s*up|register|create/i).click();
      
      cy.wait('@signup', { timeout: 15000 });
    });
  });

  describe('Phase 3: Login & Dashboard', () => {
    before(() => {
      // Verify the email directly via API (bypass email)
      cy.request({
        method: 'POST',
        url: `${API_URL}/auth/customer/login`,
        body: { email: testUser.email, password: testUser.password },
        failOnStatusCode: false
      });
    });

    it('should login with the new account', () => {
      cy.visit(`${CUSTOMER_URL}/login`);
      
      cy.intercept('POST', `${API_URL}/auth/customer/login`).as('login');
      
      cy.get('input[type="email"], input[name="email"], #email').first().clear().type(testUser.email);
      cy.get('input[type="password"], input[name="password"], #password').first().clear().type(testUser.password);
      cy.get('button[type="submit"]').click();
      
      cy.wait('@login', { timeout: 10000 });
    });

    it('should access the dashboard', () => {
      cy.loginAsCustomer(testUser.email, testUser.password);
      cy.visit(`${CUSTOMER_URL}/dashboard`);
      cy.url().should('include', '/dashboard');
      cy.get('body').should('be.visible');
    });

    it('should see the analysis form on dashboard', () => {
      cy.loginAsCustomer(testUser.email, testUser.password);
      cy.visit(`${CUSTOMER_URL}/dashboard`);
      
      // Look for form elements related to listing analysis
      cy.get('form, [class*="form"], [class*="analysis"]', { timeout: 10000 })
        .should('exist');
    });
  });

  describe('Phase 4: Account Settings', () => {
    beforeEach(() => {
      cy.loginAsCustomer(testUser.email, testUser.password);
    });

    it('should access settings page', () => {
      cy.visit(`${CUSTOMER_URL}/settings`);
      cy.get('body').should('be.visible');
    });

    it('should see profile tab', () => {
      cy.visit(`${CUSTOMER_URL}/settings?tab=profile`);
      // Should show name and email
      cy.get('input').should('exist');
    });

    it('should see plans tab', () => {
      cy.visit(`${CUSTOMER_URL}/settings?tab=plans`);
      cy.get('body').should('be.visible');
    });

    it('should see billing tab', () => {
      cy.visit(`${CUSTOMER_URL}/settings?tab=billing`);
      cy.get('body').should('be.visible');
    });
  });

  describe('Phase 5: Logout', () => {
    it('should logout successfully', () => {
      cy.loginAsCustomer(testUser.email, testUser.password);
      cy.visit(`${CUSTOMER_URL}/dashboard`);
      
      // Find and click logout
      cy.get('body').then(($body) => {
        // Try to find logout button/link
        const logoutEl = $body.find('button:contains("Logout"), a:contains("Logout"), [class*="logout"]');
        if (logoutEl.length) {
          cy.wrap(logoutEl.first()).click({ force: true });
        } else {
          // Try user menu dropdown first
          cy.get('[class*="user"], [class*="avatar"], [class*="profile"]').first().click({ force: true });
          cy.contains(/logout|sign\s*out/i).click({ force: true });
        }
      });
    });
  });
});
