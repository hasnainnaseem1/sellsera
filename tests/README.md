# Shopwise Comprehensive Test Suite

Complete automation testing covering **all three frontends** (Admin, Customer, Marketing) and the **backend API** — UI elements, functionality, flows, accessibility, and performance.

---

## Architecture

```
tests/
├── package.json                    # Cypress + E2E dependencies
├── README.md                       # This file
│
├── backend/                        # ── Jest API Integration Tests ──
│   ├── jest.config.js              # Jest configuration
│   ├── setup/                      # Test infrastructure
│   │   ├── envSetup.js             # Environment variables
│   │   ├── globalSetup.js          # Start MongoDB Memory Server
│   │   ├── globalTeardown.js       # Stop MongoDB Memory Server
│   │   └── testSetup.js            # DB connect/clear/disconnect
│   ├── helpers/
│   │   └── testHelpers.js          # Auth tokens, seeders, factories, assertions
│   └── api/                        # Test files by route group
│       ├── health.test.js
│       ├── auth/
│       │   ├── adminAuth.test.js   # 9 endpoints, ~36 tests
│       │   └── customerAuth.test.js # 11 endpoints, ~35 tests
│       ├── admin/
│       │   ├── analytics.test.js   # 15 endpoints, ~16 tests
│       │   ├── blog.test.js        # 9 endpoints, ~18 tests
│       │   ├── cronJobs.test.js    # 6 endpoints, ~10 tests
│       │   ├── customers.test.js   # 16 endpoints, ~22 tests
│       │   ├── departments.test.js # 7 endpoints, ~12 tests
│       │   ├── devUtils.test.js    # 2 endpoints, ~6 tests
│       │   ├── features.test.js    # 8 endpoints, ~18 tests
│       │   ├── logs.test.js        # 7 endpoints, ~10 tests
│       │   ├── marketing.test.js   # 10 endpoints, ~18 tests
│       │   ├── plans.test.js       # 10 endpoints, ~20 tests
│       │   ├── roles.test.js       # 7 endpoints, ~14 tests
│       │   ├── seo.test.js         # 7 endpoints, ~12 tests
│       │   ├── settings.test.js    # 23 endpoints, ~25 tests
│       │   ├── upload.test.js      # 2 endpoints, ~6 tests
│       │   └── users.test.js       # 11 endpoints, ~25 tests
│       ├── customer/
│       │   ├── analysis.test.js    # 1 endpoint, ~8 tests
│       │   ├── billing.test.js     # 7 endpoints, ~12 tests
│       │   ├── history.test.js     # 4 endpoints, ~10 tests
│       │   ├── plans.test.js       # 1 endpoint, ~5 tests
│       │   └── subscription.test.js # 2 endpoints, ~8 tests
│       ├── public/
│       │   ├── blog.test.js        # 4 endpoints, ~10 tests
│       │   ├── marketing.test.js   # 5 endpoints, ~10 tests
│       │   ├── plans.test.js       # 1 endpoint, ~4 tests
│       │   └── seo.test.js         # 4 endpoints, ~8 tests
│       └── notifications/
│           └── notifications.test.js # 5 endpoints, ~10 tests
│
└── cypress/                        # ── Cypress E2E Tests ──
    ├── cypress.config.js           # Cypress configuration
    ├── support/
    │   ├── e2e.js                  # Support file (axe, error handling)
    │   └── commands.js             # Custom commands (login, API, a11y)
    ├── fixtures/
    │   ├── admin.json              # Admin test credentials
    │   ├── customer.json           # Customer test credentials
    │   └── testData.json           # Plans, features, blog, listing data
    └── e2e/
        ├── admin/                  # 17 spec files, ~170 tests
        │   ├── login.cy.js
        │   ├── dashboard.cy.js
        │   ├── users.cy.js
        │   ├── plans.cy.js
        │   ├── features.cy.js
        │   ├── blog.cy.js
        │   ├── marketing-pages.cy.js
        │   ├── settings.cy.js
        │   ├── customers.cy.js
        │   ├── roles.cy.js
        │   ├── analytics.cy.js
        │   ├── logs.cy.js
        │   ├── seo.cy.js
        │   ├── departments.cy.js
        │   ├── notifications.cy.js
        │   ├── integrations.cy.js
        │   └── profile.cy.js
        ├── customer/               # 6 spec files, ~62 tests
        │   ├── signup.cy.js
        │   ├── login.cy.js
        │   ├── verify-email.cy.js
        │   ├── dashboard.cy.js
        │   ├── account-settings.cy.js
        │   └── checkout.cy.js
        ├── marketing/              # 5 spec files, ~40 tests
        │   ├── homepage.cy.js
        │   ├── blog.cy.js
        │   ├── navigation.cy.js
        │   ├── dynamic-pages.cy.js
        │   └── maintenance.cy.js
        ├── flows/                  # 2 spec files, ~30 tests
        │   ├── visitor-to-customer.cy.js
        │   └── admin-management.cy.js
        └── accessibility/          # 3 spec files, ~25 tests
            ├── a11y-admin.cy.js
            ├── a11y-customer.cy.js
            └── a11y-marketing.cy.js
```

