import type {
  CloudCoverage,
  CompassDirection,
  DayTime,
  IceAccretion,
  LightningFrequency,
  LightningObservation,
  LightningType,
  MetarRemarks,
  ObscurationReport,
  PeakWind,
  PrecipitationEvent,
  PressureTendency,
  PressureTendencyCharacter,
  SecondLocationCeiling,
  SecondLocationVisibility,
  SectorVisibility,
  SignificantCloudReport,
  SignificantCloudType,
  SnowIncreasing,
  StationType,
  ThunderstormInfo,
  TowerSurfaceVisibility,
  VariableCeiling,
  VariableSkyCondition,
  VariableVisibility,
  VirgaObservation,
  WeatherPhenomenonCode,
} from './types/index.js';

/** Valid cloud coverage codes for matching in remarks. */
const COVERAGE_CODES = new Set(['FEW', 'SCT', 'BKN', 'OVC']);

/**
 * Parses the remarks portion of a METAR (everything after "RMK") into a
 * structured {@link MetarRemarks} object.
 *
 * @param raw - The raw remarks string (without the "RMK" prefix).
 * @param observationHour - The observation hour (UTC) from the METAR header, used to populate
 *   the hour on time-based remark fields when the raw report omits it.
 * @returns A parsed {@link MetarRemarks} object.
 */
