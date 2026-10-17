#!/usr/bin/env node

/**
 * Data snapshot profiler. Walks every bundled `*-data` snapshot, compares
 * each field with the `@squawk/types` interface the record claims to follow,
 * and fails when a field looks broken. Findings are keyed by interface field
 * (`ProcedureLeg.courseIsTrue`), counting every object of that interface in
 * the snapshot wherever it is nested:
 *
 * - NEVER_DEFINED: a field the interface declares appears on no object.
 * - NOT_IN_TYPE: an object carries a field its interface does not declare.
 * - REQUIRED_MISSING: a field the interface requires is missing on some object.
 * - UNMAPPED_OBJECT: a nested object has no interface mapping in this script.
 * - MIXED_TYPES: a field holds values of more than one type (null aside).
 * - EMPTY_STRING: a field holds empty strings.
 * - CONSTANT: a string or number field holds one value everywhere.
 * - OUT_OF_BOUNDS: a numeric field, or a polygon vertex, leaves its physical
 *   range.
 *
 * Booleans are not checked for CONSTANT, because the builders emit most
 * flags only when they are set. Findings that describe the real data are
 * listed with a reason in `scripts/profile-data.allow.json`; an entry that no
 * longer matches a finding also fails, so the list cannot go stale.
 *
 * With `--report`, the profiler also prints, without failing, the fields
 * where one value covers more than 95% of the objects and the optional
 * fields present on every object.
 *
 * Run it after rebuilding a snapshot, and after changing a type in
 * `@squawk/types`, to catch a field that went empty or a type that drifted
 * from the data. It reads the type sources with a light parser that expects
 * the repo's interface style: one property per line, two-space indented.
 *
 * Usage: node scripts/profile-data.js [--report]
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

const root = resolve(import.meta.dirname, '..');
const report = process.argv.includes('--report');

/** Share of one value above which a field is reported as dominated by it. */
const DOMINANT_SHARE = 0.95;

/** Distinct values kept per field for the CONSTANT and DOMINANT checks. */
const MAX_TRACKED_VALUES = 50_000;

/**
 * The snapshots to profile. `types` maps each object path (`[]` marks an
 * array element) to the interface its objects follow. `geometry` lists the
 * paths that hold a GeoJSON Polygon, whose vertices are range-checked and not
 * walked as fields.
 */
const DATASETS = [
  {
    name: 'airports',
    file: 'packages/libs/airport-data/data/airports.json.gz',
    records: (json) => json.records,
    types: {
      '': 'Airport',
      'runways[]': 'Runway',
      'runways[].pavementClassification': 'PavementClassification',
      'runways[].ends[]': 'RunwayEnd',
      'runways[].ends[].ils': 'IlsSystem',
      'frequencies[]': 'AirportFrequency',
    },
  },
  {
    name: 'navaids',
    file: 'packages/libs/navaid-data/data/navaids.json.gz',
    records: (json) => json.records,
    types: { '': 'Navaid', 'checkpoints[]': 'NavaidCheckpoint' },
  },
  {
    name: 'fixes',
    file: 'packages/libs/fix-data/data/fixes.json.gz',
    records: (json) => json.records,
    types: { '': 'Fix', 'navaidAssociations[]': 'FixNavaidAssociation' },
  },
  {
    name: 'airways',
    file: 'packages/libs/airway-data/data/airways.json.gz',
    records: (json) => json.records,
    types: { '': 'Airway', 'waypoints[]': 'AirwayWaypoint' },
  },
  {
    name: 'airspace',
    file: 'packages/libs/airspace-data/data/airspace.geojson.gz',
    // Each GeoJSON feature's properties are an AirspaceFeature whose
    // `boundary` is the feature's geometry.
    records: (json) =>
      json.features.map((feature) => ({ ...feature.properties, boundary: feature.geometry })),
    types: {
      '': 'AirspaceFeature',
      floor: 'AltitudeBound',
      ceiling: 'AltitudeBound',
      'exclusions[]': 'AirspaceVolume',
      'exclusions[].floor': 'AltitudeBound',
      'exclusions[].ceiling': 'AltitudeBound',
    },
    geometry: ['boundary', 'exclusions[].boundary'],
  },
  {
    name: 'procedures',
    file: 'packages/libs/procedure-data/data/procedures.json.gz',
    records: (json) => json.records,
    types: {
      '': 'Procedure',
      'commonRoutes[]': 'ProcedureCommonRoute',
      'transitions[]': 'ProcedureTransition',
      missedApproach: 'MissedApproachSequence',
      ...Object.fromEntries(
        ['commonRoutes[].legs[]', 'transitions[].legs[]', 'missedApproach.legs[]'].flatMap(
          (legs) => [
            [legs, 'ProcedureLeg'],
            [`${legs}.altitudeConstraint`, 'AltitudeConstraint'],
            [`${legs}.speedConstraint`, 'SpeedConstraint'],
          ],
        ),
      ),
    },
  },
  {
    name: 'icao-registry',
    file: 'packages/libs/icao-registry-data/data/icao-registry.json.gz',
    records: (json) => json.records,
    types: { '': 'AircraftRegistration' },
  },
];

