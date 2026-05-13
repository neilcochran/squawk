#!/usr/bin/env node

/**
 * CI guard: for each published `@squawk/*` package that has an
 * `api-extractor.json` (i.e. is enrolled in API surface tracking), if
 * the `./browser` export resolves to a different `.d.ts` file than the
 * default `.` export, require a corresponding
 * `api/<pkg>.browser.api.md` baseline alongside the default
 * `api/<pkg>.api.md`.
 *
 * Without this guard, a package with a divergent browser entry could
 * silently drift on the browser-side surface while the default report
 * stays clean. The guard is conditional on enrollment so packages not
 * yet adopted into the api-tracking system are skipped.
 *
 * When a package introduces a divergent browser entry, add a second
 * api-extractor config (e.g. `api-extractor.browser.json` pointing at
 * the browser `.d.ts`) and commit the generated browser baseline.
 *
 * Usage: node scripts/check-browser-api-coverage.js
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const libsDir = resolve(root, 'packages/libs');

const failures = [];

for (const pkgDir of readdirSync(libsDir)) {
  const pkgJsonPath = resolve(libsDir, pkgDir, 'package.json');
  const apiExtractorPath = resolve(libsDir, pkgDir, 'api-extractor.json');
  if (!existsSync(pkgJsonPath) || !existsSync(apiExtractorPath)) {
    continue;
  }

  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
  if (pkgJson.private === true) {
    continue;
  }

  const exports = pkgJson.exports;
  if (typeof exports !== 'object' || exports === null) {
    continue;
  }

  const defaultTypes = exports['.']?.types;
  const browserTypes = exports['./browser']?.types;

  if (typeof browserTypes !== 'string') {
    continue;
  }
  if (defaultTypes === browserTypes) {
    continue;
  }

  const browserReportPath = resolve(libsDir, pkgDir, 'api', `${pkgDir}.browser.api.md`);
  if (existsSync(browserReportPath)) {
    continue;
  }

  failures.push({
    pkg: pkgJson.name,
    defaultTypes,
    browserTypes,
    expectedReport: `packages/libs/${pkgDir}/api/${pkgDir}.browser.api.md`,
  });
}

if (failures.length === 0) {
  process.exit(0);
}

console.error(
  'check-browser-api-coverage: divergent browser entry without a browser API report.\n',
);
for (const failure of failures) {
  console.error(`  ${failure.pkg}`);
  console.error(`    "." types:        ${failure.defaultTypes}`);
  console.error(`    "./browser" types: ${failure.browserTypes}`);
  console.error(`    Expected baseline: ${failure.expectedReport}`);
  console.error('');
}
console.error(
  'When a package introduces a divergent browser entry, add a second api-extractor config\n' +
    '(e.g. `api-extractor.browser.json` pointing at the browser `.d.ts`) and commit the\n' +
    'generated browser baseline.\n',
);
process.exit(1);