export function parseRemarks(raw: string, observationHour: number): MetarRemarks {
  const remarks: MetarRemarks = { raw };
  const tokens = raw.split(/\s+/);

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i]!;

    // Station type: AO1 or AO2
    if (token === 'AO1' || token === 'AO2') {
      remarks.stationType = token as StationType;
      i++;
      continue;
    }

    // Sea level pressure: SLPxxx (tenths of mb, 1000+ or 900+ range)
    const slpMatch = token.match(/^SLP(\d{3})$/);
    if (slpMatch) {
      const slpValue = parseInt(slpMatch[1]!, 10);
      remarks.seaLevelPressureMb = slpValue >= 500 ? 900 + slpValue / 10 : 1000 + slpValue / 10;
      i++;
      continue;
    }

    // Sea level pressure not available
    if (token === 'SLPNO') {
      remarks.seaLevelPressureNotAvailable = true;
      i++;
      continue;
    }

    // Precise temperature/dewpoint: Txxxxxxxx
    const tGroupMatch = token.match(/^T([01]\d{3})([01]\d{3})$/);
    if (tGroupMatch) {
      remarks.preciseTemperatureC = parsePreciseTemp(tGroupMatch[1]!);
      remarks.preciseDewpointC = parsePreciseTemp(tGroupMatch[2]!);
      i++;
      continue;
    }

    // Hourly precipitation: Pxxxx (hundredths of inch)
    const precipMatch = token.match(/^P(\d{4})$/);
    if (precipMatch) {
      remarks.hourlyPrecipitationIn = parseInt(precipMatch[1]!, 10) / 100;
      i++;
      continue;
    }

    // 3/6 hour precipitation: 6xxxx (hundredths of inch)
    const precip36Match = token.match(/^6(\d{4})$/);
    if (precip36Match) {
      remarks.threeSixHourPrecipitationIn = parseInt(precip36Match[1]!, 10) / 100;
      i++;
      continue;
    }

    // 24 hour precipitation: 7xxxx (hundredths of inch)
    const precip24Match = token.match(/^7(\d{4})$/);
    if (precip24Match) {
      remarks.twentyFourHourPrecipitationIn = parseInt(precip24Match[1]!, 10) / 100;
      i++;
      continue;
    }

    // Snow depth: 4/xxx (inches)
    const snowDepthMatch = token.match(/^4\/(\d{3})$/);
    if (snowDepthMatch) {
      remarks.snowDepthIn = parseInt(snowDepthMatch[1]!, 10);
      i++;
      continue;
    }

    // 24-hour max/min temperature: 4[sign][temp][sign][temp]
    const maxMinMatch = token.match(/^4([01]\d{3})([01]\d{3})$/);
    if (maxMinMatch) {
      remarks.twentyFourHourMaxTemperatureC = parsePreciseTemp(maxMinMatch[1]!);
      remarks.twentyFourHourMinTemperatureC = parsePreciseTemp(maxMinMatch[2]!);
      i++;
      continue;
    }

    // 6-hour maximum temperature: 1snTxTxTx
    const sixHrMaxMatch = token.match(/^1([01]\d{3})$/);
    if (sixHrMaxMatch) {
      remarks.sixHourMaxTemperatureC = parsePreciseTemp(sixHrMaxMatch[1]!);
      i++;
      continue;
    }

    // 6-hour minimum temperature: 2snTnTnTn
    const sixHrMinMatch = token.match(/^2([01]\d{3})$/);
    if (sixHrMinMatch) {
      remarks.sixHourMinTemperatureC = parsePreciseTemp(sixHrMinMatch[1]!);
      i++;
      continue;
    }

    // Pressure tendency: 5appp (a=character 0-8, ppp=change in tenths hPa)
    const presTendMatch = token.match(/^5([0-8])(\d{3})$/);
    if (presTendMatch) {
      remarks.pressureTendency = {
        character: parseInt(presTendMatch[1]!, 10) as PressureTendencyCharacter,
        changeHpa: parseInt(presTendMatch[2]!, 10) / 10,
      } satisfies PressureTendency;
      i++;
      continue;
    }

    // Ice accretion: Ixnnn (x=period 1/3/6 hours, nnn=hundredths of inch)
    const iceMatch = token.match(/^I([136])(\d{3})$/);
    if (iceMatch) {
      if (!remarks.iceAccretion) {
        remarks.iceAccretion = [];
      }
      remarks.iceAccretion.push({
        periodHours: parseInt(iceMatch[1]!, 10) as 1 | 3 | 6,
        amountIn: parseInt(iceMatch[2]!, 10) / 100,
      } satisfies IceAccretion);
      i++;
      continue;
    }

    // Water equivalent of snow: 933RRR (tenths of inches)
    const waterEquivMatch = token.match(/^933(\d{3})$/);
    if (waterEquivMatch) {
      remarks.waterEquivalentSnowIn = parseInt(waterEquivMatch[1]!, 10) / 10;
      i++;
      continue;
    }

    // Snow increasing rapidly: SNINCR d/dd
    if (token === 'SNINCR' && i + 1 < tokens.length) {
      const snincrMatch = tokens[i + 1]!.match(/^(\d+)\/(\d+)$/);
      if (snincrMatch) {
        remarks.snowIncreasing = {
          lastHourIn: parseInt(snincrMatch[1]!, 10),
          totalDepthIn: parseInt(snincrMatch[2]!, 10),
        } satisfies SnowIncreasing;
        i += 2;
        continue;
      }
    }

    // Peak wind: PK WND dddff(f)/hhmm or PK WND dddff(f)/mm
    if (token === 'PK' && i + 2 < tokens.length && tokens[i + 1] === 'WND') {
      const pkWndToken = tokens[i + 2]!;
      const peakWind = parsePeakWind(pkWndToken, observationHour);
      if (peakWind) {
        remarks.peakWind = peakWind;
      }
      i += 3;
      continue;
    }

    // Pressure falling rapidly
    if (token === 'PRESFR') {
      remarks.pressureFallingRapidly = true;
      i++;
      continue;
    }

    // Pressure rising rapidly
    if (token === 'PRESRR') {
      remarks.pressureRisingRapidly = true;
      i++;
      continue;
    }

    // Maintenance indicator
    if (token === '$') {
      remarks.maintenanceIndicator = true;
      i++;
      continue;
    }

    // Tower or surface visibility: TWR VIS vv or SFC VIS vv
    if ((token === 'TWR' || token === 'SFC') && i + 2 < tokens.length && tokens[i + 1] === 'VIS') {
      const visValue = parseRemarkVisibility(tokens, i + 2);
      if (visValue) {
        if (!remarks.towerSurfaceVisibility) {
          remarks.towerSurfaceVisibility = [];
        }
        remarks.towerSurfaceVisibility.push({
          source: token as 'TWR' | 'SFC',
          visibilitySm: visValue.value,
        } satisfies TowerSurfaceVisibility);
        i = visValue.nextPos;
        continue;
      }
    }

    // VIS-prefixed remarks (variable visibility, sector visibility, second location visibility)
    if (token === 'VIS' && i + 1 < tokens.length) {
      // Variable visibility: VIS min V max (e.g. VIS 1/2V2, VIS 1/4V1)
      const visVarMatch = tokens[i + 1]!.match(/^(\d+(?:\/\d+)?)V(\d+(?:\/\d+)?)$/);
      if (visVarMatch) {
        remarks.variableVisibility = {
          minVisibilitySm: parseFraction(visVarMatch[1]!),
          maxVisibilitySm: parseFraction(visVarMatch[2]!),
        } satisfies VariableVisibility;
        i += 2;
        continue;
      }

      // Sector visibility: VIS [dir] [value] (e.g. VIS N2, VIS NE3)
      const sectorMatch = tokens[i + 1]!.match(/^([NSEW]{1,2})(\d+(?:\/\d+)?)$/);
      if (sectorMatch) {
        if (!remarks.sectorVisibility) {
          remarks.sectorVisibility = [];
        }
        remarks.sectorVisibility.push({
          direction: sectorMatch[1]! as CompassDirection,
          visibilitySm: parseFraction(sectorMatch[2]!),
        } satisfies SectorVisibility);
        i += 2;
        continue;
      }

      // Visibility at second location: VIS vv LOC (e.g. VIS 3/4 RWY11)
      const visSecondLocValue = parseRemarkVisibility(tokens, i + 1);
      if (visSecondLocValue && visSecondLocValue.nextPos < tokens.length) {
        const locToken = tokens[visSecondLocValue.nextPos];
        if (locToken && /^RWY\d{2}[LCR]?$/.test(locToken)) {
          if (!remarks.secondLocationObservations) {
            remarks.secondLocationObservations = [];
          }
          remarks.secondLocationObservations.push({
            type: 'VIS',
            visibilitySm: visSecondLocValue.value,
            location: locToken,
          } satisfies SecondLocationVisibility);
          i = visSecondLocValue.nextPos + 1;
          continue;
        }
      }
    }

    // CIG-prefixed remarks (variable ceiling, second location ceiling)
    if (token === 'CIG') {
      if (i + 1 < tokens.length) {
        // Variable ceiling: CIG xxxVxxx (e.g. CIG 003V008)
        const cigVarMatch = tokens[i + 1]!.match(/^(\d{3})V(\d{3})$/);
        if (cigVarMatch) {
          remarks.variableCeiling = {
            minFtAgl: parseInt(cigVarMatch[1]!, 10) * 100,
            maxFtAgl: parseInt(cigVarMatch[2]!, 10) * 100,
          } satisfies VariableCeiling;
          i += 2;
          continue;
        }

        // Ceiling at second location: CIG hhh LOC (e.g. CIG 017 RWY11)
        const cigHgtMatch = tokens[i + 1]!.match(/^(\d{3})$/);
        if (cigHgtMatch && i + 2 < tokens.length) {
          const locToken = tokens[i + 2];
          if (locToken && /^RWY\d{2}[LCR]?$/.test(locToken)) {
            if (!remarks.secondLocationObservations) {
              remarks.secondLocationObservations = [];
            }
            remarks.secondLocationObservations.push({
              type: 'CIG',
              ceilingFtAgl: parseInt(cigHgtMatch[1]!, 10) * 100,
              location: locToken,
            } satisfies SecondLocationCeiling);
            i += 3;
            continue;
          }
        }
      }
    }

    // Wind shift: WSHFT hhmm [FROPA]
    if (token === 'WSHFT') {
      if (i + 1 < tokens.length) {
        const wsToken = tokens[i + 1]!;
        const wsMatch = wsToken.match(/^(\d{2})?(\d{2})$/);
        if (wsMatch) {
          const hasHour = wsMatch[1] !== undefined && wsMatch[2] !== undefined;
          const time: DayTime = {
            hour: hasHour ? parseInt(wsMatch[1]!, 10) : observationHour,
            minute: parseInt(wsMatch[2] ?? wsMatch[1]!, 10),
          };
          const frontalPassage = i + 2 < tokens.length && tokens[i + 2] === 'FROPA';
          if (frontalPassage) {
            i += 3;
          } else {
            i += 2;
          }
          remarks.windShift = { time, frontalPassage };
          continue;
        }
      }
    }

    // Hail size: GR x x/x or GR x/x or GR LESS THAN 1/4 (inches)
    if (token === 'GR') {
      if (i + 1 < tokens.length) {
        // GR LESS THAN 1/4
        if (tokens[i + 1] === 'LESS' && i + 3 < tokens.length && tokens[i + 2] === 'THAN') {
          remarks.hailSizeIn = parseFraction(tokens[i + 3]!);
          i += 4;
          continue;
        }
        // Whole + fraction (e.g. GR 1 3/4)
        if (
          i + 2 < tokens.length &&
          /^\d+$/.test(tokens[i + 1]!) &&
          /^\d\/\d+$/.test(tokens[i + 2]!)
        ) {
          const whole = parseInt(tokens[i + 1]!, 10);
          remarks.hailSizeIn = whole + parseFraction(tokens[i + 2]!);
          i += 3;
          continue;
        }
        // Fraction only (e.g. GR 3/4)
        if (/^\d+\/\d+$/.test(tokens[i + 1]!)) {
          remarks.hailSizeIn = parseFraction(tokens[i + 1]!);
          i += 2;
          continue;
        }
        // Whole only (e.g. GR 1)
        if (/^\d+$/.test(tokens[i + 1]!)) {
          remarks.hailSizeIn = parseInt(tokens[i + 1]!, 10);
          i += 2;
          continue;
        }
      }
    }

    // Small hail in remarks: GS (no size, just presence)
    if (token === 'GS') {
      // GS alone means small hail observed, size < 1/4 inch
      i++;
      continue;
    }

    // Lightning: FRQ/OCNL/CONS LTGICCCGCA [directions]
    // Also handles: LTG DSNT [dir]
    if (
      token.startsWith('LTG') ||
      (/^(FRQ|OCNL|CONS)$/.test(token) && i + 1 < tokens.length && tokens[i + 1]!.startsWith('LTG'))
    ) {
      const ltgResult = parseLightning(tokens, i);
      if (ltgResult) {
        if (!remarks.lightning) {
          remarks.lightning = [];
        }
        remarks.lightning.push(ltgResult.observation);
        i = ltgResult.nextPos;
        continue;
      }
    }

    // Thunderstorm location/movement: TS [location] [MOV direction]
    if (token === 'TS' && i + 1 < tokens.length) {
      const tsResult = parseThunderstormInfo(tokens, i + 1);
      if (!remarks.thunderstormInfo) {
        remarks.thunderstormInfo = [];
      }
      remarks.thunderstormInfo.push(tsResult.info);
      i = tsResult.nextPos;
      continue;
    }

    // Virga: VIRGA [direction]
    if (token === 'VIRGA') {
      const virga: VirgaObservation = {};
      if (i + 1 < tokens.length && isDirectionToken(tokens[i + 1]!)) {
        virga.direction = tokens[i + 1]!;
        i += 2;
      } else {
        i++;
      }
      if (!remarks.virga) {
        remarks.virga = [];
      }
      remarks.virga.push(virga);
      continue;
    }

    // Variable sky condition: FEW/SCT/BKN/OVC nnn V FEW/SCT/BKN/OVC
    if (COVERAGE_CODES.has(token.slice(0, 3)) && token.length >= 6) {
      const varSkyMatch = token.match(/^(FEW|SCT|BKN|OVC)(\d{3})$/);
      if (
        varSkyMatch &&
        i + 2 < tokens.length &&
        tokens[i + 1] === 'V' &&
        COVERAGE_CODES.has(tokens[i + 2]!)
      ) {
        if (!remarks.variableSkyCondition) {
          remarks.variableSkyCondition = [];
        }
        remarks.variableSkyCondition.push({
          coverageLow: varSkyMatch[1]! as CloudCoverage,
          coverageHigh: tokens[i + 2]! as CloudCoverage,
          altitudeFtAgl: parseInt(varSkyMatch[2]!, 10) * 100,
        } satisfies VariableSkyCondition);
        i += 3;
        continue;
      }
    }

    // Significant cloud types: CB/TCU/ACC/ACSL/CCSL/SCSL/CBMAM [DSNT] [direction]
    if (/^(CB|TCU|ACC|ACSL|CCSL|SCSL|CBMAM)$/.test(token)) {
      const cloudReport: SignificantCloudReport = { type: token as SignificantCloudType };
      // Collect subsequent direction/distance tokens
      const locParts: string[] = [];
      let j = i + 1;
      while (j < tokens.length && isCloudLocationToken(tokens[j]!)) {
        locParts.push(tokens[j]!);
        j++;
      }
      if (locParts.length > 0) {
        cloudReport.location = locParts.join(' ');
      }
      if (!remarks.significantClouds) {
        remarks.significantClouds = [];
      }
      remarks.significantClouds.push(cloudReport);
      i = j;
      continue;
    }

    // Obscurations: FG/FU/HZ/BR + FEW/SCT/BKN + 000 (e.g. FG SCT000)
    // This is reported as: phenomenon coverage height in remarks
    if (/^(FG|FU|HZ|BR|DU|SA|VA|PY)$/.test(token) && i + 1 < tokens.length) {
      const obscMatch = tokens[i + 1]!.match(/^(FEW|SCT|BKN|OVC)(\d{3})$/);
      if (obscMatch) {
        if (!remarks.obscurations) {
          remarks.obscurations = [];
        }
        remarks.obscurations.push({
          phenomenon: token as WeatherPhenomenonCode,
          coverage: obscMatch[1]! as CloudCoverage,
          altitudeFtAgl: parseInt(obscMatch[2]!, 10) * 100,
        } satisfies ObscurationReport);
        i += 2;
        continue;
      }
    }

    // Sensor status: TSNO, PWINO, FZRANO, PNO, RVRNO, SLPNO (already handled above)
    if (/^(TSNO|PWINO|FZRANO|PNO|RVRNO)$/.test(token)) {
      if (!remarks.missingData) {
        remarks.missingData = [];
      }
      remarks.missingData.push(token);
      i++;
      continue;
    }

    // VISNO and CHINO with optional location: VISNO [LOC], CHINO [LOC]
    if (token === 'VISNO' || token === 'CHINO') {
      if (!remarks.missingData) {
        remarks.missingData = [];
      }
      // Check for optional location suffix (e.g. VISNO RWY06)
      if (i + 1 < tokens.length && /^RWY\d{2}[LCR]?$/.test(tokens[i + 1]!)) {
        remarks.missingData.push(`${token} ${tokens[i + 1]!}`);
        i += 2;
      } else {
        remarks.missingData.push(token);
        i++;
      }
      continue;
    }

    // Precipitation begin/end events: e.g. RAB15E32, SNE10, TSB25, RAB15E32B48
    const precipEventMatch = token.match(/^([A-Z]{2,4})((?:[BE]\d{2,4})+)$/);
    if (precipEventMatch) {
      const phenomenon = precipEventMatch[1]!;
      const eventStr = precipEventMatch[2]!;
      if (isWeatherCode(phenomenon)) {
        const events = parsePrecipitationEvents(phenomenon, eventStr, observationHour);
        if (events.length > 0) {
          if (!remarks.precipitationEvents) {
            remarks.precipitationEvents = [];
          }
          remarks.precipitationEvents.push(...events);
        }
        i++;
        continue;
      }
    }

    i++;
  }

  return remarks;
}

