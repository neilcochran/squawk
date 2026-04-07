import type {
  DayTime,
  IcingIntensity,
  SkyCondition,
  SkyClearType,
  Taf,
  TafChangeType,
  TafForecastGroup,
  TafIcingLayer,
  TafTurbulenceLayer,
  TafWindShear,
  TurbulenceIntensity,
  Visibility,
  WeatherPhenomenon,
  Wind,
} from './types/index.js';
import {
  isWindToken,
  parseWind,
  parseVisibility,
  isWeatherToken,
  parseWeatherPhenomenon,
  parseCloudLayer,
} from './weather-utils.js';

/**
 * Parses a raw TAF string into a structured {@link Taf} object.
 *
 * Handles both US (FAA) and ICAO format TAFs including FM, TEMPO, BECMG,
 * and PROB change groups, wind shear (WS), turbulence (5-group), icing
 * (6-group), CAVOK, NSW, and cancelled (CNL) forecasts.
 *
 * ```typescript
 * import { parseTaf } from '@squawk/weather';
 *
 * const taf = parseTaf(
 *   'TAF KJFK 041730Z 0418/0524 21012KT P6SM FEW250 FM042200 24015G25KT P6SM SCT040 BKN080'
 * );
 * console.log(taf.stationId);                      // "KJFK"
 * console.log(taf.forecast[0].wind?.speedKt);       // 12
 * console.log(taf.forecast[1].changeType);           // "FM"
 * ```
 *
 * @param raw - The raw TAF string to parse.
 * @returns A parsed {@link Taf} object.
 * @throws {Error} If the string cannot be parsed as a valid TAF.
 */
export function parseTaf(raw: string): Taf {
  // Normalize multi-line TAF into a single line and split into tokens
  const normalized = raw.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = normalized.split(' ');
  let pos = 0;

  // Parse TAF identifier
  if (tokens[pos] !== 'TAF') {
    throw new Error(`Expected TAF identifier, got: ${tokens[pos]}`);
  }
  pos++;

  // Parse AMD/COR modifiers
  let isAmended = false;
  let isCorrected = false;
  if (tokens[pos] === 'AMD') {
    isAmended = true;
    pos++;
  } else if (tokens[pos] === 'COR') {
    isCorrected = true;
    pos++;
  }

  // Parse station identifier
  const stationId = tokens[pos]!;
  pos++;

  // Parse issuance time (DDHHMMz)
  const timeToken = tokens[pos]!;
  const timeMatch = timeToken.match(/^(\d{2})(\d{2})(\d{2})Z$/);
  if (!timeMatch) {
    throw new Error(`Invalid issuance time: ${timeToken}`);
  }
  const issuedAt: DayTime = {
    day: parseInt(timeMatch[1]!, 10),
    hour: parseInt(timeMatch[2]!, 10),
    minute: parseInt(timeMatch[3]!, 10),
  };
  pos++;

  // Parse valid period (DDHH/DDHH)
  const validToken = tokens[pos]!;
  const validMatch = validToken.match(/^(\d{2})(\d{2})\/(\d{2})(\d{2})$/);
  if (!validMatch) {
    throw new Error(`Invalid valid period: ${validToken}`);
  }
  const validFrom: DayTime = {
    day: parseInt(validMatch[1]!, 10),
    hour: parseInt(validMatch[2]!, 10),
    minute: 0,
  };
  const validTo: DayTime = {
    day: parseInt(validMatch[3]!, 10),
    hour: parseInt(validMatch[4]!, 10),
    minute: 0,
  };
  pos++;

  // Check for cancelled TAF
  if (tokens[pos] === 'CNL') {
    return {
      raw: normalized,
      stationId,
      issuedAt,
      isAmended,
      isCorrected,
      isCancelled: true,
      validFrom,
      validTo,
      forecast: [],
    };
  }

  // Split remaining tokens into groups at change group boundaries
  const groups = splitIntoGroups(tokens, pos);
  const forecast: TafForecastGroup[] = [];

  for (const group of groups) {
    forecast.push(parseForecastGroup(group));
  }

  return {
    raw: normalized,
    stationId,
    issuedAt,
    isAmended,
    isCorrected,
    isCancelled: false,
    validFrom,
    validTo,
    forecast,
  };
}

