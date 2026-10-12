import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';
import type { Polygon } from 'geojson';

import { closeRing } from '@squawk/build-shared';
import { greatCircle } from '@squawk/geo';
import type { AirspaceFeature, AirspaceType, AirspaceVolume, AltitudeBound } from '@squawk/types';

import { discretizeArc } from './discretize-arc.js';
import { normalizeSaaAltitude } from './normalize-altitude.js';

/**
 * Largest distance between the end of one ring member and the start of the
 * next at which the two are treated as the same point. The FAA publishes the
 * coordinates of a legal description to the second of arc and derives arc
 * endpoints separately, so an arc's computed end commonly misses the
 * adjoining published point by a few tenths of a nautical mile (0.65 nm on
 * W-193); left alone, that overlap makes the first arc chord cross the
 * adjoining segment.
 */
const JOIN_TOLERANCE_NM = 1;

/**
 * The points of one curve member of a GML ring, tagged with the member kind
 * so joins can prefer published line coordinates over computed arc points.
 */
interface RingMember {
  /** `line` for LineStringSegment coordinates, `arc` for discretized arcs and circles. */
  kind: 'line' | 'arc';
  /** Member coordinates as [lon, lat] pairs. */
  points: [number, number][];
}

/** Feet per nautical mile, used to convert radius values when uom is "FT". */
const FT_PER_NM = 6076.12;

/** Nautical miles per statute mile, used to convert radius values when uom is "MI". */
const NM_PER_STATUTE_MILE = 1609.344 / 1852;

/**
 * Reads a GML radius element and returns the value in nautical miles.
 * The radius uom is almost always "NM"; a few features use "FT" (feet) and
 * a few legal descriptions written in statute miles use "MI". Any other
 * unit is reported and read as nautical miles. Returns NaN if the value
 * cannot be parsed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readRadiusNm(radiusElement: any, entryName: string): number {
  const raw: number = radiusElement?.['#text'] ?? radiusElement;
  const uom: string = radiusElement?.['@_uom'] ?? 'NM';
  switch (uom) {
    case 'NM':
      return raw;
    case 'FT':
      return raw / FT_PER_NM;
    case 'MI':
      return raw * NM_PER_STATUTE_MILE;
    default:
      console.warn(`[parse-sua] Unknown radius unit "${uom}" in "${entryName}" - reading as NM.`);
      return raw;
  }
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
 * XML parser configured for the SAA AIXM documents: attributes are kept
 * with an `@_` prefix and the elements that can repeat are always arrays.
 */
