import type {
  Altimeter,
  CloudCoverage,
  CloudLayer,
  CloudType,
  Metar,
  MetarRemarks,
  MetarType,
  RunwayVisualRange,
  RvrTrend,
  SkyCondition,
  SkyClearType,
  Visibility,
  WeatherDescriptor,
  WeatherIntensity,
  WeatherPhenomenon,
  WeatherPhenomenonCode,
  Wind,
} from '@squawk/types';
import { parseRemarks } from './remarks-parser.js';
import { deriveFlightCategory } from './flight-category.js';

/** Set of valid two-character weather phenomenon codes. */
const PHENOMENON_CODES = new Set<string>([
  'DZ',
  'RA',
  'SN',
  'SG',
  'IC',
  'PL',
  'GR',
  'GS',
  'UP',
  'BR',
  'FG',
  'FU',
  'VA',
  'DU',
  'SA',
  'HZ',
  'PY',
  'PO',
  'SQ',
  'FC',
  'SS',
  'DS',
]);

/** Set of valid two-character weather descriptor codes. */
const DESCRIPTOR_CODES = new Set<string>(['MI', 'PR', 'BC', 'DR', 'BL', 'SH', 'TS', 'FZ']);

/**
 * Parses a raw METAR or SPECI string into a structured {@link Metar} object.
 *
 * Handles both US (FAA) and ICAO format METARs including CAVOK, QNH altimeter
 * settings, and NOSIG trend indicators.
 *
 * ```typescript
 * import { parseMetar } from '@squawk/weather';
 *
 * const metar = parseMetar('METAR KJFK 041853Z 21010KT 10SM FEW250 18/06 A3012 RMK AO2 SLP203 T01830061');
 * console.log(metar.stationId);       // "KJFK"
 * console.log(metar.wind?.speedKt);   // 10
 * console.log(metar.flightCategory);  // "VFR"
 * ```
 *
 * @param raw - The raw METAR or SPECI string to parse.
 * @returns A parsed {@link Metar} object.
 * @throws {Error} If the string cannot be parsed as a valid METAR/SPECI.
 */
