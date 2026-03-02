const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    // Default base URL (marketing site)
    baseUrl: 'http://localhost:3000',
    
    // Spec file patterns
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    fixturesFolder: 'cypress/fixtures',
    
    // Screenshots & videos
    screenshotsFolder: 'cypress/screenshots',
    videosFolder: 'cypress/videos',
    video: true,
    screenshotOnRunFailure: true,
    
    // Timeouts
    defaultCommandTimeout: 10000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    pageLoadTimeout: 30000,
    
    // Viewport (desktop default)
    viewportWidth: 1280,
    viewportHeight: 720,
    
    // Retries
    retries: {
      runMode: 2,
      openMode: 0
    },
    
    // Environment variables for app URLs
    env: {
      MARKETING_URL: 'http://localhost:3000',
      BACKEND_URL: 'http://localhost:3001',
      CUSTOMER_URL: 'http://localhost:3002',
      ADMIN_URL: 'http://localhost:3003',
      API_URL: 'http://localhost:3001/api/v1',
      
      // Test credentials (seeded via backend)
      ADMIN_EMAIL: 'superadmin@test.com',
      ADMIN_PASSWORD: 'Admin@123456',
      CUSTOMER_EMAIL: 'testcustomer@test.com',
      CUSTOMER_PASSWORD: 'Customer@123456'
    },
    
    // Don't fail on uncaught exceptions from app code
    setupNodeEvents(on, config) {
      on('task', {
        log(message) {
          console.log(message);
          return null;
        }
      });
      return config;
    },
    
    // Experimental features
    experimentalRunAllSpecs: true
  }
});
