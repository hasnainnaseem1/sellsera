#!/usr/bin/env node
/**
 * Sellsera — Comprehensive Manual E2E Test
 * Acts as a real QA tester: logs in, performs every operation, captures all data.
 */

const API = 'https://api.sellsera.com';
const ADMIN_EMAIL = 'admin@sellsera.com';
const ADMIN_PASSWORD = '2bMillion@ire';

const issues = [];
let adminToken = null;
let customerToken = null;

async function api(method, path, { body, token, timeout = 15000 } = {}) {
  const url = `${API}${path}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
    clearTimeout(timer);
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { s: res.status, d: data, ok: res.ok };
  } catch (e) {
    clearTimeout(timer);
    return { s: 0, d: null, ok: false, err: e.message };
  }
}

function issue(area, desc, detail) {
  issues.push({ area, desc, detail });
  console.log(`  ❌ [${area}] ${desc}`);
  if (detail) console.log(`     → ${typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 300)}`);
}

function ok(msg) { console.log(`  ✅ ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function section(t) { console.log(`\n${'═'.repeat(60)}\n  ${t}\n${'═'.repeat(60)}`); }

async function run() {
  const start = Date.now();
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║   SELLSERA — COMPREHENSIVE MANUAL E2E TEST           ║');
  console.log('║   Testing: api.sellsera.com                          ║');
  console.log(`║   Time: ${new Date().toISOString()}              ║`);
  console.log('╚═══════════════════════════════════════════════════════╝');

  // ═══════════════════════════════════════════════════════
  // 1. ADMIN LOGIN
  // ═══════════════════════════════════════════════════════
  section('1. ADMIN LOGIN');
  const loginRes = await api('POST', '/api/v1/auth/admin/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  if (loginRes.ok && loginRes.d?.token) {
    adminToken = loginRes.d.token;
    ok(`Admin login OK — role: ${loginRes.d.user?.role}, accountType: ${loginRes.d.user?.accountType}`);
    info(`User: ${loginRes.d.user?.name} (${loginRes.d.user?.email})`);
  } else {
    issue('AUTH', 'Admin login FAILED', `Status ${loginRes.s}: ${JSON.stringify(loginRes.d)}`);
    console.log('\n⛔ Cannot proceed without admin token. Aborting.\n');
    printReport(start);
    return;
  }

  const T = adminToken;

  // ═══════════════════════════════════════════════════════
  // 2. ADMIN SETTINGS — General
  // ═══════════════════════════════════════════════════════
  section('2. ADMIN SETTINGS');

  const settingsRes = await api('GET', '/api/v1/admin/settings', { token: T });
  if (settingsRes.ok) {
    ok(`General settings fetched — siteName: "${settingsRes.d?.settings?.siteName || settingsRes.d?.siteName}"`);
  } else {
    issue('SETTINGS', 'GET /admin/settings failed', `Status ${settingsRes.s}`);
  }

  // Theme
  const themeRes = await api('GET', '/api/v1/admin/settings/theme', { token: T });
  if (themeRes.ok) {
    const theme = themeRes.d?.themeSettings || themeRes.d?.settings?.themeSettings;
    ok(`Theme fetched — primaryColor: ${theme?.primaryColor}, appName: "${theme?.appName}"`);
  } else {
    issue('SETTINGS', 'GET /admin/settings/theme failed', `Status ${themeRes.s}`);
  }

  // Update theme and verify persistence
  const testColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
  const updateTheme = await api('PUT', '/api/v1/admin/settings/theme', {
    token: T, body: { primaryColor: testColor }
  });
  if (updateTheme.ok) {
    ok(`Theme update OK — set primaryColor to ${testColor}`);
    // Verify it persisted
    const verify = await api('GET', '/api/v1/admin/settings/theme', { token: T });
    const pc = verify.d?.themeSettings?.primaryColor || verify.d?.settings?.themeSettings?.primaryColor;
    if (pc === testColor) {
      ok(`Theme persistence verified ✓`);
    } else {
      issue('SETTINGS', 'Theme change NOT persisted', `Set ${testColor}, got back ${pc}`);
    }
  } else {
    issue('SETTINGS', 'PUT theme failed', `Status ${updateTheme.s}`);
  }

  // Google SSO
  const ssoRes = await api('GET', '/api/v1/admin/settings/google-sso', { token: T });
  if (ssoRes.ok) ok('Google SSO settings fetched');
  else issue('SETTINGS', 'GET google-sso failed', `Status ${ssoRes.s}`);

  // Stripe
  const stripeRes = await api('GET', '/api/v1/admin/settings/stripe', { token: T });
  if (stripeRes.ok) ok('Stripe settings fetched');
  else issue('SETTINGS', 'GET stripe settings failed', `Status ${stripeRes.s}`);

  // Payment gateway
  const gwRes = await api('GET', '/api/v1/admin/settings/payment-gateway', { token: T });
  if (gwRes.ok) ok(`Payment gateway: ${gwRes.d?.gateway || gwRes.d?.settings?.activePaymentGateway || 'unknown'}`);
  else issue('SETTINGS', 'GET payment-gateway failed', `Status ${gwRes.s}`);

  // Email blocking domains
  const ebRes = await api('GET', '/api/v1/admin/settings/email-blocking/domains', { token: T });
  if (ebRes.ok) {
    const count = ebRes.d?.domains?.length || 0;
    ok(`Email blocking — ${count} domains blocked`);
  } else {
    issue('SETTINGS', 'GET email-blocking domains failed', `Status ${ebRes.s}`);
  }

  // Add, verify, remove blocked domain
  const addDom = await api('POST', '/api/v1/admin/settings/email-blocking/domains/testqablock.com', { token: T });
  if (addDom.ok) {
    ok('Added testqablock.com to blocked domains');
    const delDom = await api('DELETE', '/api/v1/admin/settings/email-blocking/domains/testqablock.com', { token: T });
    if (delDom.ok) ok('Removed testqablock.com — add/remove cycle works');
    else issue('SETTINGS', 'DELETE blocked domain failed', `Status ${delDom.s}: ${JSON.stringify(delDom.d)}`);
  } else {
    issue('SETTINGS', 'POST add blocked domain failed', `Status ${addDom.s}: ${JSON.stringify(addDom.d)}`);
  }

  // Email templates
  const templRes = await api('GET', '/api/v1/admin/settings/email-templates', { token: T });
  if (templRes.ok) ok('Email templates fetched');
  else issue('SETTINGS', 'GET email-templates failed', `Status ${templRes.s}`);

  // Security settings
  const secRes = await api('GET', '/api/v1/admin/settings/security', { token: T });
  if (secRes.ok) ok('Security settings fetched');
  else issue('SETTINGS', 'GET security failed', `Status ${secRes.s}`);

  // ═══════════════════════════════════════════════════════
  // 3. ADMIN USERS (admin staff)
  // ═══════════════════════════════════════════════════════
  section('3. ADMIN USERS (staff management)');

  const usersRes = await api('GET', '/api/v1/admin/users', { token: T });
  if (usersRes.ok) {
    const users = usersRes.d?.users || usersRes.d?.data?.users || [];
    ok(`Users list: ${users.length} admin users found`);
    
    if (users.length > 0) {
      // Test clicking on first user (the "No user found" issue)
      const firstUser = users[0];
      const userId = firstUser._id || firstUser.id;
      info(`Testing view user: ${firstUser.name} (${firstUser.email}) — ID: ${userId}`);
      
      const userDetail = await api('GET', `/api/v1/admin/users/${userId}`, { token: T });
      if (userDetail.ok && (userDetail.d?.user || userDetail.d?.data)) {
        ok(`User detail fetched ✓ — ${userDetail.d?.user?.name || userDetail.d?.data?.name}`);
      } else {
        issue('USERS', `GET /admin/users/${userId} — "No user found" bug`, 
          `Status ${userDetail.s}: ${JSON.stringify(userDetail.d).slice(0, 200)}`);
      }

      // Test ALL user IDs to check for pattern
      let userFailCount = 0;
      for (const u of users.slice(0, 10)) {
        const uid = u._id || u.id;
        const detail = await api('GET', `/api/v1/admin/users/${uid}`, { token: T });
        if (!detail.ok) userFailCount++;
      }
      if (userFailCount > 0) {
        issue('USERS', `${userFailCount}/${Math.min(users.length, 10)} users return errors when viewing details`, '');
      } else {
        ok(`All ${Math.min(users.length, 10)} user detail views work`);
      }
    }
  } else {
    issue('USERS', 'GET /admin/users failed', `Status ${usersRes.s}`);
  }

  // ═══════════════════════════════════════════════════════
  // 4. ADMIN CUSTOMERS
  // ═══════════════════════════════════════════════════════
  section('4. ADMIN CUSTOMERS');

  const custRes = await api('GET', '/api/v1/admin/customers', { token: T });
  if (custRes.ok) {
    const customers = custRes.d?.customers || custRes.d?.data?.customers || custRes.d?.users || [];
    ok(`Customer list: ${customers.length} customers found`);

    if (customers.length > 0) {
      // Test clicking each customer
      let custFailCount = 0;
      let failDetails = [];
      for (const c of customers.slice(0, 10)) {
        const cid = c._id || c.id;
        const detail = await api('GET', `/api/v1/admin/customers/${cid}`, { token: T });
        if (!detail.ok) {
          custFailCount++;
          failDetails.push(`${c.name || c.email}: status ${detail.s} — ${JSON.stringify(detail.d).slice(0, 100)}`);
        }
      }
      if (custFailCount > 0) {
        issue('CUSTOMERS', `${custFailCount}/${Math.min(customers.length, 10)} customers show "No user found" on click`,
          failDetails.join('\n     → '));
      } else {
        ok(`All ${Math.min(customers.length, 10)} customer detail views work`);
      }

      // Test customer analyses
      const cid0 = customers[0]._id || customers[0].id;
      const analyses = await api('GET', `/api/v1/admin/customers/${cid0}/analyses`, { token: T });
      if (analyses.ok) ok('Customer analyses endpoint works');
      else issue('CUSTOMERS', 'GET customer analyses failed', `Status ${analyses.s}`);

      // Test status update
      const statusRes = await api('PUT', `/api/v1/admin/customers/${cid0}/status`, {
        token: T, body: { status: 'active' }
      });
      if (statusRes.ok) ok('Customer status update works');
      else issue('CUSTOMERS', 'PUT customer status failed', `Status ${statusRes.s}: ${JSON.stringify(statusRes.d).slice(0, 150)}`);
    } else {
      info('No customers in database to test detail views');
    }
  } else {
    issue('CUSTOMERS', 'GET /admin/customers failed', `Status ${custRes.s}`);
  }

  // ═══════════════════════════════════════════════════════
  // 5. PLANS
  // ═══════════════════════════════════════════════════════
  section('5. PLANS');

  const plansRes = await api('GET', '/api/v1/admin/plans', { token: T });
  if (plansRes.ok) {
    const plans = plansRes.d?.plans || [];
    ok(`Plans list: ${plans.length} plans found`);
    if (plans.length > 0) {
      const pid = plans[0]._id || plans[0].id;
      const planDetail = await api('GET', `/api/v1/admin/plans/${pid}`, { token: T });
      if (planDetail.ok) ok('Plan detail view works');
      else issue('PLANS', 'GET plan detail failed', `Status ${planDetail.s}`);
    }
  } else {
    issue('PLANS', 'GET /admin/plans failed', `Status ${plansRes.s}`);
  }

  // Create plan
  const ts = Date.now();
  const newPlan = await api('POST', '/api/v1/admin/plans', {
    token: T, body: {
      name: `QA Test Plan ${ts}`,
      description: 'Auto-test plan',
      price: { monthly: 9.99, yearly: 99.99 },
      features: [],
      isActive: false
    }
  });
  let testPlanId = null;
  if (newPlan.ok) {
    testPlanId = newPlan.d?.plan?._id || newPlan.d?.plan?.id;
    ok(`Plan created: ${testPlanId}`);
  } else {
    issue('PLANS', 'POST create plan failed', `Status ${newPlan.s}: ${JSON.stringify(newPlan.d).slice(0, 200)}`);
  }

  if (testPlanId) {
    // Update
    const upd = await api('PUT', `/api/v1/admin/plans/${testPlanId}`, {
      token: T, body: { description: 'Updated by QA' }
    });
    if (upd.ok) ok('Plan update works');
    else issue('PLANS', 'PUT plan update failed', `Status ${upd.s}`);

    // Delete
    const del = await api('DELETE', `/api/v1/admin/plans/${testPlanId}`, { token: T });
    if (del.ok) ok('Plan delete works');
    else issue('PLANS', 'DELETE plan failed', `Status ${del.s}`);
  }

  // ═══════════════════════════════════════════════════════
  // 6. FEATURES
  // ═══════════════════════════════════════════════════════
  section('6. FEATURES');

  const featRes = await api('GET', '/api/v1/admin/features', { token: T });
  if (featRes.ok) {
    const feats = featRes.d?.features || [];
    ok(`Features list: ${feats.length} features`);
    if (feats.length > 0) {
      const fid = feats[0]._id || feats[0].id;
      const fDetail = await api('GET', `/api/v1/admin/features/${fid}`, { token: T });
      if (fDetail.ok) ok('Feature detail works');
      else issue('FEATURES', 'GET feature detail failed', `Status ${fDetail.s}`);
    }
  } else {
    issue('FEATURES', 'GET /admin/features failed', `Status ${featRes.s}`);
  }

  // CRUD cycle
  const newFeat = await api('POST', '/api/v1/admin/features', {
    token: T, body: {
      name: `qa_test_${ts}`, featureKey: `qa_test_${ts}`,
      description: 'QA test', type: 'boolean', category: 'testing', isActive: false
    }
  });
  let testFeatId = null;
  if (newFeat.ok) {
    testFeatId = newFeat.d?.feature?._id || newFeat.d?.feature?.id;
    ok(`Feature created: ${testFeatId}`);
  } else {
    issue('FEATURES', 'POST create feature failed', `Status ${newFeat.s}: ${JSON.stringify(newFeat.d).slice(0, 200)}`);
  }

  if (testFeatId) {
    const upd = await api('PUT', `/api/v1/admin/features/${testFeatId}`, {
      token: T, body: { description: 'Updated' }
    });
    if (upd.ok) ok('Feature update works');
    else issue('FEATURES', 'PUT feature update failed', `Status ${upd.s}`);

    const tog = await api('PUT', `/api/v1/admin/features/${testFeatId}/toggle-status`, { token: T });
    if (tog.ok) ok('Feature toggle works');
    else issue('FEATURES', 'PUT toggle-status failed', `Status ${tog.s}`);

    const del = await api('DELETE', `/api/v1/admin/features/${testFeatId}`, { token: T });
    if (del.ok) ok('Feature delete works');
    else issue('FEATURES', 'DELETE feature failed', `Status ${del.s}`);
  }

  // ═══════════════════════════════════════════════════════
  // 7. ROLES (RBAC)
  // ═══════════════════════════════════════════════════════
  section('7. ROLES (RBAC)');

  const rolesRes = await api('GET', '/api/v1/admin/roles', { token: T });
  if (rolesRes.ok) {
    const roles = rolesRes.d?.roles || [];
    ok(`Roles list: ${roles.length} custom roles`);
    if (roles.length > 0) {
      const rid = roles[0]._id || roles[0].id;
      const rDetail = await api('GET', `/api/v1/admin/roles/${rid}`, { token: T });
      if (rDetail.ok) ok('Role detail works');
      else issue('ROLES', 'GET role detail failed — "No role found" bug?', `Status ${rDetail.s}: ${JSON.stringify(rDetail.d).slice(0, 150)}`);
    }
  } else {
    issue('ROLES', 'GET /admin/roles failed', `Status ${rolesRes.s}`);
  }

  // Permissions list
  const permsRes = await api('GET', '/api/v1/admin/roles/permissions/all', { token: T });
  if (permsRes.ok) ok('Permissions list fetched');
  else issue('ROLES', 'GET permissions failed', `Status ${permsRes.s}`);

  // Create/delete role
  const newRole = await api('POST', '/api/v1/admin/roles', {
    token: T, body: { name: `QA Role ${ts}`, description: 'Test', permissions: ['dashboard.view'] }
  });
  let testRoleId = null;
  if (newRole.ok) {
    testRoleId = newRole.d?.role?._id || newRole.d?.role?.id;
    ok(`Role created: ${testRoleId}`);
  } else {
    issue('ROLES', 'POST create role failed', `Status ${newRole.s}: ${JSON.stringify(newRole.d).slice(0, 200)}`);
  }

  if (testRoleId) {
    const del = await api('DELETE', `/api/v1/admin/roles/${testRoleId}`, { token: T });
    if (del.ok) ok('Role delete works');
    else issue('ROLES', 'DELETE role failed', `Status ${del.s}`);
  }

  // ═══════════════════════════════════════════════════════
  // 8. DEPARTMENTS
  // ═══════════════════════════════════════════════════════
  section('8. DEPARTMENTS');

  const deptRes = await api('GET', '/api/v1/admin/departments', { token: T });
  if (deptRes.ok) {
    const depts = deptRes.d?.departments || [];
    ok(`Departments list: ${depts.length} departments`);
    if (depts.length > 0) {
      const did = depts[0]._id || depts[0].id;
      const dDetail = await api('GET', `/api/v1/admin/departments/${did}`, { token: T });
      if (dDetail.ok) ok('Department detail works');
      else issue('DEPARTMENTS', 'GET department detail failed', `Status ${dDetail.s}`);
    }
  } else {
    issue('DEPARTMENTS', 'GET /admin/departments failed', `Status ${deptRes.s}`);
  }

  // CRUD cycle
  const newDept = await api('POST', '/api/v1/admin/departments', {
    token: T, body: { name: `QA Dept ${ts}`, description: 'Test department' }
  });
  let testDeptId = null;
  if (newDept.ok) {
    testDeptId = newDept.d?.department?._id || newDept.d?.department?.id;
    ok(`Department created: ${testDeptId}`);
  } else {
    issue('DEPARTMENTS', 'POST create department failed', `Status ${newDept.s}: ${JSON.stringify(newDept.d).slice(0, 200)}`);
  }
  if (testDeptId) {
    const del = await api('DELETE', `/api/v1/admin/departments/${testDeptId}`, { token: T });
    if (del.ok) ok('Department delete works');
    else issue('DEPARTMENTS', 'DELETE department failed', `Status ${del.s}`);
  }

  // ═══════════════════════════════════════════════════════
  // 9. BLOG
  // ═══════════════════════════════════════════════════════
  section('9. BLOG');

  const blogRes = await api('GET', '/api/v1/admin/blog/posts', { token: T });
  if (blogRes.ok) {
    const posts = blogRes.d?.posts || [];
    ok(`Blog posts: ${posts.length} posts`);
    if (posts.length > 0) {
      const bid = posts[0]._id || posts[0].id;
      const bDetail = await api('GET', `/api/v1/admin/blog/posts/${bid}`, { token: T });
      if (bDetail.ok) ok('Blog post detail works');
      else issue('BLOG', 'GET blog post detail failed', `Status ${bDetail.s}: ${JSON.stringify(bDetail.d).slice(0, 150)}`);
    }
  } else {
    issue('BLOG', 'GET /admin/blog/posts failed', `Status ${blogRes.s}`);
  }

  // Categories
  const catRes = await api('GET', '/api/v1/admin/blog/categories', { token: T });
  if (catRes.ok) ok(`Blog categories: ${(catRes.d?.categories || []).length}`);
  else issue('BLOG', 'GET blog categories failed', `Status ${catRes.s}`);

  // Create/delete post
  const newPost = await api('POST', '/api/v1/admin/blog/posts', {
    token: T, body: {
      title: `QA Test Post ${ts}`,
      content: '<p>Test content</p>',
      excerpt: 'Test excerpt',
      status: 'draft',
      category: 'General'
    }
  });
  let testPostId = null;
  if (newPost.ok) {
    testPostId = newPost.d?.post?._id || newPost.d?.post?.id;
    ok(`Blog post created: ${testPostId}`);
  } else {
    issue('BLOG', 'POST create blog post failed', `Status ${newPost.s}: ${JSON.stringify(newPost.d).slice(0, 200)}`);
  }
  if (testPostId) {
    const del = await api('DELETE', `/api/v1/admin/blog/posts/${testPostId}`, { token: T });
    if (del.ok) ok('Blog post delete works');
    else issue('BLOG', 'DELETE blog post failed', `Status ${del.s}`);
  }

  // ═══════════════════════════════════════════════════════
  // 10. MARKETING PAGES
  // ═══════════════════════════════════════════════════════
  section('10. MARKETING PAGES');

  const mktRes = await api('GET', '/api/v1/admin/marketing/pages', { token: T });
  if (mktRes.ok) {
    const pages = mktRes.d?.pages || [];
    ok(`Marketing pages: ${pages.length} pages`);
    if (pages.length > 0) {
      let pageFailCount = 0;
      for (const p of pages.slice(0, 10)) {
        const pid = p._id || p.id;
        const pDetail = await api('GET', `/api/v1/admin/marketing/pages/${pid}`, { token: T });
        if (!pDetail.ok) {
          pageFailCount++;
          issue('MARKETING', `Page "${p.title || p.slug}" detail failed`, `Status ${pDetail.s}: ${JSON.stringify(pDetail.d).slice(0, 100)}`);
        }
      }
      if (pageFailCount === 0) ok('All marketing page detail views work');
    }
  } else {
    issue('MARKETING', 'GET /admin/marketing/pages failed', `Status ${mktRes.s}`);
  }

  // Nav links
  const navRes = await api('GET', '/api/v1/admin/marketing/navigation', { token: T });
  if (navRes.ok) ok('Navigation management works');
  else issue('MARKETING', 'GET navigation failed', `Status ${navRes.s}`);

  // ═══════════════════════════════════════════════════════
  // 11. SEO
  // ═══════════════════════════════════════════════════════
  section('11. SEO');

  const seoRes = await api('GET', '/api/v1/admin/seo/settings', { token: T });
  if (seoRes.ok) ok('SEO settings fetched');
  else issue('SEO', 'GET /admin/seo/settings failed', `Status ${seoRes.s}`);

  const seoMeta = await api('GET', '/api/v1/admin/seo/page-meta', { token: T });
  if (seoMeta.ok) ok(`Page meta entries: ${(seoMeta.d?.pageMeta || seoMeta.d?.pages || []).length}`);
  else issue('SEO', 'GET page-meta failed', `Status ${seoMeta.s}`);

  const seoRedirects = await api('GET', '/api/v1/admin/seo/redirects', { token: T });
  if (seoRedirects.ok) ok('Redirects fetched');
  else issue('SEO', 'GET redirects failed', `Status ${seoRedirects.s}`);

  const seoSocial = await api('GET', '/api/v1/admin/seo/social-links', { token: T });
  if (seoSocial.ok) ok('Social links fetched');
  else issue('SEO', 'GET social-links failed', `Status ${seoSocial.s}`);

  const seoScripts = await api('GET', '/api/v1/admin/seo/custom-scripts', { token: T });
  if (seoScripts.ok) ok('Custom scripts fetched');
  else issue('SEO', 'GET custom-scripts failed', `Status ${seoScripts.s}`);

  const seoSchemas = await api('GET', '/api/v1/admin/seo/schema', { token: T });
  if (seoSchemas.ok) ok('Schema markup fetched');
  else issue('SEO', 'GET schema failed', `Status ${seoSchemas.s}`);

  // ═══════════════════════════════════════════════════════
  // 12. ANALYTICS
  // ═══════════════════════════════════════════════════════
  section('12. ANALYTICS');

  const endpoints = [
    ['/api/v1/admin/analytics/overview', 'Overview'],
    ['/api/v1/admin/analytics/users', 'User analytics'],
    ['/api/v1/admin/analytics/revenue', 'Revenue analytics'],
    ['/api/v1/admin/analytics/subscriptions', 'Subscription analytics'],
    ['/api/v1/admin/analytics/usage', 'Usage analytics'],
    ['/api/v1/admin/analytics/activity', 'Activity analytics'],
    ['/api/v1/admin/analytics/growth', 'Growth analytics'],
    ['/api/v1/admin/analytics/retention', 'Retention analytics'],
  ];
  for (const [ep, label] of endpoints) {
    const r = await api('GET', ep, { token: T });
    if (r.ok) ok(label);
    else issue('ANALYTICS', `${label} failed`, `${ep} → ${r.s}`);
  }

  // ═══════════════════════════════════════════════════════
  // 13. LOGS & NOTIFICATIONS
  // ═══════════════════════════════════════════════════════
  section('13. LOGS & NOTIFICATIONS');

  const logsRes = await api('GET', '/api/v1/admin/logs/activity', { token: T });
  if (logsRes.ok) ok(`Activity logs: ${(logsRes.d?.logs || []).length} entries`);
  else issue('LOGS', 'GET activity logs failed', `Status ${logsRes.s}`);

  const errLogs = await api('GET', '/api/v1/admin/logs/errors', { token: T });
  if (errLogs.ok) ok('Error logs fetched');
  else issue('LOGS', 'GET error logs failed', `Status ${errLogs.s}`);

  const notifRes = await api('GET', '/api/v1/admin/notifications', { token: T });
  if (notifRes.ok) ok('Admin notifications fetched');
  else issue('LOGS', 'GET notifications failed', `Status ${notifRes.s}`);

  // Cron jobs
  const cronRes = await api('GET', '/api/v1/admin/cron/status', { token: T });
  if (cronRes.ok) ok('Cron status fetched');
  else issue('LOGS', 'GET cron status failed', `Status ${cronRes.s}`);

  // ═══════════════════════════════════════════════════════
  // 14. PUBLIC / MARKETING SITE
  // ═══════════════════════════════════════════════════════
  section('14. PUBLIC / MARKETING SITE');

  const pubEndpoints = [
    ['/api/v1/public/marketing/site', 'Site branding'],
    ['/api/v1/public/marketing/navigation', 'Navigation'],
    ['/api/v1/public/marketing/pages', 'All pages'],
    ['/api/v1/public/marketing/pages/home', 'Home page'],
    ['/api/v1/public/marketing/home', 'Home data'],
    ['/api/v1/public/blog/posts', 'Blog posts'],
    ['/api/v1/public/blog/popular', 'Popular posts'],
    ['/api/v1/public/blog/categories', 'Blog categories'],
    ['/api/v1/public/seo/settings', 'SEO settings'],
    ['/api/v1/public/plans', 'Pricing plans'],
    ['/api/health', 'Health check'],
  ];
  for (const [ep, label] of pubEndpoints) {
    const r = await api('GET', ep);
    if (r.ok) ok(`${label} ✓`);
    else issue('PUBLIC', `${label} failed`, `${ep} → ${r.s}`);
  }

  // Verify branding reflects theme change
  const pubSite = await api('GET', '/api/v1/public/marketing/site');
  const pubColor = pubSite.d?.site?.primaryColor;
  if (pubColor === testColor) {
    ok(`Branding reflects admin change: ${testColor} ✓`);
  } else {
    issue('PUBLIC', 'Branding NOT reflecting admin theme change on marketing site',
      `Admin set: ${testColor}, public shows: ${pubColor}`);
  }

  // Restore original color
  const origColor = themeRes.d?.themeSettings?.primaryColor || themeRes.d?.settings?.themeSettings?.primaryColor;
  if (origColor) {
    await api('PUT', '/api/v1/admin/settings/theme', { token: T, body: { primaryColor: origColor } });
    info(`Restored original color: ${origColor}`);
  }

  // ═══════════════════════════════════════════════════════
  // 15. CUSTOMER LOGIN & FLOWS
  // ═══════════════════════════════════════════════════════
  section('15. CUSTOMER LOGIN & FLOWS');

  // First, find a customer from admin panel to get creds
  const custList = await api('GET', '/api/v1/admin/customers', { token: T });
  const customers = custList.d?.customers || custList.d?.data?.customers || custList.d?.users || [];
  info(`Found ${customers.length} customers in system`);

  // Try customer login with the admin email (to test if account exists as customer type)
  const custLogin = await api('POST', '/api/v1/auth/customer/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  if (custLogin.ok && custLogin.d?.token) {
    customerToken = custLogin.d.token;
    ok('Customer login OK');
  } else {
    info(`Customer login with admin creds: Status ${custLogin.s} — ${custLogin.d?.message}`);
    info('This is expected — admin account is not a customer account');
  }

  // Try signup flow
  const signupEmail = `qatest_${ts}@mailinator.com`;
  const signupRes = await api('POST', '/api/v1/auth/customer/signup', {
    body: { name: 'QA Test User', email: signupEmail, password: 'Test@12345' }
  });
  if (signupRes.ok || signupRes.s === 201) {
    ok(`Customer signup works (${signupEmail})`);
    // Try login with signed-up user (may fail if email verification required)
    const newCustLogin = await api('POST', '/api/v1/auth/customer/login', {
      body: { email: signupEmail, password: 'Test@12345' }
    });
    if (newCustLogin.ok && newCustLogin.d?.token) {
      customerToken = newCustLogin.d.token;
      ok('New customer login OK');
    } else {
      info(`New customer login: Status ${newCustLogin.s} — ${newCustLogin.d?.message}`);
      if (newCustLogin.s === 403) info('Email verification required (expected behavior)');
    }
  } else {
    issue('CUSTOMER', 'Customer signup failed', `Status ${signupRes.s}: ${JSON.stringify(signupRes.d).slice(0, 200)}`);
  }

  if (customerToken) {
    const CT = customerToken;
    
    const custEndpoints = [
      ['/api/v1/customer/profile', 'GET', 'Profile'],
      ['/api/v1/customer/subscription', 'GET', 'Subscription'],
      ['/api/v1/customer/billing/payments', 'GET', 'Payment history'],
      ['/api/v1/customer/dashboard', 'GET', 'Dashboard'],
      ['/api/v1/customer/notifications', 'GET', 'Notifications'],
    ];
    for (const [ep, method, label] of custEndpoints) {
      const r = await api(method, ep, { token: CT });
      if (r.ok) ok(`${label} ✓`);
      else issue('CUSTOMER', `${label} failed`, `${ep} → ${r.s}: ${JSON.stringify(r.d).slice(0, 100)}`);
    }

    // Billing
    const checkout = await api('POST', '/api/v1/customer/billing/checkout', {
      token: CT, body: { planId: 'nonexistent' }
    });
    if (checkout.s >= 500 && checkout.s !== 503) {
      issue('CUSTOMER', 'Billing checkout crashes with 500', `Status ${checkout.s}`);
    } else {
      ok(`Billing checkout: status ${checkout.s} (${checkout.s === 503 ? 'not configured' : checkout.s === 400 ? 'validation' : 'ok'})`);
    }

    const portal = await api('POST', '/api/v1/customer/billing/portal', { token: CT });
    if (portal.s >= 500 && portal.s !== 503) {
      issue('CUSTOMER', 'Billing portal crashes with 500', `Status ${portal.s}`);
    } else {
      ok(`Billing portal: status ${portal.s} (${portal.s === 503 ? 'not configured' : 'ok'})`);
    }
  } else {
    info('No customer token — skipping customer flow tests');
    info('(Customer requires email verification OR no customer account exists)');
  }

  // ═══════════════════════════════════════════════════════
  // 16. DATA INTEGRITY CHECKS 
  // ═══════════════════════════════════════════════════════
  section('16. DATA INTEGRITY CHECKS');

  // Check if MongoDB IDs are valid format
  if (customers.length > 0) {
    const sample = customers[0];
    const idField = sample._id || sample.id;
    if (idField && /^[0-9a-fA-F]{24}$/.test(idField)) {
      ok('Customer IDs are valid MongoDB ObjectIds');
    } else {
      issue('DATA', 'Customer IDs may be malformed', `Sample: ${idField}`);
    }
  }

  // Check AdminSettings document count
  info('Checking for duplicate AdminSettings... (via settings endpoint)');
  const s1 = await api('GET', '/api/v1/admin/settings', { token: T });
  const s2 = await api('GET', '/api/v1/admin/settings', { token: T });
  if (s1.ok && s2.ok) {
    const id1 = s1.d?.settings?._id || s1.d?._id;
    const id2 = s2.d?.settings?._id || s2.d?._id;
    if (id1 && id2 && id1 === id2) {
      ok('Settings document consistent (same _id on repeated fetch)');
    } else if (id1 && id2) {
      issue('DATA', 'Duplicate AdminSettings documents detected!', `Got ${id1} and ${id2}`);
    }
  }

  printReport(start);
}

function printReport(start) {
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log('\n\n');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                  COMPREHENSIVE TEST REPORT                   ║');
  console.log('╠═══════════════════════════════════════════════════════════════╣');
  console.log(`║  Time: ${elapsed}s                                              ║`);
  console.log(`║  Issues Found: ${String(issues.length).padEnd(46)}║`);
  console.log('╠═══════════════════════════════════════════════════════════════╣');

  if (issues.length === 0) {
    console.log('║  🎉  ALL TESTS PASSED — No issues found!                     ║');
  } else {
    console.log('║  DETAILED ISSUE LIST:                                        ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    issues.forEach((iss, i) => {
      console.log(`║  ${i + 1}. [${iss.area}] ${iss.desc}`);
      if (iss.detail) {
        const lines = String(iss.detail).split('\n');
        lines.forEach(l => console.log(`║     ${l}`));
      }
    });
  }
  console.log('╚═══════════════════════════════════════════════════════════════╝');
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
