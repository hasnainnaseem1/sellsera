// ***********************************************************
// Custom Cypress Commands
// Reusable actions for authentication, navigation, API calls
// ***********************************************************

const API_URL = Cypress.env('API_URL') || 'http://localhost:3001/api/v1';
const ADMIN_URL = Cypress.env('ADMIN_URL') || 'http://localhost:3003';
const CUSTOMER_URL = Cypress.env('CUSTOMER_URL') || 'http://localhost:3002';
const MARKETING_URL = Cypress.env('MARKETING_URL') || 'http://localhost:3000';

// ─── Authentication Commands ───────────────────────────────

/**
 * Login as admin via API and store token
 */
Cypress.Commands.add('loginAsAdmin', (email, password) => {
  const adminEmail = email || Cypress.env('ADMIN_EMAIL');
  const adminPassword = password || Cypress.env('ADMIN_PASSWORD');
  
  cy.request({
    method: 'POST',
    url: `${API_URL}/auth/admin/login`,
    body: { email: adminEmail, password: adminPassword },
    failOnStatusCode: false
  }).then((res) => {
    if (res.status === 200 && res.body.success) {
      const token = res.body.token || res.body.data?.token;
      if (token) {
        window.localStorage.setItem('adminToken', token);
        window.localStorage.setItem('token', token);
      }
    }
  });
});

/**
 * Login as customer via API and store token
 */
Cypress.Commands.add('loginAsCustomer', (email, password) => {
  const custEmail = email || Cypress.env('CUSTOMER_EMAIL');
  const custPassword = password || Cypress.env('CUSTOMER_PASSWORD');
  
  cy.request({
    method: 'POST',
    url: `${API_URL}/auth/customer/login`,
    body: { email: custEmail, password: custPassword },
    failOnStatusCode: false
  }).then((res) => {
    if (res.status === 200 && res.body.success) {
      const token = res.body.token || res.body.data?.token;
      if (token) {
        window.localStorage.setItem('token', token);
        window.localStorage.setItem('customerToken', token);
      }
    }
  });
});

/**
 * Login as admin via UI (admin center login page)
 */
Cypress.Commands.add('adminUILogin', (email, password) => {
  const adminEmail = email || Cypress.env('ADMIN_EMAIL');
  const adminPassword = password || Cypress.env('ADMIN_PASSWORD');
  
  cy.visit(`${ADMIN_URL}/login`);
  cy.get('input[type="email"], input[name="email"], #email').clear().type(adminEmail);
  cy.get('input[type="password"], input[name="password"], #password').clear().type(adminPassword);
  cy.get('button[type="submit"], .login-button, .ant-btn-primary').click();
  cy.url().should('not.include', '/login');
});

/**
 * Login as customer via UI (customer center login page)
 */
Cypress.Commands.add('customerUILogin', (email, password) => {
  const custEmail = email || Cypress.env('CUSTOMER_EMAIL');
  const custPassword = password || Cypress.env('CUSTOMER_PASSWORD');
  
  cy.visit(`${CUSTOMER_URL}/login`);
  cy.get('input[type="email"], input[name="email"], #email').clear().type(custEmail);
  cy.get('input[type="password"], input[name="password"], #password').clear().type(custPassword);
  cy.get('button[type="submit"], .login-button, .ant-btn-primary').click();
  cy.url().should('not.include', '/login');
});

/**
 * Logout (clear tokens)
 */
Cypress.Commands.add('logout', () => {
  window.localStorage.removeItem('token');
  window.localStorage.removeItem('adminToken');
  window.localStorage.removeItem('customerToken');
});

// ─── Navigation Commands ───────────────────────────────────

/**
 * Visit admin panel
 */
Cypress.Commands.add('visitAdmin', (path = '/') => {
  cy.visit(`${ADMIN_URL}${path}`);
});

/**
 * Visit customer center
 */
Cypress.Commands.add('visitCustomer', (path = '/') => {
  cy.visit(`${CUSTOMER_URL}${path}`);
});

/**
 * Visit marketing site
 */
Cypress.Commands.add('visitMarketing', (path = '/') => {
  cy.visit(`${MARKETING_URL}${path}`);
});

// ─── API Utility Commands ──────────────────────────────────

/**
 * Make authenticated API request as admin
 */