/** The `@squawk/types` sources that declare the interfaces above. */
const TYPE_FILES = [
  'airport.ts',
  'navaid.ts',
  'fix.ts',
  'airway.ts',
  'airspace.ts',
  'procedure.ts',
  'registry.ts',
];

/**
 * Physical ranges for numeric fields, matched against the field name,
 * optionally limited to one dataset. The first matching rule applies; a
 * field no rule matches is not range-checked.
 */
const BOUNDS = [
  { field: /^(lat|dmeLat)$/, min: -90, max: 90 },
  { field: /^(lon|dmeLon)$/, min: -180, max: 180 },
  { field: /ElevationFt$|^elevationFt$/, min: -300, max: 15_000 },
  { dataset: 'airports', field: /^frequencyMhz$/, min: 2, max: 400 },
  { dataset: 'navaids', field: /^frequencyMhz$/, min: 108, max: 136 },
  { field: /^frequencyKhz$/, min: 190, max: 535 },
  { field: /^lengthFt$/, min: 1, max: 30_000 },
  { field: /^widthFt$/, min: 1, max: 10_000 },
  { field: /^verticalAngleDeg$/, min: -10, max: 0 },
  { field: /^glideSlopeAngleDeg$/, min: 1, max: 6 },
  { field: /^magneticVariationDeg$/, min: 0, max: 60 },
  { field: /Deg$/, min: 0, max: 360 },
  { field: /Nm$/, min: 0, max: 5_000 },
  { field: /^yearManufactured$/, min: 1900, max: new Date().getFullYear() + 1 },
  { field: /Ft(Agl)?$/, min: -1_500, max: 99_999 },
];

/**
 * Reads every exported interface of the type sources into a map of interface
 * name to its fields, each marked optional (true) or required (false).
 */
