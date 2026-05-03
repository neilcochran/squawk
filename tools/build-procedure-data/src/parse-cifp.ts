import type {
  MissedApproachSequence,
  Procedure,
  ProcedureCommonRoute,
  ProcedureLegFixCategory,
  ProcedureTransition,
} from '@squawk/types';

import { approachTypeFromRouteType, runwayFromApproachIdentifier } from './classify-approach.js';
import { parseArincLatitude, parseArincLongitude } from './coord.js';
import { decodePrimaryLegRecord, type DecodedLegRecord } from './decode-leg.js';

/**
 * Location + category entry stored in the fix index during parsing.
 */
interface FixIndexEntry {
  /** Latitude in decimal degrees. */
  lat: number;
  /** Longitude in decimal degrees. */
  lon: number;
  /** Fix category. */
  category: ProcedureLegFixCategory;
}

/**
 * Location cache for resolving recommended navaid coordinates (leg `rho`
 * / `theta` tuning). Keyed identically to the main fix index; used only
 * to provide the navaid's lat/lon when decoding the leg's recommended
 * navaid reference.
 */
export type FixIndex = ReadonlyMap<string, FixIndexEntry>;

/**
 * Builds the composite lookup key used by the fix index. Keys are
 * formed from the fix identifier, the ICAO region code, and the CIFP
 * section code - all uppercase and trimmed.
 */
function fixKey(ident: string, region: string, section: string): string {
  return `${ident}::${region}::${section}`;
}

/**
 * Scans all CIFP records in the file and builds a lookup index mapping
 * each fix, navaid, airport, and runway reference to its decimal-degree
 * coordinates. Records that cannot be parsed (missing coordinates,
 * malformed section codes) are skipped silently.
 *
 * @param lines - All records in `FAACIFP18`, one record per line.
 */
export function buildFixIndex(lines: string[]): Map<string, FixIndexEntry> {
  const index = new Map<string, FixIndexEntry>();
  for (const raw of lines) {
    if (raw.length < 132) {
      continue;
    }
    if (raw.charAt(0) !== 'S') {
      continue;
    }

    const sectionCharA = raw.charAt(4);

    if (sectionCharA === 'E') {
      if (raw.charAt(5) !== 'A') {
        continue;
      }
      if (raw.charAt(21) !== '0' && raw.charAt(21) !== '1') {
        continue;
      }
      const ident = raw.substring(13, 18).trim();
      const region = raw.substring(19, 21).trim();
      const lat = parseArincLatitude(raw.substring(32, 41));
      const lon = parseArincLongitude(raw.substring(41, 51));
      if (ident.length === 0 || region.length === 0 || lat === undefined || lon === undefined) {
        continue;
      }
      index.set(fixKey(ident, region, 'EA'), { lat, lon, category: 'FIX' });
      continue;
    }

    if (sectionCharA === 'D') {
      const sub = raw.charAt(5);
      if (sub !== ' ' && sub !== 'B') {
        continue;
      }
      if (raw.charAt(21) !== '0' && raw.charAt(21) !== '1') {
        continue;
      }
      const ident = raw.substring(13, 17).trim();
      const region = raw.substring(19, 21).trim();
      let lat = parseArincLatitude(raw.substring(32, 41));
      let lon = parseArincLongitude(raw.substring(41, 51));
      if (sub === ' ' && (lat === undefined || lon === undefined)) {
        lat = parseArincLatitude(raw.substring(55, 64));
        lon = parseArincLongitude(raw.substring(64, 74));
      }
      if (ident.length === 0 || region.length === 0 || lat === undefined || lon === undefined) {
        continue;
      }
      const section = sub === ' ' ? 'D ' : 'DB';
      const entry = { lat, lon, category: 'NAVAID' as const };
      index.set(fixKey(ident, region, section), entry);
      // CIFP publishes all NDBs under section `DB` even when they are
      // airport-associated, but procedure legs at airports often reference
      // them by the airport-subsection code `PN`. Dual-index so either
      // lookup resolves.
      if (section === 'DB') {
        index.set(fixKey(ident, region, 'PN'), entry);
      }
      continue;
    }

    if (sectionCharA !== 'P') {
      continue;
    }

    const subsection = raw.charAt(12);
    const region = raw.substring(10, 12).trim();

    if (subsection === 'A') {
      if (raw.charAt(21) !== '0' && raw.charAt(21) !== '1') {
        continue;
      }
      const ident = raw.substring(6, 10).trim();
      const lat = parseArincLatitude(raw.substring(32, 41));
      const lon = parseArincLongitude(raw.substring(41, 51));
      if (ident.length === 0 || region.length === 0 || lat === undefined || lon === undefined) {
        continue;
      }
      index.set(fixKey(ident, region, 'PA'), { lat, lon, category: 'AIRPORT' });
      continue;
    }

    if (subsection === 'C' || subsection === 'G') {
      if (raw.charAt(21) !== '0' && raw.charAt(21) !== '1') {
        continue;
      }
      const ident = raw.substring(13, 18).trim();
      const lat = parseArincLatitude(raw.substring(32, 41));
      const lon = parseArincLongitude(raw.substring(41, 51));
      if (ident.length === 0 || lat === undefined || lon === undefined) {
        continue;
      }
      const section = subsection === 'C' ? 'PC' : 'PG';
      const category: ProcedureLegFixCategory = subsection === 'C' ? 'FIX' : 'RUNWAY';
      const waypointRegion = raw.substring(19, 21).trim();
      const effectiveRegion = waypointRegion.length > 0 ? waypointRegion : region;
      if (effectiveRegion.length === 0) {
        continue;
      }
      index.set(fixKey(ident, effectiveRegion, section), { lat, lon, category });
      continue;
    }

    if (subsection === 'I' || subsection === 'N') {
      if (raw.charAt(21) !== '0' && raw.charAt(21) !== '1') {
        continue;
      }
      const ident = raw.substring(13, 17).trim();
      const lat = parseArincLatitude(raw.substring(32, 41));
      const lon = parseArincLongitude(raw.substring(41, 51));
      if (ident.length === 0 || lat === undefined || lon === undefined) {
        continue;
      }
      const section = subsection === 'I' ? 'PI' : 'PN';
      const waypointRegion = raw.substring(19, 21).trim();
      const effectiveRegion = waypointRegion.length > 0 ? waypointRegion : region;
      if (effectiveRegion.length === 0) {
        continue;
      }
      index.set(fixKey(ident, effectiveRegion, section), { lat, lon, category: 'NAVAID' });
      continue;
    }
  }
  return index;
}

