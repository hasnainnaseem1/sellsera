/**
 * Test Helper Utilities
 * Shared across all test scripts.
 */
const cfg = require('./config');

const results = { passed: 0, failed: 0, skipped: 0, details: [] };

function log(icon, msg) { console.log(`  ${icon} ${msg}`); }

async function request(method, path, { body, token, timeout, raw } = {}) {
  const url = `${cfg.API_URL}${path}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout || cfg.REQUEST_TIMEOUT);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, ok: res.ok, headers: res.headers };
  } catch (err) {
    clearTimeout(timer);
    return { status: 0, data: null, ok: false, error: err.message };
  }
}

function test(name, { status, data, ok, error, headers }, checks = {}) {
  const issues = [];

  if (error) {
    issues.push(`Network error: ${error}`);
  }
  if (checks.status && status !== checks.status) {
    issues.push(`Expected status ${checks.status}, got ${status}`);
  }
  if (checks.success !== undefined && data?.success !== checks.success) {
    issues.push(`Expected success=${checks.success}, got ${data?.success}`);
  }
  if (checks.hasFields) {
    for (const field of checks.hasFields) {
      if (data?.[field] === undefined && data?.data?.[field] === undefined) {
        issues.push(`Missing field: ${field}`);
      }
    }
  }
  if (checks.custom) {
    // Convert fetch Headers to plain object for easy access
    const hdrs = {};
    if (headers?.forEach) headers.forEach((v, k) => { hdrs[k] = v; });
    const customIssue = checks.custom(data, status, hdrs);
    if (customIssue) issues.push(customIssue);
  }

  if (issues.length === 0) {
    log('✅', name);
    results.passed++;
    results.details.push({ name, status: 'PASS' });
  } else {
    log('❌', `${name}`);
    issues.forEach(i => log('  ', `→ ${i}`));
    results.failed++;
    results.details.push({ name, status: 'FAIL', issues });
  }
  return { status, data, ok };
}

function skip(name, reason) {
  log('⏭️', `${name} — SKIPPED: ${reason}`);
  results.skipped++;
  results.details.push({ name, status: 'SKIP', reason });
}

function section(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

function printSummary(suiteName) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${suiteName} — Results`);
  console.log(`  ✅ Passed: ${results.passed}  |  ❌ Failed: ${results.failed}  |  ⏭️ Skipped: ${results.skipped}`);
  console.log('─'.repeat(60));
  const failures = results.details
    .filter(d => d.status === 'FAIL')
    .map(d => `${d.name}: ${d.issues.join('; ')}`);
  if (failures.length > 0) {
    console.log('\n  Failed tests:');
    results.details.filter(d => d.status === 'FAIL').forEach(d => {
      console.log(`    ❌ ${d.name}`);
      d.issues.forEach(i => console.log(`       → ${i}`));
    });
  }
  console.log('');
  return { ...results, failures };
}

function resetResults() {
  results.passed = 0;
  results.failed = 0;
  results.skipped = 0;
  results.details = [];
}

/**
 * Login as admin, returns token
 */
async function adminLogin() {
  const res = await request('POST', '/api/v1/auth/admin/login', {
    body: { email: cfg.ADMIN_EMAIL, password: cfg.ADMIN_PASSWORD }
  });
  if (!res.ok || !res.data?.token) {
    console.error('❌ Admin login failed! Check credentials in config.js');
    console.error('   Response:', JSON.stringify(res.data).slice(0, 200));
    return null;
  }
  return res.data.token;
}

/**
 * Login as customer, returns token
 */
async function customerLogin() {
  const res = await request('POST', '/api/v1/auth/customer/login', {
    body: { email: cfg.CUSTOMER_EMAIL, password: cfg.CUSTOMER_PASSWORD }
  });
  if (!res.ok || !res.data?.token) {
    console.error('❌ Customer login failed! Check credentials in config.js');
    console.error('   Response:', JSON.stringify(res.data).slice(0, 200));
    return null;
  }
  return res.data.token;
}

module.exports = { request, test, skip, section, printSummary, resetResults, adminLogin, customerLogin, log };
