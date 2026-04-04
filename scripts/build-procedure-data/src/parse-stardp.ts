import type {
  Procedure,
  ProcedureType,
  ProcedureWaypoint,
  ProcedureWaypointCategory,
  ProcedureWaypointTypeCode,
  ProcedureTransition,
  ProcedureCommonRoute,
} from '@squawk/types';
import { PROCEDURE_TYPE_MAP, PROCEDURE_WAYPOINT_CATEGORY_MAP } from '@squawk/types';

/**
 * A raw parsed record from one line of STARDP.txt before grouping.
 */
interface RawRecord {
  /** S (STAR) or D (SID). */
  recordType: string;
  /** 4-digit sequence number grouping records into procedures. */
  sequenceNumber: string;
  /** Raw 2-character waypoint type code (e.g. "P ", "AA", "NW"). */
  waypointTypeRaw: string;
  /** Latitude in decimal degrees. */
  lat: number;
  /** Longitude in decimal degrees. */
  lon: number;
  /** Fix or navaid identifier. */
  fixIdentifier: string;
  /** ICAO region code. */
  icaoRegionCode: string;
  /** Description text (non-empty on header records only). */
  description: string;
}

/**
 * Parses a latitude string from STARDP.txt format (e.g. "N4027123")
 * into decimal degrees. Format: N/S + DD + MM + SS + tenths.
 */
function parseLatitude(raw: string): number {
  const hemisphere = raw.charAt(0);
  const degrees = parseInt(raw.substring(1, 3), 10);
  const minutes = parseInt(raw.substring(3, 5), 10);
  const seconds = parseInt(raw.substring(5, 7), 10);
  const tenths = parseInt(raw.substring(7, 8), 10) || 0;

  let decimal = degrees + minutes / 60 + (seconds + tenths / 10) / 3600;
  if (hemisphere === 'S') {
    decimal = -decimal;
  }
  return Math.round(decimal * 1_000_000) / 1_000_000;
}

/**
 * Parses a longitude string from STARDP.txt format (e.g. "W10345252")
 * into decimal degrees. Format: E/W + DDD + MM + SS + tenths.
 */
function parseLongitude(raw: string): number {
  const hemisphere = raw.charAt(0);
  const degrees = parseInt(raw.substring(1, 4), 10);
  const minutes = parseInt(raw.substring(4, 6), 10);
  const seconds = parseInt(raw.substring(6, 8), 10);
  const tenths = parseInt(raw.substring(8, 9), 10) || 0;

  let decimal = degrees + minutes / 60 + (seconds + tenths / 10) / 3600;
  if (hemisphere === 'W') {
    decimal = -decimal;
  }
  return Math.round(decimal * 1_000_000) / 1_000_000;
}

/**
 * Normalizes a raw 2-character waypoint type code to a known ProcedureWaypointTypeCode.
 * Falls back to the first character if the 2-char code is not recognized.
 */
function normalizeTypeCode(raw: string): ProcedureWaypointTypeCode {
  const trimmed = raw.trim();
  if (trimmed in PROCEDURE_WAYPOINT_CATEGORY_MAP) {
    return trimmed as ProcedureWaypointTypeCode;
  }
  if (trimmed.charAt(0) in PROCEDURE_WAYPOINT_CATEGORY_MAP) {
    return trimmed.charAt(0) as ProcedureWaypointTypeCode;
  }
  return 'P';
}

/**
 * Parses a single fixed-width line from STARDP.txt into a RawRecord.
 */
function parseLine(line: string): RawRecord {
  return {
    recordType: line.substring(0, 1),
    sequenceNumber: line.substring(1, 5),
    waypointTypeRaw: line.substring(10, 12),
    lat: parseLatitude(line.substring(13, 21)),
    lon: parseLongitude(line.substring(21, 30)),
    fixIdentifier: line.substring(30, 35).trim(),
    icaoRegionCode: line.substring(36, 38).trim(),
    description: line.substring(38).trim(),
  };
}

/**
 * Extracts the computer code from a description header string.
 * The computer code always ends with a digit and may appear before or
 * after the dot depending on procedure type.
 *
 * STARs use "FIXNAME.COMPUTERCODE PROCEDURE_NAME" (code after dot).
 * SIDs use "COMPUTERCODE.FIXNAME PROCEDURE_NAME" (code before dot).
 *
 * Example: "AALLE.AALLE4 AALLE FOUR" yields "AALLE4"
 * Example: "ACCRA5.ACCRA ACCRA FIVE" yields "ACCRA5"
 */
function extractComputerCode(description: string): string {
  const dotIndex = description.indexOf('.');
  if (dotIndex === -1) {
    return '';
  }

  const beforeDot = description.substring(0, dotIndex).trim();
  const afterDot = description.substring(dotIndex + 1);
  const spaceIndex = afterDot.indexOf(' ');
  const afterDotToken =
    spaceIndex === -1 ? afterDot.trim() : afterDot.substring(0, spaceIndex).trim();

  if (/\d$/.test(afterDotToken)) {
    return afterDotToken;
  }
  if (/\d$/.test(beforeDot)) {
    return beforeDot;
  }
  return afterDotToken;
}

