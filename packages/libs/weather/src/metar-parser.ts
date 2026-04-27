import type {
  Altimeter,
  DayTime,
  Metar,
  MetarType,
  RunwayVisualRange,
  RvrTrend,
  SkyCondition,
  SkyClearType,
  Visibility,
  WeatherPhenomenon,
  Wind,
} from './types/index.js';
import { parseRemarks } from './remarks-parser.js';
import { deriveFlightCategory } from './flight-category.js';
import {
  isWindToken,
  parseWind,
  parseVisibility,
  isWeatherToken,
  parseWeatherPhenomenon,
  parseCloudLayer,
} from './weather-utils.js';

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
  const observationTime: DayTime = {
    day: parseInt(timeMatch[1]!, 10),
    hour: parseInt(timeMatch[2]!, 10),
    minute: parseInt(timeMatch[3]!, 10),
  };
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
          sky.verticalVisibilityFtAgl = parseInt(vvMatch[1]!, 10) * 100;
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

  // Parse remarks (observation hour is passed so time fields can be populated immediately)
  const remarks =
    remarksPart !== undefined ? parseRemarks(remarksPart, observationTime.hour) : undefined;

  // Derive flight category
  const flightCategory = deriveFlightCategory(
    visibility?.visibilitySm,
    visibility?.isLessThan ?? false,
    sky,
    isCavok,
  );

  return {
    raw: trimmed,
    type,
    stationId,
    observationTime,
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