/**
 * Parses `FAACIFP18` into the full list of procedures.
 *
 * The implementation performs two passes over the lines: one to build
 * the fix-coordinate index, and one to decode procedure leg records and
 * group them into {@link Procedure} objects.
 *
 * @param cifpText - Contents of `FAACIFP18` as a string.
 */
export function parseCifp(cifpText: string): Procedure[] {
  const lines = cifpText.split('\n').filter((line) => line.length >= 132);
  const fixIndex = buildFixIndex(lines);

  const decoded: DecodedLegRecord[] = [];
  for (const raw of lines) {
    const record = decodePrimaryLegRecord(raw);
    if (record === undefined) {
      continue;
    }
    resolveLegCoordinates(record, fixIndex);
    decoded.push(record);
  }

  return groupIntoProcedures(decoded);
}

/**
 * Populates `leg.lat` / `leg.lon` by looking up the leg's termination
 * fix in the pre-built fix index. The lookup uses the raw CIFP section
 * code preserved on the decoded record (e.g. `PC`, `EA`, `D `) to
 * disambiguate between fixes that share an identifier across sections.
 */
function resolveLegCoordinates(record: DecodedLegRecord, fixIndex: FixIndex): void {
  const { leg } = record;
  if (leg.fixIdentifier === undefined || leg.icaoRegionCode === undefined) {
    return;
  }
  const entry = fixIndex.get(fixKey(leg.fixIdentifier, leg.icaoRegionCode, record.fixSectionCode));
  if (entry === undefined) {
    return;
  }
  leg.lat = entry.lat;
  leg.lon = entry.lon;
}

/**
 * Groups decoded leg records into {@link Procedure} instances. A
 * procedure is uniquely identified by the tuple (airport, procedure
 * identifier, procedure type). Within a procedure, records are
 * distributed across common routes, named transitions, and (for IAPs)
 * the missed-approach sequence based on the ARINC 424 route type code.
 */