/**
 * Parses a precise temperature value from the T-group or 4-group format.
 * First digit is sign (0=positive, 1=negative), remaining digits are tenths of degree C.
 */
function parsePreciseTemp(raw: string): number {
  const sign = raw[0] === '1' ? -1 : 1;
  const value = parseInt(raw.slice(1), 10) / 10;
  return sign * value;
}

/**
 * Parses a peak wind token (e.g. "22065/1842" or "33045/32").
 * Format: dddff(f)/hhmm or dddff(f)/mm
 */
function parsePeakWind(token: string, observationHour: number): PeakWind | undefined {
  const match = token.match(/^(\d{3})(\d{2,3})\/(\d{2,4})$/);
  if (!match) {
    return undefined;
  }

  const directionDeg = parseInt(match[1]!, 10);
  const speedKt = parseInt(match[2]!, 10);
  const timeStr = match[3]!;

  const time: DayTime =
    timeStr.length === 4
      ? { hour: parseInt(timeStr.slice(0, 2), 10), minute: parseInt(timeStr.slice(2), 10) }
      : { hour: observationHour, minute: parseInt(timeStr, 10) };

  return { directionDeg, speedKt, time };
}

/** Parses a fraction string (e.g. "1/4", "3/4") or whole number ("2") into a decimal. */
function parseFraction(raw: string): number {
  const fracMatch = raw.match(/^(\d+)\/(\d+)$/);
  if (fracMatch) {
    return parseInt(fracMatch[1]!, 10) / parseInt(fracMatch[2]!, 10);
  }
  return parseInt(raw, 10);
}

