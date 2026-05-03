import type {
  Airmet,
  AirmetConditions,
  AirmetFreezingLevel,
  AirmetHazard,
  AirmetHazardType,
  AirmetOutlookArea,
  AirmetSeries,
  DayTime,
  FreezingLevelBoundary,
  FreezingLevelContour,
} from './types/index.js';
import { parseAltitudeFt, parseAltitudeRange, parseTimeString } from './advisory-utils.js';

/**
 * Parses an AIRMET bulletin string into a structured {@link Airmet} object.
 *
 * Accepts both raw WMO-wrapped bulletins (with header lines like WAUS41 KKCI)
 * and body-only bulletins starting with "AIRMET SIERRA/TANGO/ZULU".
 *
 * A single bulletin contains a header with series, validity, and purpose
 * information, followed by one or more hazard areas separated by `.` lines.
 * Zulu bulletins may also include freezing level sections and outlook areas.
 *
 * ```typescript
 * import { parseAirmet } from '@squawk/weather';
 *
 * const airmet = parseAirmet(rawBulletin);
 * console.log(airmet.series, airmet.hazards.length);
 * for (const hazard of airmet.hazards) {
 *   console.log(hazard.hazardType, hazard.states);
 * }
 * ```
 *
 * @param raw - The raw AIRMET bulletin string to parse.
 * @returns A parsed {@link Airmet} object.
 * @throws {Error} If the string cannot be parsed as a valid AIRMET bulletin.
 */
