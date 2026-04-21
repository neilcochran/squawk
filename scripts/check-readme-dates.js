/**
 * CI check: verifies that each data package README contains a date matching
 * the date embedded in its built data file. Exits with code 1 if any
 * README is out of sync.
 *
 * Usage: node scripts/check-readme-dates.js
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Data packages with the cycle-date field name used in each package's
 * bundled JSON (under `meta` / `properties`) and the data-source label
 * embedded in the README ("FAA NASR", "FAA CIFP", "FAA ReleasableAircraft").
 */
const dataPackages = [
  {
    pkg: 'airport-data',
    dataFile: 'data/airports.json.gz',
    dateField: 'nasrCycleDate',
    source: 'NASR',
  },
  {
    pkg: 'navaid-data',
    dataFile: 'data/navaids.json.gz',
    dateField: 'nasrCycleDate',
    source: 'NASR',
  },
  { pkg: 'fix-data', dataFile: 'data/fixes.json.gz', dateField: 'nasrCycleDate', source: 'NASR' },
  {
    pkg: 'airway-data',
    dataFile: 'data/airways.json.gz',
    dateField: 'nasrCycleDate',
    source: 'NASR',
  },
  {
    pkg: 'airspace-data',
    dataFile: 'data/airspace.geojson.gz',
    dateField: 'nasrCycleDate',
    source: 'NASR',
  },
  {
    pkg: 'procedure-data',
    dataFile: 'data/procedures.json.gz',
    dateField: 'cifpCycleDate',
    source: 'CIFP',
  },
];

/** ICAO registry uses the ISO `generatedAt` timestamp rather than a publication cycle date. */
const icaoPackage = { pkg: 'icao-registry-data', dataFile: 'data/icao-registry.json.gz' };

const datePattern = /from the \*\*(\d{4}-\d{2}-\d{2})\*\* FAA (NASR|CIFP|ReleasableAircraft)/;

let failures = 0;

for (const { pkg, dataFile, dateField, source } of dataPackages) {
  const dataPath = resolve(root, 'packages', pkg, dataFile);
  const readmePath = resolve(root, 'packages', pkg, 'README.md');

  const raw = gunzipSync(readFileSync(dataPath));
  const json = JSON.parse(raw.toString());
  const dataDate = json.meta?.[dateField] ?? json.properties?.[dateField];

  if (!dataDate) {
    console.error(`FAIL: ${pkg} - could not extract ${dateField} from data file`);
    failures++;
    continue;
  }

  const readme = readFileSync(readmePath, 'utf-8');
  const match = datePattern.exec(readme);

  if (!match) {
    console.error(`FAIL: ${pkg} - README has no date pattern to check`);
    failures++;
    continue;
  }

  if (match[2] !== source) {
    console.error(
      `FAIL: ${pkg} - README labels source as FAA ${match[2]} but expected FAA ${source}`,
    );
    failures++;
    continue;
  }

  if (match[1] !== dataDate) {
    console.error(`FAIL: ${pkg} - README says ${match[1]} but data file says ${dataDate}`);
    failures++;
  } else {
    console.log(`  OK: ${pkg} - ${dataDate}`);
  }
}

// ICAO registry: uses generatedAt (YYYY-MM-DD from ISO timestamp)
{
  const { pkg, dataFile } = icaoPackage;
  const dataPath = resolve(root, 'packages', pkg, dataFile);
  const readmePath = resolve(root, 'packages', pkg, 'README.md');

  const raw = gunzipSync(readFileSync(dataPath));
  const json = JSON.parse(raw.toString());
  const dataDate = json.meta?.generatedAt?.slice(0, 10);

  if (!dataDate) {
    console.error(`FAIL: ${pkg} - could not extract generatedAt from data file`);
    failures++;
  } else {
    const readme = readFileSync(readmePath, 'utf-8');
    const match = datePattern.exec(readme);

    if (!match) {
      console.error(`FAIL: ${pkg} - README has no date pattern to check`);
      failures++;
    } else if (match[1] !== dataDate) {
      console.error(`FAIL: ${pkg} - README says ${match[1]} but data file says ${dataDate}`);
      failures++;
    } else {
      console.log(`  OK: ${pkg} - ${dataDate}`);
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} README date(s) out of sync with data files.`);
  process.exit(1);
} else {
  console.log('\nAll README dates match their data files.');
}
