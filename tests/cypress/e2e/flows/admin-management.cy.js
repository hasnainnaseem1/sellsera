/**
 * Admin Management Flow — End-to-End Journey
 * 
 * Tests the complete admin workflow:
 * 1. Login to admin panel
 * 2. Check dashboard stats
 * 3. Manage users (CRUD)
 * 4. Manage plans and features
 * 5. Manage marketing content
 * 6. Review analytics
 * 7. Update settings
 * 8. Manage customers
 */

const ADMIN_URL = Cypress.env('ADMIN_URL') || 'http://localhost:3003';
const API_URL = Cypress.env('API_URL') || 'http://localhost:3001/api/v1';

describe('Admin Management Flow', () => {
  
  beforeEach(() => {
    cy.loginAsAdmin();
  });

  describe('Phase 1: Dashboard Overview', () => {
    it('should login and see dashboard', () => {
      cy.visit(`${ADMIN_URL}/`);
      cy.get('body').should('be.visible');
      // Dashboard should have stats or overview content
      cy.get('[class*="card"], [class*="stat"], [class*="dashboard"]', { timeout: 10000 })
        .should('exist');
    });

    it('should display sidebar navigation', () => {
      cy.visit(`${ADMIN_URL}/`);
      cy.get('[class*="sider"], [class*="sidebar"], nav, .ant-layout-sider', { timeout: 10000 })
        .should('exist');
    });

    it('should display header with user info', () => {
      cy.visit(`${ADMIN_URL}/`);
      cy.get('header, [class*="header"], .ant-layout-header').should('exist');
    });
  });

  describe('Phase 2: User Management', () => {
    it('should navigate to users page', () => {
      cy.visit(`${ADMIN_URL}/users`);
      cy.get('body').should('be.visible');
    });

    it('should display users table or list', () => {
      cy.visit(`${ADMIN_URL}/users`);
      cy.intercept('GET', `${API_URL}/admin/users*`).as('getUsers');
      cy.wait('@getUsers', { timeout: 15000 });
      cy.get('.ant-table, table, [class*="table"], [class*="list"]', { timeout: 10000 })
        .should('exist');
    });

    it('should have user CRUD actions available', () => {
      cy.visit(`${ADMIN_URL}/users`);
      // Create button should exist
      cy.get('button, a').then(($els) => {
        const hasCreate = [...$els].some(el => 
          /create|add|new/i.test(el.textContent)
        );
        expect(hasCreate).to.be.true;
      });
    });
  });

  describe('Phase 3: Plans & Features Management', () => {
    it('should navigate to plans page', () => {
      cy.visit(`${ADMIN_URL}/plans`);
      cy.get('body').should('be.visible');
      cy.intercept('GET', `${API_URL}/admin/plans*`).as('getPlans');
    });

    it('should navigate to features page', () => {
      cy.visit(`${ADMIN_URL}/features`);
      cy.get('body').should('be.visible');
    });

    it('plans page has create button', () => {
      cy.visit(`${ADMIN_URL}/plans`);
      cy.get('a[href*="/plans/new"], button').then(($els) => {
        const hasCreate = [...$els].some(el => 
          /create|add|new/i.test(el.textContent) || el.getAttribute('href')?.includes('/new')
        );
        expect(hasCreate).to.be.true;
      });
    });
  });

  describe('Phase 4: Marketing Content', () => {
    it('should navigate to marketing pages', () => {
      cy.visit(`${ADMIN_URL}/marketing/pages`);
      cy.get('body').should('be.visible');
    });

    it('should navigate to blog posts', () => {
      cy.visit(`${ADMIN_URL}/blog/posts`);
      cy.get('body').should('be.visible');
    });

    it('blog has create button', () => {
      cy.visit(`${ADMIN_URL}/blog/posts`);
      cy.get('a[href*="/blog/posts/new"], button').then(($els) => {
        const hasCreate = [...$els].some(el => 
          /create|add|new|write/i.test(el.textContent) || el.getAttribute('href')?.includes('/new')
        );
        expect(hasCreate).to.be.true;
      });
    });
  });

  describe('Phase 5: Analytics Review', () => {
    it('should navigate to analytics page', () => {
      cy.visit(`${ADMIN_URL}/analytics`);
      cy.get('body').should('be.visible');
    });

    it('analytics page has charts or stats', () => {
      cy.visit(`${ADMIN_URL}/analytics`);
      cy.intercept('GET', `${API_URL}/admin/analytics/*`).as('analyticsApi');
      // Should have some visual elements
      cy.get('canvas, svg, [class*="chart"], [class*="stat"], [class*="card"]', { timeout: 15000 })
        .should('exist');
    });
  });

  describe('Phase 6: Settings Management', () => {
    it('should navigate to settings page', () => {
      cy.visit(`${ADMIN_URL}/settings`);
      cy.get('body').should('be.visible');
    });

    it('settings page has form sections', () => {
      cy.visit(`${ADMIN_URL}/settings`);
      cy.get('.ant-tabs, .ant-card, [class*="tab"], [class*="section"], form', { timeout: 10000 })
        .should('exist');
    });

    it('should navigate to SEO settings', () => {
      cy.visit(`${ADMIN_URL}/seo/settings`);
      cy.get('body').should('be.visible');
    });
  });

  describe('Phase 7: Customer Management', () => {
    it('should navigate to customers page', () => {
      cy.visit(`${ADMIN_URL}/customers`);
      cy.get('body').should('be.visible');
    });

    it('customers page shows table', () => {
      cy.visit(`${ADMIN_URL}/customers`);
      cy.intercept('GET', `${API_URL}/admin/customers*`).as('getCustomers');
      cy.wait('@getCustomers', { timeout: 15000 });
      cy.get('.ant-table, table, [class*="table"]', { timeout: 10000 })
        .should('exist');
    });
  });

  describe('Phase 8: Sidebar Navigation Coverage', () => {
    // Test that every main sidebar link works
    const adminPages = [
      { path: '/', name: 'Dashboard' },
      { path: '/users', name: 'Users' },
      { path: '/customers', name: 'Customers' },
      { path: '/plans', name: 'Plans' },
      { path: '/features', name: 'Features' },
      { path: '/analytics', name: 'Analytics' },
      { path: '/settings', name: 'Settings' },
      { path: '/roles', name: 'Roles' },
      { path: '/logs', name: 'Logs' },
      { path: '/notifications', name: 'Notifications' },
      { path: '/profile', name: 'Profile' },
      { path: '/marketing/pages', name: 'Marketing Pages' },
      { path: '/blog/posts', name: 'Blog Posts' },
      { path: '/seo/settings', name: 'SEO Settings' },
      { path: '/departments', name: 'Departments' },
      { path: '/integrations', name: 'Integrations' }
    ];

    adminPages.forEach(({ path, name }) => {
      it(`should load ${name} page (${path})`, () => {
        cy.visit(`${ADMIN_URL}${path}`);
        cy.get('body').should('be.visible');
        // Page should not show 404 or error
        cy.get('body').should('not.contain', 'Page not found');
      });
    });
  });
});