Cypress.Commands.add('apiAsAdmin', (method, url, body) => {
  const token = window.localStorage.getItem('adminToken') || window.localStorage.getItem('token');
  return cy.request({
    method,
    url: `${API_URL}${url}`,
    body,
    headers: { Authorization: `Bearer ${token}` },
    failOnStatusCode: false
  });
});

/**
 * Make authenticated API request as customer
 */
Cypress.Commands.add('apiAsCustomer', (method, url, body) => {
  const token = window.localStorage.getItem('customerToken') || window.localStorage.getItem('token');
  return cy.request({
    method,
    url: `${API_URL}${url}`,
    body,
    headers: { Authorization: `Bearer ${token}` },
    failOnStatusCode: false
  });
});

/**
 * Make unauthenticated API request
 */
Cypress.Commands.add('apiPublic', (method, url, body) => {
  return cy.request({
    method,
    url: `${API_URL}${url}`,
    body,
    failOnStatusCode: false
  });
});

// ─── UI Assertion Commands ─────────────────────────────────

/**
 * Check page title exists
 */
Cypress.Commands.add('hasPageTitle', (text) => {
  cy.get('h1, h2, .page-title, .ant-page-header-heading-title').should('exist');
  if (text) {
    cy.get('h1, h2, .page-title, .ant-page-header-heading-title').should('contain', text);
  }
});

/**
 * Check for loading state then content
 */
Cypress.Commands.add('waitForContent', () => {
  // Wait for any loading spinners to disappear
  cy.get('.ant-spin, .loading, [data-testid="loading"]', { timeout: 15000 }).should('not.exist');
});

/**
 * Check table has rows
 */
Cypress.Commands.add('tableHasRows', (minRows = 1) => {
  cy.get('.ant-table-tbody tr, table tbody tr, [class*="table"] [class*="row"]')
    .should('have.length.at.least', minRows);
});

/**
 * Fill Ant Design form field
 */
Cypress.Commands.add('antdInput', (label, value) => {
  cy.contains('label, .ant-form-item-label', label)
    .parent()
    .find('input, textarea')
    .clear()
    .type(value);
});

/**
 * Click Ant Design menu item
 */
Cypress.Commands.add('clickMenuItem', (text) => {
  cy.get('.ant-menu-item, .ant-menu-submenu-title').contains(text).click();
});

/**
 * Check for success notification/message
 */
Cypress.Commands.add('hasSuccessMessage', () => {
  cy.get('.ant-message-success, .ant-notification-notice, .Toastify__toast--success, [class*="success"]', { timeout: 10000 })
    .should('exist');
});

/**
 * Check for error notification/message
 */
Cypress.Commands.add('hasErrorMessage', () => {
  cy.get('.ant-message-error, .ant-notification-notice-error, .Toastify__toast--error, [class*="error"]', { timeout: 10000 })
    .should('exist');
});

// ─── Responsive Testing Commands ───────────────────────────

/**
 * Test at different viewport sizes
 */
Cypress.Commands.add('testResponsive', (callback) => {
  const viewports = [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 720 },
    { name: 'wide', width: 1920, height: 1080 }
  ];
  
  viewports.forEach(({ name, width, height }) => {
    cy.viewport(width, height);
    callback(name, width, height);
  });
});

// ─── Accessibility Commands ────────────────────────────────

/**
 * Run axe accessibility check on current page
 */
Cypress.Commands.add('checkAccessibility', (context, options) => {
  cy.injectAxe();
  cy.checkA11y(context || null, options || {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa']
    }
  }, (violations) => {
    if (violations.length) {
      cy.task('log', `${violations.length} accessibility violation(s) found:`);
      violations.forEach((v) => {
        cy.task('log', `  - ${v.id}: ${v.description} (${v.impact}) [${v.nodes.length} node(s)]`);
      });
    }
  });
});

// ─── Performance Commands ──────────────────────────────────

/**
 * Check page load time
 */
Cypress.Commands.add('checkLoadTime', (maxMs = 5000) => {
  cy.window().then((win) => {
    const timing = win.performance.timing;
    const loadTime = timing.loadEventEnd - timing.navigationStart;
    expect(loadTime).to.be.lessThan(maxMs);
    cy.task('log', `Page load time: ${loadTime}ms (max: ${maxMs}ms)`);
  });
});
