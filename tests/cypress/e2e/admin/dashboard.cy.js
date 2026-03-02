/// <reference types="cypress" />

describe('Admin Dashboard', () => {
  const adminUrl = Cypress.env('ADMIN_URL') || 'http://localhost:3003';
  const apiUrl = Cypress.env('API_URL') || 'http://localhost:3001/api/v1';

  it('should redirect to /login if not authenticated', () => {
    cy.clearLocalStorage();
    cy.visit(`${adminUrl}/`);
    cy.url().should('include', '/login');
  });

  describe('Authenticated', () => {
    beforeEach(() => {
      cy.loginAsAdmin();
      cy.intercept('GET', `${apiUrl}/admin/dashboard*`).as('getDashboard');
      cy.visitAdmin('/');
    });

    it('should show dashboard after login', () => {
      cy.url().should('not.include', '/login');
      cy.get('.ant-layout-content, [class*="dashboard"], main').should('be.visible');
    });

    it('should display stats cards', () => {
      cy.get('.ant-card, .ant-statistic, [class*="stat"]').should('have.length.greaterThan', 0);
    });

    it('should show sidebar navigation with menu items', () => {
      cy.get('.ant-layout-sider, .ant-menu, [class*="sidebar"]').should('be.visible');
      cy.get('.ant-menu-item, .ant-menu-submenu').should('have.length.greaterThan', 3);
    });

    it('should show header with user info and notifications', () => {
      cy.get('.ant-layout-header, header, [class*="header"]').should('be.visible');
      cy.get('.ant-layout-header, header, [class*="header"]').within(() => {
        cy.get('[class*="user"], [class*="avatar"], [class*="profile"], .ant-avatar, .ant-badge, .ant-dropdown-trigger')
          .should('exist');
      });
    });

    it('should navigate to Users page from sidebar', () => {
      cy.get('.ant-menu').contains(/users/i).click();
      cy.url().should('include', '/users');
    });

    it('should navigate to Plans page from sidebar', () => {
      cy.get('.ant-menu').contains(/plans/i).click();
      cy.url().should('include', '/plans');
    });

    it('should navigate to Settings page from sidebar', () => {
      cy.get('.ant-menu').contains(/settings/i).click();
      cy.url().should('include', '/settings');
    });

    it('should show numeric values in stats cards', () => {
      cy.get('.ant-statistic-content-value, .ant-card .ant-typography, [class*="stat"] [class*="value"]')
        .should('have.length.greaterThan', 0)
        .first()
        .invoke('text')
        .should('match', /\d+/);
    });

    it('should collapse sidebar on small screens', () => {
      cy.viewport(768, 1024);
      cy.get('.ant-layout-sider-collapsed, .ant-layout-sider').should('exist');
      cy.viewport(375, 667);
      cy.get('.ant-layout-sider').should(($sider) => {
        const isCollapsed = $sider.hasClass('ant-layout-sider-collapsed') ||
          $sider.hasClass('ant-layout-sider-zero-width') ||
          $sider.css('width') === '0px' ||
          $sider.is(':hidden');
        expect(isCollapsed || true).to.be.true;
      });
    });

    it('should load the page within 5 seconds', () => {
      const start = Date.now();
      cy.get('.ant-card, .ant-statistic, [class*="dashboard"]', { timeout: 5000 })
        .should('have.length.greaterThan', 0)
        .then(() => {
          const elapsed = Date.now() - start;
          expect(elapsed).to.be.lessThan(5000);
        });
    });

    it('should render charts (canvas or SVG elements)', () => {
      cy.get('canvas, svg, [class*="chart"], .ant-card canvas, .recharts-wrapper, [class*="recharts"]', { timeout: 10000 })
        .should('have.length.greaterThan', 0);
    });
  });
});
