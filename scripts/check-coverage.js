#!/usr/bin/env node

/**
 * Aggregate coverage gate. Walks every workspace defined in the root
 * `package.json#workspaces` glob set, reads each workspace's
 * `coverage/coverage-summary.json` (produced earlier by
 * `turbo run test:coverage` via Vitest's `json-summary` reporter), and
 * exits non-zero when any package's aggregate coverage or the
 * workspace-wide aggregate falls below the configured thresholds.
 *
 * Per-file gating lives in `vitest.shared.ts` (`thresholds.perFile: true`,
 * 80% on every metric). Vitest cannot express both per-file and aggregate
 * thresholds in one config block, so the aggregate gate stays here as a
 * thin post-coverage check rather than a full lcov scanner.
 *
 * This script does NOT run tests. Run `npm run test:coverage` first
 * (or `turbo run test:coverage`) to populate the per-workspace coverage
 * summaries.
 *
 * Threshold defaults: 90 lines, 95 functions, 90 branches. Override
 * via the COVERAGE_LINES_THRESHOLD, COVERAGE_FUNCS_THRESHOLD, and
 * COVERAGE_BRANCHES_THRESHOLD environment variables. The same
 * thresholds are enforced at both the per-package and aggregate
 * level: the script exits non-zero if any package falls below or if
 * the workspace-wide totals fall below.
 *
 * Usage: node scripts/check-coverage.js
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const LINE_THRESHOLD = Number(process.env.COVERAGE_LINES_THRESHOLD ?? 90);
const FUNC_THRESHOLD = Number(process.env.COVERAGE_FUNCS_THRESHOLD ?? 95);
const BRANCH_THRESHOLD = Number(process.env.COVERAGE_BRANCHES_THRESHOLD ?? 90);

/**
 * Resolves the workspace directory list from the root `package.json`'s
 * `workspaces` field. Each entry is either a literal path or a single
 * `*` glob (the only form the project uses, e.g. `packages/libs/*`).
 *
 * @returns Sorted absolute paths to every concrete workspace directory.
 */
function discoverWorkspaceDirs() {
  const rootPkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));
  const patterns = rootPkg.workspaces ?? [];
  const dirs = [];
  for (const pattern of patterns) {
    if (pattern.endsWith('/*')) {
      const parent = resolve(root, pattern.slice(0, -2));
      if (!existsSync(parent)) {
        continue;
      }
      for (const entry of readdirSync(parent)) {
        const full = resolve(parent, entry);
        if (statSync(full).isDirectory()) {
          dirs.push(full);
        }
      }
    } else {
      const full = resolve(root, pattern);
      if (existsSync(full) && statSync(full).isDirectory()) {
        dirs.push(full);
      }
    }
  }
  dirs.sort();
  return dirs;
}

/**
 * Reads Vitest's coverage-summary.json from a workspace. The summary
 * contains a `total` entry plus one entry per covered file; the totals
 * already aggregate across the package, so no per-file walk is needed.
 *
 * Returns counters in the same shape used everywhere else in this
 * script so the aggregation step can sum across packages.
 *
 * @param summaryPath - Absolute path to coverage/coverage-summary.json.
 */
function readSummary(summaryPath) {
  const summary = JSON.parse(readFileSync(summaryPath, 'utf-8'));
  const total = summary.total ?? {};
  const lines = total.lines ?? { total: 0, covered: 0 };
  const functions = total.functions ?? { total: 0, covered: 0 };
  const branches = total.branches ?? { total: 0, covered: 0 };
  return {
    totalLines: lines.total,
    hitLines: lines.covered,
    totalFuncs: functions.total,
    hitFuncs: functions.covered,
    totalBranches: branches.total,
    hitBranches: branches.covered,
  };
}

/**
 * Sums two counter records into a fresh object so the caller can use
 * `.reduce` over the per-workspace stats without mutating any of them.
 */
function addCounters(a, b) {
  return {
    totalLines: a.totalLines + b.totalLines,
    hitLines: a.hitLines + b.hitLines,
    totalFuncs: a.totalFuncs + b.totalFuncs,
    hitFuncs: a.hitFuncs + b.hitFuncs,
    totalBranches: a.totalBranches + b.totalBranches,
    hitBranches: a.hitBranches + b.hitBranches,
  };
}

/**
 * Computes a percentage of `hit` over `total`, returning `undefined`
 * when `total` is zero so the caller can format an "n/a" cell rather
 * than treat zero-instrumented metrics as 100% successes.
 */
function pct(hit, total) {
  return total === 0 ? undefined : (hit / total) * 100;
}

/**
 * Formats a percentage cell. `undefined` becomes a centered `n/a`
 * marker so the table aligns when a workspace has no instrumented
 * functions or branches (e.g. a thin wrapper package).
 */
function fmtPct(value) {
  return value === undefined ? '   n/a' : `${value.toFixed(2).padStart(5)}%`;
}

/**
 * Returns `true` when every threshold-applicable metric is at or above
 * its configured threshold. Metrics whose percentage is `undefined`
 * (no instrumented sites) are treated as passing.
 */
function meetsThresholds(linePct, funcPct, branchPct) {
  if (linePct !== undefined && linePct < LINE_THRESHOLD) {
    return false;
  }
  if (funcPct !== undefined && funcPct < FUNC_THRESHOLD) {
    return false;
  }
  if (branchPct !== undefined && branchPct < BRANCH_THRESHOLD) {
    return false;
  }
  return true;
}

const workspaceDirs = discoverWorkspaceDirs();
const perWorkspace = [];
const missing = [];

