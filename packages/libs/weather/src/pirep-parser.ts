import type { Coordinates } from '@squawk/types';

import type {
  CloudCoverage,
  DayTime,
  IcingType,
  Pirep,
  PirepCloudLayer,
  PirepIcing,
  PirepIcingIntensity,
  PirepLocation,
  PirepLocationPoint,
  PirepTurbulence,
  PirepTurbulenceIntensity,
  PirepType,
  PirepWind,
  TurbulenceFrequency,
  TurbulenceType,
  Visibility,
  WeatherPhenomenon,
} from './types/index.js';
import { isWeatherToken, parseVisibility, parseWeatherPhenomenon } from './weather-utils.js';

/** Valid PIREP turbulence intensity codes. */
const TURBULENCE_INTENSITIES = new Set<string>(['NEG', 'LGT', 'MOD', 'SEV', 'EXTRM']);

/** Valid PIREP icing intensity codes. */
const ICING_INTENSITIES = new Set<string>(['NEG', 'TR', 'LGT', 'MOD', 'SEV']);

/** Valid turbulence type codes. */
const TURBULENCE_TYPES = new Set<string>(['CAT', 'CHOP', 'LLWS']);

/** Valid turbulence frequency codes. */
const TURBULENCE_FREQUENCIES = new Set<string>(['OCC', 'INT', 'CONT']);

/** Valid icing type codes. */
const ICING_TYPES = new Set<string>(['RIME', 'CLR', 'MXD', 'SLD']);

/**
 * Splits a PIREP string into field marker/value pairs.
 * Remarks (/RM) capture everything after the marker as free text.
 * Field markers may be preceded by a space or appear at the start of a
 * slash-delimited boundary (e.g. "/OV OKC/TM 1530/FL085").
 */
function splitFields(text: string): Map<string, string> {
  const fields = new Map<string, string>();
  const markerPattern = /\/(OV|TM|FL|TP|SK|WX|TA|WV|TB|IC|RM)(?:\s+|(?=[A-Z\d])|(?=$))/g;
  const markers: { key: string; start: number; valueStart: number }[] = [];

  let match: RegExpExecArray | null;
  while ((match = markerPattern.exec(text)) !== null) {
    markers.push({
      key: `/${match[1]!}`,
      start: match.index,
      valueStart: match.index + match[0].length,
    });
  }

  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i]!;
    const valueEnd = i + 1 < markers.length ? markers[i + 1]!.start : text.length;
    fields.set(marker.key, text.substring(marker.valueStart, valueEnd).trim());
  }

  return fields;
}

/**
 * Parses a single location point token like "OKC" or "SAV 180020" or "SAV180020".
 */
function parseLocationPoint(token: string): PirepLocationPoint {
  // Station with radial/distance: "SAV 180020" or "SAV180020"
  const rdMatch = token.match(/^([A-Z]{2,5})\s*(\d{3})(\d{3})$/);
  if (rdMatch) {
    return {
      identifier: rdMatch[1]!,
      radialDeg: parseInt(rdMatch[2]!, 10),
      distanceNm: parseInt(rdMatch[3]!, 10),
    };
  }

  // Simple station identifier
  return { identifier: token.trim() };
}

/**
 * Parses a latitude/longitude string like "3412N11830W" into Coordinates.
 * Format: DDMMN DDDMMW (without spaces).
 */
function parseLatLon(text: string): Coordinates | undefined {
  const match = text.match(/^(\d{2})(\d{2})([NS])(\d{3})(\d{2})([EW])$/);
  if (!match) {
    return undefined;
  }

  let lat = parseInt(match[1]!, 10) + parseInt(match[2]!, 10) / 60;
  if (match[3] === 'S') {
    lat = -lat;
  }

  let lon = parseInt(match[4]!, 10) + parseInt(match[5]!, 10) / 60;
  if (match[6] === 'W') {
    lon = -lon;
  }

  return { lat, lon };
}

/**
 * Parses the /OV (location) field value.
 */
function parseLocation(value: string): PirepLocation | undefined {
  if (!value) {
    return undefined;
  }

  // Check for lat/lon format
  const coords = parseLatLon(value.trim());
  if (coords) {
    return { locationType: 'latlon', coordinates: coords };
  }

  // Check for route (contains hyphens between points)
  if (value.includes('-')) {
    // Split on hyphens, but keep station+radial/distance together
    // "DHT 360015-AMA-CDS" or "ABC 090025-DEF 180010"
    const segments = value.split('-');
    const points: PirepLocationPoint[] = segments.map((seg) => parseLocationPoint(seg.trim()));
    return { locationType: 'route', points };
  }

  // Single station (with or without radial/distance)
  const point = parseLocationPoint(value.trim());
  return { locationType: 'station', point };
}