/**
 * Parses a visibility value from remarks tokens, handling whole, fraction, and mixed formats.
 * Returns the parsed value and the next token position.
 */
function parseRemarkVisibility(
  tokens: string[],
  pos: number,
): { value: number; nextPos: number } | undefined {
  if (pos >= tokens.length) {
    return undefined;
  }
  const token = tokens[pos]!;

  // Whole + fraction (e.g. "1" "1/2")
  if (/^\d+$/.test(token) && pos + 1 < tokens.length && /^\d\/\d+$/.test(tokens[pos + 1]!)) {
    return {
      value: parseInt(token, 10) + parseFraction(tokens[pos + 1]!),
      nextPos: pos + 2,
    };
  }

  // Fraction only (e.g. "3/4")
  if (/^\d+\/\d+$/.test(token)) {
    return { value: parseFraction(token), nextPos: pos + 1 };
  }

  // Whole only (e.g. "2")
  if (/^\d+$/.test(token)) {
    return { value: parseInt(token, 10), nextPos: pos + 1 };
  }

  return undefined;
}

/** Checks if a string is a recognized weather phenomenon or descriptor code. */
function isWeatherCode(code: string): boolean {
  const knownPhenomena = new Set([
    'RA',
    'SN',
    'PL',
    'DZ',
    'GR',
    'GS',
    'IC',
    'SG',
    'UP',
    'TS',
    'FG',
    'BR',
    'HZ',
    'FU',
    'VA',
    'DU',
    'SA',
    'TSRA',
    'TSSN',
    'FZRA',
    'FZDZ',
    'SHSN',
    'SHRA',
  ]);
  return knownPhenomena.has(code);
}

