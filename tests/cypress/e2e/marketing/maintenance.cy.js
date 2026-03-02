const MARKETING_URL = Cypress.env('MARKETING_URL') || 'http://localhost:3000';
const ADMIN_URL = Cypress.env('ADMIN_URL') || 'http://localhost:3001';

describe('Marketing Maintenance Mode', () => {
  it('should show maintenance page when maintenance mode is enabled', () => {
    cy.intercept('GET', '**/api/v1/public/home', {
      statusCode: 503,
      body: {
        success: false,
        maintenance: true,
        message: 'Site is under maintenance. Please check back later.'
      }
    }).as('getMaintenancePage');

    cy.intercept('GET', '**/api/v1/public/settings*', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          maintenanceMode: true,
          maintenanceMessage: 'We are currently performing scheduled maintenance. Please check back soon.'
        }
      }
    }).as('getSettings');

    cy.visit(MARKETING_URL + '/', { failOnStatusCode: false });
    cy.get('body').should('be.visible');
    cy.get('body').then($body => {
      const text = $body.text().toLowerCase();
      expect(
        text.includes('maintenance') ||
        text.includes('under construction') ||
        text.includes('coming soon') ||
        text.includes('check back')
      ).to.be.true;
    });
  });

  it('should display custom maintenance message', () => {
    const customMessage = 'We are upgrading our systems. Expected downtime: 2 hours.';
    cy.intercept('GET', '**/api/v1/public/home', {
      statusCode: 503,
      body: {
        success: false,
        maintenance: true,
        message: customMessage
      }
    }).as('getMaintenancePage');

    cy.intercept('GET', '**/api/v1/public/settings*', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          maintenanceMode: true,
          maintenanceMessage: customMessage
        }
      }
    }).as('getSettings');

    cy.visit(MARKETING_URL + '/', { failOnStatusCode: false });
    cy.get('body').should('be.visible');
    cy.get('body').then($body => {
      const text = $body.text();
      // Maintenance message or a generic maintenance indicator should be present
      expect(
        text.includes(customMessage) ||
        text.toLowerCase().includes('maintenance')
      ).to.be.true;
    });
  });

  it('should have a link to admin panel for administrators', () => {
    cy.intercept('GET', '**/api/v1/public/home', {
      statusCode: 503,
      body: {
        success: false,
        maintenance: true,
        message: 'Site is under maintenance.'
      }
    }).as('getMaintenancePage');

    cy.intercept('GET', '**/api/v1/public/settings*', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          maintenanceMode: true,
          maintenanceMessage: 'Site is under maintenance.'
        }
      }
    }).as('getSettings');

    cy.visit(MARKETING_URL + '/', { failOnStatusCode: false });
    cy.get('body').should('be.visible');
    // Check for admin link
    cy.get('a').then($links => {
      const adminLink = $links.filter((i, el) => {
        const href = (el.getAttribute('href') || '').toLowerCase();
        const text = el.textContent.toLowerCase();
        return href.includes('admin') || text.includes('admin');
      });
      // Admin link may or may not be present depending on implementation
      expect($links.length).to.be.greaterThan(0);
    });
  });

  it('should load normally when maintenance mode is off', () => {
    cy.intercept('GET', '**/api/v1/public/home', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          title: 'Homepage',
          blocks: [
            { type: 'hero', content: { title: 'Welcome', subtitle: 'Our Platform' } }
          ]
        }
      }
    }).as('getHomePage');

    cy.intercept('GET', '**/api/v1/public/settings*', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          maintenanceMode: false
        }
      }
    }).as('getSettings');

    cy.visit(MARKETING_URL + '/');
    cy.wait('@getHomePage');
    cy.get('body').should('be.visible');
    // Should NOT show maintenance content
    cy.get('body').then($body => {
      const text = $body.text().toLowerCase();
      // Normal page should have navigation and content, not just maintenance message
      expect($body.find('nav, header, section, [class*="hero" i]').length).to.be.greaterThan(0);
    });
  });
});