function loadInterfaces() {
  const interfaces = new Map();
  for (const file of TYPE_FILES) {
    const source = readFileSync(resolve(root, 'packages/libs/types/src', file), 'utf8');
    const pattern = /^export interface (\w+)[^{]*\{\n([\s\S]*?)\n\}/gm;
    for (const match of source.matchAll(pattern)) {
      const fields = new Map();
      for (const line of match[2].split('\n')) {
        const property = /^ {2}(\w+)(\?)?:/.exec(line);
        if (property) {
          fields.set(property[1], property[2] === '?');
        }
      }
      interfaces.set(match[1], fields);
    }
  }
  return interfaces;
}

/** Increments a counter in a map. */
function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/**
 * Profiles one dataset. Returns the findings (`{ key, flag, detail }`, where
 * `key` is an interface field or a geometry path), the record count and the
 * number of interface fields seen.
 */
function profile(dataset, interfaces) {
  const json = JSON.parse(gunzipSync(readFileSync(resolve(root, dataset.file))).toString());
  const records = dataset.records(json);
  const geometryPaths = new Set(dataset.geometry ?? []);
  const objectCounts = new Map();
  const presence = new Map();
  const undeclared = new Map();
  const values = new Map();
  const unmapped = new Set();
  const vertexIssues = new Map();
  const findings = [];

  const valueStats = (key) => {
    let entry = values.get(key);
    if (entry === undefined) {
      entry = {
        types: new Set(),
        empty: 0,
        min: Infinity,
        max: -Infinity,
        counts: new Map(),
        overflow: false,
      };
      values.set(key, entry);
    }
    return entry;
  };

  const recordScalar = (key, value) => {
    const entry = valueStats(key);
    if (value === null) {
      entry.types.add('null');
      return;
    }
    const type = typeof value;
    entry.types.add(type);
    if (type === 'string' && value === '') {
      entry.empty++;
    }
    if (type === 'number') {
      entry.min = Math.min(entry.min, value);
      entry.max = Math.max(entry.max, value);
    }
    if (type === 'string' || type === 'number') {
      const text = String(value);
      if (entry.counts.has(text) || entry.counts.size < MAX_TRACKED_VALUES) {
        increment(entry.counts, text);
      } else {
        entry.overflow = true;
      }
    }
  };

  const checkPolygon = (path, polygon) => {
    for (const ring of polygon?.coordinates ?? []) {
      for (const [lon, lat] of ring) {
        if (!(lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90)) {
          increment(vertexIssues, path);
        }
      }
    }
  };

  const walkObject = (object, path) => {
    const interfaceName = dataset.types[path];
    increment(objectCounts, interfaceName);
    const fields = interfaces.get(interfaceName);
    for (const [field, value] of Object.entries(object)) {
      if (value === undefined) {
        continue;
      }
      const key = `${interfaceName}.${field}`;
      const childPath = path === '' ? field : `${path}.${field}`;
      increment(presence, key);
      if (!fields?.has(field)) {
        undeclared.set(key, interfaceName);
      }
      if (geometryPaths.has(childPath)) {
        checkPolygon(childPath, value);
      } else if (Array.isArray(value)) {
        for (const element of value) {
          walkElement(element, `${childPath}[]`, `${key}[]`);
        }
      } else {
        walkElement(value, childPath, key);
      }
    }
  };

  const walkElement = (value, path, key) => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      if (dataset.types[path] === undefined) {
        unmapped.add(path);
        return;
      }
      walkObject(value, path);
      return;
    }
    recordScalar(key, value);
  };

  for (const record of records) {
    walkObject(record, '');
  }

  // Interface conformance, counted over every object of each interface.
  for (const interfaceName of new Set(Object.values(dataset.types))) {
    const fields = interfaces.get(interfaceName);
    if (fields === undefined) {
      throw new Error(`${dataset.name}: interface ${interfaceName} not found in the type sources`);
    }
    const objects = objectCounts.get(interfaceName) ?? 0;
    if (objects === 0) {
      continue;
    }
    for (const [field, optional] of fields) {
      const key = `${interfaceName}.${field}`;
      const count = presence.get(key) ?? 0;
      if (count === 0) {
        findings.push({ key, flag: 'NEVER_DEFINED', detail: `on none of ${objects}` });
      } else if (!optional && count < objects) {
        findings.push({
          key,
          flag: 'REQUIRED_MISSING',
          detail: `missing on ${objects - count} of ${objects}`,
        });
      } else if (optional && count === objects && report) {
        findings.push({ key, flag: 'NOTE_OPTIONAL_ALWAYS_PRESENT', detail: `on all ${objects}` });
      }
    }
  }
  for (const [key, interfaceName] of undeclared) {
    findings.push({ key, flag: 'NOT_IN_TYPE', detail: `not declared on ${interfaceName}` });
  }
  for (const path of unmapped) {
    findings.push({
      key: path,
      flag: 'UNMAPPED_OBJECT',
      detail: 'add a type mapping to this script',
    });
  }
  for (const [path, count] of vertexIssues) {
    findings.push({
      key: path,
      flag: 'OUT_OF_BOUNDS',
      detail: `${count} vertices outside lon/lat range`,
    });
  }

  // Value checks on scalar fields.
  for (const [key, entry] of values) {
    const types = [...entry.types].filter((type) => type !== 'null');
    const total = [...entry.counts.values()].reduce((sum, n) => sum + n, 0);
    if (types.length > 1) {
      findings.push({ key, flag: 'MIXED_TYPES', detail: types.join(', ') });
    }
    if (entry.empty > 0) {
      findings.push({ key, flag: 'EMPTY_STRING', detail: `${entry.empty} of ${total}` });
    }
    if (!entry.overflow && entry.counts.size === 1 && total > 1 && !types.includes('boolean')) {
      const [only] = entry.counts.keys();
      findings.push({ key, flag: 'CONSTANT', detail: `${JSON.stringify(only)} on ${total}` });
    }
    if (types.includes('number')) {
      const field = key.slice(key.indexOf('.') + 1).replace(/\[\]$/, '');
      const rule = BOUNDS.find(
        (bound) =>
          (bound.dataset === undefined || bound.dataset === dataset.name) &&
          bound.field.test(field),
      );
      if (rule !== undefined && (entry.min < rule.min || entry.max > rule.max)) {
        findings.push({
          key,
          flag: 'OUT_OF_BOUNDS',
          detail: `values ${entry.min} to ${entry.max} outside ${rule.min} to ${rule.max}`,
        });
      }
    }
    if (report && entry.counts.size > 1 && total > 0) {
      const [topValue, topCount] = [...entry.counts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (topCount / total > DOMINANT_SHARE) {
        findings.push({
          key,
          flag: 'NOTE_DOMINANT',
          detail: `${JSON.stringify(topValue)} on ${((100 * topCount) / total).toFixed(1)}%`,
        });
      }
    }
  }

  return { findings, recordCount: records.length, fieldCount: presence.size };
}

