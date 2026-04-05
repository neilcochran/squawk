import type {
  CompassDirection,
  ConvectiveSigmet,
  ConvectiveSigmetOutlook,
  ConvectiveSigmetRegion,
  InternationalSigmet,
  NonConvectiveSigmet,
  Sigmet,
  SigmetAltitudeRange,
  SigmetHazard,
  SigmetHazardType,
  SigmetIntensityChange,
  SigmetMovement,
  SigmetObservationStatus,
  SigmetPosition,
  SigmetSeriesName,
  SigmetTime,
  SigmetTops,
} from '@squawk/types';

/** Set of valid 16-point compass directions. */
const COMPASS_DIRECTIONS = new Set<string>([
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
]);

/**
 * Parses a raw SIGMET string into a structured {@link Sigmet} object.
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
  const normalized = trimmed.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

  // Detect format based on content
  if (normalized.includes('CONVECTIVE SIGMET')) {
    return parseConvectiveSigmet(normalized);
  }

  if (isInternationalFormat(normalized)) {
    return parseInternationalSigmet(normalized);
  }

  return parseNonConvectiveSigmet(normalized);
}

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

/**
 * Tests whether the normalized SIGMET text matches the international (ICAO) format.
 * International SIGMETs have a pattern like:
 *   XXXX SIGMET NAME # VALID dddddd/dddddd XXXX-
 * where XXXX is a 4-letter ICAO identifier and validity uses the slash format.
 */
