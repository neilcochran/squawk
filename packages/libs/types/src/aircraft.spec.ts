import { describe, expect, it } from 'vitest';

import { AircraftCategory } from './aircraft.js';

describe('AircraftCategory', () => {
  it('maps every documented ICAO/FAA code to a label', () => {
    const expected: Record<string, string> = {
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
    };
    expect({ ...AircraftCategory }).toEqual(expected);
  });
});
