import type { Airport } from './airport.js';
import type { Position } from './position.js';

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

export interface Aircraft {
  icaoHex: string;
  callsign?: string;
  position?: Position;
  groundSpeedKts?: number;
  iasKts?: number;
  tasKts?: number;
  trackDeg?: number;
  magneticHeadingDeg?: number;
  verticalRateFpm?: number;
  squawk?: string;
  onGround?: boolean;
  category?: AircraftCategory;
  origin?: Airport;
  destination?: Airport;
  lastSeenAt: number;
}