---

## Quick Start

### 1. Install Dependencies

```bash
# Backend test deps (Jest + SuperTest + MongoDB Memory Server)
cd backend
npm install --save-dev jest supertest mongodb-memory-server

# Cypress + E2E deps
cd ../tests
npm install
```

### 2. Run Backend API Tests (No servers needed — uses in-memory MongoDB)

```bash
# From the backend/ directory:
npm test                        # Run all API tests
npm run test:verbose            # Verbose output
npm run test:coverage           # With coverage report
npm run test:watch              # Watch mode for development

# Or from tests/ directory:
npm run test:api                # All API tests
npm run test:api:auth           # Only auth tests
npm run test:api:admin          # Only admin tests
npm run test:api:customer       # Only customer tests
npm run test:api:public         # Only public tests
```

### 3. Run Cypress E2E Tests (Requires all 4 servers running)

**First, start all servers in separate terminals:**

```bash
# Terminal 1 - Backend API (port 3001)
cd backend && npm run dev

# Terminal 2 - Marketing Site (port 3000)
cd frontend-marketing && npm start

# Terminal 3 - Customer Center (port 3002)
cd frontend-customer-center && npm start

# Terminal 4 - Admin Center (port 3003)
cd frontend-admin-center && npm start
```

**Then, ensure test users are seeded:**
```bash
cd backend && npm run seed    # Seeds super admin user
```

**Run E2E tests:**

```bash
cd tests

# Interactive mode (Cypress GUI)
npm run test:e2e:open

# Headless mode (CI/automated)
npm run test:e2e                # All E2E tests
npm run test:e2e:admin          # Admin panel only
npm run test:e2e:customer       # Customer center only
npm run test:e2e:marketing      # Marketing site only
npm run test:e2e:flows          # Cross-app flows
npm run test:e2e:a11y           # Accessibility only
```

---

## Test Coverage Summary

| Area | Type | Files | Approx Tests | What's Covered |
|------|------|-------|-------------|----------------|
| **Backend Auth** | API (Jest) | 2 | ~71 | Admin + Customer login, signup, email verification, password reset, Google SSO, JWT handling |
| **Backend Admin** | API (Jest) | 15 | ~212 | All 15 admin route groups: Users, Plans, Features, Blog, Marketing, Settings, Customers, Analytics, Roles, Departments, SEO, Logs, Cron, DevUtils, Upload |
| **Backend Customer** | API (Jest) | 5 | ~43 | Analysis, History, Subscription, Billing, Plans |
| **Backend Public** | API (Jest) | 4 | ~32 | Marketing pages, Blog, Plans, SEO (sitemap, robots, redirects) |
| **Backend Notifications** | API (Jest) | 1 | ~10 | CRUD, mark read, unread count |
| **Admin UI** | E2E (Cypress) | 17 | ~170 | Every admin page: login, dashboard, users, plans, features, blog, marketing, settings, customers, roles, analytics, logs, SEO, departments, notifications, integrations, profile |
| **Customer UI** | E2E (Cypress) | 6 | ~62 | Signup, login, email verification, dashboard (analysis tool), account settings (all 5 tabs), checkout success/cancel |
| **Marketing UI** | E2E (Cypress) | 5 | ~40 | Homepage, blog, navigation, dynamic pages, maintenance mode |
| **Flow Tests** | E2E (Cypress) | 2 | ~30 | Full visitor→customer journey, full admin management workflow |
| **Accessibility** | E2E (Cypress) | 3 | ~25 | WCAG 2.0 AA on all pages, ARIA roles, keyboard navigation, color contrast, semantic HTML |
| **Total** | | **60 files** | **~695** | |

