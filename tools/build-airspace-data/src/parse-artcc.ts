import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { Polygon } from 'geojson';
import type { AirspaceFeature, AltitudeBound, ArtccStratum, Coordinates } from '@squawk/types';
import { simplifyPolygon } from './simplify-polygon.js';
import { splitAtAntimeridian } from './split-antimeridian.js';

/**
 * Douglas-Peucker tolerance in degrees applied to ARTCC boundary polygons.
 * ARTCC boundaries are large in extent (whole-state to whole-ocean scale),
 * and a tolerance of `0.001` deg (~111 m) produces visually clean shapes
 * while keeping the per-stratum vertex count modest. This matches the
 * tolerance used for Class E features.
 */
const SIMPLIFICATION_TOLERANCE = 0.001;

/**
 * Marker substring within `BNDRY_PT_DESCRIP` that signals the current point
 * closes a shape by returning to its first point. Some entries include a
 * trailing period or extra whitespace, so we match case-insensitively against
 * the substring rather than requiring an exact equality.
 */
const POINT_OF_BEGINNING_MARKER = 'POINT OF BEGINNING';

/**
 * Country code in `ARB_BASE.csv` for US-controlled ARTCCs. Foreign centers
 * (CZEG Edmonton, CZQM Moncton, etc.) appear in the same file for
 * cartographic context but are excluded here because the package scope is
 * US airspace.
 */
const US_COUNTRY_CODE = 'US';

/**
 * Stratum altitude bounds. Floors and ceilings are operational
 * approximations rather than legal limits - LOW maps to the FAA Class E
 * column up to FL180, HIGH maps to Class A (FL180 to FL600), UTA maps to
 * the upper-control area above FL600, and the oceanic strata (CTA, FIR,
 * CTA/FIR) cover all altitudes within the FIR.
 */
const STRATUM_BOUNDS: Record<ArtccStratum, { floor: AltitudeBound; ceiling: AltitudeBound }> = {
  LOW: {
    floor: { valueFt: 0, reference: 'SFC' },
    ceiling: { valueFt: 18000, reference: 'MSL' },
  },
  HIGH: {
    floor: { valueFt: 18000, reference: 'MSL' },
    ceiling: { valueFt: 60000, reference: 'MSL' },
  },
  UTA: {
    floor: { valueFt: 60000, reference: 'MSL' },
    ceiling: { valueFt: 99999, reference: 'MSL' },
  },
  CTA: {
    floor: { valueFt: 0, reference: 'SFC' },
    ceiling: { valueFt: 99999, reference: 'MSL' },
  },
  FIR: {
    floor: { valueFt: 0, reference: 'SFC' },
    ceiling: { valueFt: 99999, reference: 'MSL' },
  },
  'CTA/FIR': {
    floor: { valueFt: 0, reference: 'SFC' },
    ceiling: { valueFt: 99999, reference: 'MSL' },
  },
};

/**
 * Maps the `(ALTITUDE, TYPE)` pair from `ARB_SEG.csv` to an {@link ArtccStratum}.
 * Returns `undefined` for combinations that are not recognized as a US ARTCC
 * stratum (typically foreign centers or stratum kinds outside the published
 * vocabulary).
 *
 * Exported for unit testing.
 */
export function resolveStratum(altitude: string, type: string): ArtccStratum | undefined {
  if (altitude === 'HIGH' && type === 'ARTCC') {
    return 'HIGH';
  }
  if (altitude === 'LOW' && type === 'ARTCC') {
    return 'LOW';
  }
  if (altitude === 'UNLIMITED') {
    if (type === 'UTA') {
      return 'UTA';
    }
    if (type === 'CTA') {
      return 'CTA';
    }
    if (type === 'FIR') {
      return 'FIR';
    }
    if (type === 'CTA/FIR') {
      return 'CTA/FIR';
    }
  }
  return undefined;
}

/** Parsed metadata row from `ARB_BASE.csv`. */
interface ArtccBaseRecord {
  /** Three-letter ARTCC code (e.g. "ZNY"). */
  locationId: string;
  /** Full center name (e.g. "NEW YORK"). */
  locationName: string;
  /** Two-letter US state abbreviation, or null if not a US center. */
  state: string | null;
}

/**
 * Parsed point row from `ARB_SEG.csv`, accumulated per stratum. Extends the
 * shared {@link Coordinates} type with the per-point sequence and description
 * fields needed to reassemble polygon rings.
 *
 * Exported for unit testing of {@link splitClosedShapes}.
 */
export interface ArtccSegPoint extends Coordinates {
  /** Sequence number used to order points within a stratum. */
  pointSeq: number;
  /** Boundary point description text (used to detect shape close markers). */
  description: string;
}

