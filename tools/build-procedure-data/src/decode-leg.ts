import type {
  AltitudeConstraint,
  AltitudeConstraintDescriptor,
  ProcedureLeg,
  ProcedureLegFixCategory,
  ProcedureLegPathTerminator,
  ProcedureType,
  SpeedConstraint,
  SpeedConstraintDescriptor,
  TurnDirection,
} from '@squawk/types';

/**
 * Maps a CIFP airport subsection code (PD / PE / PF) to the procedure type
 * it represents.
 */
const SUBSECTION_TO_PROCEDURE_TYPE: Readonly<Record<string, ProcedureType>> = {
  D: 'SID',
  E: 'STAR',
  F: 'IAP',
};

/**
 * Maps a CIFP fix section/subsection code (ARINC 424 field 5.4/5.5)
 * to the category of the fix. The key is the 2-character slice taken
 * from columns 37-38 of a procedure leg's primary record.
 */
const FIX_SECTION_TO_CATEGORY: Readonly<Record<string, ProcedureLegFixCategory>> = {
  EA: 'FIX',
  PC: 'FIX',
  'D ': 'NAVAID',
  DB: 'NAVAID',
  PN: 'NAVAID',
  PI: 'NAVAID',
  PA: 'AIRPORT',
  PG: 'RUNWAY',
};

/**
 * Valid ARINC 424 path terminator codes that may appear on a procedure
 * leg. Stored as a `Set` for quick membership checks during parsing.
 */
const VALID_PATH_TERMINATORS: ReadonlySet<ProcedureLegPathTerminator> =
  new Set<ProcedureLegPathTerminator>([
    'IF',
    'TF',
    'CF',
    'DF',
    'FA',
    'FC',
    'FD',
    'FM',
    'CA',
    'CD',
    'CI',
    'CR',
    'RF',
    'AF',
    'VA',
    'VD',
    'VI',
    'VM',
    'VR',
    'PI',
    'HA',
    'HF',
    'HM',
  ]);

/**
 * Valid altitude constraint descriptor values.
 */
const VALID_ALTITUDE_DESCRIPTORS: ReadonlySet<AltitudeConstraintDescriptor> =
  new Set<AltitudeConstraintDescriptor>([
    '@',
    '+',
    '-',
    'B',
    'C',
    'G',
    'H',
    'I',
    'J',
    'V',
    'X',
    'Y',
  ]);

/**
 * Valid speed constraint descriptor values.
 */
const VALID_SPEED_DESCRIPTORS: ReadonlySet<SpeedConstraintDescriptor> =
  new Set<SpeedConstraintDescriptor>(['@', '+', '-']);

/**
 * Metadata accompanying a decoded procedure leg, used by the parser to
 * group legs into procedures and route sections.
 */
export interface DecodedLegRecord {
  /** FAA airport identifier (columns 7-10). */
  airport: string;
  /** ICAO region code of the airport (columns 11-12). */
  airportIcaoRegionCode: string;
  /** CIFP procedure identifier, right-trimmed (columns 14-19). */
  procedureIdentifier: string;
  /** Procedure type derived from the subsection code at column 13. */
  procedureType: ProcedureType;
  /** CIFP route type letter (column 20). */
  routeType: string;
  /** Transition identifier (columns 21-25), right-trimmed. Empty string for common-route records. */
  transitionIdentifier: string;
  /** CIFP sequence number (columns 27-29). */
  sequenceNumber: number;
  /** Raw 2-character section code of the termination fix (columns 37-38), preserved so the parser can resolve coordinates against the fix index. */
  fixSectionCode: string;
  /** `true` when this record carries the Waypoint Description Code position-2 `M` flag, marking the first leg of an embedded missed-approach procedure inside an IAP final-approach route. */
  startsEmbeddedMissedApproach: boolean;
  /** The decoded leg. */
  leg: ProcedureLeg;
}

/**
 * Decodes a single ARINC 424 primary leg record (PD / PE / PF) into a
 * {@link DecodedLegRecord}.
 *
 * Returns `undefined` when the line is not a primary record of an
 * airport procedure (for example a header, trailer, continuation, or
 * non-procedure section).
 *
 * @param raw - 132-character fixed-width ARINC 424 record line.
 */