---

## What's Tested

### Backend API Tests
- **Authentication**: Login/logout, JWT tokens (valid, expired, missing), signup flows, email verification, password reset, Google SSO
- **Authorization**: RBAC permission checks (super_admin vs moderator), role-based access, feature gates
- **CRUD Operations**: Every model's create/read/update/delete endpoints
- **Pagination**: Page/limit query params, total counts, page count calculations
- **Search & Filters**: name/email search, status filters, date ranges, category filters
- **Bulk Operations**: Bulk delete with ID arrays
- **File Upload**: Image upload (multipart), file deletion
- **CSV Export**: Export endpoints return correct content types
- **Business Logic**: Plan default (only one), feature toggles, usage tracking, subscription state machine
- **Error Handling**: 400 (validation), 401 (auth), 403 (permission), 404 (not found), 409 (conflict)

### Cypress E2E Tests
- **UI Rendering**: Every page loads, required elements exist, correct layout
- **Forms**: Input validation, submit flows, error messages, success feedback
- **Tables**: Data display, sorting, pagination, search, filters
- **Modals**: Open, fill, submit, close — for CRUD operations
- **Navigation**: Sidebar links, breadcrumbs, URL routing, query params
- **Responsive**: Mobile/tablet/desktop layouts, collapsing sidebars
- **Performance**: Page load times under threshold
- **Accessibility**: WCAG 2.0 AA compliance, ARIA, keyboard navigation, contrast
- **Cross-App Flows**: Marketing → Signup → Email verify → Login → Dashboard → Settings

---

## Configuration

### Backend Tests (`tests/backend/jest.config.js`)
- Uses `mongodb-memory-server` — no real database needed
- Tests run serially (`maxWorkers: 1`) to avoid DB conflicts
- 30-second timeout for async operations
- Coverage reports to `tests/coverage/`

### Cypress Tests (`tests/cypress/cypress.config.js`)
- Default URLs configurable via `Cypress.env()`:
  - `MARKETING_URL` = http://localhost:3000
  - `BACKEND_URL` = http://localhost:3001
  - `CUSTOMER_URL` = http://localhost:3002
  - `ADMIN_URL` = http://localhost:3003
- Screenshots saved on failure
- Video recording enabled
- 2 retries in headless mode

### Test Credentials
- **Admin**: `superadmin@test.com` / `Admin@123456` (seeded via `npm run seed`)
- **Customer**: `testcustomer@test.com` / `Customer@123456` (create manually or via seed)

To update credentials, edit:
- `tests/cypress/cypress.config.js` → `env` section
- `tests/cypress/fixtures/admin.json`
- `tests/cypress/fixtures/customer.json`

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  api-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: cd backend && npm ci && npm install --save-dev jest supertest mongodb-memory-server
      - run: cd backend && npm test

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: cd backend && npm ci
      - run: cd frontend-marketing && npm ci
      - run: cd frontend-customer-center && npm ci
      - run: cd frontend-admin-center && npm ci
      - run: cd tests && npm ci
      # Start all servers
      - run: cd backend && npm start &
      - run: cd frontend-marketing && npm start &
      - run: cd frontend-customer-center && npm start &
      - run: cd frontend-admin-center && npm start &
      - run: sleep 30  # Wait for servers
      - run: cd tests && npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: cypress-screenshots
          path: tests/cypress/screenshots
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ECONNREFUSED` in API tests | Ensure `mongodb-memory-server` binary is downloaded: `npx mongodb-memory-server-download` |
| Cypress can't connect | Ensure all 4 servers are running on correct ports |
| Auth tests failing | Run `npm run seed` in backend to create admin user |
| E2E tests timeout | Increase `defaultCommandTimeout` in cypress.config.js |
| `ENOMEM` during test run | Reduce `maxWorkers` or run test groups separately |
| Ant Design selectors not found | Ant Design versions may change class names — adjust selectors in Cypress tests |
