import type { Coordinates } from '@squawk/types';
import type {
  ConvectiveSigmet,
  ConvectiveSigmetOutlook,
  ConvectiveSigmetRegion,
  DayTime,
  InternationalSigmet,
  NonConvectiveSigmet,
  Sigmet,
  SigmetHazard,
  SigmetHazardType,
  SigmetObservationStatus,
  SigmetSeriesName,
  SigmetTops,
} from './types/index.js';
import {
  parseAltitudeRange,
  parseIcaoPosition,
  parseIntensityChange,
  parseMovement,
  parseTimeString,
  parseVolcanoPosition,
} from './advisory-utils.js';

/**
 * Parses a single SIGMET record into a structured {@link Sigmet} object.
 *
 * For general use, prefer {@link parseSigmetBulletin} which handles both
 * single records and multi-SIGMET bulletins transparently.
 *
 * Automatically detects the SIGMET format (convective, non-convective, or
 * international ICAO) from the content and returns the appropriate variant
 * of the discriminated union.
 *
 * Accepts both raw WMO-wrapped messages (with header lines like WSUS32 KKCI)
 * and body-only messages.
 *
 * ```typescript
 * import { parseSigmet } from '@squawk/weather';
 *
 * const sigmet = parseSigmet('SIGMET NOVEMBER 3 VALID UNTIL 050200Z\n...');
 * if (sigmet.format === 'NONCONVECTIVE') {
 *   console.log(sigmet.seriesName, sigmet.hazards[0].hazardType);
 * }
 * ```
 *
 * @param raw - The raw SIGMET string to parse.
 * @returns A parsed {@link Sigmet} object.
 * @throws {Error} If the string cannot be parsed as a valid SIGMET.
 */