export function decodePrimaryLegRecord(raw: string): DecodedLegRecord | undefined {
  if (raw.length < 132) {
    return undefined;
  }
  if (raw.charAt(0) !== 'S') {
    return undefined;
  }
  if (raw.charAt(4) !== 'P') {
    return undefined;
  }
  const subsectionCode = raw.charAt(12);
  const procedureType = SUBSECTION_TO_PROCEDURE_TYPE[subsectionCode];
  if (procedureType === undefined) {
    return undefined;
  }
  const continuationNumber = raw.charAt(38);
  if (continuationNumber !== '0' && continuationNumber !== '1') {
    return undefined;
  }

  const airport = raw.substring(6, 10).trim();
  if (airport.length === 0) {
    return undefined;
  }
  const airportIcaoRegionCode = raw.substring(10, 12).trim();
  const procedureIdentifier = raw.substring(13, 19).trim();
  if (procedureIdentifier.length === 0) {
    return undefined;
  }
  const routeType = raw.charAt(19);
  const transitionIdentifier = raw.substring(20, 25).trim();
  const sequenceRaw = raw.substring(26, 29).trim();
  const sequenceNumber = Number.parseInt(sequenceRaw, 10);
  if (Number.isNaN(sequenceNumber)) {
    return undefined;
  }

  const pathTerminatorRaw = raw.substring(47, 49).trim();
  if (!isPathTerminator(pathTerminatorRaw)) {
    return undefined;
  }
  const pathTerminator: ProcedureLegPathTerminator = pathTerminatorRaw;

  const leg: ProcedureLeg = { pathTerminator };

  const fixIdentifier = raw.substring(29, 34).trim();
  const fixSectionCode = raw.substring(36, 38);
  if (fixIdentifier.length > 0) {
    leg.fixIdentifier = fixIdentifier;
    const fixIcaoRegionCode = raw.substring(34, 36).trim();
    if (fixIcaoRegionCode.length > 0) {
      leg.icaoRegionCode = fixIcaoRegionCode;
    }
    const category = FIX_SECTION_TO_CATEGORY[fixSectionCode];
    if (category !== undefined) {
      leg.category = category;
    }
  }

  const descriptionCode = raw.substring(39, 43);
  applyWaypointDescriptionCode(leg, descriptionCode);
  const startsEmbeddedMissedApproach = isFirstMissedApproachLeg(descriptionCode);

  const turnDirection = raw.charAt(43);
  if (turnDirection === 'L' || turnDirection === 'R') {
    leg.turnDirection = turnDirection as TurnDirection;
  }

  const rnpNm = parseRnp(raw.substring(44, 47));
  if (rnpNm !== undefined) {
    leg.rnpNm = rnpNm;
  }

  const recommendedNavaid = raw.substring(50, 54).trim();
  if (recommendedNavaid.length > 0) {
    leg.recommendedNavaid = recommendedNavaid;
    const recommendedNavaidRegion = raw.substring(54, 56).trim();
    if (recommendedNavaidRegion.length > 0) {
      leg.recommendedNavaidIcaoRegionCode = recommendedNavaidRegion;
    }
  }

  const arcRadiusNm = parseTenThousandths(raw.substring(56, 62));
  if (arcRadiusNm !== undefined) {
    leg.arcRadiusNm = arcRadiusNm;
  }

  const thetaDeg = parseTenths(raw.substring(62, 66));
  if (thetaDeg !== undefined) {
    leg.thetaDeg = thetaDeg;
  }

  const rhoNm = parseTenths(raw.substring(66, 70));
  if (rhoNm !== undefined) {
    leg.rhoNm = rhoNm;
  }

  const courseSlice = raw.substring(70, 74);
  const course = parseCourse(courseSlice);
  if (course !== undefined) {
    leg.courseDeg = course.deg;
    if (course.isTrue) {
      leg.courseIsTrue = true;
    }
  }

  const distanceTime = parseDistanceOrTime(raw.substring(74, 78));
  if (distanceTime !== undefined) {
    if (distanceTime.kind === 'distance') {
      leg.distanceNm = distanceTime.value;
    } else {
      leg.holdTimeMin = distanceTime.value;
    }
  }

  const altitudeConstraint = parseAltitudeConstraint(
    raw.charAt(82),
    raw.substring(84, 89),
    raw.substring(89, 94),
  );
  if (altitudeConstraint !== undefined) {
    leg.altitudeConstraint = altitudeConstraint;
  }

  const speedConstraint = parseSpeedConstraint(raw.substring(99, 102), raw.charAt(117));
  if (speedConstraint !== undefined) {
    leg.speedConstraint = speedConstraint;
  }

  if (pathTerminator === 'RF') {
    const centerFix = raw.substring(106, 111).trim();
    if (centerFix.length > 0) {
      leg.centerFix = centerFix;
      const centerFixRegion = raw.substring(112, 114).trim();
      if (centerFixRegion.length > 0) {
        leg.centerFixIcaoRegionCode = centerFixRegion;
      }
    }
  }

  return {
    airport,
    airportIcaoRegionCode,
    procedureIdentifier,
    procedureType,
    routeType,
    transitionIdentifier,
    sequenceNumber,
    fixSectionCode,
    startsEmbeddedMissedApproach,
    leg,
  };
}