/**
 * Parses the /TM (time) field value.
 * Accepts 4-digit HHMM format with optional Z suffix.
 */
function parseTime(value: string): DayTime | undefined {
  if (!value) {
    return undefined;
  }

  const cleaned = value.replace(/Z$/, '').trim();
  if (cleaned.length === 4 && /^\d{4}$/.test(cleaned)) {
    return {
      hour: parseInt(cleaned.substring(0, 2), 10),
      minute: parseInt(cleaned.substring(2, 4), 10),
    };
  }

  return undefined;
}

/**
 * Parses the /FL (flight level/altitude) field value.
 * Returns altitude in feet MSL. Handles numeric values, UNKN, DURD, DURC.
 */
function parseFlightLevel(value: string): {
  altitudeFtMsl?: number;
  altitudeQualifier?: 'UNKN' | 'DURD' | 'DURC';
} {
  const trimmed = value.trim();

  if (trimmed === 'UNKN') {
    return { altitudeQualifier: 'UNKN' };
  }
  if (trimmed === 'DURD') {
    return { altitudeQualifier: 'DURD' };
  }
  if (trimmed === 'DURC') {
    return { altitudeQualifier: 'DURC' };
  }

  const num = parseInt(trimmed, 10);
  if (!isNaN(num)) {
    return { altitudeFtMsl: num * 100 };
  }

  return {};
}

/**
 * Parses an altitude token (3 digits) into feet MSL.
 * Returns undefined for UNKN or invalid tokens.
 */
function parseAltitudeHundreds(token: string): number | undefined {
  if (token === 'UNKN') {
    return undefined;
  }
  const match = token.match(/^(\d{3})$/);
  if (match) {
    return parseInt(match[1]!, 10) * 100;
  }
  return undefined;
}

/**
 * Parses the /SK (sky condition) field value.
 * Handles formats like:
 * - "BKN065-TOP090"
 * - "OVC025"
 * - "BKN040-TOP060 OVC100-TOPUNKN"
 * - "CLR"
 * - "010BKN028" (compact: base-coverage-top)
 */
function parseSkyCondition(value: string): PirepCloudLayer[] | undefined {
  if (!value) {
    return undefined;
  }

  const layers: PirepCloudLayer[] = [];

  // Split on whitespace to separate multiple layers, but rejoin if needed
  // "BKN065-TOP090 OVC100-TOPUNKN" -> two layers
  // Handle "/" as layer separator too
  const layerTexts = value.split(/\s+(?=[A-Z\d]{3,})|\/(?=[A-Z])/);

  for (const layerText of layerTexts) {
    const trimmed = layerText.trim();
    if (!trimmed) {
      continue;
    }

    // CLR (clear)
    if (trimmed === 'CLR') {
      layers.push({ coverage: 'CLR' });
      continue;
    }

    // Compact notation: 010BKN028 (base-coverage-top)
    const compactMatch = trimmed.match(/^(\d{3})(FEW|SCT|BKN|OVC)(\d{3})$/);
    if (compactMatch) {
      layers.push({
        coverage: compactMatch[2]! as CloudCoverage,
        baseFtMsl: parseInt(compactMatch[1]!, 10) * 100,
        topFtMsl: parseInt(compactMatch[3]!, 10) * 100,
      });
      continue;
    }

    // Standard notation: BKN065-TOP090 or OVC025 or BKN040-TOPUNKN
    const stdMatch = trimmed.match(/^(FEW|SCT|BKN|OVC)(\d{3}|UNKN)(?:-TOP(\d{3}|UNKN))?$/);
    if (stdMatch) {
      const coverage = stdMatch[1]! as CloudCoverage;
      const baseFtMsl = parseAltitudeHundreds(stdMatch[2]!);
      const topFtMsl = stdMatch[3] ? parseAltitudeHundreds(stdMatch[3]) : undefined;

      const layer: PirepCloudLayer = {
        coverage,
        ...(baseFtMsl !== undefined ? { baseFtMsl } : {}),
        ...(topFtMsl !== undefined ? { topFtMsl } : {}),
      };
      layers.push(layer);
      continue;
    }
  }

  return layers.length > 0 ? layers : undefined;
}

