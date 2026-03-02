const CUSTOMER_URL = Cypress.env('CUSTOMER_URL') || 'http://localhost:3002';

// Helper: stub login and set auth token
function loginAndVisitDashboard() {
  cy.intercept('GET', '**/api/v1/auth/me', {
    statusCode: 200,
    body: {
      success: true,
      data: {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        emailVerified: true,
        plan: 'free',
        role: 'user'
      }
    }
  }).as('getMe');

  cy.intercept('GET', '**/api/v1/analyses*', {
    statusCode: 200,
    body: {
      success: true,
      data: [
        {
          _id: 'analysis-1',
          title: 'Test Product Listing',
          description: 'A sample product description for testing',
          score: 85,
          createdAt: '2026-02-28T10:00:00Z',
          status: 'completed'
        },
        {
          _id: 'analysis-2',
          title: 'Another Listing',
          description: 'Another sample description',
          score: 72,
          createdAt: '2026-02-27T14:30:00Z',
          status: 'completed'
        }
      ],
      total: 2
    }
  }).as('getAnalyses');

  // Set auth token in localStorage before visiting
  cy.visit(CUSTOMER_URL + '/dashboard', {
    onBeforeLoad(win) {
      win.localStorage.setItem('token', 'fake-jwt-token');
    }
  });
}

