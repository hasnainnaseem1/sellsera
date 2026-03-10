#!/usr/bin/env node
/**
 * Diagnostic: Why do detail views (get by ID) fail?
 * Captures exact IDs from list and tests each one individually.
 */
const API = 'https://api.sellsera.com';
async function api(method, path, { body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { s: res.status, d: data };
  } catch (e) { return { s: 0, d: null, err: e.message }; }
}

async function run() {
  // Login
  const login = await api('POST', '/api/v1/auth/admin/login', {
    body: { email: 'admin@sellsera.com', password: '2bMillion@ire' }
  });
  if (!login.d?.token) { console.error('Login failed:', login.d); return; }
  const T = login.d.token;
  console.log('✅ Logged in\n');

  // ── TEST: Admin Users ──
  console.log('═══ ADMIN USERS ═══');
  const users = await api('GET', '/api/v1/admin/users', { token: T });
  const userList = users.d?.users || [];
  console.log(`List returned ${userList.length} users:`);
  for (const u of userList) {
    const id = u._id || u.id;
    console.log(`  ID: ${id} | name: ${u.name} | email: ${u.email} | accountType: ${u.accountType} | role: ${u.role}`);
    const detail = await api('GET', `/api/v1/admin/users/${id}`, { token: T });
    console.log(`    → Detail: status=${detail.s}, msg=${detail.d?.message || 'OK'}`);
  }

  // ── TEST: Customers ──
  console.log('\n═══ CUSTOMERS ═══');
  const custs = await api('GET', '/api/v1/admin/customers', { token: T });
  const custList = custs.d?.customers || custs.d?.users || [];
  console.log(`List returned ${custList.length} customers:`);
  for (const c of custList) {
    const id = c._id || c.id;
    console.log(`  ID: ${id} | name: ${c.name} | email: ${c.email} | accountType: ${c.accountType}`);
    const detail = await api('GET', `/api/v1/admin/customers/${id}`, { token: T });
    console.log(`    → Detail: status=${detail.s}, msg=${detail.d?.message || 'OK'}`);
  }

  // ── TEST: Plans ──
  console.log('\n═══ PLANS ═══');
  const plans = await api('GET', '/api/v1/admin/plans', { token: T });
  const planList = plans.d?.plans || [];
  console.log(`List returned ${planList.length} plans:`);
  for (const p of planList) {
    const id = p._id || p.id;
    console.log(`  ID: ${id} | name: ${p.name} | isActive: ${p.isActive}`);
    const detail = await api('GET', `/api/v1/admin/plans/${id}`, { token: T });
    console.log(`    → Detail: status=${detail.s}, msg=${detail.d?.message || 'OK'}`);
  }

  // ── TEST: Features ──
  console.log('\n═══ FEATURES ═══');
  const feats = await api('GET', '/api/v1/admin/features', { token: T });
  const featList = feats.d?.features || [];
  console.log(`List returned ${featList.length} features:`);
  for (const f of featList) {
    const id = f._id || f.id;
    console.log(`  ID: ${id} | name: ${f.name} | key: ${f.featureKey}`);
    const detail = await api('GET', `/api/v1/admin/features/${id}`, { token: T });
    console.log(`    → Detail: status=${detail.s}, msg=${detail.d?.message || 'OK'}`);
  }

  // ── TEST: Blog Posts ──
  console.log('\n═══ BLOG POSTS ═══');
  const blog = await api('GET', '/api/v1/admin/blog/posts', { token: T });
  const blogList = blog.d?.posts || [];
  console.log(`List returned ${blogList.length} posts:`);
  for (const b of blogList.slice(0, 5)) {
    const id = b._id || b.id;
    console.log(`  ID: ${id} | title: ${b.title?.slice(0, 40)}`);
    const detail = await api('GET', `/api/v1/admin/blog/posts/${id}`, { token: T });
    console.log(`    → Detail: status=${detail.s}, msg=${detail.d?.message || 'OK'}`);
  }

  // ── TEST: Marketing Pages ──
  console.log('\n═══ MARKETING PAGES ═══');
  const mkt = await api('GET', '/api/v1/admin/marketing/pages', { token: T });
  const pageList = mkt.d?.pages || [];
  console.log(`List returned ${pageList.length} pages:`);
  for (const p of pageList) {
    const id = p._id || p.id;
    console.log(`  ID: ${id} | title: ${p.title} | slug: ${p.slug}`);
    const detail = await api('GET', `/api/v1/admin/marketing/pages/${id}`, { token: T });
    console.log(`    → Detail: status=${detail.s}, msg=${detail.d?.message || 'OK'}`);
  }

  // ── TEST: Departments ──
  console.log('\n═══ DEPARTMENTS ═══');
  const depts = await api('GET', '/api/v1/admin/departments', { token: T });
  const deptList = depts.d?.departments || [];
  console.log(`List returned ${deptList.length} departments:`);
  for (const d of deptList) {
    const id = d._id || d.id;
    console.log(`  ID: ${id} | name: ${d.name}`);
    const detail = await api('GET', `/api/v1/admin/departments/${id}`, { token: T });
    console.log(`    → Detail: status=${detail.s}, msg=${detail.d?.message || 'OK'}`);
  }

  // ── TEST: Logs (see if they return 500 or feature-disabled) ──
  console.log('\n═══ LOGS ═══');
  const logs = await api('GET', '/api/v1/admin/logs', { token: T });
  console.log(`Logs: status=${logs.s}, message=${logs.d?.message || 'OK'}, count=${(logs.d?.logs||[]).length}`);
  
  // Also check /logs/activity explicitly
  const logs2 = await api('GET', '/api/v1/admin/logs/activity', { token: T });
  console.log(`Logs/activity: status=${logs2.s}, message=${logs2.d?.message || 'OK'}`);

  // ── TEST: Analytics - the real endpoints ──
  console.log('\n═══ ANALYTICS (real endpoints) ═══');
  const analyticsEndpoints = [
    '/api/v1/admin/analytics/overview',
    '/api/v1/admin/analytics/users-growth',
    '/api/v1/admin/analytics/analyses-trend',
    '/api/v1/admin/analytics/subscription-distribution',
    '/api/v1/admin/analytics/top-customers',
    '/api/v1/admin/analytics/recent-activities',
    '/api/v1/admin/analytics/plan-distribution',
    '/api/v1/admin/analytics/usage-stats',
    '/api/v1/admin/analytics/revenue-stats',
    '/api/v1/admin/analytics/login-analytics',
    '/api/v1/admin/analytics/feature-adoption',
    '/api/v1/admin/analytics/per-plan-usage',
    '/api/v1/admin/analytics/revenue-advanced',
  ];
  for (const ep of analyticsEndpoints) {
    const r = await api('GET', ep, { token: T });
    const label = ep.split('/').pop();
    console.log(`  ${label}: status=${r.s}${r.s !== 200 ? ' — ' + (r.d?.message || '') : ''}`);
  }

  // ── TEST: Settings sub-routes (real endpoints) ──
  console.log('\n═══ SETTINGS (sub-routes from GET /settings) ═══');
  const settings = await api('GET', '/api/v1/admin/settings', { token: T });
  if (settings.s === 200) {
    const s = settings.d?.settings || settings.d;
    console.log(`  Has themeSettings: ${!!s?.themeSettings}`);
    console.log(`  Has stripeSettings: ${!!s?.stripeSettings}`);
    console.log(`  Has googleSSOSettings: ${!!s?.googleSSOSettings || !!s?.googleSSO}`);
    console.log(`  Has securitySettings: ${!!s?.securitySettings}`);
    console.log(`  Has customerSettings: ${!!s?.customerSettings}`);
    console.log(`  Has features flags: ${!!s?.features}`);
    console.log(`  Features.enableActivityLogs: ${s?.features?.enableActivityLogs}`);
    console.log(`  Features.enableCustomRoles: ${s?.features?.enableCustomRoles}`);
    console.log(`  activePaymentGateway: ${s?.activePaymentGateway}`);
  }

  // ── Notifications ──
  console.log('\n═══ NOTIFICATIONS ═══');
  const notif = await api('GET', '/api/v1/admin/notifications', { token: T });
  console.log(`Notifications: status=${notif.s}, msg=${notif.d?.message || 'OK'}`);

  // ── Cron ──
  console.log('\n═══ CRON ═══');
  const cron = await api('GET', '/api/v1/admin/cron', { token: T });
  console.log(`Cron: status=${cron.s}, msg=${cron.d?.message || 'OK'}`);
}

run().catch(e => console.error('Fatal:', e));
