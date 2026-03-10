# Sellsera Live Site Test Suite

Comprehensive API test scripts for testing ALL functionalities on the live site.

## Setup

```bash
cd backend/scripts/testSuite
npm install   # (no extra deps needed — uses built-in fetch)
```

## Usage

Edit `config.js` to set your live API URL and credentials, then:

```bash
# Test EVERYTHING
node runAll.js

# Test individual modules
node testAdminAuth.js
node testAdminSettings.js
node testAdminUsers.js
node testAdminCustomers.js
node testAdminPlans.js
node testAdminFeatures.js
node testAdminRoles.js
node testAdminDepartments.js
node testAdminBlog.js
node testAdminMarketing.js
node testAdminSeo.js
node testAdminAnalytics.js
node testAdminLogs.js
node testCustomerAuth.js
node testCustomerFlows.js
node testPublicEndpoints.js
```

## What it tests
- Every GET/POST/PUT/DELETE endpoint
- Auth flows (login, logout, change password)
- CRUD operations (create → read → update → delete)
- Settings save → public API reflect (branding flow)
- Response format validation
- Error handling (invalid data, missing fields)
