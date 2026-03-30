import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AircraftCategory } from './aircraft.js';

describe('AircraftCategory', () => {
  it('should have the correct value for each category code', () => {
    assert.equal(AircraftCategory.A0, 'unknown');
    assert.equal(AircraftCategory.A1, 'light');
    assert.equal(AircraftCategory.A2, 'small');
    assert.equal(AircraftCategory.A3, 'large');
    assert.equal(AircraftCategory.A4, 'highVortexLarge');
    assert.equal(AircraftCategory.A5, 'heavy');
    assert.equal(AircraftCategory.A6, 'highPerformance');
    assert.equal(AircraftCategory.A7, 'rotorcraft');
    assert.equal(AircraftCategory.B1, 'glider');
    assert.equal(AircraftCategory.B2, 'lighterThanAir');
    assert.equal(AircraftCategory.B3, 'parachutist');
    assert.equal(AircraftCategory.B4, 'ultralight');
    assert.equal(AircraftCategory.B6, 'uav');
    assert.equal(AircraftCategory.B7, 'spaceVehicle');
    assert.equal(AircraftCategory.C1, 'surfaceEmergencyVehicle');
    assert.equal(AircraftCategory.C2, 'surfaceServiceVehicle');
    assert.equal(AircraftCategory.C3, 'pointObstacle');
    assert.equal(AircraftCategory.C4, 'clusterObstacle');
    assert.equal(AircraftCategory.C5, 'lineObstacle');
  });
});
