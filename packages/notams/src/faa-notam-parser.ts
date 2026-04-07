import type {
  FaaNotam,
  FaaNotamClassification,
  FaaNotamKeyword,
  NotamDateTime,
} from './types/index.js';

/** The set of valid FAA NOTAM keywords. */
const VALID_KEYWORDS = new Set<string>([
  'RWY',
  'TWY',
  'APRON',
  'AD',
  'OBST',
  'NAV',
  'COM',
  'SVC',
  'AIRSPACE',
  'ODP',
  'SID',
  'STAR',
  'IAP',
  'VFP',
  'DVA',
  'ROUTE',
  'CHART',
  'DATA',
  'SPECIAL',
  'SECURITY',
]);

/**
 * Parses a NOTAM datetime string in YYMMDDHHmm format into a {@link NotamDateTime}.
 *
 * @param str - The 10-digit datetime string (e.g. "2604120730").
 * @returns The parsed datetime, or undefined if the format is invalid.
 */
function parseNotamDateTime(str: string): NotamDateTime | undefined {
  const cleaned = str.trim();
  if (cleaned.length !== 10 || !/^\d{10}$/.test(cleaned)) {
    return undefined;
  }
  return {
    year: parseInt(cleaned.substring(0, 2), 10),
    month: parseInt(cleaned.substring(2, 4), 10),
    day: parseInt(cleaned.substring(4, 6), 10),
    hour: parseInt(cleaned.substring(6, 8), 10),
    minute: parseInt(cleaned.substring(8, 10), 10),
  };
}

/**
 * Parses the effective period from the end of an FAA domestic NOTAM.
 * Handles formats: `YYMMDDHHMM-YYMMDDHHMM`, `YYMMDDHHMM-YYMMDDHHMMEST`, and `YYMMDDHHMM-PERM`.
 *
 * @param periodStr - The raw effective period string.
 * @returns The parsed effective period fields, or undefined if the format is invalid.
 */
function parseEffectivePeriod(periodStr: string):
  | {
      effectiveFrom: NotamDateTime;
      effectiveUntil?: NotamDateTime;
      isEstimatedEnd: boolean;
      isPermanent: boolean;
    }
  | undefined {
  const trimmed = periodStr.trim();

  // Match: YYMMDDHHMM-YYMMDDHHMM[EST] or YYMMDDHHMM-PERM
  const match = trimmed.match(/^(\d{10})-(\d{10})(EST)?$|^(\d{10})-(PERM)$/);
  if (!match) {
    return undefined;
  }

  if (match[5] === 'PERM') {
    // YYMMDDHHMM-PERM
    const from = parseNotamDateTime(match[4]!);
    if (!from) {
      return undefined;
    }
    return {
      effectiveFrom: from,
      isPermanent: true,
      isEstimatedEnd: false,
    };
  }

  // YYMMDDHHMM-YYMMDDHHMM[EST]
  const from = parseNotamDateTime(match[1]!);
  const until = parseNotamDateTime(match[2]!);
  if (!from || !until) {
    return undefined;
  }

  return {
    effectiveFrom: from,
    effectiveUntil: until,
    isEstimatedEnd: match[3] === 'EST',
    isPermanent: false,
  };
}

/**
 * Parses the airport name and location from an FDC NOTAM body.
 * FDC NOTAMs include the full airport name, city, and state after the keyword,
 * separated by commas and terminated by a period.
 *
 * Example: "HARTSFIELD/JACKSON ATLANTA INTL, ATLANTA, GA."
 *
 * @param bodyText - The text after the keyword in an FDC NOTAM.
 * @returns The parsed airport name, location, and remaining text, or undefined if not matched.
 */
function parseFdcAirportInfo(bodyText: string):
  | {
      airportName: string;
      airportLocation: string;
      remainingText: string;
    }
  | undefined {
  // FDC airport info pattern: NAME, CITY, ST. or NAME, CITY ST.
  // The airport name is everything up to the last comma before the city/state block,
  // and the location is "CITY, ST" or "CITY ST" terminated by a period.
  // The state code is always a 2-letter uppercase abbreviation followed by a period.
  const match = bodyText.match(/^(.+?),\s*([A-Z][A-Za-z .]+?[,\s]\s*[A-Z]{2})\.\s*/);
  if (!match) {
    return undefined;
  }

  return {
    airportName: match[1]!.trim(),
    airportLocation: match[2]!.trim(),
    remainingText: bodyText.substring(match[0].length).trim(),
  };
}

/**
 * Parses a raw FAA domestic (legacy) format NOTAM string into a structured
 * {@link FaaNotam} object.
 *
 * Handles both sub-formats:
 * - **NOTAM D** (facility-issued): `!ATL 03/296 ATL NAV ILS RWY 08L IM U/S 2603181657-2711082111EST`
 * - **FDC**: `!FDC 5/3374 ATL IAP HARTSFIELD/JACKSON ATLANTA INTL, ATLANTA, GA. [body] 2512021812-2712021809EST`
 *
 * The parser extracts the accountability, NOTAM number, location code, keyword,
 * body text, and effective period. For FDC NOTAMs, it additionally extracts the
 * airport name and city/state location.
 *
 * ```typescript
 * import { parseFaaNotam } from '@squawk/notams';
 *
 * const notam = parseFaaNotam(
 *   '!BOS 04/084 BOS TWY C APN SIGN LGT U/S 2604040835-2605092359'
 * );
 * console.log(notam.accountability);    // "BOS"
 * console.log(notam.classification);    // "NOTAM_D"
 * console.log(notam.keyword);           // "TWY"
 * console.log(notam.text);              // "C APN SIGN LGT U/S"
 * ```
 *
 * @param raw - The raw FAA domestic NOTAM string to parse.
 * @returns A parsed {@link FaaNotam} object.
 * @throws {Error} If the string cannot be parsed as a valid FAA domestic NOTAM.
 */
