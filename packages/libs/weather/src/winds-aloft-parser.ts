/**
 * Parser for FD (Forecast Winds and Temperatures Aloft) text bulletins.
 * The wire format is sometimes referred to by its older name "FB".
 *
 * Bulletin structure: an optional preamble (WMO header, product code),
 * a `DATA BASED ON DDHHMM Z` line, a `VALID DDHHMM Z FOR USE HHMM-HHMMZ.
 * TEMPS NEG ABV <ALT>` line, an `FT` header row listing altitude columns,
 * and then one row per reporting station. Columns have fixed widths that
 * depend on the altitude (wind only below 5000 ft, wind + explicit-sign
 * temperature at 5000-24000 ft, wind + implicit-negative temperature
 * above 24000 ft). Blank columns indicate altitudes outside the station's
 * forecast range.
 */

import type { DayTime } from './types/shared.js';
import type {
  WindsAloftForecast,
  WindsAloftLevel,
  WindsAloftStationForecast,
} from './types/winds-aloft.js';

/**
 * Parses a raw FD winds-aloft forecast bulletin into a structured
 * {@link WindsAloftForecast} object. Handles the AWC wire-format preamble
 * (`(Extracted from X)` or a plain WMO header line), the fixed-width data
 * table, light-and-variable winds (raw code `9900`), high-speed wind
 * encoding (direction codes 51-86 denoting speeds >= 100 kt), and
 * implicit-negative temperatures above the `TEMPS NEG ABV` threshold.
 *
 * ```typescript
 * import { parseWindsAloft } from '@squawk/weather';
 *
 * const forecast = parseWindsAloft(rawFdBulletin);
 * console.log(forecast.altitudesFt); // [3000, 6000, 9000, 12000, 18000, 24000, 30000, 34000, 39000]
 * console.log(forecast.stations[0]?.stationId); // "BDL"
 * console.log(forecast.stations[0]?.levels[2]?.directionDeg); // 330
 * ```
 *
 * @param raw - The raw FD bulletin text to parse.
 * @returns A parsed {@link WindsAloftForecast} object.
 * @throws {Error} If the input is not a recognizable FD bulletin.
 */
export function parseWindsAloft(raw: string): WindsAloftForecast {
  const lines = raw.split(/\r?\n/);
  let wmoHeader: string | undefined;
  let productCode: string | undefined;

  let index = 0;
  for (; index < lines.length; index++) {
    const line = lines[index];
    if (line === undefined) {
      continue;
    }
    const trimmed = line.trim();
    if (trimmed.startsWith('DATA BASED ON')) {
      break;
    }
    const extractedMatch = trimmed.match(/^\(Extracted from (.+)\)$/);
    if (extractedMatch !== null) {
      wmoHeader = extractedMatch[1];
      continue;
    }
    if (/^FB[A-Z]{2}\d{2} [A-Z]{4} \d{6}$/.test(trimmed)) {
      wmoHeader = trimmed;
      continue;
    }
    if (/^FD\d[A-Z]+\d+$/.test(trimmed)) {
      productCode = trimmed;
      continue;
    }
  }

  if (index >= lines.length) {
    throw new Error('FD bulletin missing "DATA BASED ON" header');
  }
  const basedOn = parseBasedOn(lines[index]!);
  index++;

  index = skipBlankLines(lines, index);
  if (index >= lines.length) {
    throw new Error('FD bulletin missing "VALID" header');
  }
  const { validAt, useFrom, useTo, negativeTempsAboveFt } = parseValidLine(lines[index]!);
  index++;

  index = skipBlankLines(lines, index);
  if (index >= lines.length) {
    throw new Error('FD bulletin missing "FT" altitude header');
  }
  const ftLine = lines[index]!;
  if (!/^\s*FT\b/.test(ftLine)) {
    throw new Error(`FD bulletin expected "FT" altitude header, got: ${ftLine}`);
  }
  const { altitudesFt, columnEnds } = parseFtHeader(ftLine);
  index++;

  const stations: WindsAloftStationForecast[] = [];
  for (; index < lines.length; index++) {
    const line = lines[index]!;
    if (line.trim().length === 0) {
      continue;
    }
    const station = parseStationRow(line, altitudesFt, columnEnds, negativeTempsAboveFt);
    if (station !== undefined) {
      stations.push(station);
    }
  }

  return {
    raw,
    basedOn,
    validAt,
    useFrom,
    useTo,
    negativeTempsAboveFt,
    altitudesFt,
    stations,
    ...(wmoHeader !== undefined && { wmoHeader }),
    ...(productCode !== undefined && { productCode }),
  };
}

