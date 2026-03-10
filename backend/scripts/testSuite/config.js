/**
 * Test Suite Configuration
 * 
 * Edit these values to match your live site before running tests.
 */
module.exports = {
  // ── Backend API ──────────────────────────────────────
  API_URL: process.env.TEST_API_URL || 'https://api.sellsera.com',

  // ── Admin credentials (super_admin) ──────────────────
  ADMIN_EMAIL: process.env.TEST_ADMIN_EMAIL || 'admin@sellsera.com',
  ADMIN_PASSWORD: process.env.TEST_ADMIN_PASSWORD || 'CHANGE_ME',

  // ── Customer credentials (existing test customer) ────
  CUSTOMER_EMAIL: process.env.TEST_CUSTOMER_EMAIL || 'testcustomer@example.com',
  CUSTOMER_PASSWORD: process.env.TEST_CUSTOMER_PASSWORD || 'CHANGE_ME',

  // ── Timeouts ─────────────────────────────────────────
  REQUEST_TIMEOUT: 15000,  // ms per request
};
