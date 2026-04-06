import type { AltitudeRange, CompassDirection, Coordinates, DayTime } from '@squawk/types';

/** Set of valid 16-point compass directions. */
export const COMPASS_DIRECTIONS = new Set<string>([
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
 * Parses an altitude string like "FL350" or "040" or "SFC" into feet.
 * Returns undefined for SFC.
 *
 * @param alt - The altitude string to parse.
 * @returns The altitude in feet, or undefined for SFC.
 */
export function parseAltitudeFt(alt: string): number | undefined {
  if (alt === 'SFC' || alt === 'FRZLVL') {
    return undefined;
  }
  if (alt.startsWith('FL')) {
    return parseInt(alt.substring(2), 10) * 100;
  }
  return parseInt(alt, 10) * 100;
}

/**
 * Parses a "BTN XXX AND YYY" or "XXX/YYY" altitude range from text.
 * Returns the altitude range or undefined if not found.
 *
 * @param text - The text containing an altitude range.
 * @returns The parsed altitude range, or undefined if no range is found.
 */
export function parseAltitudeRange(text: string): AltitudeRange | undefined {
  const btnMatch = text.match(
    /BTN\s+(SFC|FRZLVL|FL\d{3}|\d{3})\s+AND\s+(SFC|FRZLVL|FL\d{3}|\d{3})/,
  );
  if (btnMatch) {
    const baseToken = btnMatch[1]!;
    const topToken = btnMatch[2]!;
    const baseFt = parseAltitudeFt(baseToken);
    const baseIsFreezingLevel = baseToken === 'FRZLVL' || undefined;
    return {
      ...(baseFt !== undefined ? { baseFt } : {}),
      topFt: parseAltitudeFt(topToken)!,
      ...(baseIsFreezingLevel ? { baseIsFreezingLevel } : {}),
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
 * Parses a time string like "0200Z" or "050200Z" into a DayTime.
 * Accepts 4-digit (HHMM) or 6-digit (DDHHMM) formats, with or without Z suffix.
 *
 * @param timeStr - The time string to parse.
 * @returns The parsed DayTime, or undefined if the format is unrecognized.
 */
export function parseTimeString(timeStr: string): DayTime | undefined {
  const cleaned = timeStr.replace(/Z$/, '');
  if (cleaned.length === 2) {
    return {
      hour: parseInt(cleaned, 10),
      minute: 0,
    };
  }
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
 * Parses movement from text.
 * Handles "MOV FROM dddssKT" (domestic) and "MOV [compass] [speed]KT" (international).
 *
 * @param text - The text containing movement information.
 * @returns The parsed movement with direction and speed, or undefined if not found.
 */
export function parseMovement(text: string):
  | {
      directionDeg?: number;
      directionCompass?: CompassDirection;
      speedKt?: number;
      speedKmh?: number;
    }
  | undefined {
  // Domestic format: MOV FROM dddssKT or MOVG FROM dddssKT or MOVING FROM dddssKT
  const domesticMatch = text.match(/MOV(?:ING|G)?\s+FROM\s+(\d{3})(\d{2,3})(KT|KMH)/);
  if (domesticMatch) {
    const speed = parseInt(domesticMatch[2]!, 10);
    return {
      directionDeg: parseInt(domesticMatch[1]!, 10),
      ...(domesticMatch[3] === 'KMH' ? { speedKmh: speed } : { speedKt: speed }),
    };
  }

  // International format: MOV [compass] [speed] KT/KMH
  const intlMatch = text.match(
    /\bMOV\s+(N|NE|E|SE|S|SW|W|NW|NNE|ENE|ESE|SSE|SSW|WSW|WNW|NNW)\s+(\d+)\s*(KT|KMH)\b/,
  );
  if (intlMatch && COMPASS_DIRECTIONS.has(intlMatch[1]!)) {
    const speed = parseInt(intlMatch[2]!, 10);
    return {
      directionCompass: intlMatch[1]! as CompassDirection,
      ...(intlMatch[3] === 'KMH' ? { speedKmh: speed } : { speedKt: speed }),
    };
  }

  return undefined;
}

/**
 * Parses intensity change from text.
 *
 * @param text - The text to search for intensity change indicators.
 * @returns 'INTENSIFYING', 'WEAKENING', 'NO_CHANGE', or undefined.
 */
export function parseIntensityChange(
  text: string,
): 'INTENSIFYING' | 'WEAKENING' | 'NO_CHANGE' | undefined {
  if (/\bINTSF\b/.test(text)) {
    return 'INTENSIFYING';
  }
  if (/\bWKN\b/.test(text)) {
    return 'WEAKENING';
  }
  // NC must not match inside other words - require word boundary or end of content
  if (/\bNC\b/.test(text) && !/\bANC\b/.test(text)) {
    return 'NO_CHANGE';
  }
  return undefined;
}

/**
 * Parses a volcano position string like "6042N15610W" into Coordinates.
 * Format: DDMMd DDDMMd where d is N/S for lat, E/W for lon.
 *
 * @param posStr - The position string to parse.
 * @returns The parsed coordinates, or undefined if the format is unrecognized.
 */
export function parseVolcanoPosition(posStr: string): Coordinates | undefined {
  const match = posStr.match(/^(\d{2})(\d{2})([NS])(\d{3})(\d{2})([EW])$/);
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
 * Parses an ICAO-style position string like "N2540 W08830" into Coordinates.
 * Format: Nddmm Wdddmm (or S/E variants).
 *
 * @param posStr - The position string to parse.
 * @returns The parsed coordinates, or undefined if the format is unrecognized.
 */
export function parseIcaoPosition(posStr: string): Coordinates | undefined {
  const match = posStr.match(/([NS])(\d{2})(\d{2})\s+([EW])(\d{3})(\d{2})/);
  if (!match) {
    return undefined;
  }

  let lat = parseInt(match[2]!, 10) + parseInt(match[3]!, 10) / 60;
  if (match[1] === 'S') {
    lat = -lat;
  }

  let lon = parseInt(match[5]!, 10) + parseInt(match[6]!, 10) / 60;
  if (match[4] === 'W') {
    lon = -lon;
  }

  return { lat, lon };
}