/**
 * Splits the remaining token stream into groups, where each group starts with
 * a change indicator (FM, TEMPO, BECMG, PROB) or is the initial base forecast.
 * PROB30/PROB40 followed by TEMPO is treated as a single group.
 */
function splitIntoGroups(tokens: string[], startPos: number): string[][] {
  const groups: string[][] = [];
  let currentGroup: string[] = [];

  for (let i = startPos; i < tokens.length; i++) {
    const token = tokens[i]!;

    if (isChangeGroupStart(token) && currentGroup.length > 0) {
      // Check if previous group started with PROB and this token is TEMPO -
      // PROB+TEMPO is a combined group, not two separate groups
      if (
        token === 'TEMPO' &&
        currentGroup.length === 1 &&
        (currentGroup[0] === 'PROB30' || currentGroup[0] === 'PROB40')
      ) {
        currentGroup.push(token);
      } else {
        groups.push(currentGroup);
        currentGroup = [token];
      }
    } else {
      currentGroup.push(token);
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

/** Tests whether a token marks the start of a new change group. */
function isChangeGroupStart(token: string): boolean {
  return (
    /^FM\d{6}$/.test(token) ||
    token === 'TEMPO' ||
    token === 'BECMG' ||
    token === 'PROB30' ||
    token === 'PROB40'
  );
}

/** Parses a single forecast group (base or change group) from its tokens. */
function parseForecastGroup(tokens: string[]): TafForecastGroup {
  let pos = 0;

  let changeType: TafChangeType | undefined;
  let probability: 30 | 40 | undefined;
  let start: DayTime | undefined;
  let end: DayTime | undefined;

  const token = tokens[pos]!;

  // Parse FM group header: FMDDHHmm
  const fmMatch = token.match(/^FM(\d{2})(\d{2})(\d{2})$/);
  if (fmMatch) {
    changeType = 'FM';
    start = {
      day: parseInt(fmMatch[1]!, 10),
      hour: parseInt(fmMatch[2]!, 10),
      minute: parseInt(fmMatch[3]!, 10),
    };
    pos++;
  }

  // Parse PROB group header: PROB30 or PROB40, optionally followed by TEMPO
  if (token === 'PROB30' || token === 'PROB40') {
    probability = token === 'PROB30' ? 30 : 40;
    pos++;

    if (pos < tokens.length && tokens[pos] === 'TEMPO') {
      changeType = 'TEMPO';
      pos++;
    }

    // Parse validity period (DDHH/DDHH)
    if (pos < tokens.length) {
      const periodResult = parseValidityPeriod(tokens[pos]!);
      if (periodResult) {
        start = periodResult.start;
        end = periodResult.end;
        pos++;
      }
    }
  }

  // Parse TEMPO or BECMG group header
  if (token === 'TEMPO' || token === 'BECMG') {
    changeType = token as TafChangeType;
    pos++;

    // Parse validity period (DDHH/DDHH)
    if (pos < tokens.length) {
      const periodResult = parseValidityPeriod(tokens[pos]!);
      if (periodResult) {
        start = periodResult.start;
        end = periodResult.end;
        pos++;
      }
    }
  }

  // Build header with only defined properties (exactOptionalPropertyTypes)
  const header: {
    changeType?: TafChangeType;
    probability?: 30 | 40;
    start?: DayTime;
    end?: DayTime;
  } = {};
  if (changeType !== undefined) {
    header.changeType = changeType;
  }
  if (probability !== undefined) {
    header.probability = probability;
  }
  if (start !== undefined) {
    header.start = start;
  }
  if (end !== undefined) {
    header.end = end;
  }

  return parseForecastFields(tokens, pos, header);
}

/** Parses a DDHH/DDHH validity period token. */
function parseValidityPeriod(token: string): { start: DayTime; end: DayTime } | undefined {
  const match = token.match(/^(\d{2})(\d{2})\/(\d{2})(\d{2})$/);
  if (!match) {
    return undefined;
  }
  return {
    start: { day: parseInt(match[1]!, 10), hour: parseInt(match[2]!, 10), minute: 0 },
    end: { day: parseInt(match[3]!, 10), hour: parseInt(match[4]!, 10), minute: 0 },
  };
}

/** Parses the weather content fields of a forecast group starting at startPos. */
function parseForecastFields(
  tokens: string[],
  startPos: number,
  header: {
    changeType?: TafChangeType;
    probability?: 30 | 40;
    start?: DayTime;
    end?: DayTime;
  },
): TafForecastGroup {
  let pos = startPos;

  // Parse wind
  let wind: Wind | undefined;
  if (pos < tokens.length && isWindToken(tokens[pos]!)) {
    wind = parseWind(tokens[pos]!);
    pos++;
  }

  // Check for CAVOK
  let isCavok = false;
  if (pos < tokens.length && tokens[pos] === 'CAVOK') {
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

  // Parse NSW (No Significant Weather)
  let isNoSignificantWeather = false;
  if (pos < tokens.length && tokens[pos] === 'NSW') {
    isNoSignificantWeather = true;
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

  // Parse sky condition (cloud layers, SKC, vertical visibility)
  const sky: SkyCondition = { layers: [] };
  if (isCavok) {
    sky.clear = 'SKC';
  } else {
    while (pos < tokens.length) {
      const token = tokens[pos]!;
      if (token === 'SKC') {
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

  // Parse wind shear (WS###/dddss[s]KT)
  let windShear: TafWindShear | undefined;
  if (pos < tokens.length) {
    const wsResult = parseWindShear(tokens[pos]!);
    if (wsResult) {
      windShear = wsResult;
      pos++;
    }
  }

  // Parse turbulence layers (5-group) and icing layers (6-group)
  let turbulence: TafTurbulenceLayer[] | undefined;
  let icing: TafIcingLayer[] | undefined;
  while (pos < tokens.length) {
    const token = tokens[pos]!;
    const turbResult = parseTurbulenceLayer(token);
    if (turbResult) {
      if (!turbulence) {
        turbulence = [];
      }
      turbulence.push(turbResult);
      pos++;
      continue;
    }
    const iceResult = parseIcingLayer(token);
    if (iceResult) {
      if (!icing) {
        icing = [];
      }
      icing.push(iceResult);
      pos++;
      continue;
    }
    break;
  }

  return {
    ...header,
    isCavok,
    isNoSignificantWeather,
    ...(wind ? { wind } : {}),
    ...(visibility ? { visibility } : {}),
    weather,
    sky,
    ...(windShear ? { windShear } : {}),
    ...(turbulence ? { turbulence } : {}),
    ...(icing ? { icing } : {}),
  };
}

/** Parses a wind shear token (e.g. WS020/27050KT). */
function parseWindShear(token: string): TafWindShear | undefined {
  const match = token.match(/^WS(\d{3})\/(\d{3})(\d{2,3})KT$/);
  if (!match) {
    return undefined;
  }

  return {
    altitudeFt: parseInt(match[1]!, 10) * 100,
    directionDeg: parseInt(match[2]!, 10),
    speedKt: parseInt(match[3]!, 10),
  };
}

/** Parses a turbulence layer token (e.g. 520804). */
function parseTurbulenceLayer(token: string): TafTurbulenceLayer | undefined {
  const match = token.match(/^5(\d)(\d{3})(\d)$/);
  if (!match) {
    return undefined;
  }

  return {
    intensity: parseInt(match[1]!, 10) as TurbulenceIntensity,
    baseAltitudeFt: parseInt(match[2]!, 10) * 100,
    depthFt: parseInt(match[3]!, 10) * 1000,
  };
}

/** Parses an icing layer token (e.g. 620304). */
function parseIcingLayer(token: string): TafIcingLayer | undefined {
  const match = token.match(/^6(\d)(\d{3})(\d)$/);
  if (!match) {
    return undefined;
  }

  return {
    intensity: parseInt(match[1]!, 10) as IcingIntensity,
    baseAltitudeFt: parseInt(match[2]!, 10) * 100,
    depthFt: parseInt(match[3]!, 10) * 1000,
  };
}