/** Checks if a token is a compass direction or directional range. */
function isDirectionToken(token: string): boolean {
  return /^[NSEW]{1,2}(-[NSEW]{1,2})?$/.test(token) || token === 'OHD';
}

/** Checks if a token is part of a significant cloud location description. */
function isCloudLocationToken(token: string): boolean {
  return (
    isDirectionToken(token) ||
    token === 'DSNT' ||
    token === 'VC' ||
    token === 'OHD' ||
    token === 'MOV' ||
    /^[NSEW]{1,2}(-[NSEW]{1,2})?$/.test(token)
  );
}

/**
 * Parses a lightning remark starting at the given position.
 * Handles: FRQ/OCNL/CONS LTGICCGCA [location] or LTGICCGCA [location]
 */
function parseLightning(
  tokens: string[],
  pos: number,
): { observation: LightningObservation; nextPos: number } | undefined {
  let frequency: LightningFrequency | undefined;
  let ltgToken: string;
  let nextPos: number;

  const token = tokens[pos]!;

  // Check if current token is a frequency prefix
  if (/^(FRQ|OCNL|CONS)$/.test(token)) {
    frequency = token as LightningFrequency;
    if (pos + 1 >= tokens.length) {
      return undefined;
    }
    ltgToken = tokens[pos + 1]!;
    nextPos = pos + 2;
  } else {
    ltgToken = token;
    nextPos = pos + 1;
  }

  // Parse the LTG token for types
  if (!ltgToken.startsWith('LTG')) {
    return undefined;
  }

  const typeStr = ltgToken.slice(3);
  const types: LightningType[] = [];
  for (let j = 0; j < typeStr.length; j += 2) {
    const code = typeStr.slice(j, j + 2);
    if (/^(IC|CC|CG|CA)$/.test(code)) {
      types.push(code as LightningType);
    }
  }

  // Collect location tokens
  const locParts: string[] = [];
  while (nextPos < tokens.length && isLightningLocationToken(tokens[nextPos]!)) {
    locParts.push(tokens[nextPos]!);
    nextPos++;
  }

  const observation: LightningObservation = {
    ...(frequency ? { frequency } : {}),
    types,
    ...(locParts.length > 0 ? { location: locParts.join(' ') } : {}),
  };

  return { observation, nextPos };
}