function groupIntoProcedures(records: DecodedLegRecord[]): Procedure[] {
  const byProcedure = new Map<string, DecodedLegRecord[]>();
  for (const rec of records) {
    const key = `${rec.airport}::${rec.procedureIdentifier}::${rec.procedureType}`;
    let arr = byProcedure.get(key);
    if (arr === undefined) {
      arr = [];
      byProcedure.set(key, arr);
    }
    arr.push(rec);
  }

  const procedures: Procedure[] = [];
  for (const group of byProcedure.values()) {
    const first = group[0];
    if (first === undefined) {
      continue;
    }

    const commonRouteBuckets = new Map<string, DecodedLegRecord[]>();
    const transitionBuckets = new Map<string, DecodedLegRecord[]>();
    const missedApproachRecords: DecodedLegRecord[] = [];

    for (const rec of group) {
      if (rec.procedureType === 'IAP') {
        if (rec.routeType === 'A') {
          pushBucket(transitionBuckets, rec.transitionIdentifier, rec);
        } else if (rec.routeType === 'Z') {
          missedApproachRecords.push(rec);
        } else {
          pushBucket(commonRouteBuckets, rec.routeType, rec);
        }
        continue;
      }
      if (isCommonRouteRouteType(rec.procedureType, rec.routeType)) {
        const bucketKey =
          rec.transitionIdentifier.length === 0
            ? rec.routeType
            : `${rec.routeType}::${rec.transitionIdentifier}`;
        pushBucket(commonRouteBuckets, bucketKey, rec);
      } else {
        pushBucket(transitionBuckets, `${rec.routeType}::${rec.transitionIdentifier}`, rec);
      }
    }

    const airports = new Set<string>();
    airports.add(first.airport);

    const commonRoutes: ProcedureCommonRoute[] = [];
    for (const bucket of commonRouteBuckets.values()) {
      bucket.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
      const splitIndex =
        first.procedureType === 'IAP' ? findEmbeddedMissedApproachStart(bucket) : -1;
      const commonLegs = splitIndex >= 0 ? bucket.slice(0, splitIndex) : bucket;
      commonRoutes.push({
        legs: commonLegs.map((b) => b.leg),
        airports: [first.airport],
      });
      if (splitIndex >= 0) {
        for (let i = splitIndex; i < bucket.length; i++) {
          const entry = bucket[i];
          if (entry !== undefined) {
            missedApproachRecords.push(entry);
          }
        }
      }
    }

    const transitions: ProcedureTransition[] = [];
    for (const bucket of transitionBuckets.values()) {
      bucket.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
      const transitionName = bucket[0]?.transitionIdentifier ?? '';
      transitions.push({
        name: transitionName,
        legs: bucket.map((b) => b.leg),
      });
    }

    let missedApproach: MissedApproachSequence | undefined;
    if (missedApproachRecords.length > 0) {
      missedApproachRecords.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
      missedApproach = { legs: missedApproachRecords.map((r) => r.leg) };
    }

    const procedure: Procedure = {
      name: composeName(first, commonRouteBuckets),
      identifier: first.procedureIdentifier,
      type: first.procedureType,
      airports: Array.from(airports),
      commonRoutes,
      transitions,
    };

    if (first.procedureType === 'IAP') {
      const finalRouteType = firstKey(commonRouteBuckets);
      if (finalRouteType !== undefined) {
        const approachType = approachTypeFromRouteType(finalRouteType);
        if (approachType !== undefined) {
          procedure.approachType = approachType;
        }
      }
      const runway = runwayFromApproachIdentifier(first.procedureIdentifier);
      if (runway !== undefined) {
        procedure.runway = runway;
      }
      if (missedApproach !== undefined) {
        procedure.missedApproach = missedApproach;
      }
    }

    procedures.push(procedure);
  }

  procedures.sort((a, b) => {
    const airportDiff = (a.airports[0] ?? '').localeCompare(b.airports[0] ?? '');
    if (airportDiff !== 0) {
      return airportDiff;
    }
    if (a.type !== b.type) {
      return a.type.localeCompare(b.type);
    }
    return a.identifier.localeCompare(b.identifier);
  });

  return procedures;
}