/**
 * Parses the /WX (weather/visibility) field value.
 * Contains flight visibility and optionally weather phenomena.
 */
function parseWeather(value: string): {
  visibility?: Visibility;
  weatherPhenomena?: WeatherPhenomenon[];
} {
  if (!value) {
    return {};
  }

  const tokens = value.trim().split(/\s+/);
  let visibility: Visibility | undefined;
  const phenomena: WeatherPhenomenon[] = [];

  let pos = 0;
  while (pos < tokens.length) {
    // Try to parse visibility
    if (!visibility) {
      const visResult = parseVisibility(tokens, pos);
      if (visResult) {
        visibility = visResult.visibility;
        pos = visResult.nextPos;
        continue;
      }
    }

    // Try to parse weather phenomenon
    const token = tokens[pos]!;
    if (isWeatherToken(token)) {
      const wx = parseWeatherPhenomenon(token);
      if (wx) {
        phenomena.push(wx);
      }
    }
    pos++;
  }

  return {
    ...(visibility ? { visibility } : {}),
    ...(phenomena.length > 0 ? { weatherPhenomena: phenomena } : {}),
  };
}

/**
 * Parses the /TA (temperature) field value.
 * Handles both "-" and "M" prefixes for negative values.
 */
function parseTemperature(value: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();

  // "M" prefix for negative
  const mMatch = trimmed.match(/^M(\d+)$/);
  if (mMatch) {
    return -parseInt(mMatch[1]!, 10);
  }

  // "-" prefix for negative
  const negMatch = trimmed.match(/^-(\d+)$/);
  if (negMatch) {
    return -parseInt(negMatch[1]!, 10);
  }

  // Positive
  const posMatch = trimmed.match(/^(\d+)$/);
  if (posMatch) {
    return parseInt(posMatch[1]!, 10);
  }

  return undefined;
}

/**
 * Parses the /WV (wind) field value.
 * Format: dddss or dddssKT (direction in degrees magnetic + speed in knots).
 */
function parseWindField(value: string): PirepWind | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.trim().match(/^(\d{3})(\d{2,3})(?:KT)?$/);
  if (!match) {
    return undefined;
  }

  return {
    magneticDirectionDeg: parseInt(match[1]!, 10),
    speedKt: parseInt(match[2]!, 10),
  };
}

/**
 * Parses an altitude token from turbulence/icing fields.
 * Handles FL-prefixed and bare 3-digit values.
 */
function parseTbIcAltitude(token: string): number | undefined {
  const flMatch = token.match(/^FL(\d{2,3})$/);
  if (flMatch) {
    return parseInt(flMatch[1]!, 10) * 100;
  }

  const bareMatch = token.match(/^(\d{3})$/);
  if (bareMatch) {
    return parseInt(bareMatch[1]!, 10) * 100;
  }

  return undefined;
}

/**
 * Parses the /TB (turbulence) field value.
 * Handles intensity, intensity ranges, types, frequencies, altitude bounds, and BLO/ABV modifiers.
 */