export function parseFaaNotam(raw: string): FaaNotam {
  const trimmed = raw.trim();

  if (!trimmed) {
    throw new Error('Empty NOTAM string');
  }

  // Normalize to single-spaced for easier parsing, preserving original for raw field
  const normalized = trimmed.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();

  // Must start with !
  if (!normalized.startsWith('!')) {
    throw new Error('FAA domestic NOTAM must start with "!"');
  }

  // Determine classification: FDC vs facility (NOTAM D)
  const isFdc = normalized.startsWith('!FDC ');

  let accountability: string;
  let classification: FaaNotamClassification;
  let cursor: number;

  if (isFdc) {
    accountability = 'FDC';
    classification = 'FDC';
    cursor = 5; // past "!FDC "
  } else {
    // Extract facility accountability: !XXX where XXX is 2-4 alphanumeric chars
    const acctMatch = normalized.match(/^!([A-Z0-9]{2,4})\s+/);
    if (!acctMatch) {
      throw new Error('Unable to parse FAA NOTAM accountability');
    }
    accountability = acctMatch[1]!;
    classification = 'NOTAM_D';
    cursor = acctMatch[0].length;
  }

  // Parse NOTAM number
  // NOTAM D: MM/NNN (2-digit month / 3-digit sequence)
  // FDC: D/NNNN (1-digit year / 4-digit sequence)
  const remaining = normalized.substring(cursor);
  const numberMatch = remaining.match(/^(\d{1,2}\/\d{3,4})\s+/);
  if (!numberMatch) {
    throw new Error('Unable to parse FAA NOTAM number');
  }
  const notamNumber = numberMatch[1]!;
  cursor += numberMatch[0].length;

  // Parse location code (2-4 alphanumeric identifier)
  const afterNumber = normalized.substring(cursor);
  const locationMatch = afterNumber.match(/^([A-Z0-9]{2,4})\s+/);
  if (!locationMatch) {
    throw new Error('Unable to parse FAA NOTAM location code');
  }
  const locationCode = locationMatch[1]!;
  cursor += locationMatch[0].length;

  // Parse keyword
  const afterLocation = normalized.substring(cursor);
  let keyword: FaaNotamKeyword | undefined;
  let keywordLength = 0;

  for (const kw of VALID_KEYWORDS) {
    // Keyword must be followed by a space or end of string
    if (afterLocation.startsWith(kw + ' ') || afterLocation === kw) {
      if (!keyword || kw.length > keyword.length) {
        keyword = kw as FaaNotamKeyword;
        keywordLength = kw.length;
      }
    }
  }

  if (!keyword) {
    throw new Error('Unable to parse FAA NOTAM keyword');
  }
  cursor += keywordLength + 1; // +1 for the space after keyword

  // Everything remaining is body text + effective period at the end
  const bodyAndPeriod = normalized.substring(cursor).trim();

  // The effective period is always at the end: YYMMDDHHMM-YYMMDDHHMM[EST] or YYMMDDHHMM-PERM
  // Find the last occurrence of the period pattern
  const periodMatch = bodyAndPeriod.match(/\s+(\d{10}-(?:\d{10}(?:EST)?|PERM))\s*$/);
  if (!periodMatch) {
    throw new Error('Unable to parse FAA NOTAM effective period');
  }

  const periodStr = periodMatch[1]!;
  const period = parseEffectivePeriod(periodStr);
  if (!period) {
    throw new Error(`Unable to parse FAA NOTAM effective period: "${periodStr}"`);
  }

  // Body text is everything between keyword and effective period
  let bodyText = bodyAndPeriod.substring(0, bodyAndPeriod.length - periodMatch[0].length).trim();

  // For FDC NOTAMs, extract airport name and location
  let airportName: string | undefined;
  let airportLocation: string | undefined;

  if (isFdc) {
    const airportInfo = parseFdcAirportInfo(bodyText);
    if (airportInfo) {
      airportName = airportInfo.airportName;
      airportLocation = airportInfo.airportLocation;
      bodyText = airportInfo.remainingText;
    }
  }

  // Clean up trailing periods from body text
  bodyText = bodyText.replace(/\.\s*$/, '').trim();

  return {
    raw: trimmed,
    accountability,
    classification,
    notamNumber,
    locationCode,
    keyword,
    ...(airportName !== undefined ? { airportName } : {}),
    ...(airportLocation !== undefined ? { airportLocation } : {}),
    text: bodyText,
    effectiveFrom: period.effectiveFrom,
    ...(period.effectiveUntil ? { effectiveUntil: period.effectiveUntil } : {}),
    isEstimatedEnd: period.isEstimatedEnd,
    isPermanent: period.isPermanent,
  };
}
