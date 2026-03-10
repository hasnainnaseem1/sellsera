/**
 * Test: Admin Logs + Notifications + Cron
 */
const { request, test, section, printSummary, resetResults, adminLogin } = require('./helpers');

async function run() {
  resetResults();
  section('ADMIN LOGS & NOTIFICATIONS & CRON');

  const token = await adminLogin();
  if (!token) return printSummary('Admin Logs');

  // ── Activity Logs ───────────────────────────────────
  const logsRes = await request('GET', '/api/v1/admin/logs', { token });
  test('GET /admin/logs — list logs', logsRes, { status: 200, success: true });

  test('GET /admin/logs/stats/summary — stats',
    await request('GET', '/api/v1/admin/logs/stats/summary', { token }),
    { status: 200, success: true }
  );

  test('GET /admin/logs/export/csv — export',
    await request('GET', '/api/v1/admin/logs/export/csv', { token }),
    { custom: (d, s) => s >= 500 ? `Server error ${s}` : null }
  );

  // Get a log entry to test detail view
  const logs = logsRes.data?.logs || logsRes.data?.activities || [];
  if (logs[0]) {
    const logId = logs[0]._id || logs[0].id;
    test('GET /admin/logs/:id — get single log',
      await request('GET', `/api/v1/admin/logs/${logId}`, { token }),
      { status: 200, success: true }
    );
  }

  // ── Notifications ───────────────────────────────────
  test('GET /notifications/unread-count — count',
    await request('GET', '/api/v1/notifications/unread-count', { token }),
    { status: 200, success: true }
  );

  test('GET /notifications — list',
    await request('GET', '/api/v1/notifications', { token }),
    { status: 200, success: true }
  );

  test('PUT /notifications/mark-all-read — mark all',
    await request('PUT', '/api/v1/notifications/mark-all-read', { token }),
    { status: 200, success: true }
  );

  // ── Cron Jobs ───────────────────────────────────────
  test('GET /admin/cron — list cron jobs',
    await request('GET', '/api/v1/admin/cron', { token }),
    { status: 200, success: true }
  );

  return printSummary('Admin Logs & Notifications & Cron');
}

if (require.main === module) run();
module.exports = { run };
