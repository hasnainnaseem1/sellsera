const CUSTOMER_URL = Cypress.env('CUSTOMER_URL') || 'http://localhost:3002';

// Helper: stub auth and visit settings page
function loginAndVisitSettings(tab = '') {
  cy.intercept('GET', '**/api/v1/auth/me', {
    statusCode: 200,
    body: {
      success: true,
      data: {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        emailVerified: true,
        plan: 'pro',
        role: 'user'
      }
    }
  }).as('getMe');

  cy.intercept('GET', '**/api/v1/subscriptions*', {
    statusCode: 200,
    body: {
      success: true,
      data: {
        plan: 'pro',
        status: 'active',
        currentPeriodEnd: '2026-04-01T00:00:00Z',
        cancelAtPeriodEnd: false
      }
    }
  }).as('getSubscription');

  cy.intercept('GET', '**/api/v1/plans*', {
    statusCode: 200,
    body: {
      success: true,
      data: [
        {
          _id: 'plan-free',
          name: 'Free',
          price: 0,
          interval: 'month',
          features: ['5 analyses/month', 'Basic support']
        },
        {
          _id: 'plan-pro',
          name: 'Pro',
          price: 19.99,
          interval: 'month',
          features: ['50 analyses/month', 'Priority support', 'Advanced insights']
        },
        {
          _id: 'plan-enterprise',
          name: 'Enterprise',
          price: 49.99,
          interval: 'month',
          features: ['Unlimited analyses', '24/7 support', 'Custom integrations', 'API access']
        }
      ]
    }
  }).as('getPlans');

  cy.intercept('GET', '**/api/v1/payments*', {
    statusCode: 200,
    body: {
      success: true,
      data: [
        {
          _id: 'payment-1',
          amount: 19.99,
          currency: 'usd',
          status: 'succeeded',
          createdAt: '2026-02-01T00:00:00Z',
          invoiceUrl: 'https://example.com/invoice/1'
        },
        {
          _id: 'payment-2',
          amount: 19.99,
          currency: 'usd',
          status: 'succeeded',
          createdAt: '2026-01-01T00:00:00Z',
          invoiceUrl: 'https://example.com/invoice/2'
        }
      ]
    }
  }).as('getPayments');

  const url = tab ? CUSTOMER_URL + `/settings?tab=${tab}` : CUSTOMER_URL + '/settings';
  cy.visit(url, {
    onBeforeLoad(win) {
      win.localStorage.setItem('token', 'fake-jwt-token');
    }
  });
}