const SAA_PARSER = new XMLParser({
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

/**
 * Reads the SAA AIXM subscriber ZIP and returns the AirspaceFeatures of every
 * SUA airspace: one feature per BASE or UNION geometry component (see
 * {@link parseSuaXml}). Files that fail to parse are skipped with a warning.
 * The outer SaaSubscriberFile.zip contains an inner Saa_Sub_File.zip which
 * in turn holds one XML file per SUA.
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

  const features: AirspaceFeature[] = [];

  for (const entry of xmlEntries) {
    const xmlText = entry.getData().toString('utf-8');
    try {
      features.push(...parseSuaXml(xmlText, entry.entryName));
    } catch (err) {
      console.warn(
        `[parse-sua] Failed to parse "${entry.entryName}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return features;
}

/**
 * Parses a single SAA AIXM XML document into AirspaceFeatures.
 *
 * An airspace is published as one or more geometry components, each with
 * its own lateral boundary and altitude block. The `BASE` component is the
 * primary volume; `UNION` components add further volumes (A-682 Travis AFB
 * adds a lower shelf, the Birmingham 2 MOA three more areas), and each
 * becomes a feature of its own with the airspace's identifier and name, the
 * way Class B rings are published. `SUBTR` components describe volumes
 * excluded from the airspace in three dimensions (the Class D areas carved
 * out of A-211 Dothan, the airspace below 5,500 ft over part of R-5601F);
 * they become the `exclusions` of every feature of the airspace. Each limit
 * carries the FAA's INCLUSIVE/EXCLUSIVE marking as `inclusive`.
 *
 * Returns an empty array when the SUA type is unknown or no component can
 * be read.
 */
export function parseSuaXml(xmlText: string, entryName: string): AirspaceFeature[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = SAA_PARSER.parse(xmlText) as any;
  const members: unknown[] = doc?.SaaMessage?.hasMember ?? [];

  // The Airspace member holds the geometry and metadata.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const airspaceMember = members.find((m: any) => m?.Airspace !== undefined) as any;
  if (!airspaceMember) {
    console.warn(`[parse-sua] No Airspace member found in "${entryName}" - skipping.`);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timeSlice: any = airspaceMember.Airspace?.timeSlice?.AirspaceTimeSlice;
  if (!timeSlice) {
    return [];
  }

  // Determine SUA type from the SUA-namespace extension.
  const suaType = extractSuaType(timeSlice.extension);
  if (!suaType) {
    return [];
  }

  const airspaceType = SUA_TYPE_MAP[suaType];
  if (!airspaceType) {
    console.warn(`[parse-sua] Unknown SUA type "${suaType}" in "${entryName}" - skipping.`);
    return [];
  }

  const name: string = timeSlice.name ?? '';
  const identifier: string = timeSlice.designator ?? '';
  const state = extractState(timeSlice.extension);
  const controllingFacility = extractControllingFacility(members);
  const scheduleDescription = extractScheduleDescription(timeSlice.annotation);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geometryComponents: any[] = Array.isArray(timeSlice.geometryComponent)
    ? timeSlice.geometryComponent
    : timeSlice.geometryComponent
      ? [timeSlice.geometryComponent]
      : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const components: any[] = geometryComponents
    .map((gc) => gc?.AirspaceGeometryComponent)
    .filter((component) => component !== undefined && component !== null)
    .sort((a, b) => Number(a.operationSequence ?? 0) - Number(b.operationSequence ?? 0));

  const features: AirspaceFeature[] = [];
  const exclusions: AirspaceVolume[] = [];
  for (const component of components) {
    const operation: string = component.operation ?? 'BASE';
    if (operation !== 'BASE' && operation !== 'UNION' && operation !== 'SUBTR') {
      console.warn(
        `[parse-sua] Unknown geometry operation "${operation}" in "${entryName}" - skipping component.`,
      );
      continue;
    }
    const label =
      operation === 'BASE'
        ? entryName
        : `${entryName} (${operation} ${component.operationSequence ?? ''})`;

    const volume = readVolume(component, label);
    if (volume === null) {
      continue;
    }
    if (operation === 'SUBTR') {
      exclusions.push(volume);
      continue;
    }

    features.push({
      type: airspaceType,
      name,
      identifier,
      floor: volume.floor,
      ceiling: volume.ceiling,
      boundary: volume.boundary,
      state,
      controllingFacility,
      scheduleDescription,
      artccStratum: null,
    });
  }

  if (features.length === 0) {
    console.warn(`[parse-sua] No usable geometry component in "${entryName}" - skipping.`);
    return [];
  }
  if (exclusions.length > 0) {
    for (const feature of features) {
      feature.exclusions = exclusions;
    }
  }
  return features;
}

/**
 * Reads a geometry component's AirspaceVolume: its floor and ceiling, each
 * carrying the FAA's inclusive/exclusive marking, and its lateral boundary.
 * Returns null and logs a warning when any part cannot be read.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readVolume(component: any, label: string): AirspaceVolume | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const volume: any = component.theAirspaceVolume?.AirspaceVolume;
  if (!volume) {
    console.warn(`[parse-sua] No AirspaceVolume in "${label}" - skipping component.`);
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
    console.warn(`[parse-sua] Could not parse altitude bounds in "${label}" - skipping component.`);
    return null;
  }
  applyLimitInclusivity(floor, volume, 'lowerLimit');
  applyLimitInclusivity(ceiling, volume, 'upperLimit');

  const boundary = extractBoundary(volume.horizontalProjection?.Surface, label);
  if (!boundary) {
    return null;
  }

  return { floor, ceiling, boundary };
}

/**
 * Marks a bound exclusive when the volume's annotations say so. The FAA
 * annotates each limit with a Note whose `propertyName` names the limit and
 * whose text is `INCLUSIVE` or `EXCLUSIVE`; "to but not including FL 180" is
 * published as an upper limit of FL180 annotated EXCLUSIVE. A limit without
 * an annotation is inclusive and the bound is left as it is.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyLimitInclusivity(bound: AltitudeBound, volume: any, limit: string): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const annotations: any[] = Array.isArray(volume.annotation) ? volume.annotation : [];
  for (const annotation of annotations) {
    if (annotation?.Note?.propertyName !== limit) {
      continue;
    }
    if (annotation?.Note?.translatedNote?.LinguisticNote?.note === 'EXCLUSIVE') {
      bound.inclusive = false;
    }
    return;
  }
}

/**
 * Finds the SUA-namespace AirspaceExtension among a list of extension members
 * and returns the suaType string, or null if not found.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSuaType(extensions: any[] | undefined): string | null {
  if (!Array.isArray(extensions)) {
    return null;
  }
  for (const ext of extensions) {
    const suaType = ext?.AirspaceExtension?.suaType;
    if (typeof suaType === 'string') {
      return suaType;
    }
  }
  return null;
}

/**
 * Finds the SAA-namespace AirspaceExtension and returns the two-letter state
 * code derived from the administrativeArea full name, or null.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractState(extensions: any[] | undefined): string | null {
  if (!Array.isArray(extensions)) {
    return null;
  }
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
      if (typeof designator === 'string') {
        return designator;
      }
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
  if (!Array.isArray(annotations)) {
    return null;
  }

  for (const annotation of annotations) {
    if (annotation?.Note?.propertyName !== 'legalDefinitionType') {
      continue;
    }
    const noteText: unknown = annotation?.Note?.translatedNote?.LinguisticNote?.note;
    if (typeof noteText !== 'string') {
      continue;
    }

    // Extract the "Times of use." section up to the next labelled section.
    const match = noteText.match(
      /Times of use\.\s*(.+?)(?=\s*(?:Controlling agency|Using agency|$))/is,
    );
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Converts a GML Surface element (from the SAA AIXM horizontalProjection) into
 * a GeoJSON Polygon. Handles both LineStringSegment (direct coordinate lists)
 * and ArcByCenterPoint (circular arcs) curve members within the exterior Ring,
 * joining consecutive members (see {@link joinRingMembers}). Returns null and
 * logs a warning if the geometry cannot be constructed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractBoundary(surface: any, entryName: string): Polygon | null {
  const exterior = surface?.patches?.PolygonPatch?.exterior;
  if (!exterior) {
    console.warn(`[parse-sua] No exterior Ring in "${entryName}" - skipping.`);
    return null;
  }

  const members: RingMember[] = [];

  if (exterior.LinearRing) {
    // Simple polygon: pos elements are direct children of LinearRing.
    members.push({ kind: 'line', points: extractLineStringPoints(exterior.LinearRing, entryName) });
  } else if (exterior.Ring) {
    const curveMembers: unknown[] = Array.isArray(exterior.Ring.curveMember)
      ? exterior.Ring.curveMember
      : [];

    for (const member of curveMembers) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const segments = (member as any)?.Curve?.segments;
      if (!segments) {
        continue;
      }

      if (segments.LineStringSegment) {
        members.push({
          kind: 'line',
          points: extractLineStringPoints(segments.LineStringSegment, entryName),
        });
      } else if (segments.ArcByCenterPoint) {
        members.push({
          kind: 'arc',
          points: extractArcPoints(segments.ArcByCenterPoint, entryName),
        });
      } else if (segments.CircleByCenterPoint) {
        members.push({
          kind: 'arc',
          points: extractCirclePoints(segments.CircleByCenterPoint, entryName),
        });
      }
    }
  } else {
    console.warn(`[parse-sua] No exterior Ring in "${entryName}" - skipping.`);
    return null;
  }

  const coordinates = joinRingMembers(members.filter((m) => m.points.length > 0));

  if (coordinates.length < 4) {
    console.warn(
      `[parse-sua] Too few coordinates (${coordinates.length}) in "${entryName}" - skipping.`,
    );
    return null;
  }

  return { type: 'Polygon', coordinates: [closeRing(coordinates)] };
}

/**
 * Concatenates the members of a ring into one open coordinate list. Where a
 * member ends within {@link JOIN_TOLERANCE_NM} of the next member's start,
 * the two points are the same corner published twice, and the one computed
 * from an arc is dropped in favour of the published line coordinate (the
 * next member's point when both are the same kind). The same rule closes
 * the ring between the last and first members.
 */
function joinRingMembers(members: RingMember[]): [number, number][] {
  const coordinates: [number, number][] = [];
  let previousKind: RingMember['kind'] | undefined;

  for (const member of members) {
    const points = [...member.points];
    const last = coordinates[coordinates.length - 1];
    const first = points[0];
    if (last !== undefined && first !== undefined && previousKind !== undefined) {
      if (isSameCorner(last, first)) {
        if (previousKind === 'arc' && member.kind === 'line') {
          coordinates.pop();
        } else {
          points.shift();
        }
      }
    }
    coordinates.push(...points);
    previousKind = member.kind;
  }

  const ringStart = coordinates[0];
  const ringEnd = coordinates[coordinates.length - 1];
  if (
    members.length > 1 &&
    ringStart !== undefined &&
    ringEnd !== undefined &&
    coordinates.length > 1 &&
    isSameCorner(ringEnd, ringStart) &&
    (ringEnd[0] !== ringStart[0] || ringEnd[1] !== ringStart[1])
  ) {
    const lastMember = members[members.length - 1];
    const firstMember = members[0];
    if (lastMember?.kind === 'line' && firstMember?.kind === 'arc') {
      coordinates.shift();
    } else {
      coordinates.pop();
    }
  }

  return coordinates;
}

/**
 * Returns `true` when two ring points are within {@link JOIN_TOLERANCE_NM}
 * of each other.
 */
function isSameCorner(a: [number, number], b: [number, number]): boolean {
  return greatCircle.distanceNm(a[1], a[0], b[1], b[0]) <= JOIN_TOLERANCE_NM;
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
    if (typeof pos !== 'string' && typeof pos !== 'number') {
      continue;
    }
    const parts = String(pos).trim().split(/\s+/);
    if (parts.length < 2) {
      console.warn(`[parse-sua] Malformed pos "${pos}" in "${entryName}" - skipping point.`);
      continue;
    }
    const lon = parseFloat(parts[0] ?? '');
    const lat = parseFloat(parts[1] ?? '');
    if (!isFinite(lon) || !isFinite(lat)) {
      continue;
    }
    points.push([lon, lat]);
  }

  return points;
}

/**
 * Converts a GML ArcByCenterPoint element into discretized [lon, lat] pairs.
 * The center pos is in "lon lat" format (CRS84 lon/lat order). The radius is
 * converted to nautical miles. Angles are in degrees from east,
 * counterclockwise, and their order gives the direction of travel (see
 * {@link discretizeArc}).
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
  const radiusNm = readRadiusNm(arc.radius, entryName);
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
  const radiusNm = readRadiusNm(circle.radius, entryName);

  if (!isFinite(centerLon) || !isFinite(centerLat) || !isFinite(radiusNm)) {
    console.warn(`[parse-sua] Incomplete circle parameters in "${entryName}" - skipping circle.`);
    return [];
  }

  return discretizeArc(centerLon, centerLat, radiusNm, 0, 360);
}
