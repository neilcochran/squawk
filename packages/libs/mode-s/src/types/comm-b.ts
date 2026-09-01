/**
 * Decoded BDS 4,0 (Selected Vertical Intention) - the pilot's MCP/FCU and
 * FMS selected altitude targets, barometric pressure setting, and MCP mode
 * flags, per ICAO Doc 9871 Table A-2-31.
 */
export interface SelectedVerticalIntention {
  /** Discriminant tag identifying this as a decoded BDS 4,0 register. */
  bdsCode: '4,0';
  /** MCP/FCU selected altitude target, in feet. Undefined if not available. */
  mcpFcuSelectedAltitudeFt: number | undefined;
  /** FMS selected altitude target, in feet. Undefined if not available. */
  fmsSelectedAltitudeFt: number | undefined;
  /** Barometric pressure (altimeter) setting, in millibars/hectopascals. Undefined if not available. */
  baroPressureSettingMb: number | undefined;
  /** Whether VNAV mode is active. Undefined when the MCP mode bits are not reported (populated or omitted together with `altitudeHoldModeActive`/`approachModeActive`). */
  vnavModeActive: boolean | undefined;
  /** Whether altitude-hold mode is active. Undefined when the MCP mode bits are not reported. */
  altitudeHoldModeActive: boolean | undefined;
  /** Whether approach mode is active. Undefined when the MCP mode bits are not reported. */
  approachModeActive: boolean | undefined;
  /** Which altitude target the aircraft is currently flying toward. Undefined if not reported. */
  targetAltitudeSource: 'unknown' | 'aircraftAltitude' | 'mcpFcu' | 'fms' | undefined;
}

/**
 * Decoded BDS 5,0 (Track and Turn Report) - a flight-management-system
 * snapshot of roll, track, groundspeed, turn rate, and true airspeed, per
 * ICAO Doc 9871 Table A-2-34.
 */
export interface TrackAndTurnReport {
  /** Discriminant tag identifying this as a decoded BDS 5,0 register. */
  bdsCode: '5,0';
  /** Roll angle in degrees, positive for a right turn. Undefined if not available. */
  rollAngleDeg: number | undefined;
  /** True track angle in degrees. Undefined if not available. */
  trueTrackDeg: number | undefined;
  /** Ground speed in knots. Undefined if not available. */
  groundSpeedKt: number | undefined;
  /** Rate of change of track angle, in degrees per second (positive turning right). Undefined if not available. */
  trackAngleRateDegPerSec: number | undefined;
  /** True airspeed in knots. Undefined if not available. */
  trueAirspeedKt: number | undefined;
}

/**
 * Decoded BDS 6,0 (Heading and Speed Report) - an air-data-computer
 * snapshot of magnetic heading, indicated airspeed, Mach number, and
 * vertical rates, per ICAO Doc 9871 Table A-2-35.
 */
export interface HeadingAndSpeedReport {
  /** Discriminant tag identifying this as a decoded BDS 6,0 register. */
  bdsCode: '6,0';
  /** Magnetic heading in degrees. Undefined if not available. */
  magneticHeadingDeg: number | undefined;
  /** Indicated airspeed in knots. Undefined if not available. */
  indicatedAirspeedKt: number | undefined;
  /** Mach number. Undefined if not available. */
  mach: number | undefined;
  /** Barometric vertical rate in feet per minute, positive for climbing. Undefined if not available. */
  baroVerticalRateFtPerMin: number | undefined;
  /** Inertial vertical rate in feet per minute, positive for climbing. Undefined if not available. */
  inertialVerticalRateFtPerMin: number | undefined;
}

/**
 * A decoded Comm-B "Enhanced Surveillance" register - the ones DF20/21
 * carry with no self-declared register identifier, so a caller cannot know
 * in advance which of these three an MB field holds. Discriminated by
 * `bdsCode`.
 */
export type CommBRegister = SelectedVerticalIntention | TrackAndTurnReport | HeadingAndSpeedReport;