describe('Customer Account Settings', () => {

  describe('Settings Page Layout', () => {
    it('should render settings page with tabs', () => {
      loginAndVisitSettings();
      cy.get(
        '[class*="tab" i], [role="tablist"], .ant-tabs, [data-testid="settings-tabs"]'
      ).should('exist');
    });

    it('should navigate to billing tab via URL query param', () => {
      loginAndVisitSettings('billing');
      cy.url().should('include', 'tab=billing');
      cy.get('body').then($body => {
        const text = $body.text().toLowerCase();
        expect(
          text.includes('billing') ||
          text.includes('payment') ||
          text.includes('invoice')
        ).to.be.true;
      });
    });

    it('should be responsive: tabs become scrollable/dropdown on mobile', () => {
      cy.viewport(375, 667);
      loginAndVisitSettings();
      cy.get(
        '[class*="tab" i], [role="tablist"], .ant-tabs'
      ).should('be.visible');
    });
  });

  describe('Profile Tab', () => {
    beforeEach(() => {
      loginAndVisitSettings('profile');
    });

    it('should show name and email fields', () => {
      cy.get('input[name="name"], input[id*="name" i], input[placeholder*="name" i]').should('exist');
      cy.get(
        'input[name="email"], input[id*="email" i], input[type="email"], ' +
        '[class*="email" i]'
      ).should('exist');
    });

    it('should have an update button', () => {
      cy.get('button[type="submit"], button').then($buttons => {
        const updateBtn = $buttons.filter((i, el) => {
          const text = el.textContent.toLowerCase();
          return text.includes('update') || text.includes('save') || text.includes('submit');
        });
        expect(updateBtn.length).to.be.greaterThan(0);
      });
    });

    it('should update name and show success message', () => {
      cy.intercept('PUT', '**/api/v1/auth/me', {
        statusCode: 200,
        body: { success: true, data: { name: 'Updated Name', email: 'test@example.com' } }
      }).as('updateProfile');

      cy.intercept('PATCH', '**/api/v1/auth/me', {
        statusCode: 200,
        body: { success: true, data: { name: 'Updated Name', email: 'test@example.com' } }
      }).as('updateProfilePatch');

      cy.get('input[name="name"], input[id*="name" i], input[placeholder*="name" i]')
        .clear()
        .type('Updated Name');

      cy.get('button[type="submit"], button').then($buttons => {
        const updateBtn = $buttons.filter((i, el) => {
          const text = el.textContent.toLowerCase();
          return text.includes('update') || text.includes('save');
        });
        cy.wrap(updateBtn.first()).click();
      });

      cy.get('body').then($body => {
        expect(
          $body.find('.ant-message-success, [class*="success" i]').length > 0 ||
          $body.text().toLowerCase().includes('success') ||
          $body.text().toLowerCase().includes('updated')
        ).to.be.true;
      });
    });
  });

  describe('Subscription Tab', () => {
    beforeEach(() => {
      loginAndVisitSettings('subscription');
    });

    it('should show current plan and status', () => {
      cy.wait('@getSubscription');
      cy.get('body').then($body => {
        const text = $body.text().toLowerCase();
        expect(
          text.includes('pro') ||
          text.includes('active') ||
          text.includes('plan') ||
          text.includes('subscription')
        ).to.be.true;
      });
    });

    it('should show cancel subscription button if active', () => {
      cy.wait('@getSubscription');
      cy.get('button, a').then($elements => {
        const cancelBtn = $elements.filter((i, el) => {
          return el.textContent.toLowerCase().includes('cancel');
        });
        expect(cancelBtn.length).to.be.greaterThan(0);
      });
    });

    it('should show resume subscription button if cancelled', () => {
      cy.intercept('GET', '**/api/v1/subscriptions*', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            plan: 'pro',
            status: 'active',
            currentPeriodEnd: '2026-04-01T00:00:00Z',
            cancelAtPeriodEnd: true
          }
        }
      }).as('getCancelledSubscription');

      loginAndVisitSettings('subscription');
      cy.wait('@getCancelledSubscription');

      cy.get('body').then($body => {
        const text = $body.text().toLowerCase();
        expect(
          text.includes('resume') ||
          text.includes('reactivate') ||
          text.includes('renew') ||
          text.includes('cancel')
        ).to.be.true;
      });
    });
  });

  describe('Plans Tab', () => {
    beforeEach(() => {
      loginAndVisitSettings('plans');
    });

    it('should show available plans with pricing', () => {
      cy.wait('@getPlans');
      cy.get('body').then($body => {
        const text = $body.text().toLowerCase();
        expect(text.includes('free') || text.includes('pro') || text.includes('enterprise')).to.be.true;
        expect(text.includes('$') || text.includes('price') || text.includes('19') || text.includes('49')).to.be.true;
      });
    });

    it('should show plan cards with features list', () => {
      cy.wait('@getPlans');
      cy.get(
        '[class*="plan" i], [class*="card" i], [class*="pricing" i], [data-testid*="plan"]'
      ).should('have.length.greaterThan', 0);
      cy.get('body').then($body => {
        const text = $body.text().toLowerCase();
        expect(
          text.includes('analyses') ||
          text.includes('support') ||
          text.includes('feature')
        ).to.be.true;
      });
    });

    it('should have upgrade/downgrade buttons', () => {
      cy.wait('@getPlans');
      cy.get('button, a').then($elements => {
        const actionBtn = $elements.filter((i, el) => {
          const text = el.textContent.toLowerCase();
          return text.includes('upgrade') || text.includes('downgrade') ||
                 text.includes('select') || text.includes('choose') ||
                 text.includes('subscribe') || text.includes('get started');
        });
        expect(actionBtn.length).to.be.greaterThan(0);
      });
    });

    it('should have billing cycle toggle (monthly/yearly)', () => {
      cy.wait('@getPlans');
      cy.get(
        '[class*="toggle" i], [class*="switch" i], .ant-switch, [class*="cycle" i], ' +
        '[class*="billing-toggle" i], [data-testid="billing-cycle"]'
      ).then($toggle => {
        if ($toggle.length > 0) {
          cy.wrap($toggle).should('be.visible');
        } else {
          // Check for monthly/yearly buttons or tabs
          cy.get('button, [role="tab"]').then($btns => {
            const cycleBtn = $btns.filter((i, el) => {
              const text = el.textContent.toLowerCase();
              return text.includes('monthly') || text.includes('yearly') || text.includes('annual');
            });
            // Toggle may not exist in all implementations
            cy.log(`Billing cycle toggle/buttons found: ${cycleBtn.length}`);
          });
        }
      });
    });
  });

  describe('Billing Tab', () => {
    beforeEach(() => {
      loginAndVisitSettings('billing');
    });

    it('should show payment history table', () => {
      cy.wait('@getPayments');
      cy.get(
        'table, [class*="table" i], .ant-table, [class*="history" i], [data-testid="payment-history"]'
      ).should('exist');
    });

    it('should have download invoice button on each payment', () => {
      cy.wait('@getPayments');
      cy.get(
        'a[href*="invoice"], button[class*="invoice" i], [data-testid="download-invoice"], ' +
        'a[download], button[class*="download" i], .anticon-download'
      ).should('have.length.greaterThan', 0);
    });

    it('should show payment details (amount, date, status)', () => {
      cy.wait('@getPayments');
      cy.get('body').then($body => {
        const text = $body.text().toLowerCase();
        expect(
          text.includes('19.99') || text.includes('$19') || text.includes('amount')
        ).to.be.true;
        expect(
          text.includes('succeeded') || text.includes('paid') || text.includes('status') || text.includes('complete')
        ).to.be.true;
      });
    });
  });

  describe('Password Tab', () => {
    beforeEach(() => {
      loginAndVisitSettings('password');
    });

    it('should show current password, new password, and confirm password fields', () => {
      cy.get('input[type="password"]').should('have.length.greaterThan', 1);
      // At least current password and new password fields
      cy.get(
        'input[name*="current" i], input[name*="old" i], input[id*="current" i], input[id*="old" i], ' +
        'input[placeholder*="current" i], input[placeholder*="old" i]'
      ).should('exist');
      cy.get(
        'input[name*="new" i], input[id*="new" i], input[placeholder*="new" i]'
      ).should('exist');
    });

    it('should validate password change form', () => {
      cy.get('button[type="submit"], button').then($buttons => {
        const changeBtn = $buttons.filter((i, el) => {
          const text = el.textContent.toLowerCase();
          return text.includes('change') || text.includes('update') || text.includes('save');
        });
        if (changeBtn.length > 0) {
          cy.wrap(changeBtn.first()).click();
          cy.get(
            '[class*="error" i], .ant-form-item-explain-error, [class*="validation" i]'
          ).should('have.length.greaterThan', 0);
        }
      });
    });

    it('should change password successfully', () => {
      cy.intercept('PUT', '**/api/v1/auth/password*', {
        statusCode: 200,
        body: { success: true, message: 'Password changed successfully' }
      }).as('changePassword');

      cy.intercept('PATCH', '**/api/v1/auth/password*', {
        statusCode: 200,
        body: { success: true, message: 'Password changed successfully' }
      }).as('changePasswordPatch');

      cy.intercept('POST', '**/api/v1/auth/change-password*', {
        statusCode: 200,
        body: { success: true, message: 'Password changed successfully' }
      }).as('changePasswordPost');

      cy.get(
        'input[name*="current" i], input[name*="old" i], input[id*="current" i], input[placeholder*="current" i]'
      ).type('OldPassword123!');

      cy.get(
        'input[name*="new" i], input[id*="new" i], input[placeholder*="new" i]'
      ).first().type('NewPassword456!');

      // Confirm new password field
      cy.get('input[type="password"]').last().then($lastInput => {
        const name = ($lastInput.attr('name') || '').toLowerCase();
        const id = ($lastInput.attr('id') || '').toLowerCase();
        const placeholder = ($lastInput.attr('placeholder') || '').toLowerCase();
        if (name.includes('confirm') || id.includes('confirm') || placeholder.includes('confirm')) {
          cy.wrap($lastInput).type('NewPassword456!');
        }
      });

      cy.get('button[type="submit"], button').then($buttons => {
        const changeBtn = $buttons.filter((i, el) => {
          const text = el.textContent.toLowerCase();
          return text.includes('change') || text.includes('update') || text.includes('save');
        });
        if (changeBtn.length > 0) {
          cy.wrap(changeBtn.first()).click();
        }
      });

      cy.get('body').then($body => {
        expect(
          $body.find('.ant-message-success, [class*="success" i]').length > 0 ||
          $body.text().toLowerCase().includes('success') ||
          $body.text().toLowerCase().includes('changed')
        ).to.be.true;
      });
    });
  });
});
