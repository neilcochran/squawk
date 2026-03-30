import type { Airport } from './airport.js';
import type { AircraftRegistration } from './index.js';
import type { Position } from './position.js';

/**
 * ICAO/FAA aircraft category codes mapped to human-readable labels.
 *
 * The letter prefix indicates the broad grouping:
 * - `A` - airborne powered aircraft
 * - `B` - airborne unpowered or special-category aircraft
 * - `C` - surface vehicles and fixed obstacles
 */
export const AircraftCategory = {
  A0: 'unknown',
  A1: 'light',
  A2: 'small',
  A3: 'large',
  A4: 'highVortexLarge',
  A5: 'heavy',
  A6: 'highPerformance',
  A7: 'rotorcraft',
  B1: 'glider',
  B2: 'lighterThanAir',
  B3: 'parachutist',
  B4: 'ultralight',
  B6: 'uav',
  B7: 'spaceVehicle',
  C1: 'surfaceEmergencyVehicle',
  C2: 'surfaceServiceVehicle',
  C3: 'pointObstacle',
  C4: 'clusterObstacle',
  C5: 'lineObstacle',
} as const;

export type AircraftCategory = (typeof AircraftCategory)[keyof typeof AircraftCategory];

/**
 * Normalized flight state object for ADS-B/Mode-S tracking, used across packages.
 */
export interface Aircraft {
  /** 24-bit ICAO hexadecimal address (e.g. "A0B1C2"). */
  icaoHex: string;
  /** Current callsign, as available from the source (e.g. "UAL123"). */
  callsign?: string;
  /** Resolved aircraft registration details (N-number, make/model, etc.). */
  registration?: AircraftRegistration;
  /** Current geospatial position. */
  position?: Position;
  /** Ground speed in knots. */
  groundSpeedKts?: number;
  /** Indicated airspeed in knots. */
  iasKts?: number;
  /** True airspeed in knots. */
  tasKts?: number;
  /** Track over ground in degrees true. */
  trackDeg?: number;
  /** Magnetic heading in degrees. */
  magneticHeadingDeg?: number;
  /** Vertical rate in feet per minute. */
  verticalRateFpm?: number;
  /** Squawk transponder code. */
  squawk?: string;
  /** True if aircraft is on the ground. */
  onGround?: boolean;
  /** Aircraft category code for performance/weight class. */
  category?: AircraftCategory;
  /** Origin airport information. */
  origin?: Airport;
  /** Destination airport information. */
  destination?: Airport;
  /** Unix epoch ms last seen timestamp. */
  lastSeenAt: number;
}