/**
 * CIFP route-type codes classified as the "common route" segment of a
 * SID or STAR. Runway transitions and enroute transitions use
 * different route-type codes within the same procedure.
 *
 * SID route types:
 *
 * - Common route: `2` (common), `5` (RNAV common), `M` (FMS common), `N` (RNP common).
 * - Runway transition: `1`, `4`, `F`, `R`, `T` (plus `0` engine-out).
 * - Enroute transition: `3`, `6`, `S`, `V`, `P`.
 *
 * STAR route types:
 *
 * - Common route: `2`, `5`, `8`, `M`, `N`.
 * - Runway transition: `3`, `6`, `9`, `S`, `P`.
 * - Enroute transition: `1`, `4`, `7`, `F`, `R`.
 */
const SID_COMMON_ROUTE_TYPES: ReadonlySet<string> = new Set(['2', '5', 'M', 'N']);
const STAR_COMMON_ROUTE_TYPES: ReadonlySet<string> = new Set(['2', '5', '8', 'M', 'N']);

/**
 * Returns `true` when the given CIFP route-type letter classifies the
 * record as a common-route segment for the procedure type.
 *
 * @param procedureType - `SID` or `STAR` (IAPs use a different dispatch).
 * @param routeType - Single-character CIFP route-type code.
 */
export function isCommonRouteRouteType(
  procedureType: 'SID' | 'STAR' | 'IAP',
  routeType: string,
): boolean {
  if (procedureType === 'SID') {
    return SID_COMMON_ROUTE_TYPES.has(routeType);
  }
  if (procedureType === 'STAR') {
    return STAR_COMMON_ROUTE_TYPES.has(routeType);
  }
  return false;
}

/**
 * Finds the index of the first record in a sorted IAP final-approach
 * common-route bucket that begins the embedded missed-approach segment,
 * signalled by the Waypoint Description Code position-2 `M` flag.
 *
 * Returns `-1` when no leg carries the flag, meaning the entire bucket
 * is the final approach segment (with the missed approach sequence, if
 * any, published separately under route type `Z`).
 */
export function findEmbeddedMissedApproachStart(bucket: readonly DecodedLegRecord[]): number {
  for (let i = 0; i < bucket.length; i++) {
    const entry = bucket[i];
    if (entry !== undefined && entry.startsEmbeddedMissedApproach) {
      return i;
    }
  }
  return -1;
}

/**
 * Appends a record to a bucketed map, creating the bucket on first use.
 */
function pushBucket(
  map: Map<string, DecodedLegRecord[]>,
  key: string,
  record: DecodedLegRecord,
): void {
  let arr = map.get(key);
  if (arr === undefined) {
    arr = [];
    map.set(key, arr);
  }
  arr.push(record);
}

/**
 * Returns the first key of a map iteration, or `undefined` when the
 * map is empty. Used to extract the final-approach route type letter
 * from the first common-route bucket of an IAP.
 */
function firstKey<K>(map: Map<K, unknown>): K | undefined {
  for (const key of map.keys()) {
    return key;
  }
  return undefined;
}

/**
 * Composes a human-readable name for a procedure.
 *
 * - SIDs and STARs use the CIFP identifier as the name (e.g. `AALLE4`).
 * - IAPs use the approach classification plus runway (or circling suffix) derived from the common-route records.
 */
export function composeName(
  first: DecodedLegRecord,
  commonRouteBuckets: Map<string, DecodedLegRecord[]>,
): string {
  if (first.procedureType !== 'IAP') {
    return first.procedureIdentifier;
  }
  const finalRouteType = firstKey(commonRouteBuckets);
  const approachType =
    finalRouteType === undefined ? undefined : approachTypeFromRouteType(finalRouteType);
  const runway = runwayFromApproachIdentifier(first.procedureIdentifier);
  const label = approachType === undefined ? first.procedureIdentifier.charAt(0) : approachType;
  if (runway !== undefined) {
    return `${label} RWY ${runway}`;
  }
  const circlingSuffix = first.procedureIdentifier.substring(1).replace(/^[A-Z]*-?/, '-');
  const cleaned = circlingSuffix.trim().replace(/^-+/, '-');
  return cleaned.length > 1 ? `${label}${cleaned}` : first.procedureIdentifier;
}