export function parseSigmet(raw: string): Sigmet {
  const trimmed = raw.trim();

  if (!trimmed) {
    throw new Error('Empty SIGMET string');
  }

  // Normalize to single line for easier parsing
  const normalized = trimmed
    .replace(/\r?\n|\r/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Detect format based on content
  if (normalized.includes('CONVECTIVE SIGMET')) {
    return parseConvectiveSigmet(normalized);
  }

  if (isInternationalFormat(normalized)) {
    return parseInternationalSigmet(normalized);
  }

  return parseNonConvectiveSigmet(normalized);
}

/**
 * Recommended entry point for SIGMET parsing. Handles both single SIGMET
 * records and multi-SIGMET bulletins, always returning an array.
 *
 * Consumers do not need to know whether their input is a single record or
 * a bulletin - this function handles both transparently. Real-world convective
 * SIGMET bulletins from AWC often contain multiple individually numbered
 * SIGMETs for a region, followed by a shared outlook section. This function
 * splits the bulletin, parses each SIGMET, and attaches the shared outlook
 * to each convective SIGMET.
 *
 * For non-convective and international SIGMETs (which are typically single
 * messages), this returns an array with one element.
 *
 * ```typescript
 * import { parseSigmetBulletin } from '@squawk/weather';
 *
 * const sigmets = parseSigmetBulletin(rawBulletin);
 * for (const sigmet of sigmets) {
 *   console.log(sigmet.format, sigmet.raw);
 * }
 * ```
 *
 * @param raw - The raw SIGMET bulletin string, possibly containing multiple SIGMETs.
 * @returns An array of parsed {@link Sigmet} objects.
 * @throws {Error} If no valid SIGMETs can be parsed from the bulletin.
 */
export function parseSigmetBulletin(raw: string): Sigmet[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Empty SIGMET bulletin');
  }

  const normalized = trimmed
    .replace(/\r?\n|\r/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Check if this is a convective bulletin with multiple SIGMETs
  if (normalized.includes('CONVECTIVE SIGMET')) {
    return parseConvectiveBulletin(normalized);
  }

  // Non-convective and international: single SIGMET per message
  return [parseSigmet(raw)];
}

/**
 * Splits a convective SIGMET bulletin into individual SIGMETs.
 * A bulletin may contain: multiple CONVECTIVE SIGMET entries + shared OUTLOOK,
 * or just CONVECTIVE SIGMET...NONE + OUTLOOK.
 */
function parseConvectiveBulletin(normalized: string): Sigmet[] {
  // Find all CONVECTIVE SIGMET boundaries
  const sigmetStarts: number[] = [];
  const pattern = /CONVECTIVE SIGMET/g;
  let match;
  while ((match = pattern.exec(normalized)) !== null) {
    sigmetStarts.push(match.index);
  }

  if (sigmetStarts.length === 0) {
    throw new Error('No CONVECTIVE SIGMET found in bulletin');
  }

  // If only one SIGMET entry, parse as single
  if (sigmetStarts.length === 1) {
    return [parseSigmet(normalized)];
  }

  // Find the outlook section (shared across all SIGMETs in the bulletin)
  const outlookIdx = normalized.indexOf('OUTLOOK VALID');

  // Split into individual SIGMET texts
  const results: Sigmet[] = [];
  for (let i = 0; i < sigmetStarts.length; i++) {
    const start = sigmetStarts[i]!;
    const text = normalized.substring(start);

    // Skip if this is the OUTLOOK-only marker (not a real SIGMET)
    if (text.startsWith('CONVECTIVE SIGMET OUTLOOK')) {
      continue;
    }

    // Determine end of this SIGMET's body (next SIGMET or OUTLOOK)
    let end: number | undefined;
    if (i + 1 < sigmetStarts.length) {
      end = sigmetStarts[i + 1]!;
    } else if (outlookIdx >= 0 && outlookIdx > start) {
      end = outlookIdx;
    }

    const sigmetText = end !== undefined ? normalized.substring(start, end).trim() : text.trim();

    // If there's a shared outlook, append it so each SIGMET gets it
    const withOutlook =
      outlookIdx >= 0 && !sigmetText.includes('OUTLOOK VALID')
        ? sigmetText + ' ' + normalized.substring(outlookIdx)
        : sigmetText;

    try {
      results.push(parseSigmet(withOutlook));
    } catch {
      // Skip individual SIGMETs that fail to parse in a bulletin context
    }
  }

  if (results.length === 0) {
    throw new Error('No valid SIGMETs found in bulletin');
  }

  return results;
}

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

/**
 * Tests whether the normalized SIGMET text matches the international (ICAO) format.
 * International SIGMETs use: SIGMET NAME # VALID dddddd/dddddd XXXX-
 * The trailing XXXX- (issuing station + dash) distinguishes them from
 * domestic range-validity SIGMETs (e.g. VALID dddddd/ddddddZ for volcanic ash).
 */
function isInternationalFormat(text: string): boolean {
  return /\bSIGMET\s+[A-Z0-9]+(?:\s+\d+)?\s+VALID\s+\d{6}\/\d{6}\s+[A-Z]{4}-/.test(text);
}

// ---------------------------------------------------------------------------
// WMO header stripping
// ---------------------------------------------------------------------------

/**
 * Strips WMO, AWIPS, and area identifier header lines from a domestic SIGMET.
 * Returns the body starting from the SIGMET or CANCEL keyword.
 */
function stripDomesticHeaders(text: string): string {
  const sigmetIdx = text.indexOf('SIGMET');
  if (sigmetIdx > 0) {
    const cancelIdx = text.lastIndexOf('CANCEL', sigmetIdx);
    if (cancelIdx >= 0 && text.substring(cancelIdx, sigmetIdx).trim() === 'CANCEL') {
      return text.substring(cancelIdx).trim();
    }
    return text.substring(sigmetIdx).trim();
  }
  return text;
}

/**
 * Strips WMO and AWIPS headers from a convective SIGMET, returning the body
 * starting from "CONVECTIVE SIGMET".
 */
function stripConvectiveHeaders(text: string): string {
  const idx = text.indexOf('CONVECTIVE SIGMET');
  if (idx > 0) {
    return text.substring(idx).trim();
  }
  return text;
}

// ---------------------------------------------------------------------------
// Convective SIGMET parser
// ---------------------------------------------------------------------------

/** Parses a convective SIGMET. */
function parseConvectiveSigmet(normalized: string): ConvectiveSigmet {
  const body = stripConvectiveHeaders(normalized);

  // Check for OUTLOOK-only format
  if (/^CONVECTIVE SIGMET OUTLOOK\b/.test(body)) {
    return parseConvectiveOutlookOnly(body, normalized);
  }

  // Check for NONE format (no convective activity in region)
  if (/CONVECTIVE SIGMET\.{3}NONE/.test(body)) {
    return parseConvectiveNone(body, normalized);
  }

  // Parse "CONVECTIVE SIGMET ##[E/C/W]"
  const sigmetMatch = body.match(/^CONVECTIVE SIGMET\s+(\d+)([ECW])\b/);
  if (!sigmetMatch) {
    throw new Error('Invalid convective SIGMET: could not parse number and region');
  }

  const number = parseInt(sigmetMatch[1]!, 10);
  const region = sigmetMatch[2]! as ConvectiveSigmetRegion;

  // Parse valid time: VALID UNTIL DDHHMMz or VALID UNTIL HHMMz
  let validUntil: DayTime | undefined;
  const validMatch = body.match(/VALID UNTIL\s+(\d{2})?(\d{2})(\d{2})Z/);
  if (validMatch) {
    validUntil = {
      ...(validMatch[1] ? { day: parseInt(validMatch[1], 10) } : {}),
      hour: parseInt(validMatch[2]!, 10),
      minute: parseInt(validMatch[3]!, 10),
    };
  }

  // Parse states: line after VALID UNTIL, before FROM
  const statesResult = parseConvectiveStates(body);
  const states = statesResult?.states;
  const coastalWaters = statesResult?.coastalWaters;

  // Parse area points: FROM xxx-yyy-zzz
  const areaPoints = parseConvectiveAreaPoints(body);

  // Parse thunderstorm description
  const tsResult = parseThunderstormDescription(body);

  // Parse movement
  const movement = parseMovement(body);

  // Parse tops
  const tops = parseTops(body);

  // Parse severe weather hazards
  const hasTornadoes = /\bTORNADO(?:ES|S)?\b/.test(body);
  const hailMatch = body.match(/HAIL\s+TO\s+([\d.]+(?:\s+\d+\/\d+)?)\s*IN/);
  const hailSizeIn = hailMatch ? parseHailSize(hailMatch[1]!) : undefined;
  const windMatch = body.match(/WIND\s+GUSTS?\s+TO\s+(\d+)\s*KT/);
  const windGustsKt = windMatch ? parseInt(windMatch[1]!, 10) : undefined;

  // Parse outlook section
  const outlook = parseConvectiveOutlookSection(body);

  return {
    format: 'CONVECTIVE',
    raw: normalized,
    region,
    number,
    isNone: false,
    isOutlookOnly: false,
    ...(validUntil ? { validUntil } : {}),
    ...(states ? { states } : {}),
    ...(coastalWaters !== undefined ? { coastalWaters } : {}),
    ...(areaPoints ? { areaPoints } : {}),
    ...(tsResult?.thunderstormType ? { thunderstormType: tsResult.thunderstormType } : {}),
    ...(tsResult?.isSevere ? { isSevere: tsResult.isSevere } : {}),
    ...(tsResult?.isEmbedded ? { isEmbedded: tsResult.isEmbedded } : {}),
    ...(tsResult?.lineWidthNm !== undefined ? { lineWidthNm: tsResult.lineWidthNm } : {}),
    ...(movement ? { movement } : {}),
    ...(tops ? { tops } : {}),
    ...(hasTornadoes ? { hasTornadoes } : {}),
    ...(hailSizeIn !== undefined ? { hailSizeIn } : {}),
    ...(windGustsKt !== undefined ? { windGustsKt } : {}),
    ...(outlook ? { outlook } : {}),
  };
}

/** Parses a CONVECTIVE SIGMET...NONE (no convective activity in region). */
function parseConvectiveNone(body: string, raw: string): ConvectiveSigmet {
  // Detect region from WMO header (SIGE/SIGC/SIGW) or AWIPS header
  let region: ConvectiveSigmetRegion = 'C';
  const regionMatch = raw.match(/SIG([ECW])/);
  if (regionMatch) {
    region = regionMatch[1]! as ConvectiveSigmetRegion;
  }

  // Parse attached outlook if present
  const outlook = parseConvectiveOutlookSection(body);

  return {
    format: 'CONVECTIVE',
    raw,
    region,
    number: 0,
    isNone: true,
    isOutlookOnly: false,
    ...(outlook ? { outlook } : {}),
  };
}

/** Parses a standalone convective SIGMET outlook. */
function parseConvectiveOutlookOnly(body: string, raw: string): ConvectiveSigmet {
  const validMatch = body.match(/VALID\s+(\d{2})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})Z?/);
  if (!validMatch) {
    throw new Error('Invalid convective SIGMET outlook: could not parse valid period');
  }

  const areaPoints = parseConvectiveAreaPoints(body);

  // Try to detect region from the raw text header
  let region: ConvectiveSigmetRegion = 'C';
  const regionMatch = raw.match(/SIG([ECW])/);
  if (regionMatch) {
    region = regionMatch[1]! as ConvectiveSigmetRegion;
  }

  const outlook: ConvectiveSigmetOutlook = {
    validFromDay: parseInt(validMatch[1]!, 10),
    validFromHour: parseInt(validMatch[2]!, 10),
    validFromMinute: parseInt(validMatch[3]!, 10),
    validToDay: parseInt(validMatch[4]!, 10),
    validToHour: parseInt(validMatch[5]!, 10),
    validToMinute: parseInt(validMatch[6]!, 10),
    areaPoints: areaPoints ?? [],
    text: body.substring(body.indexOf('VALID')).trim(),
  };

  return {
    format: 'CONVECTIVE',
    raw,
    region,
    number: 0,
    isNone: false,
    isOutlookOnly: true,
    outlook,
  };
}