/**
 * UTF-8 byte order mark code point. Stripped from the very first character of
 * a CSV file when present, otherwise the BOM gets glued to the first column
 * name and breaks `indexOf` lookups against expected header strings.
 */
const UTF8_BOM = '\uFEFF';

/**
 * Parses a single line of the FAA NASR ARB CSV files into individual field
 * values. Unlike the simpler airport CSV parser used elsewhere in this build
 * tool, the ARB files mix quoted string fields (e.g. `"ZNY"`, `"ALBUQUERQUE"`)
 * with unquoted numeric fields (e.g. `35,46,0` for lat deg/min/sec). This
 * parser walks the line character-by-character, treating quoted regions as
 * opaque text and unquoted regions as comma-separated values. A leading
 * UTF-8 BOM is stripped so header parsing works on files that ship one.
 *
 * Exported for unit testing.
 */
export function parseCsvLine(line: string): string[] {
  const stripped = line.startsWith(UTF8_BOM) ? line.slice(1) : line;
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < stripped.length; i++) {
    const char = stripped[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  fields.push(current);
  return fields;
}

/**
 * Reads `ARB_BASE.csv` and returns a map from ARTCC `LOCATION_ID` to its
 * metadata. Filters to US-controlled centers via the `COUNTRY_CODE` column.
 */
async function loadArtccBase(csvPath: string): Promise<Map<string, ArtccBaseRecord>> {
  const records = new Map<string, ArtccBaseRecord>();

  const rl = createInterface({
    input: createReadStream(csvPath),
    crlfDelay: Infinity,
  });

  let isHeader = true;
  let locationIdCol = -1;
  let locationNameCol = -1;
  let countryCodeCol = -1;
  let stateCol = -1;

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }
    const fields = parseCsvLine(line);

    if (isHeader) {
      locationIdCol = fields.indexOf('LOCATION_ID');
      locationNameCol = fields.indexOf('LOCATION_NAME');
      countryCodeCol = fields.indexOf('COUNTRY_CODE');
      stateCol = fields.indexOf('STATE');
      if (
        locationIdCol === -1 ||
        locationNameCol === -1 ||
        countryCodeCol === -1 ||
        stateCol === -1
      ) {
        throw new Error(
          `ARB_BASE.csv is missing expected columns. ` + `Found: ${fields.slice(0, 10).join(', ')}`,
        );
      }
      isHeader = false;
      continue;
    }

    if (fields[countryCodeCol] !== US_COUNTRY_CODE) {
      continue;
    }

    const locationId = fields[locationIdCol];
    const locationName = fields[locationNameCol];
    if (!locationId || !locationName) {
      continue;
    }

    const stateRaw = fields[stateCol] ?? '';
    records.set(locationId, {
      locationId,
      locationName,
      state: stateRaw.length > 0 ? stateRaw : null,
    });
  }

  return records;
}

/**
 * Reads `ARB_SEG.csv` and returns boundary points grouped by `(LOCATION_ID,
 * stratum)`. Only US ARTCCs (those present in `arbBase`) and recognized
 * stratum kinds are retained. Points are sorted by `POINT_SEQ` within each
 * group before return.
 */
async function loadArtccSegments(
  csvPath: string,
  arbBase: Map<string, ArtccBaseRecord>,
): Promise<Map<string, { locationId: string; stratum: ArtccStratum; points: ArtccSegPoint[] }>> {
  const groups = new Map<
    string,
    { locationId: string; stratum: ArtccStratum; points: ArtccSegPoint[] }
  >();

  const rl = createInterface({
    input: createReadStream(csvPath),
    crlfDelay: Infinity,
  });

  let isHeader = true;
  let locationIdCol = -1;
  let altitudeCol = -1;
  let typeCol = -1;
  let pointSeqCol = -1;
  let latCol = -1;
  let lonCol = -1;
  let descripCol = -1;

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }
    const fields = parseCsvLine(line);

    if (isHeader) {
      locationIdCol = fields.indexOf('LOCATION_ID');
      altitudeCol = fields.indexOf('ALTITUDE');
      typeCol = fields.indexOf('TYPE');
      pointSeqCol = fields.indexOf('POINT_SEQ');
      latCol = fields.indexOf('LAT_DECIMAL');
      lonCol = fields.indexOf('LONG_DECIMAL');
      descripCol = fields.indexOf('BNDRY_PT_DESCRIP');
      if (
        locationIdCol === -1 ||
        altitudeCol === -1 ||
        typeCol === -1 ||
        pointSeqCol === -1 ||
        latCol === -1 ||
        lonCol === -1 ||
        descripCol === -1
      ) {
        throw new Error(
          `ARB_SEG.csv is missing expected columns. ` + `Found: ${fields.slice(0, 12).join(', ')}`,
        );
      }
      isHeader = false;
      continue;
    }

    const locationId = fields[locationIdCol] ?? '';
    if (!arbBase.has(locationId)) {
      continue;
    }

    const stratum = resolveStratum(fields[altitudeCol] ?? '', fields[typeCol] ?? '');
    if (stratum === undefined) {
      continue;
    }

    const pointSeq = parseInt(fields[pointSeqCol] ?? '', 10);
    const lat = parseFloat(fields[latCol] ?? '');
    const lon = parseFloat(fields[lonCol] ?? '');
    if (!isFinite(pointSeq) || !isFinite(lat) || !isFinite(lon)) {
      continue;
    }

    const key = `${locationId}|${stratum}`;
    const group = groups.get(key);
    const point: ArtccSegPoint = {
      pointSeq,
      lat,
      lon,
      description: fields[descripCol] ?? '',
    };
    if (group === undefined) {
      groups.set(key, { locationId, stratum, points: [point] });
    } else {
      group.points.push(point);
    }
  }

  for (const group of groups.values()) {
    group.points.sort((a, b) => a.pointSeq - b.pointSeq);
  }

  return groups;
}

