/**
 * Validates the generated airspace GeoJSON file against known NASR data
 * characteristics, structural requirements, and geographic sanity checks.
 *
 * Usage: node validate.mjs [path-to-geojson]
 * Defaults to ../../packages/libs/airspace-data/data/airspace.geojson
 */

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultPath = resolve(__dirname, '../../packages/libs/airspace-data/data/airspace.geojson');
const inputPath = process.argv[2] ? resolve(process.argv[2]) : defaultPath;

let pass = 0;
let warn = 0;
let fail = 0;

function check(label, ok, detail) {
  if (ok) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label}${detail ? ' -- ' + detail : ''}`);
    fail++;
  }
}

function warning(label, detail) {
  console.log(`  WARN  ${label}${detail ? ' -- ' + detail : ''}`);
  warn++;
}

// ── Load ──

console.log(`\nValidating: ${inputPath}\n`);
const text = await readFile(inputPath, 'utf-8');
const json = JSON.parse(text);

// ── Top-level structure ──

console.log('=== Structure ===');
check('type is FeatureCollection', json.type === 'FeatureCollection');
check('has properties object', typeof json.properties === 'object' && json.properties !== null);
check(
  'has nasrCycleDate',
  typeof json.properties?.nasrCycleDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(json.properties.nasrCycleDate),
);
check('has generatedAt', typeof json.properties?.generatedAt === 'string');
check(
  'has featureCount matching features.length',
  json.properties?.featureCount === json.features?.length,
);
check('features is a non-empty array', Array.isArray(json.features) && json.features.length > 0);

const features = json.features;

// ── Feature counts by type ──

console.log('\n=== Feature Counts ===');
const typeCounts = {};
for (const f of features) {
  const t = f.properties?.type ?? 'UNKNOWN';
  typeCounts[t] = (typeCounts[t] ?? 0) + 1;
}
console.log('  Breakdown:', JSON.stringify(typeCounts, null, 2).replace(/\n/g, '\n  '));

// Expected approximate counts from NASR 2026-01-22 cycle (with tolerance for
// multi-component airspace and minor variations across cycles).
const expectedRanges = {
  CLASS_B: [150, 400],
  CLASS_C: [300, 700],
  CLASS_D: [400, 700],
  MOA: [300, 550],
  RESTRICTED: [200, 550],
  WARNING: [80, 220],
  ALERT: [15, 50],
  PROHIBITED: [5, 20],
  NSA: [5, 30],
};

for (const [type, [min, max]] of Object.entries(expectedRanges)) {
  const actual = typeCounts[type] ?? 0;
  check(
    `${type} count (${actual}) in expected range [${min}-${max}]`,
    actual >= min && actual <= max,
    actual < min ? `too few (${actual})` : actual > max ? `too many (${actual})` : undefined,
  );
}

// Check for unexpected types.
const validTypes = new Set(Object.keys(expectedRanges));
const unknownTypes = Object.keys(typeCounts).filter((t) => !validTypes.has(t));
check(
  'no unexpected airspace types',
  unknownTypes.length === 0,
  unknownTypes.length > 0 ? `found: ${unknownTypes.join(', ')}` : undefined,
);

// ── Geographic bounds ──

console.log('\n=== Geographic Bounds ===');

// US bounding box (generous, includes territories: AK, HI, PR, GU, Marianas).
// Alaska extends above 70N, Guam/Marianas are near 10-15N / 145E.
const US_LON_MIN = -180;
const US_LON_MAX = 180;
const US_LAT_MIN = 10;
const US_LAT_MAX = 82;

let lonMin = Infinity,
  lonMax = -Infinity,
  latMin = Infinity,
  latMax = -Infinity;
let outOfBoundsFeatures = [];

for (const f of features) {
  const coords = f.geometry?.coordinates?.[0];
  if (!coords) continue;
  for (const [lon, lat] of coords) {
    if (lon < lonMin) lonMin = lon;
    if (lon > lonMax) lonMax = lon;
    if (lat < latMin) latMin = lat;
    if (lat > latMax) latMax = lat;
  }

  // Check each feature's centroid is in US bounds.
  const avgLon = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const avgLat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  if (avgLon < US_LON_MIN || avgLon > US_LON_MAX || avgLat < US_LAT_MIN || avgLat > US_LAT_MAX) {
    outOfBoundsFeatures.push(`${f.properties?.name} (${avgLon.toFixed(2)}, ${avgLat.toFixed(2)})`);
  }
}

console.log(`  Lon range: [${lonMin.toFixed(4)}, ${lonMax.toFixed(4)}]`);
console.log(`  Lat range: [${latMin.toFixed(4)}, ${latMax.toFixed(4)}]`);
check(
  'all feature centroids within US bounds',
  outOfBoundsFeatures.length === 0,
  outOfBoundsFeatures.length > 0
    ? `${outOfBoundsFeatures.length} out of bounds: ${outOfBoundsFeatures.slice(0, 5).join('; ')}`
    : undefined,
);

// ── Geometry validity ──

console.log('\n=== Geometry Validity ===');

let unclosedRings = 0;
let tooFewCoords = 0;
let emptyGeometry = 0;

for (const f of features) {
  const coords = f.geometry?.coordinates;
  if (!coords || coords.length === 0) {
    emptyGeometry++;
    continue;
  }
  for (const ring of coords) {
    if (ring.length < 4) {
      tooFewCoords++;
      continue;
    }
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      unclosedRings++;
    }
  }
}

check(
  'no empty geometries',
  emptyGeometry === 0,
  emptyGeometry > 0 ? `${emptyGeometry} features` : undefined,
);
check(
  'all rings have >= 4 coordinates',
  tooFewCoords === 0,
  tooFewCoords > 0 ? `${tooFewCoords} rings too small` : undefined,
);
check(
  'all rings are closed (first == last)',
  unclosedRings === 0,
  unclosedRings > 0 ? `${unclosedRings} unclosed rings` : undefined,
);

// ── Altitude bounds ──

console.log('\n=== Altitude Bounds ===');

let invalidFloor = 0;
let invalidCeiling = 0;
let floorAboveCeiling = 0;

const validRefs = new Set(['MSL', 'AGL', 'SFC']);

for (const f of features) {
  const { floor, ceiling } = f.properties ?? {};
  if (!floor || typeof floor.valueFt !== 'number' || !validRefs.has(floor.reference)) {
    invalidFloor++;
    continue;
  }
  if (!ceiling || typeof ceiling.valueFt !== 'number' || !validRefs.has(ceiling.reference)) {
    invalidCeiling++;
    continue;
  }
  // Only compare floor vs ceiling when both are MSL (AGL/SFC comparison is unreliable).
  if (floor.reference === 'MSL' && ceiling.reference === 'MSL' && floor.valueFt > ceiling.valueFt) {
    floorAboveCeiling++;
  }
}

check(
  'all features have valid floor',
  invalidFloor === 0,
  invalidFloor > 0 ? `${invalidFloor} invalid` : undefined,
);
check(
  'all features have valid ceiling',
  invalidCeiling === 0,
  invalidCeiling > 0 ? `${invalidCeiling} invalid` : undefined,
);
check(
  'no MSL floor above MSL ceiling',
  floorAboveCeiling === 0,
  floorAboveCeiling > 0 ? `${floorAboveCeiling} features` : undefined,
);

// ── Required properties ──

console.log('\n=== Required Properties ===');

let missingName = 0;
let missingIdentifier = 0;
let missingType = 0;

for (const f of features) {
  if (!f.properties?.name) missingName++;
  if (f.properties?.identifier === '' || f.properties?.identifier == null) missingIdentifier++;
  if (!f.properties?.type) missingType++;
}

check(
  'all features have name',
  missingName === 0,
  missingName > 0 ? `${missingName} missing` : undefined,
);
// A small number of shapefile records have null IDENT (e.g. LYNDEN CLASS D).
// This is a source data issue, not a parsing bug.
if (missingIdentifier > 0 && missingIdentifier <= 5) {
  warning(`${missingIdentifier} features missing identifier (source data issue)`);
} else {
  check(
    'all features have identifier',
    missingIdentifier === 0,
    missingIdentifier > 0 ? `${missingIdentifier} missing` : undefined,
  );
}
check(
  'all features have type',
  missingType === 0,
  missingType > 0 ? `${missingType} missing` : undefined,
);

// ── Known-value spot checks ──

console.log('\n=== Known-Value Spot Checks ===');

function findFeature(type, identifier) {
  return features.find(
    (f) => f.properties?.type === type && f.properties?.identifier === identifier,
  );
}

// LAX Class B - should exist with SFC floor and 10000 MSL ceiling (innermost ring).
const laxB = features.filter(
  (f) => f.properties?.type === 'CLASS_B' && f.properties?.identifier === 'LAX',
);
check('LAX Class B exists', laxB.length > 0);
if (laxB.length > 0) {
  check('LAX Class B has multiple rings', laxB.length >= 3, `found ${laxB.length} rings`);
  const sfcRing = laxB.find((r) => r.properties?.floor?.reference === 'SFC');
  check('LAX Class B has an SFC floor ring', sfcRing !== undefined);
  if (sfcRing) {
    check(
      'LAX Class B SFC ring ceiling is 10000 MSL',
      sfcRing.properties?.ceiling?.valueFt === 10000 &&
        sfcRing.properties?.ceiling?.reference === 'MSL',
      `got ${sfcRing.properties?.ceiling?.valueFt} ${sfcRing.properties?.ceiling?.reference}`,
    );
  }
  check(
    'LAX Class B state is CA',
    laxB[0].properties?.state === 'CA',
    `got "${laxB[0].properties?.state}"`,
  );
}

// ORD Class B - Chicago.
const ordB = features.filter(
  (f) => f.properties?.type === 'CLASS_B' && f.properties?.identifier === 'ORD',
);
check('ORD Class B exists', ordB.length > 0);
if (ordB.length > 0) {
  check(
    'ORD Class B state is IL',
    ordB[0].properties?.state === 'IL',
    `got "${ordB[0].properties?.state}"`,
  );
}

// DCA Class B (Reagan National / Washington DC area).
const dcaB = features.filter(
  (f) => f.properties?.type === 'CLASS_B' && f.properties?.identifier === 'DCA',
);
check('DCA Class B exists', dcaB.length > 0);

// A well-known Class C - SDF (Louisville).
const sdfC = findFeature('CLASS_C', 'SDF');
check('SDF (Louisville) Class C exists', sdfC !== undefined);

// A well-known Class D.
const ozr = findFeature('CLASS_D', 'OZR');
check('OZR (Fort Novosel) Class D exists', ozr !== undefined);

// P-56 (DC prohibited area) - one of the most well-known prohibited areas.
// SUA identifiers in AIXM do not contain hyphens (e.g. "P56A" not "P-56A").
const p56 = features.find(
  (f) => f.properties?.type === 'PROHIBITED' && f.properties?.identifier?.startsWith('P56'),
);
check('P-56 (Washington DC) prohibited area exists', p56 !== undefined);
if (p56) {
  // P-56 should be near DC: lon ~ -77, lat ~ 38.9.
  const coords = p56.geometry?.coordinates?.[0];
  if (coords && coords.length > 0) {
    const avgLon = coords.reduce((s, c) => s + c[0], 0) / coords.length;
    const avgLat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
    check(
      'P-56 centroid is near Washington DC',
      avgLon > -77.5 && avgLon < -76.5 && avgLat > 38.5 && avgLat < 39.5,
      `centroid: (${avgLon.toFixed(3)}, ${avgLat.toFixed(3)})`,
    );
  }
}

// R-2508 Complex (Edwards AFB / China Lake) - large restricted area in CA.
const r2508 = features.find(
  (f) => f.properties?.type === 'RESTRICTED' && f.properties?.identifier?.startsWith('R2508'),
);
check('R-2508 (Edwards/China Lake) restricted area exists', r2508 !== undefined);
if (r2508) {
  check('R-2508 state is CA', r2508.properties?.state === 'CA', `got "${r2508.properties?.state}"`);
}

// W-137 warning area (off SE coast).
const w137 = features.find(
  (f) => f.properties?.type === 'WARNING' && f.properties?.identifier?.startsWith('W137'),
);
check('W-137 warning area exists', w137 !== undefined);

// A well-known MOA.
const brushy = features.find(
  (f) => f.properties?.type === 'MOA' && f.properties?.name?.includes('BRUSHY'),
);
if (brushy) {
  check('BRUSHY MOA found', true);
} else {
  // Try any MOA as a fallback to confirm MOAs exist with reasonable data.
  const anyMoa = features.find((f) => f.properties?.type === 'MOA');
  check(
    'at least one MOA exists with geometry',
    anyMoa !== undefined && anyMoa.geometry?.coordinates?.[0]?.length > 3,
  );
}

// Alert area check.
const anyAlert = features.find((f) => f.properties?.type === 'ALERT');
check('at least one ALERT area exists', anyAlert !== undefined);
if (anyAlert) {
  // Not all alert areas have facility/schedule data populated, so just verify the
  // properties exist on the object (even if null).
  check(
    'ALERT area has expected property keys',
    'controllingFacility' in (anyAlert.properties ?? {}) &&
      'scheduleDescription' in (anyAlert.properties ?? {}),
  );
}

// ── Coordinate precision ──

console.log('\n=== Coordinate Precision ===');

let maxDecimals = 0;
let sampleCount = 0;
outer: for (const f of features) {
  for (const ring of f.geometry?.coordinates ?? []) {
    for (const coord of ring) {
      for (const v of coord) {
        const str = String(v);
        const dot = str.indexOf('.');
        if (dot >= 0) {
          const decimals = str.length - dot - 1;
          if (decimals > maxDecimals) maxDecimals = decimals;
        }
        sampleCount++;
        if (sampleCount > 100000) break outer;
      }
    }
  }
}

check(`coordinate precision <= 5 decimal places (found ${maxDecimals})`, maxDecimals <= 5);

// ── Summary ──

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${pass} passed, ${warn} warnings, ${fail} failed`);
console.log(`${'='.repeat(40)}\n`);

process.exit(fail > 0 ? 1 : 0);
