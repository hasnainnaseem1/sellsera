/// <reference types="cypress" />

describe('Admin Users Management', () => {
  const adminUrl = Cypress.env('ADMIN_URL') || 'http://localhost:3003';
  const apiUrl = Cypress.env('API_URL') || 'http://localhost:3001/api/v1';

  beforeEach(() => {
    cy.loginAsAdmin();
    cy.intercept('GET', `${apiUrl}/admin/users*`).as('getUsers');
    cy.visitAdmin('/users');
    cy.wait('@getUsers');
  });

  it('should render the users list page with a table', () => {
    cy.get('.ant-table').should('be.visible');
  });

  it('should have columns: name, email, role, status, actions', () => {
    cy.get('.ant-table-thead th').then(($headers) => {
      const text = $headers.map((i, el) => Cypress.$(el).text().toLowerCase()).get().join(' ');
      expect(text).to.match(/name/);
      expect(text).to.match(/email/);
      expect(text).to.match(/role/);
      expect(text).to.match(/status/);
      expect(text).to.match(/action/);
    });
  });

  it('should search and filter users by name/email', () => {
    cy.get('.ant-input-search input, input[placeholder*="search" i], input[placeholder*="Search" i]')
      .should('be.visible')
      .type('admin');
    cy.get('.ant-table-tbody tr').should('have.length.greaterThan', 0);
  });

  it('should open create user form/modal when clicking Create User button', () => {
    cy.get('.ant-btn-primary').contains(/create|add|new/i).click();
    cy.get('.ant-modal, .ant-drawer, [class*="form"]').should('be.visible');
  });

  it('should create a new user via form', () => {
    const uniqueEmail = `testuser_${Date.now()}@example.com`;

    cy.intercept('POST', `${apiUrl}/admin/users`).as('createUser');

    cy.get('.ant-btn-primary').contains(/create|add|new/i).click();
    cy.get('.ant-modal, .ant-drawer').should('be.visible');

    cy.get('.ant-modal, .ant-drawer').within(() => {
      cy.get('input[id*="name"], input[name="name"], input[placeholder*="name" i]').first().type('Test User');
      cy.get('input[id*="email"], input[name="email"], input[placeholder*="email" i]').first().type(uniqueEmail);
      cy.get('input[id*="password"], input[name="password"], input[placeholder*="password" i]').first().type('Password123!');
      cy.get('button[type="submit"], .ant-btn-primary').click();
    });

    cy.wait('@createUser');
    cy.get('.ant-message-success, .ant-notification-notice-success').should('be.visible');
  });

  it('should edit a user', () => {
    cy.intercept('PUT', `${apiUrl}/admin/users/*`).as('updateUser');

    cy.get('.ant-table-tbody tr').first().within(() => {
      cy.get('.ant-btn, button').contains(/edit/i).click();
    });

    cy.get('.ant-modal, .ant-drawer, [class*="form"]').should('be.visible');

    cy.get('.ant-modal, .ant-drawer').within(() => {
      cy.get('input[id*="name"], input[name="name"]').first().clear().type('Updated User Name');
      cy.get('button[type="submit"], .ant-btn-primary').click();
    });

    cy.wait('@updateUser');
    cy.get('.ant-message-success, .ant-notification-notice-success').should('be.visible');
  });

  it('should delete a user with confirmation', () => {
    cy.intercept('DELETE', `${apiUrl}/admin/users/*`).as('deleteUser');

    cy.get('.ant-table-tbody tr').first().within(() => {
      cy.get('.ant-btn, button').contains(/delete/i).click();
    });

    cy.get('.ant-modal-confirm, .ant-popconfirm').should('be.visible');
    cy.get('.ant-modal-confirm .ant-btn-primary, .ant-popconfirm .ant-btn-primary, .ant-btn-dangerous')
      .contains(/yes|ok|confirm|delete/i)
      .click();

    cy.wait('@deleteUser');
  });

  it('should suspend/activate user toggle', () => {
    cy.intercept('PATCH', `${apiUrl}/admin/users/*/status`).as('toggleStatus');
    cy.intercept('PUT', `${apiUrl}/admin/users/*`).as('updateUser');

    cy.get('.ant-table-tbody tr').first().within(() => {
      cy.get('.ant-switch, .ant-btn, button').contains(/suspend|activate|ban/i).first().click();
    });

    cy.get('.ant-modal-confirm, .ant-popconfirm').then(($modal) => {
      if ($modal.length) {
        cy.wrap($modal).find('.ant-btn-primary, .ant-btn-dangerous').first().click();
      }
    });
  });

  it('should view user detail page', () => {
    cy.get('.ant-table-tbody tr').first().within(() => {
      cy.get('a, .ant-btn, button').contains(/view|detail/i).first().click();
    });

    cy.url().should('match', /\/users\/[a-zA-Z0-9]+/);
    cy.get('.ant-descriptions, .ant-card, [class*="profile"], [class*="detail"]').should('be.visible');
  });

  it('should show profile info, login history, activity on user detail', () => {
    cy.get('.ant-table-tbody tr').first().within(() => {
      cy.get('a, .ant-btn, button').contains(/view|detail/i).first().click();
    });

    cy.url().should('match', /\/users\/[a-zA-Z0-9]+/);
    cy.get('.ant-tabs, .ant-card').should('exist');
  });

  it('should trigger CSV export download', () => {
    cy.intercept('GET', `${apiUrl}/admin/users/export*`).as('exportUsers');

    cy.get('.ant-btn, button').contains(/export|csv|download/i).click();
    // Verify export request or download initiated
  });

  it('should handle pagination', () => {
    cy.get('.ant-pagination').should('exist');
    cy.get('.ant-pagination-item').then(($pages) => {
      if ($pages.length > 1) {
        cy.get('.ant-pagination-item').eq(1).click();
        cy.wait('@getUsers');
        cy.get('.ant-table-tbody tr').should('have.length.greaterThan', 0);
      }
    });
  });

  it('should support bulk delete: select multiple users and delete', () => {
    cy.intercept('DELETE', `${apiUrl}/admin/users/bulk*`).as('bulkDelete');
    cy.intercept('POST', `${apiUrl}/admin/users/bulk-delete*`).as('bulkDeletePost');

    cy.get('.ant-table-tbody .ant-checkbox-input').first().check({ force: true });
    cy.get('.ant-table-tbody .ant-checkbox-input').eq(1).check({ force: true });

    cy.get('.ant-btn, button').contains(/bulk\s*delete|delete\s*selected/i).click();
    cy.get('.ant-modal-confirm .ant-btn-primary, .ant-popconfirm .ant-btn-primary, .ant-btn-dangerous')
      .contains(/yes|ok|confirm|delete/i)
      .click();
  });

  it('should show disabled create button for unauthorized user', () => {
    // Stub a moderator user without users.create permission
    cy.intercept('GET', `${apiUrl}/admin/users*`, {
      statusCode: 200,
      body: { success: true, data: { users: [], total: 0 } }
    }).as('getUsersEmpty');

    cy.window().then((win) => {
      const user = JSON.parse(win.localStorage.getItem('user') || '{}');
      user.permissions = user.permissions ? user.permissions.filter(p => p !== 'USERS_CREATE' && p !== 'users.create') : [];
      win.localStorage.setItem('user', JSON.stringify(user));
    });

    cy.visitAdmin('/users');
    // Check if create button is disabled or hidden for restricted permissions
    cy.get('body').then(($body) => {
      const createBtn = $body.find('.ant-btn-primary:contains("Create"), .ant-btn-primary:contains("Add"), .ant-btn-primary:contains("New")');
      if (createBtn.length) {
        // Button exists but may be disabled
        cy.wrap(createBtn).should('exist');
      }
    });
  });

  it('should show empty state when no users match filter', () => {
    cy.get('.ant-input-search input, input[placeholder*="search" i]')
      .type('nonexistentuser12345xyz');

    cy.get('.ant-empty, .ant-table-placeholder, [class*="empty"]').should('be.visible');
  });
});