/**
 * Splits a sequence of stratum points into one or more closed polygon rings
 * by breaking at points whose `BNDRY_PT_DESCRIP` contains "POINT OF
 * BEGINNING". Each emitted ring includes its closing duplicate point so the
 * result conforms to GeoJSON's "first equals last" requirement.
 *
 * Exported for unit testing.
 */
export function splitClosedShapes(points: ArtccSegPoint[]): [number, number][][] {
  const shapes: [number, number][][] = [];
  let current: [number, number][] = [];

  for (const point of points) {
    current.push([point.lon, point.lat]);
    if (point.description.toUpperCase().includes(POINT_OF_BEGINNING_MARKER)) {
      const first = current[0];
      const last = current[current.length - 1];
      if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
        current.push([first[0], first[1]]);
      }
      shapes.push(current);
      current = [];
    }
  }

  // Trailing points without a "POINT OF BEGINNING" marker are closed implicitly
  // so the polygon is still valid GeoJSON; this is defensive in case future
  // NASR cycles publish data without the explicit close marker.
  if (current.length > 0) {
    const first = current[0];
    const last = current[current.length - 1];
    if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
      current.push([first[0], first[1]]);
    }
    shapes.push(current);
  }

  return shapes;
}

/**
 * Parses NASR `ARB_BASE.csv` and `ARB_SEG.csv` into one or more
 * {@link AirspaceFeature} entries per US ARTCC. Each `(ARTCC, stratum)`
 * combination yields one feature per closed shape published in the source
 * data, so an oceanic stratum that consists of multiple disjoint regions
 * (e.g. ZOA UTA) is preserved as several features with the same identifier
 * and stratum.
 *
 * Antimeridian-crossing shapes (the Pacific FIR boundaries for ZAK and ZAP)
 * are split into two sub-polygons at the 180th meridian via
 * {@link splitAtAntimeridian}, so each emitted ring has coordinates within
 * the standard `[-180, 180]` longitude range. Each sub-polygon becomes its
 * own `AirspaceFeature` with the same `(identifier, artccStratum)` pair.
 */
export async function parseArtcc(
  /** Absolute path to `ARB_BASE.csv` extracted from the NASR CSV ZIP. */
  arbBaseCsvPath: string,
  /** Absolute path to `ARB_SEG.csv` extracted from the NASR CSV ZIP. */
  arbSegCsvPath: string,
): Promise<AirspaceFeature[]> {
  const arbBase = await loadArtccBase(arbBaseCsvPath);
  const groups = await loadArtccSegments(arbSegCsvPath, arbBase);

  const features: AirspaceFeature[] = [];

  for (const { locationId, stratum, points } of groups.values()) {
    const base = arbBase.get(locationId);
    if (!base) {
      continue;
    }

    const shapes = splitClosedShapes(points);
    for (const rawRing of shapes) {
      if (rawRing.length < 4) {
        console.warn(
          `[parse-artcc] ${locationId} ${stratum} shape has too few points (${rawRing.length}) - skipping.`,
        );
        continue;
      }

      const subRings = splitAtAntimeridian(rawRing);
      for (const ring of subRings) {
        if (ring.length < 4) {
          continue;
        }
        const rawBoundary: Polygon = { type: 'Polygon', coordinates: [ring] };
        const boundary = simplifyPolygon(rawBoundary, SIMPLIFICATION_TOLERANCE);
        const bounds = STRATUM_BOUNDS[stratum];

        features.push({
          type: 'ARTCC',
          name: base.locationName,
          identifier: base.locationId,
          floor: bounds.floor,
          ceiling: bounds.ceiling,
          boundary,
          state: base.state,
          controllingFacility: null,
          scheduleDescription: null,
          artccStratum: stratum,
        });
      }
    }
  }

  return features;
}
