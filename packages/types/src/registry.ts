/**
 * High-level categorization of aircraft types for registry lookups.
 */
export type AircraftType =
  | 'glider'
  | 'balloon'
  | 'blimpOrDirigible'
  | 'fixedWingSingleEngine'
  | 'fixedWingMultiEngine'
  | 'rotorcraft'
  | 'weightShiftControl'
  | 'poweredParachute'
  | 'gyroplane'
  | 'hybridLift';

/**
 * Primary engine type classification used in FAA registration data.
 */
export type EngineType =
  | 'none'
  | 'reciprocating'
  | 'turboProp'
  | 'turboShaft'
  | 'turboJet'
  | 'turboFan'
  | 'ramjet'
  | 'twoCycle'
  | 'fourCycle'
  | 'unknown'
  | 'electric'
  | 'rotary';

/**
 * Aircraft registration record, including identification and manufacturer metadata.
 */
export interface AircraftRegistration {
  /** 24-bit ICAO address. */
  icaoHex: string;
  /** N-number or equivalent registration string. */
  registration: string;
  /** Manufacturer name. */
  make?: string;
  /** Model name. */
  model?: string;
  /** Operator name / company. */
  operator?: string;
  /** Aircraft usage category. */
  aircraftType?: AircraftType;
  /** Engine classification. */
  engineType?: EngineType;
  /** Year of manufacture. */
  yearManufactured?: number;
}
