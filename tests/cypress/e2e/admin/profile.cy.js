/// <reference types="cypress" />

describe('Admin Profile', () => {
  const adminUrl = Cypress.env('ADMIN_URL') || 'http://localhost:3003';
  const apiUrl = Cypress.env('API_URL') || 'http://localhost:3001/api/v1';

  beforeEach(() => {
    cy.loginAsAdmin();
    cy.intercept('GET', `${apiUrl}/admin/profile*`).as('getProfile');
    cy.intercept('GET', `${apiUrl}/auth/me*`).as('getMe');
    cy.visitAdmin('/profile');
  });

  it('should render the profile page with current user info', () => {
    cy.get('.ant-form, .ant-card, .ant-descriptions, [class*="profile"]').should('be.visible');
    cy.get('input[id*="name"], input[name="name"], input[id*="email"], input[name="email"]')
      .first()
      .should('not.have.value', '');
  });

  it('should update name', () => {
    cy.intercept('PUT', `${apiUrl}/admin/profile*`).as('updateProfile');
    cy.intercept('PATCH', `${apiUrl}/admin/profile*`).as('patchProfile');
    cy.intercept('PUT', `${apiUrl}/auth/profile*`).as('updateAuthProfile');

    cy.get('input[id*="name"], input[name="name"], input[placeholder*="name" i]')
      .first()
      .clear()
      .type('Updated Admin Name');

    cy.get('button[type="submit"], .ant-btn-primary').contains(/save|update|submit/i).click();

    cy.get('.ant-message-success, .ant-notification-notice-success').should('be.visible');
  });

  it('should update phone number', () => {
    cy.intercept('PUT', `${apiUrl}/admin/profile*`).as('updateProfile');
    cy.intercept('PATCH', `${apiUrl}/admin/profile*`).as('patchProfile');

    cy.get('input[id*="phone"], input[name="phone"], input[placeholder*="phone" i]')
      .first()
      .clear()
      .type('+1234567890');

    cy.get('button[type="submit"], .ant-btn-primary').contains(/save|update|submit/i).click();

    cy.get('.ant-message-success, .ant-notification-notice-success').should('be.visible');
  });

  it('should change password', () => {
    cy.intercept('PUT', `${apiUrl}/admin/profile/password*`).as('changePassword');
    cy.intercept('POST', `${apiUrl}/auth/change-password*`).as('changePasswordPost');
    cy.intercept('PATCH', `${apiUrl}/admin/profile*`).as('patchProfile');

    cy.get('input[id*="currentPassword"], input[name*="currentPassword"], input[id*="current_password"], input[id*="oldPassword"], input[placeholder*="current" i]')
      .first()
      .type('OldPassword123!');

    cy.get('input[id*="newPassword"], input[name*="newPassword"], input[id*="new_password"], input[placeholder*="new password" i]')
      .first()
      .type('NewPassword123!');

    cy.get('input[id*="confirmPassword"], input[name*="confirmPassword"], input[id*="confirm_password"], input[placeholder*="confirm" i]')
      .first()
      .type('NewPassword123!');

    cy.get('button[type="submit"], .ant-btn-primary').contains(/change|update|save/i).last().click();
  });

  it('should have timezone selection', () => {
    cy.get('.ant-select, select, [id*="timezone"], [name*="timezone"]')
      .first()
      .should('exist')
      .click({ force: true });

    cy.get('.ant-select-dropdown .ant-select-item').should('have.length.greaterThan', 0);
  });

  it('should show profile picture/avatar section', () => {
    cy.get('.ant-avatar, .ant-upload, img[class*="avatar"], [class*="avatar"], [class*="profile-pic"], input[type="file"]')
      .should('exist');
  });
});