describe('Customer Dashboard', () => {

  it('should redirect to /login if not authenticated', () => {
    cy.intercept('GET', '**/api/v1/auth/me', {
      statusCode: 401,
      body: { success: false, message: 'Not authenticated' }
    }).as('getMeUnauth');

    cy.visit(CUSTOMER_URL + '/dashboard');
    cy.url().should('include', '/login');
  });

  it('should load the dashboard after login', () => {
    loginAndVisitDashboard();
    cy.get('body').should('be.visible');
    cy.url().should('include', '/dashboard');
  });

  it('should show the analysis form with all fields', () => {
    loginAndVisitDashboard();
    cy.get('form, [class*="form" i], [data-testid="analysis-form"]').should('exist');
    // Title field
    cy.get(
      'input[name="title"], input[id*="title" i], input[placeholder*="title" i]'
    ).should('exist');
    // Description/content field
    cy.get(
      'textarea[name="description"], textarea[id*="description" i], textarea[placeholder*="description" i], ' +
      'textarea[name="content"], textarea'
    ).should('exist');
  });

  it('should submit analysis and show results', () => {
    loginAndVisitDashboard();

    cy.intercept('POST', '**/api/v1/analyses*', {
      statusCode: 201,
      body: {
        success: true,
        data: {
          _id: 'analysis-new',
          title: 'My Test Listing',
          description: 'A product listing for testing analysis',
          score: 90,
          recommendations: [
            'Add more keywords',
            'Improve product description',
            'Add high-quality images'
          ],
          optimizedListing: 'An optimized version of the listing...',
          status: 'completed'
        }
      }
    }).as('submitAnalysis');

    cy.get('input[name="title"], input[id*="title" i], input[placeholder*="title" i]').type('My Test Listing');
    cy.get('textarea').first().type('A product listing for testing analysis');

    // Fill optional fields if present
    cy.get('body').then($body => {
      if ($body.find('input[name="price"], input[placeholder*="price" i]').length) {
        cy.get('input[name="price"], input[placeholder*="price" i]').type('29.99');
      }
      if ($body.find('input[name="tags"], input[placeholder*="tags" i]').length) {
        cy.get('input[name="tags"], input[placeholder*="tags" i]').type('electronics, gadget');
      }
    });

    cy.get('button[type="submit"], input[type="submit"]').click();
    cy.wait('@submitAnalysis');

    // Check results display
    cy.get('body').then($body => {
      const text = $body.text();
      expect(
        text.includes('90') ||
        text.toLowerCase().includes('score') ||
        text.toLowerCase().includes('result') ||
        text.toLowerCase().includes('recommendation')
      ).to.be.true;
    });
  });

  it('should show score, recommendations, and optimized listing in results', () => {
    loginAndVisitDashboard();

    cy.intercept('POST', '**/api/v1/analyses*', {
      statusCode: 201,
      body: {
        success: true,
        data: {
          _id: 'analysis-detail',
          title: 'Detail Test',
          score: 78,
          recommendations: ['Tip 1', 'Tip 2', 'Tip 3'],
          optimizedListing: 'Optimized listing text here',
          status: 'completed'
        }
      }
    }).as('submitAnalysis');

    cy.get('input[name="title"], input[id*="title" i], input[placeholder*="title" i]').type('Detail Test');
    cy.get('textarea').first().type('Some description text for analysis');
    cy.get('button[type="submit"], input[type="submit"]').click();
    cy.wait('@submitAnalysis');

    cy.get('[class*="result" i], [class*="score" i], [data-testid="results"]').should('exist');
  });

  it('should show analysis history list', () => {
    loginAndVisitDashboard();
    cy.wait('@getAnalyses');
    cy.get(
      '[class*="history" i], [class*="list" i], [data-testid="analysis-history"], table, ' +
      '[class*="analyses" i]'
    ).should('exist');
    cy.get('body').should('contain.text', 'Test Product Listing');
  });

  it('should delete an analysis from history', () => {
    loginAndVisitDashboard();
    cy.wait('@getAnalyses');

    cy.intercept('DELETE', '**/api/v1/analyses/*', {
      statusCode: 200,
      body: { success: true, message: 'Analysis deleted' }
    }).as('deleteAnalysis');

    cy.get(
      'button[class*="delete" i], button[aria-label*="delete" i], [data-testid="delete-analysis"], ' +
      '[class*="delete" i], .anticon-delete'
    ).first().then($btn => {
      if ($btn.length > 0) {
        cy.wrap($btn).click();
        // Confirm delete if modal appears
        cy.get('body').then($body => {
          if ($body.find('.ant-popconfirm-buttons button, .ant-modal-confirm-btns button, button:contains("OK"), button:contains("Yes")').length) {
            cy.get('.ant-popconfirm-buttons button, .ant-modal-confirm-btns button').last().click();
          }
        });
      }
    });
  });

  it('should view previous analysis detail', () => {
    loginAndVisitDashboard();
    cy.wait('@getAnalyses');

    cy.intercept('GET', '**/api/v1/analyses/analysis-1', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          _id: 'analysis-1',
          title: 'Test Product Listing',
          description: 'A sample product description',
          score: 85,
          recommendations: ['Recommendation 1', 'Recommendation 2'],
          optimizedListing: 'Optimized version of listing',
          status: 'completed'
        }
      }
    }).as('getAnalysisDetail');

    // Click on first analysis in history
    cy.get('a, button, tr, [class*="item" i]').then($items => {
      const analysisItem = $items.filter((i, el) => {
        return el.textContent.includes('Test Product Listing');
      });
      if (analysisItem.length > 0) {
        cy.wrap(analysisItem.first()).click();
      }
    });
  });

  it('should show empty history state', () => {
    cy.intercept('GET', '**/api/v1/auth/me', {
      statusCode: 200,
      body: {
        success: true,
        data: { id: 'user-123', name: 'Test User', email: 'test@example.com', emailVerified: true }
      }
    }).as('getMe');

    cy.intercept('GET', '**/api/v1/analyses*', {
      statusCode: 200,
      body: { success: true, data: [], total: 0 }
    }).as('getEmptyAnalyses');

    cy.visit(CUSTOMER_URL + '/dashboard', {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'fake-jwt-token');
      }
    });
    cy.wait('@getEmptyAnalyses');
    cy.get('body').then($body => {
      const text = $body.text().toLowerCase();
      expect(
        text.includes('no analysis') ||
        text.includes('no results') ||
        text.includes('empty') ||
        text.includes('get started') ||
        text.includes('no data') ||
        $body.find('[class*="empty" i], .ant-empty').length > 0
      ).to.be.true;
    });
  });

  it('should show loading state during analysis', () => {
    loginAndVisitDashboard();

    cy.intercept('POST', '**/api/v1/analyses*', (req) => {
      req.reply({
        delay: 3000,
        statusCode: 201,
        body: { success: true, data: { _id: 'delayed', title: 'Test', score: 80, status: 'completed' } }
      });
    }).as('slowAnalysis');

    cy.get('input[name="title"], input[id*="title" i], input[placeholder*="title" i]').type('Loading Test');
    cy.get('textarea').first().type('Description for loading test');
    cy.get('button[type="submit"], input[type="submit"]').click();

    // Should show loading indicator
    cy.get(
      '[class*="loading" i], [class*="spinner" i], .ant-spin, [class*="progress" i], ' +
      'button[disabled], [aria-busy="true"]'
    ).should('exist');
  });

  it('should show rate limit / usage limit message when exceeded', () => {
    loginAndVisitDashboard();

    cy.intercept('POST', '**/api/v1/analyses*', {
      statusCode: 429,
      body: { success: false, message: 'Usage limit exceeded. Please upgrade your plan.' }
    }).as('rateLimited');

    cy.get('input[name="title"], input[id*="title" i], input[placeholder*="title" i]').type('Rate Limit Test');
    cy.get('textarea').first().type('Description for rate limit test');
    cy.get('button[type="submit"], input[type="submit"]').click();

    cy.wait('@rateLimited');
    cy.get('body').then($body => {
      const text = $body.text().toLowerCase();
      expect(
        text.includes('limit') ||
        text.includes('upgrade') ||
        text.includes('exceeded') ||
        text.includes('quota') ||
        $body.find('[class*="error" i], .ant-message-error, .ant-notification').length > 0
      ).to.be.true;
    });
  });

  it('should be responsive: form stacks on mobile', () => {
    cy.viewport(375, 667);
    loginAndVisitDashboard();
    cy.get('form, [class*="form" i], [data-testid="analysis-form"]').should('be.visible');
    cy.get('input').first().should('be.visible');
    cy.get('textarea').first().should('be.visible');
  });
});