/**
 * Extracts the human-readable procedure or transition name from a description
 * header string. The name is everything after the "CODE.TOKEN" prefix.
 *
 * Examples:
 * - "AALLE.AALLE4 AALLE FOUR" yields "AALLE FOUR"
 * - "ACCRA5.ACCRA ACCRA FIVE" yields "ACCRA FIVE"
 * - "BBOTL.AALLE4 BBOTL TRANSITION" yields "BBOTL TRANSITION"
 */
function extractName(description: string): string {
  const dotIndex = description.indexOf('.');
  if (dotIndex === -1) {
    return description;
  }
  const afterDot = description.substring(dotIndex + 1);
  const spaceIndex = afterDot.indexOf(' ');
  if (spaceIndex === -1) {
    return afterDot.trim();
  }
  return afterDot.substring(spaceIndex + 1).trim();
}

/**
 * Returns true if the description indicates a transition path.
 */
function isTransition(description: string): boolean {
  return description.toUpperCase().includes('TRANSITION');
}

/**
 * Converts a RawRecord into a ProcedureWaypoint.
 */
function toWaypoint(rec: RawRecord): ProcedureWaypoint {
  const typeCode = normalizeTypeCode(rec.waypointTypeRaw);
  const category: ProcedureWaypointCategory = PROCEDURE_WAYPOINT_CATEGORY_MAP[typeCode];

  const wp: ProcedureWaypoint = {
    fixIdentifier: rec.fixIdentifier,
    category,
    typeCode,
    lat: rec.lat,
    lon: rec.lon,
  };

  if (rec.icaoRegionCode.length > 0) {
    wp.icaoRegionCode = rec.icaoRegionCode;
  }

  return wp;
}

/**
 * A path is a sequence of records from one header to the next.
 */
interface ParsedPath {
  /** Description from the header record. */
  description: string;
  /** Whether this is a transition path. */
  isTransition: boolean;
  /** All records in this path (header included). */
  records: RawRecord[];
}

/**
 * Splits a sequence of records (same sequence number) into individual paths.
 * A new path starts whenever a record has a non-empty description.
 */
function splitIntoPaths(records: RawRecord[]): ParsedPath[] {
  const paths: ParsedPath[] = [];
  let currentPath: ParsedPath | undefined;

  for (const rec of records) {
    if (rec.description.length > 0) {
      currentPath = {
        description: rec.description,
        isTransition: isTransition(rec.description),
        records: [rec],
      };
      paths.push(currentPath);
    } else if (currentPath) {
      currentPath.records.push(rec);
    }
  }

  return paths;
}

/**
 * Parses the full STARDP.txt content and returns an array of Procedure records.
 *
 * @param content - The full text content of STARDP.txt.
 * @returns Array of parsed Procedure records sorted alphabetically by computer code.
 */
export function parseStardp(content: string): Procedure[] {
  const lines = content.split(/\r?\n/).filter((l) => l.length >= 38);

  const bySequence = new Map<string, RawRecord[]>();

  for (const line of lines) {
    const rec = parseLine(line);
    const key = `${rec.recordType}${rec.sequenceNumber}`;
    let arr = bySequence.get(key);
    if (!arr) {
      arr = [];
      bySequence.set(key, arr);
    }
    arr.push(rec);
  }

  const procedures: Procedure[] = [];

  for (const [, records] of bySequence) {
    if (records.length === 0) {
      continue;
    }

    const paths = splitIntoPaths(records);
    if (paths.length === 0) {
      continue;
    }

    const firstPath = paths[0]!;
    const computerCode = extractComputerCode(firstPath.description);
    if (computerCode.length === 0) {
      continue;
    }

    const rawName = extractName(firstPath.description);
    const procedureType: ProcedureType = PROCEDURE_TYPE_MAP[records[0]!.recordType] ?? 'STAR';

    const allAirports = new Set<string>();
    const commonRoutes: ProcedureCommonRoute[] = [];
    const transitions: ProcedureTransition[] = [];

    for (const path of paths) {
      const waypoints: ProcedureWaypoint[] = [];
      const pathAirports: string[] = [];

      for (const rec of path.records) {
        const wp = toWaypoint(rec);
        if (wp.category === 'AIRPORT') {
          pathAirports.push(wp.fixIdentifier);
          allAirports.add(wp.fixIdentifier);
        } else {
          waypoints.push(wp);
        }
      }

      if (waypoints.length === 0) {
        continue;
      }

      if (path.isTransition) {
        const transName = extractTransitionName(path.description);
        transitions.push({
          name: transName,
          waypoints,
        });
      } else {
        commonRoutes.push({
          waypoints,
          airports: pathAirports,
        });
      }
    }

    if (commonRoutes.length === 0 && transitions.length === 0) {
      continue;
    }

    procedures.push({
      name: rawName,
      computerCode,
      type: procedureType,
      airports: Array.from(allAirports).sort(),
      commonRoutes,
      transitions,
    });
  }

  procedures.sort((a, b) => a.computerCode.localeCompare(b.computerCode));
  return procedures;
}

/**
 * Extracts the transition name from a description header containing "TRANSITION".
 * Example: "BBOTL.AALLE4 BBOTL TRANSITION" yields "BBOTL"
 * Example: "MCG.TAGER9   MCGRATH TRANSITION" yields "MCGRATH"
 * Example: "GAL.TAGER9   GALENA TRANSITION" yields "GALENA"
 */
function extractTransitionName(description: string): string {
  const name = extractName(description);
  return name.replace(/\s*TRANSITION\s*/i, '').trim();
}