function parseTurbulence(value: string): PirepTurbulence[] | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();

  // Split on "/" for multiple turbulence layers
  const layerTexts = trimmed
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const results: PirepTurbulence[] = [];

  for (const layerText of layerTexts) {
    const tokens = layerText.split(/\s+/);
    let intensity: PirepTurbulenceIntensity | undefined;
    let intensityHigh: PirepTurbulenceIntensity | undefined;
    let type: TurbulenceType | undefined;
    let frequency: TurbulenceFrequency | undefined;
    let baseFtMsl: number | undefined;
    let topFtMsl: number | undefined;
    let belowAltitude: number | undefined;
    let aboveAltitude: number | undefined;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]!;

      // Intensity range: MOD-SEV
      const rangeMatch = token.match(/^([A-Z]+)-([A-Z]+)$/);
      if (
        rangeMatch &&
        TURBULENCE_INTENSITIES.has(rangeMatch[1]!) &&
        TURBULENCE_INTENSITIES.has(rangeMatch[2]!)
      ) {
        intensity = rangeMatch[1]! as PirepTurbulenceIntensity;
        intensityHigh = rangeMatch[2]! as PirepTurbulenceIntensity;
        continue;
      }

      // Single intensity
      if (TURBULENCE_INTENSITIES.has(token) && !intensity) {
        intensity = token as PirepTurbulenceIntensity;
        continue;
      }

      // Type
      if (TURBULENCE_TYPES.has(token)) {
        type = token as TurbulenceType;
        continue;
      }

      // Frequency
      if (TURBULENCE_FREQUENCIES.has(token)) {
        frequency = token as TurbulenceFrequency;
        continue;
      }

      // BLO (below) modifier
      if (token === 'BLO') {
        const nextToken = tokens[i + 1];
        if (nextToken) {
          const alt = parseTbIcAltitude(nextToken);
          if (alt !== undefined) {
            belowAltitude = alt;
            i++;
            continue;
          }
        }
        continue;
      }

      // ABV (above) modifier
      if (token === 'ABV') {
        const nextToken = tokens[i + 1];
        if (nextToken) {
          const alt = parseTbIcAltitude(nextToken);
          if (alt !== undefined) {
            aboveAltitude = alt;
            i++;
            continue;
          }
        }
        continue;
      }

      // Altitude range: 060-090 or FL060-FL090
      const altRangeMatch = token.match(/^(FL\d{2,3}|\d{3})-(FL\d{2,3}|\d{3})$/);
      if (altRangeMatch) {
        baseFtMsl = parseTbIcAltitude(altRangeMatch[1]!);
        topFtMsl = parseTbIcAltitude(altRangeMatch[2]!);
        continue;
      }

      // Single altitude
      const alt = parseTbIcAltitude(token);
      if (alt !== undefined) {
        if (baseFtMsl === undefined) {
          baseFtMsl = alt;
        } else {
          topFtMsl = alt;
        }
      }
    }

    if (intensity) {
      const tb: PirepTurbulence = {
        intensity,
        ...(intensityHigh ? { intensityHigh } : {}),
        ...(type ? { type } : {}),
        ...(frequency ? { frequency } : {}),
        ...(baseFtMsl !== undefined ? { baseFtMsl } : {}),
        ...(topFtMsl !== undefined ? { topFtMsl } : {}),
        ...(belowAltitude !== undefined ? { belowAltitude } : {}),
        ...(aboveAltitude !== undefined ? { aboveAltitude } : {}),
      };
      results.push(tb);
    }
  }

  return results.length > 0 ? results : undefined;
}

/**
 * Parses the /IC (icing) field value.
 * Handles intensity, intensity ranges, types, and altitude ranges.
 */
function parseIcing(value: string): PirepIcing[] | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();

  // Split on "/" for multiple icing layers
  const layerTexts = trimmed
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const results: PirepIcing[] = [];

  for (const layerText of layerTexts) {
    const tokens = layerText.split(/\s+/);
    let intensity: PirepIcingIntensity | undefined;
    let intensityHigh: PirepIcingIntensity | undefined;
    let type: IcingType | undefined;
    let baseFtMsl: number | undefined;
    let topFtMsl: number | undefined;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]!;

      // Intensity range: LGT-MOD
      const rangeMatch = token.match(/^([A-Z]+)-([A-Z]+)$/);
      if (
        rangeMatch &&
        ICING_INTENSITIES.has(rangeMatch[1]!) &&
        ICING_INTENSITIES.has(rangeMatch[2]!)
      ) {
        intensity = rangeMatch[1]! as PirepIcingIntensity;
        intensityHigh = rangeMatch[2]! as PirepIcingIntensity;
        continue;
      }

      // Single intensity
      if (ICING_INTENSITIES.has(token) && !intensity) {
        intensity = token as PirepIcingIntensity;
        continue;
      }

      // Type
      if (ICING_TYPES.has(token)) {
        type = token as IcingType;
        continue;
      }

      // Altitude range: 060-090 or FL060-FL090
      const altRangeMatch = token.match(/^(FL\d{2,3}|\d{3})-(FL\d{2,3}|\d{3})$/);
      if (altRangeMatch) {
        baseFtMsl = parseTbIcAltitude(altRangeMatch[1]!);
        topFtMsl = parseTbIcAltitude(altRangeMatch[2]!);
        continue;
      }

      // Single altitude
      const alt = parseTbIcAltitude(token);
      if (alt !== undefined) {
        if (baseFtMsl === undefined) {
          baseFtMsl = alt;
        } else {
          topFtMsl = alt;
        }
      }
    }

    if (intensity) {
      const ic: PirepIcing = {
        intensity,
        ...(intensityHigh ? { intensityHigh } : {}),
        ...(type ? { type } : {}),
        ...(baseFtMsl !== undefined ? { baseFtMsl } : {}),
        ...(topFtMsl !== undefined ? { topFtMsl } : {}),
      };
      results.push(ic);
    }
  }

  return results.length > 0 ? results : undefined;
}

