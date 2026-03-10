#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════
 *  Sellsera — Complete Live Site Test Runner
 * ═══════════════════════════════════════════════════════════════
 *
 *  Usage:
 *    node runAll.js                  — run ALL test suites
 *    node runAll.js admin            — run only admin tests
 *    node runAll.js customer         — run only customer tests
 *    node runAll.js public           — run only public tests
 *    node runAll.js admin.auth       — run a specific module
 *
 *  Requires: Node.js 18+ (uses built-in fetch)
 *  Config:   Edit config.js with your API URL and credentials
 */

const config = require('./config');

// ── Test module registry ──────────────────────────────────────
const modules = {
  // Public (no auth)
  'public': require('./testPublicEndpoints'),

  // Admin center
  'admin.auth':       require('./testAdminAuth'),
  'admin.settings':   require('./testAdminSettings'),
  'admin.users':      require('./testAdminUsers'),
  'admin.customers':  require('./testAdminCustomers'),
  'admin.plans':      require('./testAdminPlans'),
  'admin.features':   require('./testAdminFeatures'),
  'admin.roles':      require('./testAdminRoles'),
  'admin.departments':require('./testAdminDepartments'),
  'admin.blog':       require('./testAdminBlog'),
  'admin.marketing':  require('./testAdminMarketing'),
  'admin.seo':        require('./testAdminSeo'),
  'admin.analytics':  require('./testAdminAnalytics'),
  'admin.logs':       require('./testAdminLogs'),

  // Customer center
  'customer.auth':    require('./testCustomerAuth'),
  'customer.flows':   require('./testCustomerFlows'),
};

// ── Parse CLI args for filtering ──────────────────────────────
function getFilter() {
  const arg = process.argv[2]?.toLowerCase();
  if (!arg) return null;
  return arg; // 'admin', 'customer', 'public', or 'admin.auth' etc
}

function shouldRun(name, filter) {
  if (!filter) return true;
  return name === filter || name.startsWith(filter + '.');
}

// ── Grand summary tracking ────────────────────────────────────
let grandPassed = 0;
let grandFailed = 0;
let grandSkipped = 0;
let grandErrors = [];
let moduleSummaries = [];

async function main() {
  const filter = getFilter();
  const startTime = Date.now();

  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║            SELLSERA — LIVE SITE TEST SUITE                ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  API URL   : ${config.API_URL.padEnd(43)}║`);
  console.log(`║  Filter    : ${(filter || 'ALL MODULES').padEnd(43)}║`);
  console.log(`║  Timestamp : ${new Date().toISOString().padEnd(43)}║`);
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  const moduleNames = Object.keys(modules);
  const selected = moduleNames.filter(n => shouldRun(n, filter));

  if (selected.length === 0) {
    console.log(`❌ No modules match filter "${filter}"`);
    console.log(`   Available: ${moduleNames.join(', ')}`);
    process.exit(1);
  }

  console.log(`Running ${selected.length} module(s): ${selected.join(', ')}\n`);

  for (const name of selected) {
    try {
      const result = await modules[name].run();
      const summary = {
        name,
        passed: result?.passed ?? 0,
        failed: result?.failed ?? 0,
        skipped: result?.skipped ?? 0,
        failures: result?.failures ?? []
      };

      grandPassed += summary.passed;
      grandFailed += summary.failed;
      grandSkipped += summary.skipped;

      if (summary.failures.length > 0) {
        grandErrors.push(...summary.failures.map(f => `[${name}] ${f}`));
      }

      moduleSummaries.push(summary);
    } catch (err) {
      console.error(`\n💥 Module "${name}" crashed: ${err.message}\n`);
      grandFailed++;
      grandErrors.push(`[${name}] CRASH: ${err.message}`);
      moduleSummaries.push({
        name, passed: 0, failed: 1, skipped: 0,
        failures: [`CRASH: ${err.message}`]
      });
    }
  }

  // ── Grand Summary ───────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const grandTotal = grandPassed + grandFailed + grandSkipped;

  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    GRAND SUMMARY                          ║');
  console.log('╠════════════════════════════════════════════════════════════╣');

  // Per-module breakdown
  for (const m of moduleSummaries) {
    const icon = m.failed > 0 ? '❌' : '✅';
    const line = `${icon} ${m.name}: ${m.passed} passed, ${m.failed} failed, ${m.skipped} skipped`;
    console.log(`║  ${line.padEnd(56)}║`);
  }

  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Total Tests : ${String(grandTotal).padEnd(42)}║`);
  console.log(`║  ✅ Passed   : ${String(grandPassed).padEnd(42)}║`);
  console.log(`║  ❌ Failed   : ${String(grandFailed).padEnd(42)}║`);
  console.log(`║  ⏭️  Skipped  : ${String(grandSkipped).padEnd(42)}║`);
  console.log(`║  Time        : ${(elapsed + 's').padEnd(42)}║`);
  console.log('╠════════════════════════════════════════════════════════════╣');

  if (grandErrors.length > 0) {
    console.log('║                   FAILED TESTS                            ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    for (const err of grandErrors) {
      // Wrap long lines
      const lines = [];
      let remaining = err;
      while (remaining.length > 54) {
        lines.push(remaining.substring(0, 54));
        remaining = remaining.substring(54);
      }
      lines.push(remaining);
      for (const line of lines) {
        console.log(`║  ${line.padEnd(56)}║`);
      }
    }
  }

  const verdict = grandFailed === 0 ? '🎉 ALL TESTS PASSED!' : `⚠️  ${grandFailed} TEST(S) FAILED`;
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  ${verdict.padEnd(56)}║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  process.exit(grandFailed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