export function parseMetar(raw: string): Metar {
  const trimmed = raw.trim();
  const remarksSplit = trimmed.split(/\sRMK\s/);
  const bodyPart = remarksSplit[0]!;
  const remarksPart = remarksSplit.length > 1 ? remarksSplit.slice(1).join(' RMK ') : undefined;

  const tokens = bodyPart.split(/\s+/);
  let pos = 0;

  // Parse report type (METAR or SPECI prefix)
  let type: MetarType = 'METAR';
  if (tokens[pos] === 'METAR' || tokens[pos] === 'SPECI') {
    type = tokens[pos] as MetarType;
    pos++;
  }

  // Parse station identifier
  const stationId = tokens[pos]!;
  pos++;

  // Parse observation time (DDHHMMz)
  const timeToken = tokens[pos]!;
  const timeMatch = timeToken.match(/^(\d{2})(\d{2})(\d{2})Z$/);
  if (!timeMatch) {
    throw new Error(`Invalid observation time: ${timeToken}`);
  }
  const dayOfMonth = parseInt(timeMatch[1]!, 10);
  const hour = parseInt(timeMatch[2]!, 10);
  const minute = parseInt(timeMatch[3]!, 10);
  pos++;

  // Parse AUTO/COR modifiers
  let isAutomated = false;
  let isCorrected = false;
  if (tokens[pos] === 'AUTO') {
    isAutomated = true;
    pos++;
  } else if (tokens[pos] === 'COR') {
    isCorrected = true;
    pos++;
  }

  // Parse wind
  let wind: Wind | undefined;
  if (pos < tokens.length && isWindToken(tokens[pos]!)) {
    wind = parseWind(tokens[pos]!);
    pos++;

    // Check for variable wind direction (e.g. 200V270)
    if (pos < tokens.length && /^\d{3}V\d{3}$/.test(tokens[pos]!)) {
      const variableMatch = tokens[pos]!.match(/^(\d{3})V(\d{3})$/);
      if (variableMatch) {
        wind.variableFromDeg = parseInt(variableMatch[1]!, 10);
        wind.variableToDeg = parseInt(variableMatch[2]!, 10);
      }
      pos++;
    }
  }

  // Check for CAVOK
  let isCavok = false;
  if (tokens[pos] === 'CAVOK') {
    isCavok = true;
    pos++;
  }

  // Parse visibility (if not CAVOK)
  let visibility: Visibility | undefined;
  if (!isCavok && pos < tokens.length) {
    const visResult = parseVisibility(tokens, pos);
    if (visResult) {
      visibility = visResult.visibility;
      pos = visResult.nextPos;
    }
  }

  // Parse RVR groups (R##/####FT or R##/####V####FT)
  const rvr: RunwayVisualRange[] = [];
  while (pos < tokens.length && /^R\d{2}[LCR]?\//.test(tokens[pos]!)) {
    const rvrResult = parseRvr(tokens[pos]!);
    if (rvrResult) {
      rvr.push(rvrResult);
    }
    pos++;
  }

  // Parse weather phenomena groups
  const weather: WeatherPhenomenon[] = [];
  while (pos < tokens.length) {
    const token = tokens[pos]!;
    if (isWeatherToken(token)) {
      const wx = parseWeatherPhenomenon(token);
      if (wx) {
        weather.push(wx);
      }
      pos++;
    } else {
      break;
    }
  }

  // Parse sky condition (cloud layers, CLR/SKC, vertical visibility)
  const sky: SkyCondition = { layers: [] };
  if (isCavok) {
    sky.clear = 'SKC';
  } else {
    while (pos < tokens.length) {
      const token = tokens[pos]!;
      if (token === 'CLR' || token === 'SKC') {
        sky.clear = token as SkyClearType;
        pos++;
      } else if (token.startsWith('VV')) {
        const vvMatch = token.match(/^VV(\d{3})$/);
        if (vvMatch) {
          sky.verticalVisibilityFt = parseInt(vvMatch[1]!, 10) * 100;
        }
        pos++;
      } else if (/^(FEW|SCT|BKN|OVC)\d{3}/.test(token)) {
        const layer = parseCloudLayer(token);
        if (layer) {
          sky.layers.push(layer);
        }
        pos++;
      } else {
        break;
      }
    }
  }

  // Parse temperature/dewpoint (TT/TD or MTT/MTD)
  let temperatureC: number | undefined;
  let dewpointC: number | undefined;
  if (pos < tokens.length && /^M?\d{2}\/M?\d{2}$/.test(tokens[pos]!)) {
    const tempDew = parseTempDewpoint(tokens[pos]!);
    temperatureC = tempDew.temperatureC;
    dewpointC = tempDew.dewpointC;
    pos++;
  }

  // Parse altimeter setting (A#### or Q####)
  let altimeter: Altimeter | undefined;
  if (pos < tokens.length && /^[AQ]\d{4}$/.test(tokens[pos]!)) {
    altimeter = parseAltimeter(tokens[pos]!);
    pos++;
  }

  // Check for NOSIG in remaining body tokens
  let isNoSignificantChange = false;
  while (pos < tokens.length) {
    if (tokens[pos] === 'NOSIG') {
      isNoSignificantChange = true;
    }
    pos++;
  }

  // Parse remarks
  const remarks = remarksPart !== undefined ? parseRemarks(remarksPart) : undefined;

  // Backfill omitted hour fields in remarks with the observation hour.
  // Per FAA JO 7900.5E, when the hour is omitted from a time field in remarks,
  // it occurred during the observation hour and can be inferred from the report time.
  if (remarks) {
    backfillRemarkHours(remarks, hour);
  }

  // Derive flight category
  const flightCategory = deriveFlightCategory(
    visibility?.statuteMiles,
    visibility?.isLessThan ?? false,
    sky,
    isCavok,
  );

  return {
    raw: trimmed,
    type,
    stationId,
    dayOfMonth,
    hour,
    minute,
    isAutomated,
    isCorrected,
    isCavok,
    isNoSignificantChange,
    ...(wind ? { wind } : {}),
    ...(visibility ? { visibility } : {}),
    rvr,
    weather,
    sky,
    ...(temperatureC !== undefined ? { temperatureC } : {}),
    ...(dewpointC !== undefined ? { dewpointC } : {}),
    ...(altimeter ? { altimeter } : {}),
    ...(remarks ? { remarks } : {}),
    ...(flightCategory ? { flightCategory } : {}),
  };
}

/** Tests whether a token looks like a wind group (dddssKT or dddssGggKT or VRBssKT). */
function isWindToken(token: string): boolean {
  return /^(VRB|\d{3})\d{2,3}(G\d{2,3})?KT$/.test(token);
}

/** Parses a wind token into a Wind object. */
function parseWind(token: string): Wind {
  const match = token.match(/^(VRB|\d{3})(\d{2,3})(G(\d{2,3}))?KT$/);
  if (!match) {
    throw new Error(`Invalid wind token: ${token}`);
  }

  const dirStr = match[1]!;
  const speedKt = parseInt(match[2]!, 10);
  const gustKt = match[4] ? parseInt(match[4], 10) : undefined;

  const isVariable = dirStr === 'VRB';
  const isCalm = !isVariable && dirStr === '000' && speedKt === 0;
  const directionDeg = isVariable || isCalm ? undefined : parseInt(dirStr, 10);

  return {
    ...(directionDeg !== undefined ? { directionDeg } : {}),
    isVariable,
    isCalm,
    speedKt,
    ...(gustKt !== undefined ? { gustKt } : {}),
  };
}