/**
 * Looks up the forecast level for a given altitude on a station row.
 * The altitude must match an altitude column in the forecast bulletin
 * exactly - no interpolation is performed.
 *
 * ```typescript
 * const level = getLevelAtFt(forecast.stations[0]!, 9000);
 * console.log(level?.speedKt);
 * ```
 *
 * @param station - The station forecast row to search.
 * @param altitudeFt - The altitude in feet MSL to look up.
 * @returns The matching {@link WindsAloftLevel} or undefined if no column matches.
 */
export function getLevelAtFt(
  station: WindsAloftStationForecast,
  altitudeFt: number,
): WindsAloftLevel | undefined {
  return station.levels.find((level) => level.altitudeFt === altitudeFt);
}

/** Advances past blank lines starting at `start`, returning the new index. */
function skipBlankLines(lines: string[], start: number): number {
  let i = start;
  while (i < lines.length && lines[i]!.trim().length === 0) {
    i++;
  }
  return i;
}

/** Parses a `DATA BASED ON DDHHMM Z` header line. */
function parseBasedOn(line: string): DayTime {
  const match = line.trim().match(/^DATA BASED ON (\d{2})(\d{2})(\d{2})Z/);
  if (match === null) {
    throw new Error(`FD bulletin "DATA BASED ON" header malformed: ${line}`);
  }
  return {
    day: Number.parseInt(match[1]!, 10),
    hour: Number.parseInt(match[2]!, 10),
    minute: Number.parseInt(match[3]!, 10),
  };
}

/** Parses the `VALID DDHHMMZ FOR USE HHMM-HHMMZ. TEMPS NEG ABV <ALT>` line. */
function parseValidLine(line: string): {
  validAt: DayTime;
  useFrom: DayTime;
  useTo: DayTime;
  negativeTempsAboveFt: number;
} {
  const match = line
    .trim()
    .match(
      /^VALID (\d{2})(\d{2})(\d{2})Z\s+FOR USE (\d{2})(\d{2})-(\d{2})(\d{2})Z\.\s+TEMPS NEG ABV (\d+)/,
    );
  if (match === null) {
    throw new Error(`FD bulletin "VALID" header malformed: ${line}`);
  }
  return {
    validAt: {
      day: Number.parseInt(match[1]!, 10),
      hour: Number.parseInt(match[2]!, 10),
      minute: Number.parseInt(match[3]!, 10),
    },
    useFrom: {
      hour: Number.parseInt(match[4]!, 10),
      minute: Number.parseInt(match[5]!, 10),
    },
    useTo: {
      hour: Number.parseInt(match[6]!, 10),
      minute: Number.parseInt(match[7]!, 10),
    },
    negativeTempsAboveFt: Number.parseInt(match[8]!, 10),
  };
}

/**
 * Parses the `FT  3000  6000  9000 ...` altitude-header row.
 *
 * Returns the altitude values and the column-end character positions
 * relative to the original line. Each altitude value in the header marks
 * the END character position of its data column; data column widths are
 * derived from the altitude itself (4 below 5000 ft, 7 at 5000-24000 ft,
 * 6 above 24000 ft).
 */
function parseFtHeader(line: string): { altitudesFt: number[]; columnEnds: number[] } {
  const altitudesFt: number[] = [];
  const columnEnds: number[] = [];
  const regex = /\d+/g;
  let match = regex.exec(line);
  while (match !== null) {
    altitudesFt.push(Number.parseInt(match[0], 10));
    columnEnds.push(match.index + match[0].length - 1);
    match = regex.exec(line);
  }
  if (altitudesFt.length === 0) {
    throw new Error(`FD bulletin "FT" row has no altitude columns: ${line}`);
  }
  return { altitudesFt, columnEnds };
}

