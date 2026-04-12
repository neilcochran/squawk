#!/usr/bin/env node

/**
 * Runs one or more data build pipelines.
 *
 * Usage:
 *   npm run build:data -- --local <nasr-zip-or-dir>              # build all NASR data
 *   npm run build:data -- --local <nasr-zip-or-dir> --only airports,navaids
 *   npm run build:data -- --icao-fetch                           # fetch + build ICAO registry
 *   npm run build:data -- --icao-local <path-to-zip>             # build ICAO registry from local zip
 *   npm run build:data -- --local <nasr> --icao-fetch            # build everything
 *
 * The --only flag accepts a comma-separated list of short names:
 *   airports, navaids, fixes, airways, airspace, procedures
 */

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const NASR_SCRIPTS = [
  { name: 'airports', pkg: 'scripts/build-airport-data' },
  { name: 'navaids', pkg: 'scripts/build-navaid-data' },
  { name: 'fixes', pkg: 'scripts/build-fix-data' },
  { name: 'airways', pkg: 'scripts/build-airway-data' },
  { name: 'airspace', pkg: 'scripts/build-airspace-data' },
  { name: 'procedures', pkg: 'scripts/build-procedure-data' },
];

const ALL_NAMES = NASR_SCRIPTS.map((s) => s.name);

function printUsageAndExit() {
  process.stderr.write(
    'Usage: npm run build:data -- --local <nasr-zip-or-dir> [--only name,...]\n' +
      '       npm run build:data -- --icao-fetch\n' +
      '       npm run build:data -- --icao-local <path-to-zip>\n\n' +
      'NASR data options:\n' +
      '  --local <path>     Path to a NASR subscription .zip file or extracted directory.\n' +
      '  --only <names>     Comma-separated list of pipelines to run.\n' +
      `                     Available: ${ALL_NAMES.join(', ')}\n\n` +
      'ICAO registry options:\n' +
      '  --icao-fetch       Download and build the FAA ReleasableAircraft registry.\n' +
      '  --icao-local <path> Build from a local ReleasableAircraft.zip.\n',
  );
  process.exit(1);
}

const args = process.argv.slice(2);

if (args.length === 0) {
  printUsageAndExit();
}

let nasrInput = undefined;
let only = undefined;
let icaoMode = undefined;
let icaoPath = undefined;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  const next = args[i + 1];
  if (arg === '--local' && next) {
    nasrInput = resolve(next);
    i++;
  } else if (arg === '--only' && next) {
    only = next.split(',').map((s) => s.trim());
    i++;
  } else if (arg === '--icao-fetch') {
    icaoMode = 'fetch';
  } else if (arg === '--icao-local' && next) {
    icaoMode = 'local';
    icaoPath = resolve(next);
    i++;
  } else {
    process.stderr.write(`Unknown argument: ${arg}\n`);
    printUsageAndExit();
  }
}

if (!nasrInput && !icaoMode) {
  process.stderr.write(
    'Error: at least one of --local or --icao-fetch/--icao-local is required.\n',
  );
  printUsageAndExit();
}

if (only) {
  const invalid = only.filter((n) => !ALL_NAMES.includes(n));
  if (invalid.length > 0) {
    process.stderr.write(`Unknown pipeline name(s): ${invalid.join(', ')}\n`);
    process.stderr.write(`Available: ${ALL_NAMES.join(', ')}\n`);
    process.exit(1);
  }
}

let failures = 0;

if (nasrInput) {
  const scripts = only ? NASR_SCRIPTS.filter((s) => only.includes(s.name)) : NASR_SCRIPTS;

  for (const script of scripts) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Building ${script.name}...`);
    console.log('='.repeat(60));
    try {
      execSync(`node ${script.pkg}/dist/index.js --local "${nasrInput}"`, {
        stdio: 'inherit',
        cwd: resolve(import.meta.dirname, '..'),
      });
    } catch {
      console.error(`FAILED: ${script.name}`);
      failures++;
    }
  }
}

if (icaoMode) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Building ICAO registry...');
  console.log('='.repeat(60));
  const icaoArgs = icaoMode === 'fetch' ? '--fetch' : `--local "${icaoPath}"`;
  try {
    execSync(`node scripts/build-icao-registry-data/dist/index.js ${icaoArgs}`, {
      stdio: 'inherit',
      cwd: resolve(import.meta.dirname, '..'),
    });
  } catch {
    console.error('FAILED: icao-registry');
    failures++;
  }
}

console.log('');
if (failures > 0) {
  console.error(`${failures} pipeline(s) failed.`);
  process.exit(1);
} else {
  console.log('All pipelines completed successfully.');
}