/**
 * Attempts to parse visibility from the token stream.
 * Handles whole numbers (10SM), fractions (1/4SM), mixed (1 1/2SM),
 * less-than (M1/4SM), and ICAO meters (9999, 0200).
 */
function parseVisibility(
  tokens: string[],
  pos: number,
): { visibility: Visibility; nextPos: number } | undefined {
  const token = tokens[pos]!;

  // US statute miles: M?(\d+)?(\s?\d/\d)?SM
  // Check for whole + fraction combination (e.g. "1 1/2SM" = two tokens: "1" and "1/2SM")
  if (/^\d+$/.test(token) && pos + 1 < tokens.length && /^\d\/\d+SM$/.test(tokens[pos + 1]!)) {
    const whole = parseInt(token, 10);
    const fracMatch = tokens[pos + 1]!.match(/^(\d)\/(\d+)SM$/);
    if (fracMatch) {
      const numerator = parseInt(fracMatch[1]!, 10);
      const denominator = parseInt(fracMatch[2]!, 10);
      return {
        visibility: {
          statuteMiles: whole + numerator / denominator,
          isLessThan: false,
        },
        nextPos: pos + 2,
      };
    }
  }

  // M prefix (less than) with fraction: M1/4SM
  const mFracMatch = token.match(/^M(\d+)\/(\d+)SM$/);
  if (mFracMatch) {
    const numerator = parseInt(mFracMatch[1]!, 10);
    const denominator = parseInt(mFracMatch[2]!, 10);
    return {
      visibility: {
        statuteMiles: numerator / denominator,
        isLessThan: true,
      },
      nextPos: pos + 1,
    };
  }

  // Fraction only: 1/4SM, 3/4SM
  const fracOnlyMatch = token.match(/^(\d+)\/(\d+)SM$/);
  if (fracOnlyMatch) {
    const numerator = parseInt(fracOnlyMatch[1]!, 10);
    const denominator = parseInt(fracOnlyMatch[2]!, 10);
    return {
      visibility: {
        statuteMiles: numerator / denominator,
        isLessThan: false,
      },
      nextPos: pos + 1,
    };
  }

  // Whole statute miles: 10SM, 1SM
  const wholeMatch = token.match(/^(\d+)SM$/);
  if (wholeMatch) {
    return {
      visibility: {
        statuteMiles: parseInt(wholeMatch[1]!, 10),
        isLessThan: false,
      },
      nextPos: pos + 1,
    };
  }

  // ICAO meters: 4 digits (9999, 0200, etc.)
  const metersMatch = token.match(/^(\d{4})$/);
  if (metersMatch) {
    return {
      visibility: {
        meters: parseInt(metersMatch[1]!, 10),
        isLessThan: false,
      },
      nextPos: pos + 1,
    };
  }

  return undefined;
}

/** Parses an RVR token (e.g. R27L/2400FT, R27R/1800V3000FT, R17C/4000VP6000FT, R30L/P6000FT, R09/M0200FT). */
function parseRvr(token: string): RunwayVisualRange | undefined {
  // R##[L/C/R]/[M|P]####[V[M|P]####]FT[U/D/N]
  const match = token.match(/^R(\d{2}[LCR]?)\/([MP]?)(\d{4})(?:V([MP]?)(\d{4}))?FT([UDN])?$/);
  if (!match) {
    return undefined;
  }

  const trendMap: Record<string, RvrTrend> = { U: 'RISING', D: 'FALLING', N: 'NO_CHANGE' };

  return {
    runway: match[1]!,
    visibilityFt: parseInt(match[3]!, 10),
    isMoreThan: match[2] === 'P',
    isLessThan: match[2] === 'M',
    ...(match[5]
      ? { variableMaxFt: parseInt(match[5], 10), isVariableMaxMoreThan: match[4] === 'P' }
      : {}),
    ...(match[6] ? { trend: trendMap[match[6]]! } : {}),
  };
}

/** Tests whether a token looks like a weather phenomenon group. */
function isWeatherToken(token: string): boolean {
  // Weather tokens start with intensity (+/-), VC, or a descriptor/phenomenon code
  // They must not match other group patterns (cloud layers, temp, altimeter, etc.)
  if (/^(FEW|SCT|BKN|OVC)\d{3}/.test(token)) {
    return false;
  }
  if (/^(CLR|SKC|CAVOK|NOSIG)$/.test(token)) {
    return false;
  }
  if (/^VV\d{3}$/.test(token)) {
    return false;
  }
  if (/^M?\d{2}\/M?\d{2}$/.test(token)) {
    return false;
  }
  if (/^[AQ]\d{4}$/.test(token)) {
    return false;
  }

  // Strip intensity and VC prefix, then check for valid descriptor or phenomenon codes
  let stripped = token;
  if (stripped.startsWith('+') || stripped.startsWith('-')) {
    stripped = stripped.slice(1);
  }
  if (stripped.startsWith('VC')) {
    stripped = stripped.slice(2);
  }

  // Must contain at least one valid phenomenon or descriptor code
  if (stripped.length < 2) {
    return false;
  }

  // Check each pair of characters for valid codes
  for (let i = 0; i < stripped.length; i += 2) {
    const code = stripped.slice(i, i + 2);
    if (!PHENOMENON_CODES.has(code) && !DESCRIPTOR_CODES.has(code)) {
      return false;
    }
  }

  return true;
}