/**
 * Parses a raw PIREP (Pilot Report) string into a structured {@link Pirep} object.
 *
 * PIREPs use a slash-delimited field format with standardized markers:
 * `/OV` (location), `/TM` (time), `/FL` (flight level), `/TP` (aircraft type),
 * `/SK` (sky condition), `/WX` (weather/visibility), `/TA` (temperature),
 * `/WV` (wind), `/TB` (turbulence), `/IC` (icing), `/RM` (remarks).
 *
 * ```typescript
 * import { parsePirep } from '@squawk/weather';
 *
 * const pirep = parsePirep('UA /OV OKC 063015/TM 1522/FL085/TP C172/SK BKN065-TOP090/TB LGT/RM SMOOTH');
 * console.log(pirep.type);          // "UA"
 * console.log(pirep.altitudeFtMsl); // 8500
 * console.log(pirep.aircraftType);  // "C172"
 * ```
 *
 * @param raw - The raw PIREP string to parse.
 * @returns The parsed PIREP object.
 */
export function parsePirep(raw: string): Pirep {
  const trimmed = raw.trim();

  // Identify UA/UUA prefix
  let pirepType: PirepType;
  let remainder: string;

  if (trimmed.startsWith('UUA ') || trimmed.startsWith('UUA/')) {
    pirepType = 'UUA';
    remainder = trimmed.substring(3).trim();
  } else if (trimmed.startsWith('UA ') || trimmed.startsWith('UA/')) {
    pirepType = 'UA';
    remainder = trimmed.substring(2).trim();
  } else {
    pirepType = 'UA';
    remainder = trimmed;
  }

  // Split into fields
  const fields = splitFields(remainder);

  // Parse each field
  const result: Pirep = {
    raw,
    type: pirepType,
  };

  // /OV - Location
  const ovValue = fields.get('/OV');
  if (ovValue) {
    const location = parseLocation(ovValue);
    if (location) {
      result.location = location;
    }
  }

  // /TM - Time
  const tmValue = fields.get('/TM');
  if (tmValue) {
    const time = parseTime(tmValue);
    if (time) {
      result.time = time;
    }
  }

  // /FL - Flight Level
  const flValue = fields.get('/FL');
  if (flValue) {
    const fl = parseFlightLevel(flValue);
    if (fl.altitudeFtMsl !== undefined) {
      result.altitudeFtMsl = fl.altitudeFtMsl;
    }
    if (fl.altitudeQualifier) {
      result.altitudeQualifier = fl.altitudeQualifier;
    }
  }

  // /TP - Aircraft Type
  const tpValue = fields.get('/TP');
  if (tpValue) {
    result.aircraftType = tpValue.trim();
  }

  // /SK - Sky Condition
  const skValue = fields.get('/SK');
  if (skValue) {
    const sk = parseSkyCondition(skValue);
    if (sk) {
      result.skyCondition = sk;
    }
  }

  // /WX - Weather/Visibility
  const wxValue = fields.get('/WX');
  if (wxValue) {
    const wx = parseWeather(wxValue);
    if (wx.visibility) {
      result.visibility = wx.visibility;
    }
    if (wx.weatherPhenomena) {
      result.weatherPhenomena = wx.weatherPhenomena;
    }
  }

  // /TA - Temperature
  const taValue = fields.get('/TA');
  if (taValue) {
    const temp = parseTemperature(taValue);
    if (temp !== undefined) {
      result.temperatureC = temp;
    }
  }

  // /WV - Wind
  const wvValue = fields.get('/WV');
  if (wvValue) {
    const wind = parseWindField(wvValue);
    if (wind) {
      result.wind = wind;
    }
  }

  // /TB - Turbulence
  const tbValue = fields.get('/TB');
  if (tbValue) {
    const tb = parseTurbulence(tbValue);
    if (tb) {
      result.turbulence = tb;
    }
  }

  // /IC - Icing
  const icValue = fields.get('/IC');
  if (icValue) {
    const ic = parseIcing(icValue);
    if (ic) {
      result.icing = ic;
    }
  }

  // /RM - Remarks
  const rmValue = fields.get('/RM');
  if (rmValue) {
    result.remarks = rmValue;
  }

  return result;
}