/**
 * Narrows a raw string to a valid {@link ProcedureLegPathTerminator}.
 */
function isPathTerminator(value: string): value is ProcedureLegPathTerminator {
  return VALID_PATH_TERMINATORS.has(value as ProcedureLegPathTerminator);
}

/**
 * Populates the approach-role and flyover flags on a leg based on the
 * 4-character Waypoint Description Code (ARINC 424 field 5.17).
 *
 * Character indices within the 4-character field:
 *
 * - Index 0 - Waypoint type (`A` airport, `E` essential, `G` runway, `V` VHF navaid, etc.). Informational only; the fix category is resolved via the separate section code.
 * - Index 1 - `B` or `Y` marks a fly-over fix; `E` marks end-of-enroute.
 * - Index 2 - Step-down / ATC / missed-approach leg flags. `M` marks the first leg of the missed-approach procedure embedded inside a final-approach route.
 * - Index 3 - Approach role: `A`/`C`/`D` initial approach fix (IAF), `B` intermediate fix (IF), `F` final approach fix (FAF), `I` final approach course fix (FACF), `M` missed approach point (MAP).
 */
function applyWaypointDescriptionCode(leg: ProcedureLeg, code: string): void {
  if (code.length < 4) {
    return;
  }
  const flyoverFlag = code.charAt(1);
  if (flyoverFlag === 'B' || flyoverFlag === 'Y') {
    leg.isFlyover = true;
  }
  const roleFlag = code.charAt(3);
  switch (roleFlag) {
    case 'A':
    case 'C':
    case 'D':
      leg.isInitialApproachFix = true;
      break;
    case 'B':
      leg.isIntermediateFix = true;
      break;
    case 'F':
      leg.isFinalApproachFix = true;
      break;
    case 'I':
      leg.isFinalApproachCourseFix = true;
      break;
    case 'M':
      leg.isMissedApproachPoint = true;
      break;
    default:
      break;
  }
}

/**
 * Returns `true` when the leg's 4-character Waypoint Description Code
 * flags this record as the first leg of an embedded missed-approach
 * procedure (index 2 set to `M`). The parser uses this flag to split
 * an IAP's final-approach route into the common route (everything up
 * through the MAP) and the missed-approach sequence (everything from
 * the missed-approach start onward).
 *
 * @param descriptionCode - 4-character Waypoint Description Code.
 */
export function isFirstMissedApproachLeg(descriptionCode: string): boolean {
  return descriptionCode.length >= 3 && descriptionCode.charAt(2) === 'M';
}

/**
 * Parses an RNP value encoded in ARINC 424 field 5.211: a 3-character
 * string where the first two characters form the mantissa and the
 * third character is the negated base-10 exponent. For example:
 *
 * - `101` - `10 * 10^-1` = 1.0 NM.
 * - `303` - `30 * 10^-3` = 0.03 NM.
 *
 * Returns `undefined` for a blank or unparseable value.
 */
function parseRnp(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (trimmed.length !== 3) {
    return undefined;
  }
  const mantissa = Number.parseInt(trimmed.substring(0, 2), 10);
  const exponent = Number.parseInt(trimmed.substring(2, 3), 10);
  if (Number.isNaN(mantissa) || Number.isNaN(exponent)) {
    return undefined;
  }
  return mantissa * Math.pow(10, -exponent);
}

/**
 * Parses a value encoded as tenths (for example `2238` = 223.8).
 * Returns `undefined` when the slice is blank or not numeric.
 */
function parseTenths(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const value = Number.parseInt(trimmed, 10);
  if (Number.isNaN(value)) {
    return undefined;
  }
  return value / 10;
}

/**
 * Parses a value encoded as ten-thousandths (for example `012345` = 1.2345).
 * Used for arc radius encoded in nautical miles to four decimal places.
 */