function isInternationalFormat(text: string): boolean {
  // International SIGMETs use: SIGMET NAME # VALID dddddd/dddddd XXXX-
  // The trailing XXXX- (issuing station + dash) distinguishes them from
  // domestic range-validity SIGMETs (e.g. VALID dddddd/ddddddZ for volcanic ash).
  return /\bSIGMET\s+[A-Z]+\s+\d+\s+VALID\s+\d{6}\/\d{6}\s+[A-Z]{4}-/.test(text);
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
// Shared parsers
// ---------------------------------------------------------------------------

/**
 * Parses an altitude string like "FL350" or "040" or "SFC" into feet.
 * Returns undefined for SFC.
 */
function parseAltitudeFt(alt: string): number | undefined {
  if (alt === 'SFC') {
    return undefined;
  }
  if (alt.startsWith('FL')) {
    return parseInt(alt.substring(2), 10) * 100;
  }
  return parseInt(alt, 10) * 100;
}

/**
 * Parses a "BTN XXX AND YYY" altitude range from text.
 * Returns the altitude range or undefined if not found.
 */
function parseAltitudeRange(text: string): SigmetAltitudeRange | undefined {
  const btnMatch = text.match(/BTN\s+(SFC|FL\d{3}|\d{3})\s+AND\s+(SFC|FL\d{3}|\d{3})/);
  if (btnMatch) {
    const baseFt = parseAltitudeFt(btnMatch[1]!);
    return {
      ...(baseFt !== undefined ? { baseFt } : {}),
      topFt: parseAltitudeFt(btnMatch[2]!)!,
    };
  }

  // Slash format for volcanic ash: FL250/FL350 or SFC/FL100 or SFC/060
  const slashMatch = text.match(/\b(SFC|FL\d{3})\/(FL\d{3}|\d{3})\b/);
  if (slashMatch) {
    const baseFt = parseAltitudeFt(slashMatch[1]!);
    return {
      ...(baseFt !== undefined ? { baseFt } : {}),
      topFt: parseAltitudeFt(slashMatch[2]!)!,
    };
  }

  return undefined;
}

/**
 * Parses movement from text.
 * Handles "MOV FROM dddssKT" (domestic) and "MOV [compass] [speed]KT" (international).
 */
function parseMovement(text: string): SigmetMovement | undefined {
  // Domestic format: MOV FROM dddssKT or MOVG FROM dddssKT or MOVING FROM dddssKT
  const domesticMatch = text.match(/MOV(?:ING|G)?\s+FROM\s+(\d{3})(\d{2,3})KT/);
  if (domesticMatch) {
    return {
      directionDeg: parseInt(domesticMatch[1]!, 10),
      speedKt: parseInt(domesticMatch[2]!, 10),
    };
  }

  // International format: MOV [compass] [speed] KT
  const intlMatch = text.match(
    /MOV\s+(N|NE|E|SE|S|SW|W|NW|NNE|ENE|ESE|SSE|SSW|WSW|WNW|NNW)\s+(\d+)\s*KT/,
  );
  if (intlMatch && COMPASS_DIRECTIONS.has(intlMatch[1]!)) {
    return {
      directionCompass: intlMatch[1]! as CompassDirection,
      speedKt: parseInt(intlMatch[2]!, 10),
    };
  }

  return undefined;
}

/** Parses intensity change from text. */
function parseIntensityChange(text: string): SigmetIntensityChange | undefined {
  if (/\bINTSF\b/.test(text)) {
    return 'INTENSIFYING';
  }
  if (/\bWKN\b/.test(text)) {
    return 'WEAKENING';
  }
  if (/\bNC\b/.test(text)) {
    return 'NO_CHANGE';
  }
  return undefined;
}

/**
 * Parses a time string like "0200Z" or "050200Z" into a SigmetTime.
 * Accepts 4-digit (HHMM) or 6-digit (DDHHMM) formats, with or without Z suffix.
 */
function parseTimeString(timeStr: string): SigmetTime | undefined {
  const cleaned = timeStr.replace(/Z$/, '');
  if (cleaned.length === 4) {
    return {
      hour: parseInt(cleaned.substring(0, 2), 10),
      minute: parseInt(cleaned.substring(2, 4), 10),
    };
  }
  if (cleaned.length === 6) {
    return {
      day: parseInt(cleaned.substring(0, 2), 10),
      hour: parseInt(cleaned.substring(2, 4), 10),
      minute: parseInt(cleaned.substring(4, 6), 10),
    };
  }
  return undefined;
}

/**
 * Parses a volcano position string like "6042N15610W" into a SigmetPosition.
 * Format: DDMMd DDDMMd where d is N/S for lat, E/W for lon.
 */
function parseVolcanoPosition(posStr: string): SigmetPosition | undefined {
  const match = posStr.match(/^(\d{2})(\d{2})([NS])(\d{3})(\d{2})([EW])$/);
  if (!match) {
    return undefined;
  }

  let latitude = parseInt(match[1]!, 10) + parseInt(match[2]!, 10) / 60;
  if (match[3] === 'S') {
    latitude = -latitude;
  }

  let longitude = parseInt(match[4]!, 10) + parseInt(match[5]!, 10) / 60;
  if (match[6] === 'W') {
    longitude = -longitude;
  }

  return { latitude, longitude };
}

/**
 * Parses an ICAO-style position string like "N2540 W08830" into a SigmetPosition.
 * Format: Nddmm Wdddmm (or S/E variants).
 */
function parseIcaoPosition(posStr: string): SigmetPosition | undefined {
  const match = posStr.match(/([NS])(\d{2})(\d{2})\s+([EW])(\d{3})(\d{2})/);
  if (!match) {
    return undefined;
  }

  let latitude = parseInt(match[2]!, 10) + parseInt(match[3]!, 10) / 60;
  if (match[1] === 'S') {
    latitude = -latitude;
  }

  let longitude = parseInt(match[5]!, 10) + parseInt(match[6]!, 10) / 60;
  if (match[4] === 'W') {
    longitude = -longitude;
  }

  return { latitude, longitude };
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

  // Parse "CONVECTIVE SIGMET ##[E/C/W]"
  const sigmetMatch = body.match(/^CONVECTIVE SIGMET\s+(\d+)([ECW])\b/);
  if (!sigmetMatch) {
    throw new Error('Invalid convective SIGMET: could not parse number and region');
  }

  const number = parseInt(sigmetMatch[1]!, 10);
  const region = sigmetMatch[2]! as ConvectiveSigmetRegion;

  // Parse valid time: VALID UNTIL DDHHMMz or VALID UNTIL HHMMz
  let validUntil: SigmetTime | undefined;
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

/** Parses a standalone convective SIGMET outlook. */
function parseConvectiveOutlookOnly(body: string, raw: string): ConvectiveSigmet {
  const validMatch = body.match(/VALID\s+(\d{2})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})Z/);
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
  const topsMatch = body.match(/TOPS\s+(ABV\s+)?(?:TO\s+)?FL(\d{3})/);
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
    /^SIGMET\s+([A-Z]+)\s+(\d+)\s+VALID\s+UNTIL\s+(\d{2})(\d{2})(\d{2})/,
  );
  if (!headerMatch) {
    // Try the range validity format: SIGMET NAME # VALID DDHHMM/DDHHMM
    const rangeMatch = body.match(/^SIGMET\s+([A-Z]+)\s+(\d+)\s+VALID\s+(\d{6})\/(\d{6})Z?\b/);
    if (rangeMatch) {
      return parseNonConvectiveRangeValidity(body, normalized, rangeMatch);
    }
    throw new Error(
      `Invalid non-convective SIGMET: could not parse header from: ${body.substring(0, 80)}`,
    );
  }

  const seriesName = headerMatch[1]! as SigmetSeriesName;
  const seriesNumber = parseInt(headerMatch[2]!, 10);
  const validUntil: SigmetTime = {
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

  // Parse states (2-letter codes before FROM)
  const statesMatch = content.match(/^([A-Z]{2}(?:\s+[A-Z]{2})*)\s+FROM\b/);
  if (statesMatch) {
    result.states = statesMatch[1]!.split(/\s+/).filter((s) => /^[A-Z]{2}$/.test(s));
  }

  // Parse area points
  const fromIdx = content.indexOf('FROM ');
  if (fromIdx >= 0) {
    const afterFrom = content.substring(fromIdx + 5);
    const endMatch = afterFrom.match(/\s+(?:OCNL\s+)?SEV\s+(?:TURB|ICE|DUST)|VOLCANIC\s+ASH/);
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

    const fcstMatch = content.match(/FCST\s+AT\s+(\d{4})Z\s+(FL\d{3}\/FL\d{3}|SFC\/FL\d{3})/);
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
        ...(visMatch ? { visibilityBelow: parseInt(visMatch[1]!, 10) } : {}),
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
    ...(visMatch ? { visibilityBelow: parseInt(visMatch[1]!, 10) } : {}),
  };
}