for (const dir of workspaceDirs) {
  const summaryPath = resolve(dir, 'coverage', 'coverage-summary.json');
  if (!existsSync(summaryPath)) {
    missing.push(relative(root, dir));
    continue;
  }
  perWorkspace.push({ name: relative(root, dir), counters: readSummary(summaryPath) });
}

if (perWorkspace.length === 0) {
  console.error(
    '[check-coverage] No coverage/coverage-summary.json files found in any workspace. ' +
      'Run `npm run test:coverage` first.',
  );
  process.exit(1);
}

const aggregate = perWorkspace.reduce((acc, ws) => addCounters(acc, ws.counters), {
  totalLines: 0,
  hitLines: 0,
  totalFuncs: 0,
  hitFuncs: 0,
  totalBranches: 0,
  hitBranches: 0,
});

// Per-package report. Sort lowest-line-coverage first so the rows
// most in need of attention land at the top.
const rows = perWorkspace.map((ws) => {
  const linePct = pct(ws.counters.hitLines, ws.counters.totalLines);
  const funcPct = pct(ws.counters.hitFuncs, ws.counters.totalFuncs);
  const branchPct = pct(ws.counters.hitBranches, ws.counters.totalBranches);
  return {
    name: ws.name,
    linePct,
    funcPct,
    branchPct,
    passes: meetsThresholds(linePct, funcPct, branchPct),
  };
});
rows.sort((a, b) => {
  const al = a.linePct ?? 100;
  const bl = b.linePct ?? 100;
  if (al !== bl) {
    return al - bl;
  }
  return a.name.localeCompare(b.name);
});

const nameWidth = Math.max(...rows.map((r) => r.name.length), 'package'.length);
const headerName = 'package'.padEnd(nameWidth);
const sep = '-'.repeat(nameWidth + 4 + 7 + 4 + 7 + 4 + 7 + 4 + 8);

console.log('');
console.log('Per-package coverage:');
console.log(sep);
console.log(`${headerName}    Lines     Funcs     Branches   Status`);
console.log(sep);
for (const row of rows) {
  const status = row.passes ? '[ok]   ' : '[BELOW]';
  console.log(
    `${row.name.padEnd(nameWidth)}    ${fmtPct(row.linePct)}    ${fmtPct(row.funcPct)}    ${fmtPct(row.branchPct)}    ${status}`,
  );
}
console.log(sep);

if (missing.length > 0) {
  console.log('');
  console.log(
    'Workspaces without coverage/coverage-summary.json (no spec files or coverage script):',
  );
  for (const name of missing) {
    console.log(`  ${name}`);
  }
}

const aggLinePct = pct(aggregate.hitLines, aggregate.totalLines);
const aggFuncPct = pct(aggregate.hitFuncs, aggregate.totalFuncs);
const aggBranchPct = pct(aggregate.hitBranches, aggregate.totalBranches);

console.log('');
console.log('Aggregate coverage:');
console.log(
  `  Lines:     ${fmtPct(aggLinePct)} (${aggregate.hitLines} / ${aggregate.totalLines})  threshold ${LINE_THRESHOLD}%`,
);
console.log(
  `  Functions: ${fmtPct(aggFuncPct)} (${aggregate.hitFuncs} / ${aggregate.totalFuncs})  threshold ${FUNC_THRESHOLD}%`,
);
console.log(
  `  Branches:  ${fmtPct(aggBranchPct)} (${aggregate.hitBranches} / ${aggregate.totalBranches})  threshold ${BRANCH_THRESHOLD}%`,
);

const aggregateFailures = [];
if (aggLinePct !== undefined && aggLinePct < LINE_THRESHOLD) {
  aggregateFailures.push(`line coverage ${aggLinePct.toFixed(2)}% < ${LINE_THRESHOLD}%`);
}
if (aggFuncPct !== undefined && aggFuncPct < FUNC_THRESHOLD) {
  aggregateFailures.push(`function coverage ${aggFuncPct.toFixed(2)}% < ${FUNC_THRESHOLD}%`);
}
if (aggBranchPct !== undefined && aggBranchPct < BRANCH_THRESHOLD) {
  aggregateFailures.push(`branch coverage ${aggBranchPct.toFixed(2)}% < ${BRANCH_THRESHOLD}%`);
}

const packageFailures = [];
for (const row of rows) {
  if (row.passes) {
    continue;
  }
  const reasons = [];
  if (row.linePct !== undefined && row.linePct < LINE_THRESHOLD) {
    reasons.push(`lines ${row.linePct.toFixed(2)}% < ${LINE_THRESHOLD}%`);
  }
  if (row.funcPct !== undefined && row.funcPct < FUNC_THRESHOLD) {
    reasons.push(`functions ${row.funcPct.toFixed(2)}% < ${FUNC_THRESHOLD}%`);
  }
  if (row.branchPct !== undefined && row.branchPct < BRANCH_THRESHOLD) {
    reasons.push(`branches ${row.branchPct.toFixed(2)}% < ${BRANCH_THRESHOLD}%`);
  }
  packageFailures.push({ name: row.name, reasons });
}

if (aggregateFailures.length > 0 || packageFailures.length > 0) {
  console.error('');
  console.error('[check-coverage] FAILED:');
  if (aggregateFailures.length > 0) {
    console.error('  Aggregate:');
    for (const failure of aggregateFailures) {
      console.error(`    - ${failure}`);
    }
  }
  if (packageFailures.length > 0) {
    console.error('  Per-package:');
    for (const { name, reasons } of packageFailures) {
      console.error(`    - ${name}: ${reasons.join(', ')}`);
    }
  }
  process.exit(1);
}

console.log('');
console.log('[check-coverage] All per-package and aggregate thresholds met.');
