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

export interface AircraftRegistration {
  icaoHex: string;
  registration: string;
  make?: string;
  model?: string;
  operator?: string;
  aircraftType?: AircraftType;
  engineType?: EngineType;
  yearManufactured?: number;
  dataSource: 'faa' | 'bundled' | 'custom';
  datasetDate?: string;
}

export interface CustomRegistrySource {
  type: 'custom';
  data: AircraftRegistration[];
}

export type RegistrySource = { type: 'faa' } | { type: 'bundled' } | CustomRegistrySource;