function parseTenThousandths(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const value = Number.parseInt(trimmed, 10);
  if (Number.isNaN(value)) {
    return undefined;
  }
  return value / 10000;
}

/**
 * Parses the 4-character magnetic course field. The first three
 * characters are tenths of degrees; a trailing `T` denotes a true
 * bearing rather than magnetic.
 */
function parseCourse(raw: string): { deg: number; isTrue: boolean } | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  let isTrue = false;
  let body = trimmed;
  if (body.endsWith('T')) {
    isTrue = true;
    body = body.substring(0, body.length - 1);
  }
  if (body.length === 0) {
    return undefined;
  }
  const value = Number.parseInt(body, 10);
  if (Number.isNaN(value)) {
    return undefined;
  }
  return { deg: value / 10, isTrue };
}

/**
 * Result of parsing a leg's distance/time field.
 */
interface DistanceOrTime {
  /** `distance` for NM distance, `time` for holding-pattern minutes. */
  kind: 'distance' | 'time';
  /** Decoded value. */
  value: number;
}

/**
 * Parses the 4-character Route / Holding Distance-or-Time field. When
 * the first character is `T` the remainder encodes tenths of a minute
 * (holding-pattern leg time); otherwise the four characters encode
 * tenths of a nautical mile.
 */
function parseDistanceOrTime(raw: string): DistanceOrTime | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (trimmed.charAt(0) === 'T') {
    const body = trimmed.substring(1);
    if (body.length === 0) {
      return undefined;
    }
    const value = Number.parseInt(body, 10);
    if (Number.isNaN(value)) {
      return undefined;
    }
    return { kind: 'time', value: value / 10 };
  }
  const value = Number.parseInt(trimmed, 10);
  if (Number.isNaN(value)) {
    return undefined;
  }
  return { kind: 'distance', value: value / 10 };
}

/**
 * Parses a 5-character altitude slice. Accepts literal feet values
 * (e.g. `01500` = 1500 ft) and `FLxxx` flight level codes (e.g. `FL180`
 * = 18000 ft).
 */
function parseAltitudeFt(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (trimmed.startsWith('FL')) {
    const flight = Number.parseInt(trimmed.substring(2), 10);
    if (Number.isNaN(flight)) {
      return undefined;
    }
    return flight * 100;
  }
  const value = Number.parseInt(trimmed, 10);
  if (Number.isNaN(value)) {
    return undefined;
  }
  return value;
}

/**
 * Parses a leg altitude constraint from its descriptor character and
 * the two 5-character altitude slices.
 */
function parseAltitudeConstraint(
  descriptorRaw: string,
  primaryRaw: string,
  secondaryRaw: string,
): AltitudeConstraint | undefined {
  const descriptor = descriptorRaw;
  if (descriptor === ' ' || descriptor === '') {
    return undefined;
  }
  if (!VALID_ALTITUDE_DESCRIPTORS.has(descriptor as AltitudeConstraintDescriptor)) {
    return undefined;
  }
  const primaryFt = parseAltitudeFt(primaryRaw);
  if (primaryFt === undefined) {
    return undefined;
  }
  const constraint: AltitudeConstraint = {
    descriptor: descriptor as AltitudeConstraintDescriptor,
    primaryFt,
  };
  const secondaryFt = parseAltitudeFt(secondaryRaw);
  if (secondaryFt !== undefined) {
    constraint.secondaryFt = secondaryFt;
  }
  return constraint;
}

/**
 * Parses a leg speed constraint from the 3-character speed slice and
 * the 1-character descriptor character. An empty speed slice produces
 * `undefined`. The descriptor is taken from ARINC 424 field 5.261; a
 * blank descriptor defaults to `-` (at or below, the most common
 * published restriction).
 */
function parseSpeedConstraint(
  speedRaw: string,
  descriptorRaw: string,
): SpeedConstraint | undefined {
  const speedTrim = speedRaw.trim();
  if (speedTrim.length === 0) {
    return undefined;
  }
  const speedKt = Number.parseInt(speedTrim, 10);
  if (Number.isNaN(speedKt) || speedKt === 0) {
    return undefined;
  }
  const rawDescriptor = descriptorRaw === ' ' || descriptorRaw === '' ? '-' : descriptorRaw;
  if (!VALID_SPEED_DESCRIPTORS.has(rawDescriptor as SpeedConstraintDescriptor)) {
    return undefined;
  }
  return {
    descriptor: rawDescriptor as SpeedConstraintDescriptor,
    speedKt,
  };
}