/**
 * Parses a single station row into a {@link WindsAloftStationForecast}.
 * Returns undefined for rows with no station ID (e.g. trailing formatting).
 *
 * The FD wire format is fixed-width: the station identifier occupies
 * columns 0-2 (always 3 characters), a separator space lives at column 3,
 * and the first data column always begins at character 4. Subsequent
 * columns start two characters past the previous column's end (previous
 * column end + separator space). Blank columns represent altitudes
 * outside the station's forecast range and decode as missing entries.
 *
 * Rows shorter than the full set of altitude columns decode the missing
 * trailing columns as `isMissing: true` - this is intentional so that
 * partial bulletins produce partial data rather than throwing.
 */
function parseStationRow(
  line: string,
  altitudesFt: number[],
  columnEnds: number[],
  negativeTempsAboveFt: number,
): WindsAloftStationForecast | undefined {
  const stationId = line.substring(0, 3).trim();
  if (stationId.length === 0) {
    return undefined;
  }

  const levels: WindsAloftLevel[] = [];
  for (let i = 0; i < altitudesFt.length; i++) {
    const altitudeFt = altitudesFt[i]!;
    const colEnd = columnEnds[i]!;
    const colStart = i === 0 ? 4 : columnEnds[i - 1]! + 2;
    const raw = line.substring(colStart, colEnd + 1);
    levels.push(decodeEntry(raw, altitudeFt, negativeTempsAboveFt, stationId));
  }

  return { stationId, levels };
}

/**
 * Decodes one `DDSS`, `DDSS+TT`, `DDSS-TT`, or `DDSSTT` entry into a
 * {@link WindsAloftLevel}. Handles light-and-variable (`9900`), high-speed
 * winds (direction codes 51-86), and implicit-negative temperatures above
 * the `TEMPS NEG ABV` threshold. The `stationId` is threaded through so
 * error messages identify the offending station row.
 */
function decodeEntry(
  raw: string,
  altitudeFt: number,
  negativeTempsAboveFt: number,
  stationId: string,
): WindsAloftLevel {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { altitudeFt, isMissing: true, isLightAndVariable: false };
  }
  if (trimmed.length < 4) {
    throw new Error(
      `FD entry too short for station ${stationId} at altitude ${altitudeFt}: "${raw}"`,
    );
  }

  const windCode = trimmed.substring(0, 4);
  const dirCode = Number.parseInt(windCode.substring(0, 2), 10);
  const speedCode = Number.parseInt(windCode.substring(2, 4), 10);
  if (Number.isNaN(dirCode) || Number.isNaN(speedCode)) {
    throw new Error(
      `FD entry has non-numeric wind code for station ${stationId} at altitude ${altitudeFt}: "${raw}"`,
    );
  }

  let isLightAndVariable = false;
  let directionDeg: number | undefined;
  let speedKt: number | undefined;
  if (dirCode === 99 && speedCode === 0) {
    isLightAndVariable = true;
  } else if (dirCode >= 51 && dirCode <= 86) {
    directionDeg = (dirCode - 50) * 10;
    speedKt = speedCode + 100;
  } else if (dirCode >= 1 && dirCode <= 36) {
    directionDeg = dirCode * 10;
    speedKt = speedCode;
  } else {
    throw new Error(
      `FD entry has invalid wind direction for station ${stationId} at altitude ${altitudeFt}: "${raw}"`,
    );
  }

  let temperatureC: number | undefined;
  const tempPart = trimmed.substring(4);
  if (tempPart.length > 0) {
    if (tempPart.startsWith('+') || tempPart.startsWith('-')) {
      const parsed = Number.parseInt(tempPart, 10);
      if (Number.isNaN(parsed)) {
        throw new Error(
          `FD entry has malformed temperature for station ${stationId} at altitude ${altitudeFt}: "${raw}"`,
        );
      }
      temperatureC = parsed;
    } else {
      const parsed = Number.parseInt(tempPart, 10);
      if (Number.isNaN(parsed)) {
        throw new Error(
          `FD entry has malformed temperature for station ${stationId} at altitude ${altitudeFt}: "${raw}"`,
        );
      }
      temperatureC = altitudeFt > negativeTempsAboveFt ? -parsed : parsed;
    }
  }

  return {
    altitudeFt,
    isMissing: false,
    isLightAndVariable,
    ...(directionDeg !== undefined && { directionDeg }),
    ...(speedKt !== undefined && { speedKt }),
    ...(temperatureC !== undefined && { temperatureC }),
  };
}