export function parseAirmet(raw: string): Airmet {
  const trimmed = raw.trim();

  if (!trimmed) {
    throw new Error('Empty AIRMET string');
  }

  // Parse WMO headers if present
  const { issuingOffice, issuedAt, body } = stripWmoHeaders(trimmed);

  // Normalize body to single line for header parsing
  const normalized = body
    .replace(/\r?\n|\r/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Parse the bulletin header: AIRMET SIERRA [UPDT #] FOR ... VALID UNTIL DDHHMMz
  const headerMatch = normalized.match(
    /^AIRMET\s+(SIERRA|TANGO|ZULU)(?:\s+UPDT\s+(\d+))?\s+FOR\s+(.+?)\s+VALID\s+UNTIL\s+(\d{4,6}Z?)\b/,
  );
  if (!headerMatch) {
    throw new Error('Unable to parse AIRMET header');
  }

  const series = headerMatch[1]! as AirmetSeries;
  const updateNumber = headerMatch[2] ? parseInt(headerMatch[2], 10) : undefined;
  const purposes = headerMatch[3]!;
  const validUntil = parseTimeString(headerMatch[4]!)!;

  // Split the body into sections using the original (non-normalized) body
  // because we need to preserve line breaks for FRZLVL indentation parsing
  const sections = splitSections(body);

  const hazards: AirmetHazard[] = [];
  const nilStatements: string[] = [];
  const outlooks: AirmetOutlookArea[] = [];
  let freezingLevel: AirmetFreezingLevel | undefined;

  // Track the most recent OTLK VALID times so standalone AREA sections
  // (separated by `.`) can be associated with their outlook header.
  let outlookValidFrom: DayTime | undefined;
  let outlookValidTo: DayTime | undefined;

  for (const section of sections) {
    const sectionNorm = section
      .replace(/\r?\n|\r/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!sectionNorm) {
      continue;
    }

    // Outlook section header (may also contain inline AREA blocks)
    if (/^OTLK VALID\b/.test(sectionNorm)) {
      const result = parseOutlookSection(section);
      if (result) {
        outlooks.push(...result.areas);
        outlookValidFrom = result.validFrom;
        outlookValidTo = result.validTo;
      }
      continue;
    }

    // Standalone AREA block following an OTLK VALID section after a `.` separator
    if (/^AREA\s+\d+\b/.test(sectionNorm) && outlookValidFrom && outlookValidTo) {
      outlooks.push(...parseAreaBlocks(sectionNorm, outlookValidFrom, outlookValidTo));
      continue;
    }

    // Handle sections that may contain multiple inline items separated by ". "
    // or FRZLVL appended after a hazard block
    const subItems = splitInlineItems(sectionNorm, section);
    for (const item of subItems) {
      if (!item.norm) {
        continue;
      }

      // NIL statements
      if (/^NO SIGNIFICANT\b/.test(item.norm)) {
        nilStatements.push(item.norm.replace(/\.\s*$/, ''));
        continue;
      }

      // Freezing level section
      if (/^FRZLVL\b/.test(item.norm)) {
        freezingLevel = parseFreezingLevel(item.raw);
        continue;
      }

      // Hazard areas
      if (/^AIRMET\s+(IFR|MTN OBSCN|TURB|STG SFC WNDS?|SFC WND|LLWS|ICE)\b/.test(item.norm)) {
        hazards.push(parseHazardBlock(item.norm));
        continue;
      }

      // LLWS POTENTIAL blocks (different keyword format)
      if (/^LLWS POTENTIAL\b/.test(item.norm)) {
        hazards.push(parseLlwsBlock(item.norm));
        continue;
      }
    }
  }

  return {
    raw,
    series,
    ...(updateNumber !== undefined ? { updateNumber } : {}),
    ...(issuingOffice !== undefined ? { issuingOffice } : {}),
    ...(issuedAt !== undefined ? { issuedAt } : {}),
    validUntil,
    purposes,
    hazards,
    nilStatements,
    ...(freezingLevel !== undefined ? { freezingLevel } : {}),
    outlooks,
  };
}

// ---------------------------------------------------------------------------
// WMO header stripping
// ---------------------------------------------------------------------------

/**
 * Strips WMO, AWIPS, and issuing office header lines from an AIRMET bulletin.
 * Returns the body starting from "AIRMET" and any metadata extracted from headers.
 */
function stripWmoHeaders(text: string): {
  issuingOffice?: string;
  issuedAt?: DayTime;
  body: string;
} {
  const lines = text.split(/\r?\n|\r/);
  let issuingOffice: string | undefined;
  let issuedAt: DayTime | undefined;
  let bodyStartIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();

    // Look for the AIRMET header line
    if (/^AIRMET\s+(SIERRA|TANGO|ZULU)\b/.test(line)) {
      bodyStartIdx = i;
      break;
    }

    // Parse the issuing office line (e.g. "BOSS WA 271445")
    const officeMatch = line.match(/^([A-Z]{3,4})\s+WA\s+(\d{6})$/);
    if (officeMatch) {
      issuingOffice = officeMatch[1];
      issuedAt = parseTimeString(officeMatch[2]!);
    }
  }

  const body = lines.slice(bodyStartIdx).join('\n');
  return {
    ...(issuingOffice !== undefined ? { issuingOffice } : {}),
    ...(issuedAt !== undefined ? { issuedAt } : {}),
    body,
  };
}

// ---------------------------------------------------------------------------
// Section splitting
// ---------------------------------------------------------------------------

/**
 * Splits the AIRMET body into individual sections separated by `.` on its own line
 * or `.` preceded by a newline. The header portion (up to headerLen characters
 * in the normalized form) is excluded.
 */
function splitSections(body: string): string[] {
  // Find where the header ends in the original body by locating VALID UNTIL + time
  const validMatch = body.match(/VALID\s+UNTIL\s+\d{4,6}Z?\b/);
  if (!validMatch) {
    return [];
  }

  const afterHeader = body.substring(validMatch.index! + validMatch[0].length);

  // Split on lines that are just "." (possibly with horizontal whitespace).
  // [^\S\n] matches whitespace except newline; using \s* here allowed two
  // ambiguous quantifiers to overlap on newline runs, producing O(n^2)
  // backtracking on attacker-controlled input (CodeQL js/polynomial-redos).
  const rawSections = afterHeader.split(/\n[^\S\n]*\.[^\S\n]*(?:\n|$)/);

  // Also handle inline dots for simple test data that has no newlines
  const sections: string[] = [];
  for (const raw of rawSections) {
    const trimmed = raw.trim();
    if (trimmed) {
      sections.push(trimmed);
    }
  }

  // If no sections were found (single-line data without . separators),
  // try splitting the normalized version
  if (sections.length === 0) {
    const norm = afterHeader
      .replace(/\r?\n|\r/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (norm) {
      sections.push(norm);
    }
  }

  return sections;
}

/**
 * Splits a section into sub-items when it contains inline FRZLVL data or
 * multiple NIL statements. A section like:
 *   "NO SIGNIFICANT TURB EXP. NO SIGNIFICANT STG SFC WNDS EXP."
 * becomes two items. A section like:
 *   "AIRMET ICE... MOD ICE BTN... FRZLVL...040-060 ACRS AREA."
 * splits the FRZLVL portion into a separate item.
 */
function splitInlineItems(normalized: string, raw: string): { norm: string; raw: string }[] {
  const results: { norm: string; raw: string }[] = [];

  // Check for inline FRZLVL within a hazard block
  const frzlvlIdx = normalized.indexOf('FRZLVL...');
  if (frzlvlIdx > 0 && /^AIRMET\b/.test(normalized)) {
    // Split off the FRZLVL portion
    const hazardPart = normalized.substring(0, frzlvlIdx).trim();
    const frzlvlPart = normalized.substring(frzlvlIdx).trim();
    results.push({ norm: hazardPart, raw: hazardPart });
    results.push({ norm: frzlvlPart, raw: frzlvlPart });
    return results;
  }

  // Check for sections starting with NIL statement that may contain FRZLVL
  if (/^NO SIGNIFICANT\b/.test(normalized)) {
    // Split off FRZLVL if present
    const frzlvlNilIdx = normalized.indexOf('FRZLVL...');
    if (frzlvlNilIdx > 0) {
      const nilPart = normalized.substring(0, frzlvlNilIdx).trim();
      const frzPart = normalized.substring(frzlvlNilIdx).trim();
      // Split multiple NIL statements
      const nilParts = nilPart.split(/\.\s+(?=NO SIGNIFICANT\b)/);
      for (const part of nilParts) {
        const trimmed = part.trim();
        if (trimmed) {
          results.push({ norm: trimmed, raw: trimmed });
        }
      }
      results.push({ norm: frzPart, raw: frzPart });
      return results;
    }

    // Multiple NIL statements without FRZLVL
    const nilParts = normalized.split(/\.\s+(?=NO SIGNIFICANT\b)/);
    for (const part of nilParts) {
      const trimmed = part.trim();
      if (trimmed) {
        results.push({ norm: trimmed, raw: trimmed });
      }
    }
    return results;
  }

  // No splitting needed
  results.push({ norm: normalized, raw });
  return results;
}

// ---------------------------------------------------------------------------
// Hazard block parsing
// ---------------------------------------------------------------------------

/**
 * Parses a single AIRMET hazard block (e.g. "AIRMET IFR...NY PA NJ CT MA RI
 * FROM 30SW ALB-20NW BDR-40E ACK-20NE BOS-30SW ALB
 * CIG BLW 010/VIS BLW 3SM BR. CONDS CONTG BYD 0400Z.")
 */
function parseHazardBlock(text: string): AirmetHazard {
  // Extract hazard type and states from header
  const headerMatch = text.match(
    /^AIRMET\s+(IFR|MTN OBSCN|TURB|STG SFC WNDS?|SFC WND|LLWS|ICE)\s*\.{3}\s*(.+?)(?:\s+(?:FROM|BOUNDED BY)\s)/,
  );

  let hazardType: AirmetHazardType;
  let statesStr = '';

  if (headerMatch) {
    hazardType = mapHazardType(headerMatch[1]!);
    statesStr = headerMatch[2]!;
  } else {
    // Fallback: try without area points (e.g. for short blocks)
    const shortMatch = text.match(
      /^AIRMET\s+(IFR|MTN OBSCN|TURB|STG SFC WNDS?|SFC WND|LLWS|ICE)\s*\.{3}\s*(.+)/,
    );
    if (!shortMatch) {
      throw new Error(`Unable to parse AIRMET hazard block: ${text.substring(0, 80)}`);
    }
    hazardType = mapHazardType(shortMatch[1]!);
    statesStr = shortMatch[2]!.split(/\s+(?:FROM|BOUNDED BY)\s/)[0]!;
  }

  // Parse states and coastal waters
  const { states, coastalWaters } = parseStatesAndCoastalWaters(statesStr);

  // Parse area points
  const areaPoints = parseAreaPoints(text);
  const boundedBy = parseBoundedBy(text);

  // Parse condition description (everything after area points, before CONDS)
  const conditionDescription = parseConditionDescription(text, hazardType);

  // Parse altitude range from condition description
  const altitudeRange = conditionDescription ? parseAltitudeRange(conditionDescription) : undefined;

  // Parse BLW altitude for turbulence (e.g. "MOD TURB BLW 120")
  let blwAltitudeRange = altitudeRange;
  if (!blwAltitudeRange && conditionDescription) {
    const blwMatch = conditionDescription.match(/BLW\s+(FL\d{3}|\d{3})/);
    if (blwMatch) {
      blwAltitudeRange = {
        topFt: parseAltitudeFt(blwMatch[1]!)!,
      };
    }
  }

  // Parse cause (DUE TO clause)
  const causeMatch = text.match(/DUE TO\s+([A-Z]+(?:\s+[A-Z]+)*)\./);
  const cause = causeMatch ? causeMatch[1] : undefined;

  // Parse conditions
  const conditions = parseConditionsStatus(text);

  return {
    hazardType,
    states,
    coastalWaters,
    areaPoints,
    boundedBy,
    ...(conditionDescription !== undefined ? { conditionDescription } : {}),
    ...(blwAltitudeRange !== undefined ? { altitudeRange: blwAltitudeRange } : {}),
    ...(cause !== undefined ? { cause } : {}),
    ...(conditions !== undefined ? { conditions } : {}),
  };
}

/**
 * Parses an LLWS POTENTIAL block which uses BOUNDED BY instead of FROM and
 * has a different header format than standard hazard blocks.
 */
function parseLlwsBlock(text: string): AirmetHazard {
  // LLWS POTENTIAL...states
  const headerMatch = text.match(/^LLWS POTENTIAL\s*\.{3}\s*(.+?)(?:\s+BOUNDED BY\s)/);
  let statesStr = '';
  if (headerMatch) {
    statesStr = headerMatch[1]!;
  }

  const { states, coastalWaters } = parseStatesAndCoastalWaters(statesStr);
  const boundedBy = parseBoundedBy(text);

  // The condition description for LLWS is typically "LLWS EXP" or "LLWS DUE TO..."
  let conditionDescription: string | undefined;
  const llwsDescMatch = text.match(/\b(LLWS\s+(?:EXP|DUE TO\s+[A-Z]+))\b/);
  if (llwsDescMatch) {
    conditionDescription = llwsDescMatch[1];
  }

  const conditions = parseConditionsStatus(text);

  return {
    hazardType: 'LLWS',
    states,
    coastalWaters,
    areaPoints: [],
    boundedBy,
    ...(conditionDescription !== undefined ? { conditionDescription } : {}),
    ...(conditions !== undefined ? { conditions } : {}),
  };
}

// ---------------------------------------------------------------------------
// Area point parsing
// ---------------------------------------------------------------------------

/**
 * Parses FROM...TO area points from an AIRMET hazard block.
 * Handles both dash-separated (FROM x-y-z) and TO-separated (FROM x TO y TO z) formats.
 */
function parseAreaPoints(text: string): string[] {
  // Match FROM ... up to the condition description or end of area definition
  const fromMatch = text.match(/\bFROM\s+(.+?)(?:\s+(?:CIG|MTNS?|MOD|SEV|SUSTAINED|LLWS|VIS)\b)/);
  if (!fromMatch) {
    return [];
  }

  const pointsStr = fromMatch[1]!;

  // Split on " TO " or "-" (both formats appear in real data)
  if (pointsStr.includes(' TO ')) {
    return pointsStr
      .split(/\s+TO\s+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  return pointsStr
    .split('-')
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Parses BOUNDED BY area points from an AIRMET block (used for LLWS POTENTIAL).
 */
function parseBoundedBy(text: string): string[] {
  const boundedMatch = text.match(
    /\bBOUNDED BY\s+(.+?)(?:\s+(?:LLWS|MOD|SEV|CIG|MTNS?|SUSTAINED)\b)/,
  );
  if (!boundedMatch) {
    return [];
  }

  return boundedMatch[1]!
    .split('-')
    .map((p) => p.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Condition description parsing
// ---------------------------------------------------------------------------

/**
 * Extracts the condition description from a hazard block.
 * This is the text describing the actual hazard (e.g. "CIG BLW 010/VIS BLW 3SM BR",
 * "MOD TURB BTN FL250 AND FL380", "MTNS OBSC BY CLDS/PCPN/BR").
 */
function parseConditionDescription(text: string, hazardType: AirmetHazardType): string | undefined {
  let description: string | undefined;

  switch (hazardType) {
    case 'IFR': {
      const match = text.match(/\b(CIG BLW\s+\d{3}\/VIS BLW\s+\d+SM\s*[A-Z/]*)/);
      if (match) {
        description = match[1]!.trim();
      }
      break;
    }
    case 'MTN_OBSCN': {
      const match = text.match(/\b(MTNS?\s+OBSC?D?\s+BY\s+[A-Z/]+)/);
      if (match) {
        description = match[1]!.trim();
      }
      break;
    }
    case 'TURB': {
      const match = text.match(
        /\b((?:MOD|SEV)\s+TURB\s+(?:BTN\s+(?:FL\d{3}|\d{3})\s+AND\s+(?:FL\d{3}|\d{3})|BLW\s+(?:FL\d{3}|\d{3})))/,
      );
      if (match) {
        description = match[1]!.trim();
      }
      break;
    }
    case 'STG_SFC_WND': {
      const match = text.match(
        /\b(SUSTAINED\s+(?:SFC|SURFACE)\s+(?:WINDS?|WNDS?)\s+GTR\s+THAN\s+\d+KT(?:\s+EXP)?)/,
      );
      if (match) {
        description = match[1]!.trim();
      }
      break;
    }
    case 'LLWS': {
      const match = text.match(/\b(LLWS\s+(?:DUE TO\s+[A-Z]+|EXP))/);
      if (match) {
        description = match[1]!.trim();
      }
      break;
    }
    case 'ICE': {
      const match = text.match(
        /\b(MOD\s+ICE\s+BTN\s+(?:FRZLVL|FL\d{3}|\d{3})\s+AND\s+(?:FL\d{3}|\d{3})(?:\.\s*FRZLVL\s+\d{3}-\d{3})?)/,
      );
      if (match) {
        description = match[1]!.trim();
      }
      break;
    }
    default:
      break;
  }

  return description;
}

// ---------------------------------------------------------------------------
// Conditions status parsing
// ---------------------------------------------------------------------------

/**
 * Checks for a supplemental "CONDS CONTG THRU HHZ" clause that may follow
 * a DVLPG statement, providing an end time for the developing conditions.
 */
function parseSupplementalContgThru(text: string): DayTime | undefined {
  const match = text.match(/CONDS\s+CONTG\s+THRU\s+(\d{2,4})Z?\b/);
  return match ? parseTimeString(match[1]! + 'Z') : undefined;
}

/**
 * Parses the conditions status from a hazard block.
 * Handles: CONDS DVLPG, CONDS CONTG BYD, CONDS ENDG, and their time variants.
 */
function parseConditionsStatus(text: string): AirmetConditions | undefined {
  // Helper to build a conditions object with only defined time fields
  function buildConditions(
    status: AirmetConditions['status'],
    startTime: DayTime | undefined,
    endTime: DayTime | undefined,
    isAfter?: true,
  ): AirmetConditions {
    return {
      status,
      ...(startTime !== undefined ? { startTime } : {}),
      ...(endTime !== undefined ? { endTime } : {}),
      ...(isAfter !== undefined ? { isAfter } : {}),
    };
  }

  // CONDS DVLPG AFT HHZ (may be followed by CONDS CONTG THRU HHZ)
  const dvlpgAftMatch = text.match(/CONDS\s+DVLPG\s+AFT\s+(\d{2,4})Z?\b/);
  if (dvlpgAftMatch) {
    const contgThruEnd = parseSupplementalContgThru(text);
    return buildConditions(
      'DEVELOPING',
      parseTimeString(dvlpgAftMatch[1]! + 'Z'),
      contgThruEnd,
      true,
    );
  }

  // CONDS DVLPG HH-HHZ (may be followed by CONDS CONTG THRU HHZ)
  const dvlpgMatch = text.match(/CONDS\s+DVLPG\s+(\d{2,4})-(\d{2,4})Z?\b/);
  if (dvlpgMatch) {
    const rangeEnd = parseTimeString(dvlpgMatch[2]! + 'Z');
    const contgThruEnd = parseSupplementalContgThru(text);
    return buildConditions(
      'DEVELOPING',
      parseTimeString(dvlpgMatch[1]! + 'Z'),
      contgThruEnd ?? rangeEnd,
    );
  }

  // CONDS CONTG BYD HHZ THRU HHZ
  const contgThruMatch = text.match(/CONDS\s+CONTG\s+BYD\s+(\d{2,4})Z?\s+THRU\s+(\d{2,4})Z?\b/);
  if (contgThruMatch) {
    return buildConditions(
      'CONTINUING',
      parseTimeString(contgThruMatch[1]! + 'Z'),
      parseTimeString(contgThruMatch[2]! + 'Z'),
    );
  }

  // CONDS CONTG BYD HHZ ENDG BY HHZ
  const contgEndgByMatch = text.match(
    /CONDS\s+CONTG\s+BYD\s+(\d{2,4})Z?\s+ENDG\s+BY\s+(\d{2,4})Z?\b/,
  );
  if (contgEndgByMatch) {
    return buildConditions(
      'CONTINUING',
      parseTimeString(contgEndgByMatch[1]! + 'Z'),
      parseTimeString(contgEndgByMatch[2]! + 'Z'),
    );
  }

  // CONDS CONTG BYD HHZ ENDG HH-HHZ (range, no BY)
  const contgEndgRangeMatch = text.match(
    /CONDS\s+CONTG\s+BYD\s+(\d{2,4})Z?\s+ENDG\s+(\d{2,4})-(\d{2,4})Z?\b/,
  );
  if (contgEndgRangeMatch) {
    return buildConditions(
      'CONTINUING',
      parseTimeString(contgEndgRangeMatch[1]! + 'Z'),
      parseTimeString(contgEndgRangeMatch[3]! + 'Z'),
    );
  }

  // CONDS CONTG BYD HHZ
  const contgMatch = text.match(/CONDS\s+CONTG\s+BYD\s+(\d{2,4})Z?\b/);
  if (contgMatch) {
    return buildConditions('CONTINUING', parseTimeString(contgMatch[1]! + 'Z'), undefined);
  }

  // CONDS CONTG THRU HHZ (no BYD)
  const contgThruOnlyMatch = text.match(/CONDS\s+CONTG\s+THRU\s+(\d{2,4})Z?\b/);
  if (contgThruOnlyMatch) {
    return buildConditions('CONTINUING', undefined, parseTimeString(contgThruOnlyMatch[1]! + 'Z'));
  }

  // CONDS ENDG HH-HHZ
  const endgRangeMatch = text.match(/CONDS\s+ENDG\s+(\d{2,4})-(\d{2,4})Z?\b/);
  if (endgRangeMatch) {
    return buildConditions(
      'ENDING',
      parseTimeString(endgRangeMatch[1]! + 'Z'),
      parseTimeString(endgRangeMatch[2]! + 'Z'),
    );
  }

  // CONDS ENDG BY HHZ
  const endgByMatch = text.match(/CONDS\s+ENDG\s+BY\s+(\d{2,4})Z?\b/);
  if (endgByMatch) {
    return buildConditions('ENDING', undefined, parseTimeString(endgByMatch[1]! + 'Z'));
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Freezing level parsing
// ---------------------------------------------------------------------------

/**
 * Parses a FRZLVL section from an AIRMET Zulu bulletin.
 * Handles: range descriptions, contour lines, and MULT FRZLVL boundaries.
 */
function parseFreezingLevel(section: string): AirmetFreezingLevel {
  const contours: FreezingLevelContour[] = [];
  const multiFrzlvl: FreezingLevelBoundary[] = [];
  let range: string | undefined;
  let rangeLowFt: number | undefined;
  let rangeHighFt: number | undefined;

  // Normalize for top-level range parsing
  const normalized = section
    .replace(/\r?\n|\r/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Parse range: "RANGING FROM SFC-110 ACRS AREA" or "040-060 ACRS AREA"
  // or "SFC-020 N OF 40N LINE. 040-080 S OF 40N LINE."
  const rangingMatch = normalized.match(
    /FRZLVL\s*\.{3}\s*(?:RANGING FROM\s+)?(SFC|\d{3})-(\d{3})\s+(ACRS AREA)/,
  );
  if (rangingMatch) {
    rangeLowFt = rangingMatch[1] === 'SFC' ? undefined : parseAltitudeFt(rangingMatch[1]!);
    rangeHighFt = parseAltitudeFt(rangingMatch[2]!)!;
    range = `${rangingMatch[1]}-${rangingMatch[2]} ${rangingMatch[3]}`;
  } else {
    // Check for lat-line style: "SFC-020 N OF 40N LINE. 040-080 S OF 40N LINE."
    const latLineMatch = normalized.match(
      /FRZLVL\s*\.{3}\s*(SFC|\d{3})-(\d{3})\s+[NS]\s+OF\s+\d+[NS]\s+LINE/,
    );
    if (latLineMatch) {
      rangeLowFt = latLineMatch[1] === 'SFC' ? undefined : parseAltitudeFt(latLineMatch[1]!);
      rangeHighFt = parseAltitudeFt(latLineMatch[2]!)!;
      // Parse individual lat-line contours
      const latLineRegex = /(SFC|\d{3})-(\d{3})\s+([NS])\s+OF\s+(\d+[NS])\s+LINE/g;
      let latMatch;
      while ((latMatch = latLineRegex.exec(normalized)) !== null) {
        const lowStr = latMatch[1]!;
        const highStr = latMatch[2]!;
        const direction = latMatch[3]!;
        const latLine = latMatch[4]!;
        const lowFt = lowStr === 'SFC' ? undefined : parseAltitudeFt(lowStr);
        contours.push({
          ...(lowFt !== undefined ? { altitudeFt: lowFt } : {}),
          location: `${lowStr}-${highStr} ${direction} OF ${latLine} LINE`,
        });
        // Update overall range
        const highFt = parseAltitudeFt(highStr)!;
        if (rangeHighFt === undefined || highFt > rangeHighFt) {
          rangeHighFt = highFt;
        }
      }
    }
  }

  // Parse MULT FRZLVL boundaries
  const multRegex =
    /MULT\s+FRZLVL\s+BLW\s+(\d{3})\s+BOUNDED\s+BY\s+([A-Z0-9\s\-/]+?)(?=\s+MULT|\s+SFC\s+ALG|\.?\s*$)/g;
  let multMatch;
  while ((multMatch = multRegex.exec(normalized)) !== null) {
    const belowFt = parseAltitudeFt(multMatch[1]!)!;
    const boundedBy = multMatch[2]!
      .split('-')
      .map((p) => p.trim())
      .filter(Boolean);
    multiFrzlvl.push({ belowFt, boundedBy });
  }

  // Parse SFC ALG lines
  const sfcAlgRegex = /SFC\s+ALG\s+([A-Z0-9\s\-/]+?)(?=\s+MULT|\s+SFC\s+ALG|\s+\d{3}\s+ALG|\s*$)/g;
  let sfcMatch;
  while ((sfcMatch = sfcAlgRegex.exec(normalized)) !== null) {
    contours.push({
      location: `ALG ${sfcMatch[1]!.trim()}`,
    });
  }

  // Parse altitude ALG lines (e.g. "040 ALG 20S ORF-80E ECG-160SE SIE")
  const altAlgRegex =
    /(\d{3})\s+ALG\s+([A-Z0-9\s\-/]+?)(?=\s+MULT|\s+SFC\s+ALG|\s+\d{3}\s+ALG|\s*$)/g;
  let altMatch;
  while ((altMatch = altAlgRegex.exec(normalized)) !== null) {
    const altFt = parseAltitudeFt(altMatch[1]!);
    contours.push({
      ...(altFt !== undefined ? { altitudeFt: altFt } : {}),
      location: `ALG ${altMatch[2]!.trim()}`,
    });
  }

  return {
    ...(range !== undefined ? { range } : {}),
    ...(rangeLowFt !== undefined ? { rangeLowFt } : {}),
    ...(rangeHighFt !== undefined ? { rangeHighFt } : {}),
    contours,
    multiFrzlvl,
  };
}

// ---------------------------------------------------------------------------
// Outlook parsing
// ---------------------------------------------------------------------------

/**
 * Parses an OTLK VALID section header and any AREA blocks within it.
 * Returns the outlook validity times so that subsequent standalone AREA
 * sections (separated by `.`) can reuse them.
 */
function parseOutlookSection(section: string):
  | {
      validFrom: DayTime;
      validTo: DayTime;
      areas: AirmetOutlookArea[];
    }
  | undefined {
  const normalized = section
    .replace(/\r?\n|\r/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Parse OTLK VALID HHHH-HHHHZ
  const validMatch = normalized.match(/OTLK VALID\s+(\d{4,6})-(\d{4,6})Z?\b/);
  if (!validMatch) {
    return undefined;
  }

  const validFrom = parseTimeString(validMatch[1]! + 'Z')!;
  const validTo = parseTimeString(validMatch[2]! + 'Z')!;

  return {
    validFrom,
    validTo,
    areas: parseAreaBlocks(normalized, validFrom, validTo),
  };
}

/**
 * Extracts the condition description from text following the BOUNDED BY
 * clause of an outlook AREA block. Handles all hazard types, not just ICE/TURB.
 */
function parseOutlookConditionDescription(
  text: string,
  hazardType: AirmetHazardType,
): string | undefined {
  switch (hazardType) {
    case 'ICE':
    case 'TURB': {
      const match = text.match(
        /^((?:MOD|SEV)\s+(?:ICE|TURB)\s+(?:BTN\s+(?:FRZLVL|FL\d{3}|\d{3})\s+AND\s+(?:FL\d{3}|\d{3})|BLW\s+(?:FL\d{3}|\d{3})))/,
      );
      return match ? match[1]!.trim() : undefined;
    }
    case 'IFR': {
      const match = text.match(/^(CIG BLW\s+\d{3}\/VIS BLW\s+\d+SM\s*[A-Z/]*)/);
      return match ? match[1]!.trim() : undefined;
    }
    case 'MTN_OBSCN': {
      const match = text.match(/^(MTNS?\s+OBSC?D?\s+BY\s+[A-Z/]+)/);
      return match ? match[1]!.trim() : undefined;
    }
    case 'STG_SFC_WND': {
      const match = text.match(
        /^(SUSTAINED\s+(?:SFC|SURFACE)\s+(?:WINDS?|WNDS?)\s+GTR\s+THAN\s+\d+KT(?:\s+EXP)?)/,
      );
      return match ? match[1]!.trim() : undefined;
    }
    case 'LLWS': {
      const match = text.match(/^(LLWS\s+(?:DUE TO\s+[A-Z]+|EXP))/);
      return match ? match[1]!.trim() : undefined;
    }
    default:
      return undefined;
  }
}

/**
 * Extracts AREA outlook blocks from normalized text, associating each with
 * the given outlook validity times.
 */
function parseAreaBlocks(
  normalized: string,
  validFrom: DayTime,
  validTo: DayTime,
): AirmetOutlookArea[] {
  const results: AirmetOutlookArea[] = [];
  const areaRegex =
    /AREA\s+(\d+)\s*\.{3}\s*(IFR|MTN OBSCN|TURB|STG SFC WNDS?|SFC WND|LLWS|ICE)\s+([A-Z\s]+?)\s+BOUNDED\s+BY\s+(.+?)(?=\s+(?:MOD|SEV|CIG|MTNS?|LLWS|SUSTAINED)\b)/g;

  let areaMatch;
  while ((areaMatch = areaRegex.exec(normalized)) !== null) {
    const areaNumber = parseInt(areaMatch[1]!, 10);
    const hazardType = mapHazardType(areaMatch[2]!);
    const { states } = parseStatesAndCoastalWaters(areaMatch[3]!);
    const boundedBy = areaMatch[4]!
      .split('-')
      .map((p) => p.trim())
      .filter(Boolean);

    // Extract condition description from rest of text after BOUNDED BY
    const afterBounded = normalized.substring(areaMatch.index! + areaMatch[0].length).trimStart();
    const conditionDescription = parseOutlookConditionDescription(afterBounded, hazardType);

    const altitudeRange = conditionDescription
      ? parseAltitudeRange(conditionDescription)
      : undefined;
    const conditions = parseConditionsStatus(afterBounded);

    results.push({
      areaNumber,
      hazardType,
      validFrom,
      validTo,
      states,
      boundedBy,
      ...(conditionDescription !== undefined ? { conditionDescription } : {}),
      ...(altitudeRange !== undefined ? { altitudeRange } : {}),
      ...(conditions !== undefined ? { conditions } : {}),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Maps raw hazard type strings from AIRMET text to the AirmetHazardType enum value.
 */
function mapHazardType(raw: string): AirmetHazardType {
  const normalized = raw.trim().toUpperCase();
  if (normalized === 'IFR') {
    return 'IFR';
  }
  if (normalized === 'MTN OBSCN') {
    return 'MTN_OBSCN';
  }
  if (normalized === 'TURB') {
    return 'TURB';
  }
  if (normalized === 'STG SFC WNDS' || normalized === 'STG SFC WND' || normalized === 'SFC WND') {
    return 'STG_SFC_WND';
  }
  if (normalized === 'LLWS') {
    return 'LLWS';
  }
  if (normalized === 'ICE') {
    return 'ICE';
  }
  throw new Error(`Unrecognized AIRMET hazard type: ${raw}`);
}

/**
 * Parses a states string into an array of state codes and a coastal waters flag.
 */
function parseStatesAndCoastalWaters(statesStr: string): {
  states: string[];
  coastalWaters: boolean;
} {
  const coastalWaters = /\bCSTL WTRS\b/.test(statesStr) || /\bAND CSTL\b/.test(statesStr);
  const cleaned = statesStr
    .replace(/\bAND\s+CSTL\s+WTRS\b/g, '')
    .replace(/\bCSTL\s+WTRS\b/g, '')
    .replace(/\bAND\b/g, ' ')
    .trim();

  const states = cleaned
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && /^[A-Z]{2,3}$/.test(s));

  return { states, coastalWaters };
}
