import type { AircraftType, EngineType } from '@squawk/types';

/**
 * Maps FAA TYPE AIRCRAFT numeric codes from MASTER.txt to AircraftType values.
 *
 * Source: FAA ReleasableAircraft ardata.pdf field specification.
 */
export const AIRCRAFT_TYPE_MAP: Record<string, AircraftType> = {
  '1': 'glider',
  '2': 'balloon',
  '3': 'blimpOrDirigible',
  '4': 'fixedWingSingleEngine',
  '5': 'fixedWingMultiEngine',
  '6': 'rotorcraft',
  '7': 'weightShiftControl',
  '8': 'poweredParachute',
  '9': 'gyroplane',
  H: 'hybridLift',
};

/**
 * Maps FAA TYPE ENGINE numeric codes from MASTER.txt to EngineType values.
 *
 * Source: FAA ReleasableAircraft ardata.pdf field specification.
 */
export const ENGINE_TYPE_MAP: Record<string, EngineType> = {
  '0': 'none',
  '1': 'reciprocating',
  '2': 'turboProp',
  '3': 'turboShaft',
  '4': 'turboJet',
  '5': 'turboFan',
  '6': 'ramjet',
  '7': 'twoCycle',
  '8': 'fourCycle',
  '9': 'unknown',
  '10': 'electric',
  '11': 'rotary',
};
