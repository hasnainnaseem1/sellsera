/// <reference types="cypress" />

describe('Admin Notifications', () => {
  const adminUrl = Cypress.env('ADMIN_URL') || 'http://localhost:3003';
  const apiUrl = Cypress.env('API_URL') || 'http://localhost:3001/api/v1';

  beforeEach(() => {
    cy.loginAsAdmin();
    cy.intercept('GET', `${apiUrl}/admin/notifications*`).as('getNotifications');
    cy.visitAdmin('/notifications');
  });

  it('should render the notifications page', () => {
    cy.get('.ant-list, .ant-table, .ant-card, [class*="notification"]').should('be.visible');
  });

  it('should show a list of notifications', () => {
    cy.get('.ant-list-item, .ant-table-tbody tr, .ant-card, [class*="notification-item"]')
      .should('have.length.greaterThan', 0);
  });

  it('should mark a notification as read', () => {
    cy.intercept('PATCH', `${apiUrl}/admin/notifications/*`).as('markRead');
    cy.intercept('PUT', `${apiUrl}/admin/notifications/*/read`).as('markReadPut');

    cy.get('.ant-list-item, .ant-table-tbody tr, [class*="notification-item"]').first().within(() => {
      cy.get('.ant-btn, button, a').contains(/read|mark/i).first().click({ force: true });
    });
  });

  it('should mark all notifications as read', () => {
    cy.intercept('PATCH', `${apiUrl}/admin/notifications/read-all*`).as('markAllRead');
    cy.intercept('PUT', `${apiUrl}/admin/notifications/read-all*`).as('markAllReadPut');
    cy.intercept('POST', `${apiUrl}/admin/notifications/read-all*`).as('markAllReadPost');

    cy.get('.ant-btn, button').contains(/mark\s*all|read\s*all/i).click();

    cy.get('.ant-message-success, .ant-notification-notice-success').should('be.visible');
  });

  it('should delete a notification', () => {
    cy.intercept('DELETE', `${apiUrl}/admin/notifications/*`).as('deleteNotification');

    cy.get('.ant-list-item, .ant-table-tbody tr, [class*="notification-item"]').first().within(() => {
      cy.get('.ant-btn, button').contains(/delete|remove|dismiss/i).first().click({ force: true });
    });

    cy.get('.ant-modal-confirm, .ant-popconfirm').then(($modal) => {
      if ($modal.length) {
        cy.wrap($modal).find('.ant-btn-primary, .ant-btn-dangerous').first().click();
      }
    });
  });

  it('should show notification badge in header', () => {
    cy.get('.ant-layout-header, header, [class*="header"]').within(() => {
      cy.get('.ant-badge, [class*="notification"], .ant-badge-count').should('exist');
    });
  });
});
