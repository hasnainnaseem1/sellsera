// ***********************************************************
// Cypress E2E Support File
// Loaded before every spec file.
// ***********************************************************

import './commands';

// Prevent Cypress from failing on uncaught exceptions from the app
Cypress.on('uncaught:exception', (err, runnable) => {
  // Ignore React hydration errors, chunk load failures, etc.
  if (
    err.message.includes('ResizeObserver') ||
    err.message.includes('Loading chunk') ||
    err.message.includes('hydrat')
  ) {
    return false;
  }
  // Let other errors fail the test
  return true;
});

// Import cypress-axe for accessibility testing
import 'cypress-axe';

// Log test name before each test
beforeEach(() => {
  cy.task('log', `Running: ${Cypress.currentTest.titlePath.join(' > ')}`);
});