/** Parses the states line from a convective SIGMET. */
function parseConvectiveStates(
  body: string,
): { states: string[]; coastalWaters: boolean } | undefined {
  const afterValid = body.match(/\d{2}Z\s+(.*?)\s+FROM\b/);
  if (!afterValid) {
    return undefined;
  }

  const statesStr = afterValid[1]!.trim();
  const coastalWaters = /CSTL\s+WTRS/.test(statesStr);
  const cleanedStates = statesStr
    .replace(/AND\s+CSTL\s+WTRS/g, '')
    .replace(/CSTL\s+WTRS/g, '')
    .replace(/AND\s+/g, ' ')
    .trim();

  const states = cleanedStates.split(/\s+/).filter((s) => /^[A-Z]{2}$/.test(s));
  if (states.length === 0) {
    return undefined;
  }

  return { states, coastalWaters };
}

/** Parses area points from a convective SIGMET (FROM xxx-yyy-zzz). */
function parseConvectiveAreaPoints(body: string): string[] | undefined {
  const fromMatch = body.match(/\bFROM\s+(.*?)(?=\s+(?:AREA|LINE|ISOL|OUTLOOK|$))/);
  if (!fromMatch) {
    return undefined;
  }

  const pointsStr = fromMatch[1]!.trim();
  return pointsStr
    .split(/\s*-\s*/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** Parses the thunderstorm type description from a convective SIGMET body. */
function parseThunderstormDescription(body: string): {
  thunderstormType?: 'AREA' | 'LINE' | 'ISOLATED';
  isSevere?: boolean;
  isEmbedded?: boolean;
  lineWidthNm?: number;
} {
  // AREA [INTSFYG|SEV|EMBD] TS
  if (/\bAREA\b.*?\bTS\b/.test(body)) {
    const isSevere = /\bAREA\s+SEV\s+TS\b/.test(body);
    const isEmbedded = /\bAREA\s+EMBD\s+TS\b/.test(body);
    const isIntensifying = /\bINTSFYG\s+AREA\b/.test(body);
    return {
      thunderstormType: 'AREA',
      ...(isSevere || isIntensifying ? { isSevere: true } : {}),
      ...(isEmbedded ? { isEmbedded: true } : {}),
    };
  }

  // LINE TS [## NM WIDE]
  const lineMatch = body.match(/\bLINE\s+TS\s+(\d+)\s+NM\s+WIDE\b/);
  if (lineMatch) {
    return {
      thunderstormType: 'LINE',
      lineWidthNm: parseInt(lineMatch[1]!, 10),
    };
  }
  if (/\bLINE\s+TS\b/.test(body)) {
    return { thunderstormType: 'LINE' };
  }

  // ISOL [SEV] TS
  if (/\bISOL\b.*?\bTS\b/.test(body)) {
    const isSevere = /\bISOL\s+SEV\s+TS\b/.test(body);
    return {
      thunderstormType: 'ISOLATED',
      ...(isSevere ? { isSevere: true } : {}),
    };
  }

  return {};
}

/** Parses cloud tops from a convective SIGMET body. */
function parseTops(body: string): SigmetTops | undefined {
  const topsMatch = body.match(/TOPS?\s+(ABV\s+)?(?:TO\s+)?FL(\d{3})/);
  if (!topsMatch) {
    return undefined;
  }

  return {
    altitudeFt: parseInt(topsMatch[2]!, 10) * 100,
    isAbove: topsMatch[1] !== undefined,
  };
}

/** Parses hail size from text like "2 IN", "1 3/4 IN", "2.75 IN". */
function parseHailSize(text: string): number {
  const trimmed = text.trim();

  // Decimal: "2.75"
  if (/^\d+\.\d+$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // Mixed fraction: "1 3/4"
  const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    return (
      parseInt(mixedMatch[1]!, 10) + parseInt(mixedMatch[2]!, 10) / parseInt(mixedMatch[3]!, 10)
    );
  }

  // Simple fraction: "3/4"
  const fracMatch = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fracMatch) {
    return parseInt(fracMatch[1]!, 10) / parseInt(fracMatch[2]!, 10);
  }

  // Whole number: "2"
  return parseInt(trimmed, 10);
}

/** Parses the outlook section from a convective SIGMET body. */
function parseConvectiveOutlookSection(body: string): ConvectiveSigmetOutlook | undefined {
  const outlookIdx = body.indexOf('OUTLOOK VALID');
  if (outlookIdx < 0) {
    return undefined;
  }

  const outlookText = body.substring(outlookIdx).trim();

  const validMatch = outlookText.match(
    /OUTLOOK VALID\s+(\d{2})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/,
  );
  if (!validMatch) {
    return undefined;
  }

  // Parse outlook area points (FROM xxx-yyy-zzz)
  const fromMatch = outlookText.match(/\bFROM\s+(.*?)(?=\s+(?:WST|REF|$))/);
  const areaPoints = fromMatch
    ? fromMatch[1]!
        .trim()
        .split(/\s*-\s*/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
    : [];

  return {
    validFromDay: parseInt(validMatch[1]!, 10),
    validFromHour: parseInt(validMatch[2]!, 10),
    validFromMinute: parseInt(validMatch[3]!, 10),
    validToDay: parseInt(validMatch[4]!, 10),
    validToHour: parseInt(validMatch[5]!, 10),
    validToMinute: parseInt(validMatch[6]!, 10),
    areaPoints,
    text: outlookText,
  };
}

// ---------------------------------------------------------------------------
// Non-Convective SIGMET parser
// ---------------------------------------------------------------------------

/** Parses a domestic non-convective SIGMET. */
function parseNonConvectiveSigmet(normalized: string): NonConvectiveSigmet {
  const body = stripDomesticHeaders(normalized);

  // Check for cancellation format: CANCEL SIGMET NAME #. reason.
  if (/^CANCEL\s+SIGMET\b/.test(body)) {
    return parseNonConvectiveCancellation(body, normalized);
  }

  // Parse SIGMET NAME # VALID UNTIL DDHHMMz
  const headerMatch = body.match(
    /^SIGMET\s+([A-Z0-9]+)\s+(\d+)\s+VALID\s+UNTIL\s+(\d{2})(\d{2})(\d{2})/,
  );
  if (!headerMatch) {
    // Try the range validity format: SIGMET NAME # VALID DDHHMM/DDHHMM
    const rangeMatch = body.match(/^SIGMET\s+([A-Z0-9]+)\s+(\d+)\s+VALID\s+(\d{6})\/(\d{6})Z?\b/);
    if (rangeMatch) {
      return parseNonConvectiveRangeValidity(body, normalized, rangeMatch);
    }
    throw new Error(
      `Invalid non-convective SIGMET: could not parse header from: ${body.substring(0, 80)}`,
    );
  }

  const seriesName = headerMatch[1]! as SigmetSeriesName;
  const seriesNumber = parseInt(headerMatch[2]!, 10);
  const validUntil: DayTime = {
    day: parseInt(headerMatch[3]!, 10),
    hour: parseInt(headerMatch[4]!, 10),
    minute: parseInt(headerMatch[5]!, 10),
  };

  // Find the content after the valid time
  const afterValid = body
    .substring(body.indexOf(headerMatch[3]! + headerMatch[4]! + headerMatch[5]!) + 6)
    .trim();

  const parsed = parseNonConvectiveBody(afterValid);

  return {
    format: 'NONCONVECTIVE',
    raw: normalized,
    seriesName,
    seriesNumber,
    isCancellation: false,
    validUntil,
    ...parsed,
  };
}

/** Parses a non-convective SIGMET with range validity (VALID DDHHMM/DDHHMM). */
function parseNonConvectiveRangeValidity(
  body: string,
  raw: string,
  rangeMatch: RegExpMatchArray,
): NonConvectiveSigmet {
  const seriesName = rangeMatch[1]! as SigmetSeriesName;
  const seriesNumber = parseInt(rangeMatch[2]!, 10);
  const validEndStr = rangeMatch[4]!;
  const validUntil = parseTimeString(validEndStr)!;

  // Content after the validity period
  const afterValid = body
    .substring(body.indexOf(rangeMatch[4]!) + rangeMatch[4]!.length)
    .replace(/^Z?\s*/, '')
    .trim();

  const parsed = parseNonConvectiveBody(afterValid);

  return {
    format: 'NONCONVECTIVE',
    raw,
    seriesName,
    seriesNumber,
    isCancellation: false,
    validUntil,
    ...parsed,
  };
}

/** Parses the body content of a non-convective SIGMET (states, area, hazards). */
function parseNonConvectiveBody(
  content: string,
): Omit<
  NonConvectiveSigmet,
  'format' | 'raw' | 'seriesName' | 'seriesNumber' | 'isCancellation' | 'validUntil'
> {
  const result: Record<string, unknown> = {};

  // Parse states (2-letter codes before FROM, possibly with "AND CSTL WTRS")
  const statesMatch = content.match(
    /^((?:[A-Z]{2}\s+)*[A-Z]{2}(?:\s+AND\s+(?:[A-Z]{2}\s+)*CSTL\s+WTRS)?)\s+FROM\b/,
  );
  if (statesMatch) {
    const statesStr = statesMatch[1]!;
    result.states = statesStr.split(/\s+/).filter((s) => /^[A-Z]{2}$/.test(s));
  }

  // Parse area points (skip "FROM ERUPTION" in volcanic ash SIGMETs)
  let fromSearchStart = 0;
  const eruptionIdx = content.indexOf('FROM ERUPTION');
  if (eruptionIdx >= 0) {
    fromSearchStart = eruptionIdx + 'FROM ERUPTION'.length;
  }
  const fromIdx = content.indexOf('FROM ', fromSearchStart);
  if (fromIdx >= 0) {
    const afterFrom = content.substring(fromIdx + 5);
    const endMatch = afterFrom.match(
      /\s+(?:OCNL\s+)?SEV\s+(?:TURB|ICE|DUST)|VOLCANIC\s+ASH|\s+MOV\b|\s+STNR\b/,
    );
    if (endMatch && endMatch.index !== undefined) {
      const pointsStr = afterFrom.substring(0, endMatch.index).trim();
      result.areaPoints = pointsStr
        .split(/\s+TO\s+|\s*-\s*/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    }
  }

  // Parse hazards
  const hazards = parseNonConvectiveHazards(content);
  result.hazards = hazards;

  // Parse movement
  const movement = parseMovement(content);
  if (movement) {
    result.movement = movement;
  }

  // Parse intensity change
  const intensityChange = parseIntensityChange(content);
  if (intensityChange) {
    result.intensityChange = intensityChange;
  }

  // Parse conditions continuing/ending
  const contgMatch = content.match(/CONDS\s+CONTG\s+BYD\s+(\d{4})Z/);
  if (contgMatch) {
    result.conditionsContinuingBeyond = parseTimeString(contgMatch[1]! + 'Z');
  }

  const endgMatch = content.match(/CONDS\s+ENDG\s+BY\s+(\d{4})Z/);
  if (endgMatch) {
    result.conditionsEndingBy = parseTimeString(endgMatch[1]! + 'Z');
  }

  // Parse volcanic ash specific fields
  const volcanoMatch = content.match(
    /VOLCANIC\s+ASH\s+FROM\s+ERUPTION\s+OF\s+([\w\s]+?)\s+(\d{4}[NS]\d{5}[EW])/,
  );
  if (volcanoMatch) {
    result.volcanoName = volcanoMatch[1]!.trim();
    result.volcanoPosition = parseVolcanoPosition(volcanoMatch[2]!);
  }

  // Parse VA cloud altitude range
  if (content.includes('VOLCANIC ASH') || content.includes('VA CLD')) {
    const vaAlt = content.match(
      /(?:VA\s+CLD\s+)?OBS\s+AT\s+\d{4}Z\s+(FL\d{3}\/FL\d{3}|SFC\/FL\d{3})/,
    );
    if (vaAlt) {
      result.ashCloudAltitudeRange = parseAltitudeRange(vaAlt[1]!);
    }

    const fcstMatch = content.match(/FCST\s+(?:AT\s+)?(\d{4})Z\s+(FL\d{3}\/FL\d{3}|SFC\/FL\d{3})/);
    if (fcstMatch) {
      result.forecastTime = parseTimeString(fcstMatch[1]! + 'Z');
      result.forecastAltitudeRange = parseAltitudeRange(fcstMatch[2]!);
    }
  }

  return result as Omit<
    NonConvectiveSigmet,
    'format' | 'raw' | 'seriesName' | 'seriesNumber' | 'isCancellation' | 'validUntil'
  >;
}

/** Parses hazard descriptions from a non-convective SIGMET body. */
function parseNonConvectiveHazards(content: string): SigmetHazard[] {
  const hazards: SigmetHazard[] = [];

  // Match each hazard block: [OCNL] SEV TURB/ICE/DUST... BTN ... AND ... [. DUE TO ...]
  const hazardPattern =
    /(?:OCNL\s+)?SEV\s+(?:TURB|ICE|DUST\/SANDSTORM)\s+(?:OBS\s+)?(?:VIS\s+BLW\s+\d+SM\s+)?BTN\s+(?:SFC|FL\d{3}|\d{3})\s+AND\s+(?:SFC|FL\d{3}|\d{3})(?:\.\s*DUE\s+TO\s+[^.]+)?/g;

  let match;
  while ((match = hazardPattern.exec(content)) !== null) {
    const hazardText = match[0]!;
    const hazard = parseSingleHazard(hazardText);
    if (hazard) {
      hazards.push(hazard);
    }
  }

  // If no structured hazards found, try simpler patterns
  if (hazards.length === 0) {
    // Volcanic ash
    if (/VOLCANIC\s+ASH/.test(content)) {
      hazards.push({
        hazardType: 'VOLCANIC_ASH',
        isOccasional: false,
      });
    }

    // Simple SEV TURB
    if (/SEV\s+TURB/.test(content) && !hazards.some((h) => h.hazardType === 'TURBULENCE')) {
      const altRange = parseAltitudeRange(content);
      const causeMatch = content.match(/DUE\s+TO\s+([^.]+)/);
      hazards.push({
        hazardType: 'TURBULENCE',
        isOccasional: /OCNL\s+SEV\s+TURB/.test(content),
        ...(altRange ? { altitudeRange: altRange } : {}),
        ...(causeMatch ? { cause: causeMatch[1]!.trim() } : {}),
      });
    }

    if (/SEV\s+ICE/.test(content) && !hazards.some((h) => h.hazardType === 'ICING')) {
      const altRange = parseAltitudeRange(content);
      const causeMatch = content.match(/DUE\s+TO\s+([^.]+)/);
      hazards.push({
        hazardType: 'ICING',
        isOccasional: /OCNL\s+SEV\s+ICE/.test(content),
        ...(altRange ? { altitudeRange: altRange } : {}),
        ...(causeMatch ? { cause: causeMatch[1]!.trim() } : {}),
      });
    }

    if (
      /SEV\s+DUST\/SANDSTORM/.test(content) &&
      !hazards.some((h) => h.hazardType === 'DUST_SANDSTORM')
    ) {
      const altRange = parseAltitudeRange(content);
      const visMatch = content.match(/VIS\s+BLW\s+(\d+)SM/);
      hazards.push({
        hazardType: 'DUST_SANDSTORM',
        isOccasional: false,
        ...(altRange ? { altitudeRange: altRange } : {}),
        ...(visMatch ? { visibilityBelowSm: parseInt(visMatch[1]!, 10) } : {}),
      });
    }
  }

  return hazards;
}

/** Parses a single hazard block text into a SigmetHazard. */
function parseSingleHazard(text: string): SigmetHazard | undefined {
  const isOccasional = text.startsWith('OCNL');

  let hazardType: SigmetHazardType;
  if (/SEV\s+TURB/.test(text)) {
    hazardType = 'TURBULENCE';
  } else if (/SEV\s+ICE/.test(text)) {
    hazardType = 'ICING';
  } else if (/SEV\s+DUST\/SANDSTORM/.test(text)) {
    hazardType = 'DUST_SANDSTORM';
  } else {
    return undefined;
  }

  const altitudeRange = parseAltitudeRange(text);
  const causeMatch = text.match(/DUE\s+TO\s+([^.]+)/);
  const visMatch = text.match(/VIS\s+BLW\s+(\d+)SM/);

  return {
    hazardType,
    isOccasional,
    ...(altitudeRange ? { altitudeRange } : {}),
    ...(causeMatch ? { cause: causeMatch[1]!.trim() } : {}),
    ...(visMatch ? { visibilityBelowSm: parseInt(visMatch[1]!, 10) } : {}),
  };
}

/** Parses a non-convective SIGMET cancellation. */
function parseNonConvectiveCancellation(body: string, raw: string): NonConvectiveSigmet {
  const cancelMatch = body.match(/^CANCEL\s+SIGMET\s+([A-Z0-9]+)\s+(\d+)\.\s*(.*)/);
  if (!cancelMatch) {
    throw new Error('Invalid non-convective SIGMET cancellation: could not parse series');
  }

  const reason = cancelMatch[3]?.trim().replace(/\.$/, '') || undefined;

  return {
    format: 'NONCONVECTIVE',
    raw,
    seriesName: cancelMatch[1]! as SigmetSeriesName,
    seriesNumber: parseInt(cancelMatch[2]!, 10),
    isCancellation: true,
    hazards: [],
    ...(reason ? { cancellationReason: reason } : {}),
  };
}

// ---------------------------------------------------------------------------
// International SIGMET parser
// ---------------------------------------------------------------------------

/**
 * Strips WMO, AWIPS, and area identifier headers from an international SIGMET.
 * WMO headers: TTAAii CCCC DDHHmm (e.g. WSNT02 KNHC 041500)
 * AWIPS identifiers: SIGxxx, WSVxxx, etc.
 * Area identifiers: XXXX WS DDHHmm
 * After stripping, the body starts with [FIR codes...] SIGMET or just SIGMET.
 */
function stripInternationalHeaders(text: string): string {
  // Find the position of the SIGMET body by looking for FIR code(s) + SIGMET pattern
  // or just SIGMET keyword with the ICAO validity format
  const sigmetPattern =
    /\b(?:[A-Z]{4}\s+)*SIGMET\s+\w+(?:\s+\d+)?\s+VALID\s+\d{6}\/\d{6}\s+[A-Z]{4}-/;
  const match = text.match(sigmetPattern);
  if (!match || match.index === undefined) {
    return text;
  }

  // Walk backwards from the match to see if there are FIR codes that are part
  // of the SIGMET body (not WMO headers). WMO headers contain 6-char product IDs
  // (TTAAii like WSNT02), 6-digit timestamps, and AWIPS codes with digits.
  // FIR codes are strictly 4 uppercase letters.
  const beforeMatch = text.substring(0, match.index);

  // Strip known WMO/AWIPS header patterns from the prefix
  // This removes lines like "WSNT02 KNHC 041500", "SIGA0A", "ANCM WS 291615"
  const strippedPrefix = beforeMatch
    .replace(/\b[A-Z]{2}[A-Z]{2}\d{2}\s+[A-Z]{4}\s+\d{6}\b/g, '') // WMO header
    .replace(/\bSIG[A-Z0-9]+\b/g, '') // AWIPS SIGMET IDs (SIGA0A, SIGPAP, SIGAK5, etc.)
    .replace(/\bWSV[A-Z0-9]+\b/g, '') // AWIPS VA SIGMET IDs (WSVAK1, etc.)
    .replace(/\b[A-Z]{3,4}\s+WS\s+\d{6}\b/g, '') // Area IDs (ANCM WS 291615)
    .trim();

  // Whatever 4-letter codes remain in the prefix are FIR codes from the body
  const remainingFirCodes = strippedPrefix.match(/\b[A-Z]{4}\b/g);

  if (remainingFirCodes && remainingFirCodes.length > 0) {
    // Use the last FIR code as the primary (for multi-FIR, the one closest to SIGMET)
    return (
      remainingFirCodes[remainingFirCodes.length - 1]! +
      ' ' +
      text.substring(text.indexOf('SIGMET', match.index)).trim()
    );
  }

  // No FIR codes in prefix - body starts at the match position
  return text.substring(match.index).trim();
}

/**
 * Parses the header of an international SIGMET.
 * Handles both name+number (SIGMET ALFA 1 VALID...) and number-only (SIGMET 02 VALID...) formats,
 * with or without a leading FIR code.
 */
function parseInternationalHeader(body: string):
  | {
      firCodeFromHeader: string | undefined;
      seriesName: string;
      seriesNumber: number;
      validFrom: DayTime;
      validTo: DayTime;
      issuingStation: string;
      headerLength: number;
    }
  | undefined {
  // Pattern A: [XXXX] SIGMET NAME # VALID dddddd/dddddd XXXX- (name + number)
  const withNumMatch = body.match(
    /^(?:([A-Z]{4})\s+)?SIGMET\s+([A-Z0-9]+)\s+(\d+)\s+VALID\s+(\d{2})(\d{2})(\d{2})\/(\d{2})(\d{2})(\d{2})\s+([A-Z]{4})-/,
  );
  if (withNumMatch) {
    return {
      firCodeFromHeader: withNumMatch[1],
      seriesName: withNumMatch[2]!,
      seriesNumber: parseInt(withNumMatch[3]!, 10),
      validFrom: {
        day: parseInt(withNumMatch[4]!, 10),
        hour: parseInt(withNumMatch[5]!, 10),
        minute: parseInt(withNumMatch[6]!, 10),
      },
      validTo: {
        day: parseInt(withNumMatch[7]!, 10),
        hour: parseInt(withNumMatch[8]!, 10),
        minute: parseInt(withNumMatch[9]!, 10),
      },
      issuingStation: withNumMatch[10]!,
      headerLength: withNumMatch[0].length,
    };
  }

  // Pattern B: [XXXX] SIGMET ## VALID dddddd/dddddd XXXX- (number-only, no separate name)
  const numOnlyMatch = body.match(
    /^(?:([A-Z]{4})\s+)?SIGMET\s+(\d+)\s+VALID\s+(\d{2})(\d{2})(\d{2})\/(\d{2})(\d{2})(\d{2})\s+([A-Z]{4})-/,
  );
  if (numOnlyMatch) {
    const numStr = numOnlyMatch[2]!;
    return {
      firCodeFromHeader: numOnlyMatch[1],
      seriesName: numStr,
      seriesNumber: parseInt(numStr, 10),
      validFrom: {
        day: parseInt(numOnlyMatch[3]!, 10),
        hour: parseInt(numOnlyMatch[4]!, 10),
        minute: parseInt(numOnlyMatch[5]!, 10),
      },
      validTo: {
        day: parseInt(numOnlyMatch[6]!, 10),
        hour: parseInt(numOnlyMatch[7]!, 10),
        minute: parseInt(numOnlyMatch[8]!, 10),
      },
      issuingStation: numOnlyMatch[9]!,
      headerLength: numOnlyMatch[0].length,
    };
  }

  return undefined;
}

/** Parses an international (ICAO format) SIGMET. */
function parseInternationalSigmet(normalized: string): InternationalSigmet {
  let body = normalized;

  // Strip WMO/AWIPS headers to find where the SIGMET body begins.
  // WMO headers follow the pattern: TTAAii CCCC DDHHmm (e.g. WSNT02 KNHC 041500)
  // followed optionally by AWIPS identifiers (e.g. SIGA0A, SIGPAP, SIGAK5)
  // and area identifiers (e.g. ANCM WS 291615).
  // After stripping these, the body starts with [FIR codes] SIGMET or just SIGMET.
  body = stripInternationalHeaders(body);

  // Parse the international SIGMET header. Handles:
  // - XXXX SIGMET NAME # VALID dddddd/dddddd XXXX- (FIR code + name + number)
  // - SIGMET NAME # VALID dddddd/dddddd XXXX- (no FIR code, name + number)
  // - XXXX SIGMET ## VALID dddddd/dddddd XXXX- (FIR code + numeric-only identifier)
  // - SIGMET ## VALID dddddd/dddddd XXXX- (no FIR code, numeric-only identifier)
  const parsed = parseInternationalHeader(body);
  if (!parsed) {
    throw new Error(
      `Invalid international SIGMET: could not parse header from: ${body.substring(0, 100)}`,
    );
  }

  const {
    firCodeFromHeader,
    seriesName,
    seriesNumber,
    validFrom,
    validTo,
    issuingStation,
    headerLength,
  } = parsed;

  // Get the rest of the body after the header
  const afterHeader = body.substring(headerLength).trim();

  // Parse FIR info from the body after the header dash.
  // Handles: "PAZA ANCHORAGE FIR", "ANCHORAGE FIR", "NEW YORK OCEANIC FIR SAN JUAN FIR MIAMI OCEANIC FIR"
  // Also handles "ANCHORAGE FIR ANCHORAGE OCEANIC FIR" (multiple FIR names)
  const { firCode, firName, afterFirContent } = parseFirInfo(afterHeader, firCodeFromHeader);

  // Check for cancellation: CNL SIGMET NAME # dddddd/dddddd
  if (/\bCNL\s+SIGMET\b/.test(afterFirContent)) {
    return parseInternationalCancellation(
      afterFirContent,
      normalized,
      firCode,
      firName,
      seriesName,
      seriesNumber,
      issuingStation,
      validFrom,
      validTo,
    );
  }

  return parseInternationalBody(
    afterFirContent,
    normalized,
    firCode,
    firName,
    seriesName,
    seriesNumber,
    issuingStation,
    validFrom,
    validTo,
  );
}

/**
 * Parses FIR information from the body text after the SIGMET header.
 * Handles formats like:
 * - "PAZA ANCHORAGE FIR ..." (ICAO code + name)
 * - "ANCHORAGE FIR ..." (name only, no ICAO prefix)
 * - "ANCHORAGE FIR ANCHORAGE OCEANIC FIR ..." (multiple FIR names)
 * - "NEW YORK OCEANIC FIR SAN JUAN FIR MIAMI OCEANIC FIR ..." (multi-FIR)
 */
function parseFirInfo(
  afterHeader: string,
  firCodeFromHeader: string | undefined,
): { firCode: string; firName: string; afterFirContent: string } {
  // Find the last occurrence of "FIR" followed by a known phenomenon or CNL
  // This handles multi-FIR bodies where FIR appears multiple times
  const firEndPattern = /\bFIR\s+(?:SEV|FRQ|OBSC|EMBD|SQL|ISOL|TC|VA|RDOACT|WDSPR|CNL|TS\b)/;
  const firEndMatch = afterHeader.match(firEndPattern);

  if (firEndMatch && firEndMatch.index !== undefined) {
    const firSection = afterHeader.substring(0, firEndMatch.index + 3).trim(); // +3 for "FIR"
    const afterFirContent = afterHeader.substring(firEndMatch.index + 3).trim();

    // Extract FIR code from the section if it starts with a 4-letter code
    const codeMatch = firSection.match(/^([A-Z]{4})\s+(.*)/);
    if (codeMatch) {
      return {
        firCode: firCodeFromHeader ?? codeMatch[1]!,
        firName: codeMatch[2]!.trim(),
        afterFirContent,
      };
    }

    // No leading ICAO code - entire section is the FIR name
    return {
      firCode: firCodeFromHeader ?? '',
      firName: firSection,
      afterFirContent,
    };
  }

  // Fallback: try simple pattern "XXXX NAME FIR"
  const simpleMatch = afterHeader.match(/^([A-Z]{4})\s+(.*?FIR)\b\s*(.*)/s);
  if (simpleMatch) {
    return {
      firCode: firCodeFromHeader ?? simpleMatch[1]!,
      firName: simpleMatch[2]!.trim(),
      afterFirContent: simpleMatch[3]!.trim(),
    };
  }

  // Fallback: try "NAME FIR" without ICAO prefix
  const nameOnlyMatch = afterHeader.match(/^(.*?FIR)\b\s*(.*)/s);
  if (nameOnlyMatch) {
    return {
      firCode: firCodeFromHeader ?? '',
      firName: nameOnlyMatch[1]!.trim(),
      afterFirContent: nameOnlyMatch[2]!.trim(),
    };
  }

  // No FIR found at all
  return {
    firCode: firCodeFromHeader ?? '',
    firName: '',
    afterFirContent: afterHeader,
  };
}

/** Parses the body of an international SIGMET after the FIR name. */
function parseInternationalBody(
  bodyAfterFir: string,
  raw: string,
  firCode: string,
  firName: string,
  seriesName: string,
  seriesNumber: number,
  issuingStation: string,
  validFrom: DayTime,
  validTo: DayTime,
): InternationalSigmet {
  // Clean trailing = sign (ICAO message terminator)
  const content = bodyAfterFir.replace(/=\s*$/, '').trim();

  // Detect tropical cyclone
  const tcMatch = content.match(/\bTC\s+([A-Z0-9]+)\b/);
  const cycloneName = tcMatch ? tcMatch[1]! : undefined;

  // Detect phenomena - includes VA ERUPTION, VA CLD, and all TS variants
  let phenomena: string | undefined;
  const phenMatch = content.match(
    /^((?:SEV\s+TURB|SEV\s+ICE(?:\s+\(FZRA\))?|FRQ\s+TS|OBSC\s+TS|EMBD\s+TS|SQL\s+TS|ISOL\s+SEV\s+TS|TC\s+\w+|VA\s+ERUPTION|VA\s+CLD|VA\s+CLD\w*|RDOACT\s+CLD|WDSPR\s+[DS]S)\b)/,
  );
  if (phenMatch) {
    phenomena = phenMatch[1]!;
  } else if (cycloneName) {
    phenomena = `TC ${cycloneName}`;
  }

  // Parse observation status
  let observationStatus: SigmetObservationStatus | undefined;
  let observedAt: DayTime | undefined;
  const obsMatch = content.match(/\bOBS\s+AT\s+(\d{4})Z/);
  if (obsMatch) {
    observationStatus = 'OBSERVED';
    observedAt = parseTimeString(obsMatch[1]! + 'Z');
  } else if (/\bOBS\b/.test(content) && !/\bOBS\s+AND\s+FCST\b/.test(content)) {
    observationStatus = 'OBSERVED';
  }
  if (/\bFCST\b/.test(content) && !/FCST\s+AT\b/.test(content) && !/FCST\s+\d{4}Z/.test(content)) {
    if (!observationStatus) {
      observationStatus = 'FORECAST';
    }
  }

  // Parse area description (WI ... or [N/S/E/W] OF LINE ... patterns)
  let areaDescription: string | undefined;
  const areaMatch = content.match(
    /\b(?:AREA\s+)?(?:WI|[NSEW]\s+OF\s+LINE)\s+(.*?)(?=\s+(?:SFC|FL\d{3}|TOP|MOV|STNR|NC\b|INTSF|WKN|FCST\s+(?:AT\s+)?\d{4}Z)\b|$)/,
  );
  if (areaMatch) {
    areaDescription = areaMatch[1]!.trim();
  }

  // Parse altitude range
  const altitudeRange = parseAltitudeRange(content);

  // Parse tops (TOP FL### or TOP ABV FL### - international format)
  let tops: SigmetTops | undefined;
  const topsResult = parseTops(content);
  if (topsResult) {
    tops = topsResult;
  }

  // Parse movement
  const movement = parseMovement(content);
  const isStationary = /\bSTNR\b/.test(content);

  // Parse intensity change
  const intensityChange = parseIntensityChange(content);

  // Tropical cyclone fields
  let cyclonePosition: Coordinates | undefined;
  let cbTopFl: number | undefined;
  let withinNm: number | undefined;
  let forecastTime: DayTime | undefined;
  let forecastPosition: Coordinates | undefined;

  if (cycloneName) {
    const posMatch = content.match(/(?:OBS\s+AT\s+\d{4}Z\s+)?(?:NR\s+)?([NS]\d{4}\s+[EW]\d{5})/);
    if (posMatch) {
      cyclonePosition = parseIcaoPosition(posMatch[1]!);
    }

    const cbMatch = content.match(/CB\s+TOP\s+FL(\d{3})/);
    if (cbMatch) {
      cbTopFl = parseInt(cbMatch[1]!, 10);
    }

    const wiMatch = content.match(/WI\s+(\d+)\s*NM\s+OF\s+CENTER/);
    if (wiMatch) {
      withinNm = parseInt(wiMatch[1]!, 10);
    }

    const fcstMatch = content.match(
      /FCST\s+(?:AT\s+)?(\d{4})Z\s+TC\s+CENTER\s+([NS]\d{4}\s+[EW]\d{5})/,
    );
    if (fcstMatch) {
      forecastTime = parseTimeString(fcstMatch[1]! + 'Z');
      forecastPosition = parseIcaoPosition(fcstMatch[2]!);
    }
  }

  // Collect additional info (e.g. LLWS notes, re-suspended ash notes)
  let additionalInfo: string | undefined;
  const llwsMatch = raw.match(/INCLUDES\s+[^=]+/);
  if (llwsMatch) {
    additionalInfo = llwsMatch[0]!.trim();
  }

  return {
    format: 'INTERNATIONAL',
    raw,
    firCode,
    firName,
    seriesName,
    seriesNumber,
    issuingStation,
    validFrom,
    validTo,
    isCancellation: false,
    ...(phenomena ? { phenomena } : {}),
    ...(observationStatus ? { observationStatus } : {}),
    ...(observedAt ? { observedAt } : {}),
    ...(areaDescription ? { areaDescription } : {}),
    ...(altitudeRange ? { altitudeRange } : {}),
    ...(tops ? { tops } : {}),
    ...(movement ? { movement } : {}),
    ...(isStationary ? { isStationary } : {}),
    ...(intensityChange ? { intensityChange } : {}),
    ...(cycloneName ? { cycloneName } : {}),
    ...(cyclonePosition ? { cyclonePosition } : {}),
    ...(cbTopFl !== undefined ? { cbTopFl } : {}),
    ...(withinNm !== undefined ? { withinNm } : {}),
    ...(forecastTime ? { forecastTime } : {}),
    ...(forecastPosition ? { forecastPosition } : {}),
    ...(additionalInfo ? { additionalInfo } : {}),
  };
}

/** Parses an international SIGMET cancellation. */
function parseInternationalCancellation(
  afterFirContent: string,
  raw: string,
  firCode: string,
  firName: string,
  seriesName: string,
  seriesNumber: number,
  issuingStation: string,
  validFrom: DayTime,
  validTo: DayTime,
): InternationalSigmet {
  const cnlMatch = afterFirContent.match(/CNL\s+SIGMET\s+([A-Z0-9]+)\s+(\d+)\s+(\d{6})\/(\d{6})/);

  return {
    format: 'INTERNATIONAL',
    raw,
    firCode,
    firName,
    seriesName,
    seriesNumber,
    issuingStation,
    validFrom,
    validTo,
    isCancellation: true,
    ...(cnlMatch
      ? {
          cancelledSeriesName: cnlMatch[1]!,
          cancelledSeriesNumber: parseInt(cnlMatch[2]!, 10),
          cancelledValidStart: parseTimeString(cnlMatch[3]!)!,
          cancelledValidEnd: parseTimeString(cnlMatch[4]!)!,
        }
      : {}),
  };
}
