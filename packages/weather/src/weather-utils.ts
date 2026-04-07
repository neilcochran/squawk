import type {
  CloudCoverage,
  CloudLayer,
  CloudType,
  Visibility,
  WeatherDescriptor,
  WeatherIntensity,
  WeatherPhenomenon,
  WeatherPhenomenonCode,
  Wind,
} from './types/index.js';

/** Set of valid two-character weather phenomenon codes. */
export const PHENOMENON_CODES = new Set<string>([
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
export const DESCRIPTOR_CODES = new Set<string>(['MI', 'PR', 'BC', 'DR', 'BL', 'SH', 'TS', 'FZ']);

/** Tests whether a token looks like a wind group (dddssKT or dddssGggKT or VRBssKT). */
export function isWindToken(token: string): boolean {
  return /^(VRB|\d{3})\d{2,3}(G\d{2,3})?KT$/.test(token);
}

/** Parses a wind token into a Wind object. */
export function parseWind(token: string): Wind {
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
 * less-than (M1/4SM), plus (P6SM), and ICAO meters (9999, 0200).
 */
export function parseVisibility(
  tokens: string[],
  pos: number,
): { visibility: Visibility; nextPos: number } | undefined {
  const token = tokens[pos]!;

  // US "plus" visibility: P6SM (greater than 6 statute miles)
  const plusMatch = token.match(/^P(\d+)SM$/);
  if (plusMatch) {
    return {
      visibility: {
        statuteMiles: parseInt(plusMatch[1]!, 10),
        isLessThan: false,
        isMoreThan: true,
      },
      nextPos: pos + 1,
    };
  }

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
          isMoreThan: false,
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
        isMoreThan: false,
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
        isMoreThan: false,
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
        isMoreThan: false,
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
        isMoreThan: false,
      },
      nextPos: pos + 1,
    };
  }

  return undefined;
}

/** Tests whether a token looks like a weather phenomenon group. */
export function isWeatherToken(token: string): boolean {
  // Weather tokens start with intensity (+/-), VC, or a descriptor/phenomenon code
  // They must not match other group patterns (cloud layers, temp, altimeter, etc.)
  if (/^(FEW|SCT|BKN|OVC)\d{3}/.test(token)) {
    return false;
  }
  if (/^(CLR|SKC|CAVOK|NOSIG|NSW)$/.test(token)) {
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
export function parseWeatherPhenomenon(token: string): WeatherPhenomenon | undefined {
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
export function parseCloudLayer(token: string): CloudLayer | undefined {
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
