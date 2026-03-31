import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';
import type { Polygon } from 'geojson';
import type { AirspaceFeature, AirspaceType } from '@squawk/types';
import { normalizeSaaAltitude } from './normalize-altitude.js';
import { discretizeArc } from './discretize-arc.js';

/** Feet per nautical mile, used to convert radius values when uom is "FT". */
const FT_PER_NM = 6076.12;

/**
 * Reads a GML radius element and returns the value in nautical miles.
 * The radius uom is almost always "NM" but a small number of features
 * use "FT" (feet). Returns NaN if the value cannot be parsed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readRadiusNm(radiusElement: any): number {
  const raw: number = radiusElement?.['#text'] ?? radiusElement;
  const uom: string = radiusElement?.['@_uom'] ?? 'NM';
  if (uom === 'FT') return raw / FT_PER_NM;
  return raw;
}

/**
 * Maps full US state and territory names (as stored in the SAA AIXM
 * administrativeArea field) to their two-letter postal codes.
 */
const STATE_NAME_TO_CODE: Record<string, string> = {
  ALABAMA: 'AL',
  ALASKA: 'AK',
  ARIZONA: 'AZ',
  ARKANSAS: 'AR',
  CALIFORNIA: 'CA',
  COLORADO: 'CO',
  CONNECTICUT: 'CT',
  DELAWARE: 'DE',
  FLORIDA: 'FL',
  GEORGIA: 'GA',
  HAWAII: 'HI',
  IDAHO: 'ID',
  ILLINOIS: 'IL',
  INDIANA: 'IN',
  IOWA: 'IA',
  KANSAS: 'KS',
  KENTUCKY: 'KY',
  LOUISIANA: 'LA',
  MAINE: 'ME',
  MARYLAND: 'MD',
  MASSACHUSETTS: 'MA',
  MICHIGAN: 'MI',
  MINNESOTA: 'MN',
  MISSISSIPPI: 'MS',
  MISSOURI: 'MO',
  MONTANA: 'MT',
  NEBRASKA: 'NE',
  NEVADA: 'NV',
  'NEW HAMPSHIRE': 'NH',
  'NEW JERSEY': 'NJ',
  'NEW MEXICO': 'NM',
  'NEW YORK': 'NY',
  'NORTH CAROLINA': 'NC',
  'NORTH DAKOTA': 'ND',
  OHIO: 'OH',
  OKLAHOMA: 'OK',
  OREGON: 'OR',
  PENNSYLVANIA: 'PA',
  'RHODE ISLAND': 'RI',
  'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD',
  TENNESSEE: 'TN',
  TEXAS: 'TX',
  UTAH: 'UT',
  VERMONT: 'VT',
  VIRGINIA: 'VA',
  WASHINGTON: 'WA',
  'WEST VIRGINIA': 'WV',
  WISCONSIN: 'WI',
  WYOMING: 'WY',
  'DISTRICT OF COLUMBIA': 'DC',
  GUAM: 'GU',
  'PUERTO RICO': 'PR',
  'VIRGIN ISLANDS': 'VI',
  'AMERICAN SAMOA': 'AS',
  'NORTHERN MARIANA ISLANDS': 'MP',
};

/**
 * Maps SAA AIXM suaType codes to the AirspaceType values used in AirspaceFeature.
 */
const SUA_TYPE_MAP: Record<string, AirspaceType> = {
  MOA: 'MOA',
  RA: 'RESTRICTED',
  WA: 'WARNING',
  AA: 'ALERT',
  PA: 'PROHIBITED',
  NSA: 'NSA',
};

/** Name of the inner ZIP that contains the individual SUA XML files. */
const INNER_ZIP_NAME = 'Saa_Sub_File.zip';

/**
 * Reads the SAA AIXM subscriber ZIP and returns one AirspaceFeature per SUA
 * airspace. NSA entries and any features that fail to parse are skipped with a
 * warning. The outer SaaSubscriberFile.zip contains an inner Saa_Sub_File.zip
 * which in turn holds one XML file per SUA.
 */
