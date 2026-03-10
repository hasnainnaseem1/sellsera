/**
 * Test: Customer Center Flows (history, subscription, billing, plans)
 */
const { request, test, skip, section, printSummary, resetResults, customerLogin } = require('./helpers');

async function run() {
  resetResults();
  section('CUSTOMER CENTER FLOWS');

  const token = await customerLogin();
  if (!token) {
    skip('All customer flow tests', 'Login failed');
    return printSummary('Customer Flows');
  }

  // ── Analysis History ────────────────────────────────
  const historyRes = await request('GET', '/api/v1/customer/history', { token });
  test('GET /customer/history — list history', historyRes, {
    status: 200, success: true
  });

  const analyses = historyRes.data?.analyses || historyRes.data?.history || [];
  if (analyses[0]) {
    const analysisId = analyses[0]._id || analyses[0].id;
    test('GET /customer/history/:id — get single analysis',
      await request('GET', `/api/v1/customer/history/${analysisId}`, { token }),
      { status: 200, success: true }
    );
  } else {
    skip('GET /customer/history/:id', 'No analyses in history');
  }

  // ── Subscription ────────────────────────────────────
  test('GET /customer/subscription — current subscription',
    await request('GET', '/api/v1/customer/subscription', { token }),
    { status: 200, success: true }
  );

  test('GET /customer/subscription/usage — feature usage',
    await request('GET', '/api/v1/customer/subscription/usage', { token }),
    { status: 200, success: true }
  );

  // ── Plans ───────────────────────────────────────────
  test('GET /customer/plans — available plans',
    await request('GET', '/api/v1/customer/plans', { token }),
    { status: 200, success: true }
  );

  // ── Billing ─────────────────────────────────────────
  test('GET /customer/billing/payments — payment history',
    await request('GET', '/api/v1/customer/billing/payments', { token }),
    { status: 200, success: true }
  );

  // ── Create Stripe Checkout (will fail without Stripe config — test endpoint responds) ──
  test('POST /customer/billing/checkout — endpoint responds',
    await request('POST', '/api/v1/customer/billing/checkout', {
      token, body: { planId: 'nonexistent' }
    }),
    { custom: (d, s) => s === 0 ? 'Network error' : (s >= 500 ? `Server error ${s}` : null) }
  );

  // ── Stripe Portal (should error gracefully without Stripe) ──
  test('POST /customer/billing/portal — endpoint responds',
    await request('POST', '/api/v1/customer/billing/portal', { token }),
    { custom: (d, s) => s === 0 ? 'Network error' : (s >= 500 ? `Server error ${s}` : null) }
  );

  return printSummary('Customer Flows');
}

if (require.main === module) run();
module.exports = { run };
