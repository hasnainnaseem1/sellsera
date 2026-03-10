/**
 * Test: Admin Analytics — All 15 endpoints
 */
const { request, test, section, printSummary, resetResults, adminLogin } = require('./helpers');

async function run() {
  resetResults();
  section('ADMIN ANALYTICS');

  const token = await adminLogin();
  if (!token) return printSummary('Admin Analytics');

  const endpoints = [
    ['/api/v1/admin/analytics/overview', 'overview'],
    ['/api/v1/admin/analytics/users-growth', 'users-growth'],
    ['/api/v1/admin/analytics/analyses-trend', 'analyses-trend'],
    ['/api/v1/admin/analytics/subscription-distribution', 'subscription-dist'],
    ['/api/v1/admin/analytics/top-customers', 'top-customers'],
    ['/api/v1/admin/analytics/recent-activities', 'recent-activities'],
    ['/api/v1/admin/analytics/plan-distribution', 'plan-distribution'],
    ['/api/v1/admin/analytics/usage-stats', 'usage-stats'],
    ['/api/v1/admin/analytics/revenue-stats', 'revenue-stats'],
    ['/api/v1/admin/analytics/login-analytics', 'login-analytics'],
    ['/api/v1/admin/analytics/feature-adoption', 'feature-adoption'],
    ['/api/v1/admin/analytics/per-plan-usage', 'per-plan-usage'],
    ['/api/v1/admin/analytics/revenue-advanced', 'revenue-advanced'],
  ];

  for (const [path, label] of endpoints) {
    test(`GET ${label}`,
      await request('GET', path, { token }),
      { status: 200, success: true }
    );
  }

  return printSummary('Admin Analytics');
}

if (require.main === module) run();
module.exports = { run };