const allowList = JSON.parse(
  readFileSync(resolve(root, 'scripts/profile-data.allow.json'), 'utf8'),
);
const allowed = new Map(
  allowList.map((entry) => [`${entry.dataset}|${entry.key}|${entry.flag}`, entry]),
);
const matched = new Set();
const interfaces = loadInterfaces();
let failures = 0;

for (const dataset of DATASETS) {
  const { findings, recordCount, fieldCount } = profile(dataset, interfaces);
  const problems = [];
  for (const finding of findings) {
    const id = `${dataset.name}|${finding.key}|${finding.flag}`;
    if (finding.flag.startsWith('NOTE_')) {
      console.log(
        `  note: ${dataset.name} ${finding.key} - ${finding.flag.slice(5)} (${finding.detail})`,
      );
    } else if (allowed.has(id)) {
      matched.add(id);
    } else {
      problems.push(finding);
    }
  }
  if (problems.length === 0) {
    console.log(`  OK: ${dataset.name} - ${recordCount} records, ${fieldCount} fields`);
  } else {
    for (const problem of problems) {
      console.error(`FAIL: ${dataset.name} ${problem.key} - ${problem.flag} (${problem.detail})`);
    }
    failures += problems.length;
  }
}

for (const [id, entry] of allowed) {
  if (!matched.has(id)) {
    console.error(
      `FAIL: allow-list entry no longer matches a finding, remove it: ${entry.dataset} ${entry.key} ${entry.flag}`,
    );
    failures++;
  }
}

if (failures > 0) {
  console.error(
    `\n${failures} data profile finding(s). Fix the data or the type, or list the finding with its reason in scripts/profile-data.allow.json.`,
  );
  process.exitCode = 1;
} else {
  console.log('\nEvery snapshot matches its types and value checks.');
}