export function parseSua(
  /** Absolute path to the SaaSubscriberFile.zip from the NASR subscription. */
  saaZipPath: string,
): AirspaceFeature[] {
  const outerZip = new AdmZip(saaZipPath);
  const innerZipBuffer = outerZip.readFile(INNER_ZIP_NAME);
  if (!innerZipBuffer) {
    throw new Error(`Could not read ${INNER_ZIP_NAME} from ${saaZipPath}`);
  }

  const innerZip = new AdmZip(innerZipBuffer);
  const xmlEntries = innerZip.getEntries().filter((e) => e.entryName.endsWith('.xml'));

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: true,
    parseTagValue: true,
    isArray: (name) =>
      [
        'hasMember',
        'curveMember',
        'geometryComponent',
        'annotation',
        'extension',
        'pos',
        'sheet',
      ].includes(name),
  });

  const features: AirspaceFeature[] = [];

  for (const entry of xmlEntries) {
    const xmlText = entry.getData().toString('utf-8');
    try {
      const feature = parseSuaXml(xmlText, parser, entry.entryName);
      if (feature) features.push(feature);
    } catch (err) {
      console.warn(
        `[parse-sua] Failed to parse "${entry.entryName}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return features;
}

/**
 * Parses a single SAA AIXM XML document into an AirspaceFeature.
 * Returns null when the SUA type is excluded from scope (e.g. NSA) or when
 * required fields cannot be extracted.
 */
function parseSuaXml(
  xmlText: string,
  parser: XMLParser,
  entryName: string,
): AirspaceFeature | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = parser.parse(xmlText) as any;
  const members: unknown[] = doc?.SaaMessage?.hasMember ?? [];

  // The Airspace member holds the geometry and metadata.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const airspaceMember = members.find((m: any) => m?.Airspace !== undefined) as any;
  if (!airspaceMember) {
    console.warn(`[parse-sua] No Airspace member found in "${entryName}" - skipping.`);
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timeSlice: any = airspaceMember.Airspace?.timeSlice?.AirspaceTimeSlice;
  if (!timeSlice) return null;

  // Determine SUA type from the SUA-namespace extension.
  const suaType = extractSuaType(timeSlice.extension);
  if (!suaType) return null;

  const airspaceType = SUA_TYPE_MAP[suaType];
  if (!airspaceType) {
    // Known excluded types (e.g. NSA) are silently skipped.
    return null;
  }

  const name: string = timeSlice.name ?? '';
  const identifier: string = timeSlice.designator ?? '';

  // Altitude and geometry live inside the AirspaceGeometryComponent. Some airspace
  // records have multiple geometry components (e.g. BASE + SUBTR for exclusion zones).
  // Always use the BASE component, which carries the primary boundary and altitude.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geometryComponents: any[] = Array.isArray(timeSlice.geometryComponent)
    ? timeSlice.geometryComponent
    : timeSlice.geometryComponent
      ? [timeSlice.geometryComponent]
      : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseComponent: any =
    geometryComponents.find((gc: any) => gc?.AirspaceGeometryComponent?.operation === 'BASE') ??
    geometryComponents[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const volume: any = baseComponent?.AirspaceGeometryComponent?.theAirspaceVolume?.AirspaceVolume;
  if (!volume) {
    console.warn(`[parse-sua] No AirspaceVolume in "${entryName}" - skipping.`);
    return null;
  }

  const floor = normalizeSaaAltitude(
    volume.lowerLimit?.['#text'] ?? volume.lowerLimit,
    volume.lowerLimit?.['@_uom'] ?? '',
    volume.lowerLimitReference ?? '',
  );
  const ceiling = normalizeSaaAltitude(
    volume.upperLimit?.['#text'] ?? volume.upperLimit,
    volume.upperLimit?.['@_uom'] ?? '',
    volume.upperLimitReference ?? '',
  );

  if (!floor || !ceiling) {
    console.warn(`[parse-sua] Could not parse altitude bounds in "${entryName}" - skipping.`);
    return null;
  }

  const boundary = extractBoundary(volume.horizontalProjection?.Surface, entryName);
  if (!boundary) return null;

  const state = extractState(timeSlice.extension);
  const controllingFacility = extractControllingFacility(members);
  const scheduleDescription = extractScheduleDescription(timeSlice.annotation);

  return {
    type: airspaceType,
    name,
    identifier,
    floor,
    ceiling,
    boundary,
    state,
    controllingFacility,
    scheduleDescription,
  };
}

/**
 * Finds the SUA-namespace AirspaceExtension among a list of extension members
 * and returns the suaType string, or null if not found.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSuaType(extensions: any[] | undefined): string | null {
  if (!Array.isArray(extensions)) return null;
  for (const ext of extensions) {
    const suaType = ext?.AirspaceExtension?.suaType;
    if (typeof suaType === 'string') return suaType;
  }
  return null;
}

/**
 * Finds the SAA-namespace AirspaceExtension and returns the two-letter state
 * code derived from the administrativeArea full name, or null.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractState(extensions: any[] | undefined): string | null {
  if (!Array.isArray(extensions)) return null;
  for (const ext of extensions) {
    const area = ext?.AirspaceExtension?.administrativeArea;
    if (typeof area === 'string') {
      return STATE_NAME_TO_CODE[area.toUpperCase()] ?? null;
    }
  }
  return null;
}

/**
 * Finds the ARTCC Unit member among all hasMember entries and returns its
 * designator (e.g. "ZKC") as the controlling facility, or null.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractControllingFacility(members: any[]): string | null {
  for (const member of members) {
    const unit = member?.Unit?.timeSlice?.UnitTimeSlice;
    if (unit?.type === 'ARTCC') {
      const designator = unit.designator;
      if (typeof designator === 'string') return designator;
    }
  }
  return null;
}

/**
 * Extracts the "Times of use" section from the legal definition annotation
 * text, which is the most human-readable schedule description available.
 * Returns null when no annotation or no "Times of use" section is found.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractScheduleDescription(annotations: any[] | undefined): string | null {
  if (!Array.isArray(annotations)) return null;

  for (const annotation of annotations) {
    if (annotation?.Note?.propertyName !== 'legalDefinitionType') continue;
    const noteText: unknown = annotation?.Note?.translatedNote?.LinguisticNote?.note;
    if (typeof noteText !== 'string') continue;

    // Extract the "Times of use." section up to the next labelled section.
    const match = noteText.match(
      /Times of use\.\s*(.+?)(?=\s*(?:Controlling agency|Using agency|$))/is,
    );
    if (match?.[1]) return match[1].trim();
  }

  return null;
}

/**
 * Converts a GML Surface element (from the SAA AIXM horizontalProjection) into
 * a GeoJSON Polygon. Handles both LineStringSegment (direct coordinate lists)
 * and ArcByCenterPoint (circular arcs) curve members within the exterior Ring.
 * Returns null and logs a warning if the geometry cannot be constructed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractBoundary(surface: any, entryName: string): Polygon | null {
  const exterior = surface?.patches?.PolygonPatch?.exterior;
  if (!exterior) {
    console.warn(`[parse-sua] No exterior Ring in "${entryName}" - skipping.`);
    return null;
  }

  const coordinates: [number, number][] = [];

  if (exterior.LinearRing) {
    // Simple polygon: pos elements are direct children of LinearRing.
    const points = extractLineStringPoints(exterior.LinearRing, entryName);
    coordinates.push(...points);
  } else if (exterior.Ring) {
    const curveMembers: unknown[] = Array.isArray(exterior.Ring.curveMember)
      ? exterior.Ring.curveMember
      : [];

    for (const member of curveMembers) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const segments = (member as any)?.Curve?.segments;
      if (!segments) continue;

      if (segments.LineStringSegment) {
        const points = extractLineStringPoints(segments.LineStringSegment, entryName);
        coordinates.push(...points);
      } else if (segments.ArcByCenterPoint) {
        const points = extractArcPoints(segments.ArcByCenterPoint, entryName);
        coordinates.push(...points);
      } else if (segments.CircleByCenterPoint) {
        const points = extractCirclePoints(segments.CircleByCenterPoint, entryName);
        coordinates.push(...points);
      }
    }
  } else {
    console.warn(`[parse-sua] No exterior Ring in "${entryName}" - skipping.`);
    return null;
  }

  if (coordinates.length < 4) {
    console.warn(
      `[parse-sua] Too few coordinates (${coordinates.length}) in "${entryName}" - skipping.`,
    );
    return null;
  }

  // GeoJSON requires the ring to be closed (first and last point identical).
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    coordinates.push([first[0], first[1]]);
  }

  return { type: 'Polygon', coordinates: [coordinates] };
}

/**
 * Parses the pos elements from a GML LineStringSegment into [lon, lat] pairs.
 * Each pos element contains a space-separated "lon lat" string.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractLineStringPoints(segment: any, entryName: string): [number, number][] {
  const posArray: unknown[] = Array.isArray(segment.pos) ? segment.pos : [segment.pos];
  const points: [number, number][] = [];

  for (const pos of posArray) {
    if (typeof pos !== 'string' && typeof pos !== 'number') continue;
    const parts = String(pos).trim().split(/\s+/);
    if (parts.length < 2) {
      console.warn(`[parse-sua] Malformed pos "${pos}" in "${entryName}" - skipping point.`);
      continue;
    }
    const lon = parseFloat(parts[0] ?? '');
    const lat = parseFloat(parts[1] ?? '');
    if (!isFinite(lon) || !isFinite(lat)) continue;
    points.push([lon, lat]);
  }

  return points;
}

/**
 * Converts a GML ArcByCenterPoint element into discretized [lon, lat] pairs.
 * The center pos is in "lon lat" format (CRS84 lon/lat order). The radius is
 * in nautical miles. Angles are in degrees from east, counterclockwise.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractArcPoints(arc: any, entryName: string): [number, number][] {
  const posArray: unknown[] = Array.isArray(arc.pointProperty?.Point?.pos)
    ? arc.pointProperty.Point.pos
    : [arc.pointProperty?.Point?.pos];

  const centerPos = posArray[0];
  if (typeof centerPos !== 'string' && typeof centerPos !== 'number') {
    console.warn(`[parse-sua] Missing arc center in "${entryName}" - skipping arc.`);
    return [];
  }

  const parts = String(centerPos).trim().split(/\s+/);
  if (parts.length < 2) {
    console.warn(`[parse-sua] Malformed arc center "${centerPos}" in "${entryName}" - skipping.`);
    return [];
  }

  const centerLon = parseFloat(parts[0] ?? '');
  const centerLat = parseFloat(parts[1] ?? '');
  const radiusNm = readRadiusNm(arc.radius);
  const startAngle: number = arc.startAngle?.['#text'] ?? arc.startAngle;
  const endAngle: number = arc.endAngle?.['#text'] ?? arc.endAngle;

  if (
    !isFinite(centerLon) ||
    !isFinite(centerLat) ||
    !isFinite(radiusNm) ||
    !isFinite(startAngle) ||
    !isFinite(endAngle)
  ) {
    console.warn(`[parse-sua] Incomplete arc parameters in "${entryName}" - skipping arc.`);
    return [];
  }

  return discretizeArc(centerLon, centerLat, radiusNm, startAngle, endAngle);
}

/**
 * Converts a GML CircleByCenterPoint element into discretized [lon, lat] pairs
 * representing a full circle. CircleByCenterPoint has a center point and radius
 * but no start or end angles, so it always produces a complete 360-degree ring.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractCirclePoints(circle: any, entryName: string): [number, number][] {
  const posArray: unknown[] = Array.isArray(circle.pointProperty?.Point?.pos)
    ? circle.pointProperty.Point.pos
    : [circle.pointProperty?.Point?.pos];

  const centerPos = posArray[0];
  if (typeof centerPos !== 'string' && typeof centerPos !== 'number') {
    console.warn(`[parse-sua] Missing circle center in "${entryName}" - skipping circle.`);
    return [];
  }

  const parts = String(centerPos).trim().split(/\s+/);
  if (parts.length < 2) {
    console.warn(
      `[parse-sua] Malformed circle center "${centerPos}" in "${entryName}" - skipping.`,
    );
    return [];
  }

  const centerLon = parseFloat(parts[0] ?? '');
  const centerLat = parseFloat(parts[1] ?? '');
  const radiusNm = readRadiusNm(circle.radius);

  if (!isFinite(centerLon) || !isFinite(centerLat) || !isFinite(radiusNm)) {
    console.warn(`[parse-sua] Incomplete circle parameters in "${entryName}" - skipping circle.`);
    return [];
  }

  return discretizeArc(centerLon, centerLat, radiusNm, 0, 360);
}
