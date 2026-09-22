#!/usr/bin/env node

/**
 * CI guard: for each published `@squawk/*` package that has an
 * `api-extractor.json` (i.e. is enrolled in API surface tracking), every
 * export subpath whose `types` resolve to a different `.d.ts` file than the
 * default `.` export must have its own committed baseline alongside
 * `api/<pkg>.api.md`.
 *
 * Without this guard, a package with a divergent subpath could silently
 * drift on that surface while the default report stays clean. The guard is
 * conditional on enrollment so packages not yet adopted into the
 * api-tracking system are skipped.
 *
 * Baselines are named after the subpath: `./browser` expects
 * `api/<pkg>.browser.api.md`, `./fetch` expects `api/<pkg>.fetch.api.md`,
 * and so on. When a package introduces a divergent subpath, add a matching
 * api-extractor config (e.g. `api-extractor.browser.json` pointing at that
 * subpath's `.d.ts`), chain it into the package's `api:check` / `api:report`
 * scripts, and commit the generated baseline.
 *
 * Usage: node scripts/check-subpath-api-coverage.js
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const libsDir = resolve(root, 'packages/libs');

/**
 * Derives the expected API report basename for an export subpath.
 *
 * @param subpath - Export key, e.g. `"./browser"` or `"./fetch"`.
 * @returns The report infix, e.g. `"browser"`.
 */
function reportInfix(subpath) {
  return subpath.replace(/^\.\//, '').replace(/\//g, '.');
}

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

  for (const [subpath, entry] of Object.entries(exports)) {
    if (subpath === '.') {
      continue;
    }
    // Asset subpaths map straight to a file and carry no type surface.
    const subpathTypes = typeof entry === 'object' && entry !== null ? entry.types : undefined;
    if (typeof subpathTypes !== 'string' || subpathTypes === defaultTypes) {
      continue;
    }

    const infix = reportInfix(subpath);
    const reportPath = resolve(libsDir, pkgDir, 'api', `${pkgDir}.${infix}.api.md`);
    if (existsSync(reportPath)) {
      continue;
    }

    failures.push({
      pkg: pkgJson.name,
      subpath,
      defaultTypes,
      subpathTypes,
      expectedReport: `packages/libs/${pkgDir}/api/${pkgDir}.${infix}.api.md`,
    });
  }
}

if (failures.length > 0) {
  console.error('check-subpath-api-coverage: divergent export subpath without an API report.\n');
  for (const failure of failures) {
    const defaultLabel = '"." types:';
    const subpathLabel = `"${failure.subpath}" types:`;
    const width = Math.max(defaultLabel.length, subpathLabel.length, 'Expected baseline:'.length);
    console.error(`  ${failure.pkg}`);
    console.error(`    ${defaultLabel.padEnd(width)}  ${failure.defaultTypes}`);
    console.error(`    ${subpathLabel.padEnd(width)}  ${failure.subpathTypes}`);
    console.error(`    ${'Expected baseline:'.padEnd(width)}  ${failure.expectedReport}`);
    console.error('');
  }
  console.error(
    'When a package introduces a divergent export subpath, add a matching api-extractor config\n' +
      "(e.g. `api-extractor.browser.json` pointing at that subpath's `.d.ts`), chain it into the\n" +
      "package's `api:check` / `api:report` scripts, and commit the generated baseline.\n",
  );
  process.exitCode = 1;
}