/** Checks if a token is part of a lightning location description. */
function isLightningLocationToken(token: string): boolean {
  return (
    isDirectionToken(token) ||
    token === 'DSNT' ||
    token === 'VC' ||
    token === 'AND' ||
    /^[NSEW]{1,2}-[NSEW]{1,2}$/.test(token)
  );
}

/**
 * Parses thunderstorm location and movement info from tokens.
 * Format: TS [location] [MOV direction]
 */
function parseThunderstormInfo(
  tokens: string[],
  pos: number,
): { info: ThunderstormInfo; nextPos: number } {
  const info: ThunderstormInfo = {};
  const locParts: string[] = [];
  let nextPos = pos;

  // Collect location tokens until MOV or end
  while (nextPos < tokens.length) {
    const t = tokens[nextPos]!;
    if (t === 'MOV') {
      // Next token is the movement direction
      if (nextPos + 1 < tokens.length) {
        info.movingDirection = tokens[nextPos + 1]! as CompassDirection;
        nextPos += 2;
      } else {
        nextPos++;
      }
      break;
    }
    if (isDirectionToken(t) || t === 'DSNT' || t === 'VC' || t === 'AND') {
      locParts.push(t);
      nextPos++;
    } else {
      break;
    }
  }

  if (locParts.length > 0) {
    info.location = locParts.join(' ');
  }

  return { info, nextPos };
}

/**
 * Parses precipitation begin/end event strings (e.g. "B15E32", "B15E32B48").
 * B = begin, E = end, followed by 2-digit minute or 4-digit hour+minute.
 */
function parsePrecipitationEvents(
  phenomenon: string,
  eventStr: string,
  observationHour: number,
): PrecipitationEvent[] {
  const events: PrecipitationEvent[] = [];
  const eventPattern = /([BE])(\d{2,4})/g;
  let eventMatch: RegExpExecArray | null;

  while ((eventMatch = eventPattern.exec(eventStr)) !== null) {
    const eventType = eventMatch[1] === 'B' ? ('BEGIN' as const) : ('END' as const);
    const timeStr = eventMatch[2]!;

    const time: DayTime =
      timeStr.length === 4
        ? { hour: parseInt(timeStr.slice(0, 2), 10), minute: parseInt(timeStr.slice(2), 10) }
        : { hour: observationHour, minute: parseInt(timeStr, 10) };

    events.push({ phenomenon, eventType, time });
  }

  return events;
}
