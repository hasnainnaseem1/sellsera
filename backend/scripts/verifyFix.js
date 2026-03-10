#!/usr/bin/env node
/**
 * Post-fix verification: Tests ALL operations after running fixObjectIds.js
 * 
 * Usage: node backend/scripts/verifyFix.js
 */
const API = 'https://api.sellsera.com';

async function api(method, path, { body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(API + path, {
      method, headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { s: res.status, d: data };
  } catch (e) { return { s: 0, d: null, err: e.message }; }
}

const pass = (label) => console.log(`  ✅ ${label}`);
const fail = (label, detail) => console.log(`  ❌ ${label} — ${detail}`);
const skip = (label) => console.log(`  ⏭️  ${label}`);

let passes = 0, failures = 0;
function check(ok, label, detail = '') {
  if (ok) { pass(label); passes++; }
  else { fail(label, detail); failures++; }
}

async function run() {
  console.log('🔍 Sellsera Post-Fix Verification');
  console.log('══════════════════════════════════\n');

  // ── Login ──
  const login = await api('POST', '/api/v1/auth/admin/login', {
    body: { email: 'admin@sellsera.com', password: '2bMillion@ire' }
  });
  if (!login.d?.token) {
    console.error('❌ LOGIN FAILED — cannot continue:', login.d);
    return;
  }
  const T = login.d.token;
  pass('Admin login');
  passes++;

  // ══════════════════════════════════════════════
  // 1. DETAIL VIEW TESTS (the main bug)
  // ══════════════════════════════════════════════
  console.log('\n═══ 1. DETAIL VIEW (findById) ═══');

  // Users
  const users = await api('GET', '/api/v1/admin/users', { token: T });
  const userList = users.d?.users || [];
  console.log(`  Users listed: ${userList.length}`);
  for (const u of userList) {
    const id = u._id || u.id;
    const det = await api('GET', `/api/v1/admin/users/${id}`, { token: T });
    check(det.s === 200, `User detail: ${u.name} (${id})`, `status=${det.s} ${det.d?.message || ''}`);
  }

  // Customers
  const custs = await api('GET', '/api/v1/admin/customers', { token: T });
  const custList = custs.d?.customers || custs.d?.users || [];
  console.log(`  Customers listed: ${custList.length}`);
  for (const c of custList) {
    const id = c._id || c.id;
    const det = await api('GET', `/api/v1/admin/customers/${id}`, { token: T });
    check(det.s === 200, `Customer detail: ${c.name} (${id})`, `status=${det.s} ${det.d?.message || ''}`);
  }

  // Plans
  const plans = await api('GET', '/api/v1/admin/plans', { token: T });
  const planList = plans.d?.plans || [];
  console.log(`  Plans listed: ${planList.length}`);
  for (const p of planList) {
    const id = p._id || p.id;
    const det = await api('GET', `/api/v1/admin/plans/${id}`, { token: T });
    check(det.s === 200, `Plan detail: ${p.name} (${id})`, `status=${det.s} ${det.d?.message || ''}`);
  }

  // Features
  const feats = await api('GET', '/api/v1/admin/features', { token: T });
  const featList = feats.d?.features || [];
  console.log(`  Features listed: ${featList.length}`);
  for (const f of featList) {
    const id = f._id || f.id;
    const det = await api('GET', `/api/v1/admin/features/${id}`, { token: T });
    check(det.s === 200, `Feature detail: ${f.name} (${id})`, `status=${det.s} ${det.d?.message || ''}`);
  }

  // Blog Posts
  const blog = await api('GET', '/api/v1/admin/blog/posts', { token: T });
  const blogList = blog.d?.posts || [];
  console.log(`  Blog posts listed: ${blogList.length}`);
  for (const b of blogList.slice(0, 5)) {
    const id = b._id || b.id;
    const det = await api('GET', `/api/v1/admin/blog/posts/${id}`, { token: T });
    check(det.s === 200, `Blog detail: ${(b.title || '').slice(0, 30)} (${id})`, `status=${det.s} ${det.d?.message || ''}`);
  }

  // Marketing Pages
  const mkt = await api('GET', '/api/v1/admin/marketing/pages', { token: T });
  const pageList = mkt.d?.pages || [];
  console.log(`  Marketing pages listed: ${pageList.length}`);
  for (const p of pageList) {
    const id = p._id || p.id;
    const det = await api('GET', `/api/v1/admin/marketing/pages/${id}`, { token: T });
    check(det.s === 200, `Marketing detail: ${p.title} (${id})`, `status=${det.s} ${det.d?.message || ''}`);
  }

  // Departments
  const depts = await api('GET', '/api/v1/admin/departments', { token: T });
  const deptList = depts.d?.departments || [];
  console.log(`  Departments listed: ${deptList.length}`);
  for (const d of deptList) {
    const id = d._id || d.id;
    const det = await api('GET', `/api/v1/admin/departments/${id}`, { token: T });
    check(det.s === 200, `Department detail: ${d.name} (${id})`, `status=${det.s} ${det.d?.message || ''}`);
  }

  // ══════════════════════════════════════════════
  // 2. SETTINGS PERSISTENCE TESTS
  // ══════════════════════════════════════════════
  console.log('\n═══ 2. SETTINGS PERSISTENCE ═══');

  // Theme persistence test
  const themeBefore = await api('GET', '/api/v1/admin/settings/theme', { token: T });
  const origColor = themeBefore.d?.themeSettings?.primaryColor || '#7c3aed';
  const testColor = '#e74c3c';

  const themeUpdate = await api('PUT', '/api/v1/admin/settings/theme', {
    token: T, body: { primaryColor: testColor }
  });
  check(themeUpdate.s === 200, 'Theme update accepted', `status=${themeUpdate.s}`);

  // Re-read to verify persistence
  const themeAfter = await api('GET', '/api/v1/admin/settings/theme', { token: T });
  const savedColor = themeAfter.d?.themeSettings?.primaryColor;
  check(savedColor === testColor, `Theme persisted (set ${testColor}, got ${savedColor})`, savedColor);

  // Restore original color
  await api('PUT', '/api/v1/admin/settings/theme', {
    token: T, body: { primaryColor: origColor }
  });

  // Email-blocking domain persistence test
  const testDomain = 'verifytest-' + Date.now() + '.com';
  const addDomain = await api('POST', `/api/v1/admin/settings/email-blocking/domains/${testDomain}`, { token: T });
  check(addDomain.s === 200 || addDomain.s === 201, 'Add blocked domain', `status=${addDomain.s}`);

  const domainList = await api('GET', '/api/v1/admin/settings/email-blocking/domains', { token: T });
  const domains = domainList.d?.domains || [];
  const domainFound = domains.includes(testDomain);
  check(domainFound, `Blocked domain persisted (${testDomain})`, `found=${domainFound}`);

  // Clean up test domain
  if (domainFound) {
    await api('DELETE', `/api/v1/admin/settings/email-blocking/domains/${testDomain}`, { token: T });
  }

  // General settings persistence
  const allSettings = await api('GET', '/api/v1/admin/settings', { token: T });
  check(allSettings.s === 200, 'Get all settings', `status=${allSettings.s}`);

  // ══════════════════════════════════════════════
  // 3. ANALYTICS ENDPOINTS
  // ══════════════════════════════════════════════
  console.log('\n═══ 3. ANALYTICS ═══');
  const analyticsEndpoints = [
    'overview', 'users-growth', 'analyses-trend', 'subscription-distribution',
    'top-customers', 'recent-activities', 'plan-distribution', 'usage-stats',
    'revenue-stats', 'login-analytics', 'feature-adoption', 'per-plan-usage',
    'revenue-advanced'
  ];
  for (const ep of analyticsEndpoints) {
    const r = await api('GET', `/api/v1/admin/analytics/${ep}`, { token: T });
    check(r.s === 200, `analytics/${ep}`, `status=${r.s}`);
  }

  // ══════════════════════════════════════════════
  // 4. LOGS, CRON, NOTIFICATIONS
  // ══════════════════════════════════════════════
  console.log('\n═══ 4. LOGS / CRON / NOTIFICATIONS ═══');

  const logs = await api('GET', '/api/v1/admin/logs', { token: T });
  check(logs.s === 200, 'Logs list', `status=${logs.s}`);

  const logStats = await api('GET', '/api/v1/admin/logs/stats/summary', { token: T });
  check(logStats.s === 200, 'Logs stats summary', `status=${logStats.s}`);

  const cron = await api('GET', '/api/v1/admin/cron', { token: T });
  check(cron.s === 200, 'Cron status', `status=${cron.s}`);

  const notifs = await api('GET', '/api/v1/notifications', { token: T });
  check(notifs.s === 200, 'Notifications', `status=${notifs.s}`);

  const unread = await api('GET', '/api/v1/notifications/unread-count', { token: T });
  check(unread.s === 200, 'Notification unread count', `status=${unread.s}`);

  // ══════════════════════════════════════════════
  // 5. PUBLIC ENDPOINTS
  // ══════════════════════════════════════════════
  console.log('\n═══ 5. PUBLIC ENDPOINTS ═══');
  const publicEndpoints = [
    '/api/v1/public/branding',
    '/api/v1/public/plans',
    '/api/v1/public/blog/posts',
    '/api/v1/public/marketing/pages/home',
    '/api/v1/public/seo/settings',
    '/api/health',
  ];
  for (const ep of publicEndpoints) {
    const r = await api('GET', ep);
    check(r.s === 200, ep.replace('/api/v1/', ''), `status=${r.s}`);
  }

  // ══════════════════════════════════════════════
  // 6. CRUD OPERATIONS (create → read → update → delete)
  // ══════════════════════════════════════════════
  console.log('\n═══ 6. CRUD OPERATIONS ═══');

  // Create a test plan
  const testPlan = await api('POST', '/api/v1/admin/plans', {
    token: T,
    body: {
      name: 'VerifyTest-' + Date.now(),
      description: 'Temporary test plan',
      price: 0, interval: 'monthly',
      features: [], isActive: false
    }
  });
  if (testPlan.s === 201 || testPlan.s === 200) {
    const planId = testPlan.d?.plan?._id || testPlan.d?.plan?.id;
    check(true, 'Create plan');

    // Read it back
    const readPlan = await api('GET', `/api/v1/admin/plans/${planId}`, { token: T });
    check(readPlan.s === 200, 'Read created plan', `status=${readPlan.s}`);

    // Update it
    const updPlan = await api('PUT', `/api/v1/admin/plans/${planId}`, {
      token: T, body: { description: 'Updated desc' }
    });
    check(updPlan.s === 200, 'Update plan', `status=${updPlan.s}`);

    // Delete it
    const delPlan = await api('DELETE', `/api/v1/admin/plans/${planId}`, { token: T });
    check(delPlan.s === 200, 'Delete plan', `status=${delPlan.s}`);
  } else {
    fail('Create plan', `status=${testPlan.s} ${testPlan.d?.message || ''}`);
    failures++;
  }

  // ══════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════
  console.log('\n══════════════════════════════════');
  console.log(`📋 RESULTS: ${passes} passed, ${failures} failed`);
  if (failures === 0) {
    console.log('🎉 ALL TESTS PASSED — Database fix successful!');
  } else {
    console.log('⚠️  Some tests failed — review output above');
  }
  console.log('══════════════════════════════════\n');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