/** Parses a weather phenomenon token (e.g. "+TSRA", "VCSH", "-DZ", "FZRA"). */
function parseWeatherPhenomenon(token: string): WeatherPhenomenon | undefined {
  let remaining = token;

  // Parse intensity
  let intensity: WeatherIntensity = 'MODERATE';
  if (remaining.startsWith('+')) {
    intensity = 'HEAVY';
    remaining = remaining.slice(1);
  } else if (remaining.startsWith('-')) {
    intensity = 'LIGHT';
    remaining = remaining.slice(1);
  }

  // Parse vicinity
  let isVicinity = false;
  if (remaining.startsWith('VC')) {
    isVicinity = true;
    remaining = remaining.slice(2);
  }

  // Parse descriptor
  let descriptor: WeatherDescriptor | undefined;
  if (remaining.length >= 2) {
    const possibleDescriptor = remaining.slice(0, 2);
    if (DESCRIPTOR_CODES.has(possibleDescriptor)) {
      descriptor = possibleDescriptor as WeatherDescriptor;
      remaining = remaining.slice(2);
    }
  }

  // Parse phenomenon codes (each is 2 characters)
  const phenomena: WeatherPhenomenonCode[] = [];
  while (remaining.length >= 2) {
    const code = remaining.slice(0, 2);
    if (PHENOMENON_CODES.has(code)) {
      phenomena.push(code as WeatherPhenomenonCode);
      remaining = remaining.slice(2);
    } else {
      break;
    }
  }

  // A valid weather group must have at least a descriptor or a phenomenon
  if (!descriptor && phenomena.length === 0) {
    return undefined;
  }

  return {
    raw: token,
    intensity,
    isVicinity,
    ...(descriptor ? { descriptor } : {}),
    phenomena,
  };
}

/** Parses a cloud layer token (e.g. "FEW250", "BKN020CB", "SCT045TCU"). */
function parseCloudLayer(token: string): CloudLayer | undefined {
  const match = token.match(/^(FEW|SCT|BKN|OVC)(\d{3})(CB|TCU)?$/);
  if (!match) {
    return undefined;
  }

  return {
    coverage: match[1] as CloudCoverage,
    altitudeFt: parseInt(match[2]!, 10) * 100,
    ...(match[3] ? { type: match[3] as CloudType } : {}),
  };
}

/** Parses a temperature/dewpoint token (e.g. "18/06", "M04/M18", "M01/M03"). */
function parseTempDewpoint(token: string): { temperatureC: number; dewpointC: number } {
  const match = token.match(/^(M?)(\d{2})\/(M?)(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid temp/dewpoint token: ${token}`);
  }

  let temp = parseInt(match[2]!, 10);
  if (match[1] === 'M' && temp !== 0) {
    temp = -temp;
  }

  let dew = parseInt(match[4]!, 10);
  if (match[3] === 'M' && dew !== 0) {
    dew = -dew;
  }

  return { temperatureC: temp, dewpointC: dew };
}

/** Parses an altimeter setting token (e.g. "A3012" or "Q1023"). */
function parseAltimeter(token: string): Altimeter {
  const prefix = token[0]!;
  const value = parseInt(token.slice(1), 10);

  if (prefix === 'A') {
    return { inHg: value / 100 };
  }
  return { hPa: value };
}

/**
 * Backfills omitted hour fields in parsed remarks with the observation hour.
 * Per FAA JO 7900.5E, when the hour is omitted from a time field in remarks
 * (2-digit format instead of 4-digit), the event occurred during the
 * observation hour.
 */
function backfillRemarkHours(remarks: MetarRemarks, observationHour: number): void {
  if (remarks.peakWind && remarks.peakWind.hour === undefined) {
    remarks.peakWind.hour = observationHour;
  }

  if (remarks.windShift && remarks.windShift.hour === undefined) {
    remarks.windShift.hour = observationHour;
  }

  if (remarks.precipitationEvents) {
    for (const event of remarks.precipitationEvents) {
      if (event.hour === undefined) {
        event.hour = observationHour;
      }
    }
  }
}
