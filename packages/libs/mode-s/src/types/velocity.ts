/** Fields common to both airborne velocity subtypes (ADS-B BDS 0,9). */
export interface AirborneVelocityCommon {
  /** Vertical rate in feet per minute, positive for climbing. Undefined if not available. */
  verticalRateFtPerMin: number | undefined;
  /** Source of the vertical rate measurement. */
  verticalRateSource: 'gnss' | 'barometric';
  /** Geometric altitude minus barometric altitude, in feet. Undefined if not available. */
  geoMinusBaroAltitudeFt: number | undefined;
}

/** Airborne velocity decoded from a ground-speed subtype (1 or 2) message. */
export interface GroundSpeedVelocity extends AirborneVelocityCommon {
  subtype: 'groundSpeed';
  /** Ground speed in knots. Undefined if not available. */
  groundSpeedKt: number | undefined;
  /** Track over ground in degrees true. Undefined if not available. */
  trueTrackDeg: number | undefined;
}

/** Airborne velocity decoded from an airspeed subtype (3 or 4) message. */
export interface AirSpeedVelocity extends AirborneVelocityCommon {
  subtype: 'airSpeed';
  /** Indicated airspeed in knots. Undefined if not available or the message reports true airspeed instead. */
  indicatedAirspeedKt: number | undefined;
  /** True airspeed in knots. Undefined if not available or the message reports indicated airspeed instead. */
  trueAirspeedKt: number | undefined;
  /** Magnetic heading in degrees. Undefined if not available. */
  magneticHeadingDeg: number | undefined;
}

/**
 * Decoded ADS-B airborne velocity (BDS 0,9, type code 19). Ground-speed
 * subtypes report true track; airspeed subtypes report magnetic heading -
 * airspeed messages are transmitted when the aircraft lacks a good
 * GPS-derived track and falls back to its compass heading instead.
 */
export type AirborneVelocity = GroundSpeedVelocity | AirSpeedVelocity;