/** Parses a non-convective SIGMET cancellation. */
function parseNonConvectiveCancellation(body: string, raw: string): NonConvectiveSigmet {
  const cancelMatch = body.match(/^CANCEL\s+SIGMET\s+([A-Z]+)\s+(\d+)\.\s*(.*)/);
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

/** Parses an international (ICAO format) SIGMET. */
function parseInternationalSigmet(normalized: string): InternationalSigmet {
  // Strip WMO headers if present - find the SIGMET keyword for ICAO format
  let body = normalized;

  // Pattern 1: XXXX SIGMET NAME # VALID dddddd/dddddd XXXX-
  // Pattern 2: SIGMET NAME # VALID dddddd/dddddd XXXX- (FIR code comes later)
  const withFirPrefix = body.match(
    /([A-Z]{4})\s+SIGMET\s+[A-Z]+\s+\d+\s+VALID\s+\d{6}\/\d{6}\s+[A-Z]{4}-/,
  );
  if (withFirPrefix && withFirPrefix.index !== undefined && withFirPrefix.index > 0) {
    body = body.substring(withFirPrefix.index).trim();
  } else {
    // Look for pattern without leading FIR code
    const sigmetIdx = body.search(/SIGMET\s+[A-Z]+\s+\d+\s+VALID\s+\d{6}\/\d{6}\s+[A-Z]{4}-/);
    if (sigmetIdx > 0) {
      body = body.substring(sigmetIdx).trim();
    }
  }

  // Try pattern 1: XXXX SIGMET NAME # VALID dddddd/dddddd XXXX-
  let headerMatch = body.match(
    /^([A-Z]{4})\s+SIGMET\s+([A-Z]+)\s+(\d+)\s+VALID\s+(\d{2})(\d{2})(\d{2})\/(\d{2})(\d{2})(\d{2})\s+([A-Z]{4})-/,
  );
  let firCodeFromHeader: string | undefined;

  if (!headerMatch) {
    // Try pattern 2: SIGMET NAME # VALID dddddd/dddddd XXXX- (no leading FIR code)
    const noFirMatch = body.match(
      /^SIGMET\s+([A-Z]+)\s+(\d+)\s+VALID\s+(\d{2})(\d{2})(\d{2})\/(\d{2})(\d{2})(\d{2})\s+([A-Z]{4})-/,
    );
    if (!noFirMatch) {
      throw new Error(
        `Invalid international SIGMET: could not parse header from: ${body.substring(0, 100)}`,
      );
    }
    // Remap to the same index positions as pattern 1
    headerMatch = noFirMatch;
    firCodeFromHeader = undefined;
  } else {
    firCodeFromHeader = headerMatch[1]!;
  }

  // Extract fields based on which pattern matched
  const hasLeadingFir = firCodeFromHeader !== undefined;
  const seriesName = headerMatch[hasLeadingFir ? 2 : 1]! as SigmetSeriesName;
  const seriesNumber = parseInt(headerMatch[hasLeadingFir ? 3 : 2]!, 10);
  const validFrom: SigmetTime = {
    day: parseInt(headerMatch[hasLeadingFir ? 4 : 3]!, 10),
    hour: parseInt(headerMatch[hasLeadingFir ? 5 : 4]!, 10),
    minute: parseInt(headerMatch[hasLeadingFir ? 6 : 5]!, 10),
  };
  const validTo: SigmetTime = {
    day: parseInt(headerMatch[hasLeadingFir ? 7 : 6]!, 10),
    hour: parseInt(headerMatch[hasLeadingFir ? 8 : 7]!, 10),
    minute: parseInt(headerMatch[hasLeadingFir ? 9 : 8]!, 10),
  };
  const issuingStation = headerMatch[hasLeadingFir ? 10 : 9]!;

  // Get the rest of the body after the header
  const afterHeader = body.substring(headerMatch[0].length).trim();

  // Parse FIR name: XXXX [NAME] FIR
  const firNameMatch = afterHeader.match(/^([A-Z]{4})\s+(.*?FIR)\b/);
  const firCode = firCodeFromHeader ?? (firNameMatch ? firNameMatch[1]! : '');
  const firName = firNameMatch ? firNameMatch[2]!.trim() : '';

  // Check for cancellation: CNL SIGMET NAME # dddddd/dddddd
  if (/\bCNL\s+SIGMET\b/.test(afterHeader)) {
    return parseInternationalCancellation(
      afterHeader,
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

  // Parse phenomena and details from the rest
  const afterFir = firNameMatch
    ? afterHeader.substring(afterHeader.indexOf('FIR') + 3).trim()
    : afterHeader;

  return parseInternationalBody(
    afterFir,
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

/** Parses the body of an international SIGMET after the FIR name. */
function parseInternationalBody(
  bodyAfterFir: string,
  raw: string,
  firCode: string,
  firName: string,
  seriesName: SigmetSeriesName,
  seriesNumber: number,
  issuingStation: string,
  validFrom: SigmetTime,
  validTo: SigmetTime,
): InternationalSigmet {
  // Clean trailing = sign (ICAO message terminator)
  const content = bodyAfterFir.replace(/=\s*$/, '').trim();

  // Detect tropical cyclone
  const tcMatch = content.match(/\bTC\s+([A-Z]+)\b/);
  const cycloneName = tcMatch ? tcMatch[1]! : undefined;

  // Detect phenomena
  let phenomena: string | undefined;
  const phenMatch = content.match(
    /^((?:SEV\s+TURB|SEV\s+ICE|FRQ\s+TS|OBSC\s+TS|EMBD\s+TS|SQL\s+TS|ISOL\s+SEV\s+TS|TC\s+\w+|VA\s+CLD|RDOACT\s+CLD|WDSPR\s+[DS]S)\b)/,
  );
  if (phenMatch) {
    phenomena = phenMatch[1]!;
  } else if (cycloneName) {
    phenomena = `TC ${cycloneName}`;
  }

  // Parse observation status
  let observationStatus: SigmetObservationStatus | undefined;
  let observedAt: SigmetTime | undefined;
  const obsMatch = content.match(/\bOBS\s+AT\s+(\d{4})Z/);
  if (obsMatch) {
    observationStatus = 'OBSERVED';
    observedAt = parseTimeString(obsMatch[1]! + 'Z');
  } else if (/\bOBS\b/.test(content) && !/\bOBS\s+AND\s+FCST\b/.test(content)) {
    observationStatus = 'OBSERVED';
  }
  if (/\bFCST\b/.test(content) && !/FCST\s+AT\b/.test(content)) {
    if (!observationStatus) {
      observationStatus = 'FORECAST';
    }
  }

  // Parse area description
  let areaDescription: string | undefined;
  const areaMatch = content.match(
    /\b(?:AREA\s+)?WI\s+(.*?)(?=\s+(?:SFC|FL\d{3}|MOV|STNR|NC|INTSF|WKN|FCST\s+AT)\b|$)/,
  );
  if (areaMatch) {
    areaDescription = areaMatch[1]!.trim();
  }

  // Parse altitude range
  const altitudeRange = parseAltitudeRange(content);

  // Parse movement
  const movement = parseMovement(content);
  const isStationary = /\bSTNR\b/.test(content);

  // Parse intensity change
  const intensityChange = parseIntensityChange(content);

  // Tropical cyclone fields
  let cyclonePosition: SigmetPosition | undefined;
  let cbTopFl: number | undefined;
  let withinNm: number | undefined;
  let forecastTime: SigmetTime | undefined;
  let forecastPosition: SigmetPosition | undefined;

  if (cycloneName) {
    const posMatch = content.match(/(?:OBS\s+AT\s+\d{4}Z\s+)?([NS]\d{4}\s+[EW]\d{5})/);
    if (posMatch) {
      cyclonePosition = parseIcaoPosition(posMatch[1]!);
    }

    const cbMatch = content.match(/CB\s+TOP\s+FL(\d{3})/);
    if (cbMatch) {
      cbTopFl = parseInt(cbMatch[1]!, 10);
    }

    const wiMatch = content.match(/WI\s+(\d+)NM\s+OF\s+CENTER/);
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

  // Collect additional info (e.g. LLWS notes)
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
  afterHeader: string,
  raw: string,
  firCode: string,
  firName: string,
  seriesName: SigmetSeriesName,
  seriesNumber: number,
  issuingStation: string,
  validFrom: SigmetTime,
  validTo: SigmetTime,
): InternationalSigmet {
  const cnlMatch = afterHeader.match(/CNL\s+SIGMET\s+([A-Z]+)\s+(\d+)\s+(\d{6})\/(\d{6})/);

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
          cancelledSeriesName: cnlMatch[1]! as SigmetSeriesName,
          cancelledSeriesNumber: parseInt(cnlMatch[2]!, 10),
          cancelledValidStart: parseTimeString(cnlMatch[3]!)!,
          cancelledValidEnd: parseTimeString(cnlMatch[4]!)!,
        }
      : {}),
  };
}
