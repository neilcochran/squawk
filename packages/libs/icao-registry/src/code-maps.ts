import type { AircraftType, EngineType, RegistrationStatus } from '@squawk/types';

/**
 * Maps FAA TYPE AIRCRAFT codes from MASTER.txt to AircraftType values.
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
  O: 'other',
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

/**
 * Maps FAA STATUS CODE values from MASTER.txt to RegistrationStatus values.
 * The FAA publishes two codes each for an expired registration, an expired
 * registration pending cancellation, and the first, second and third renewal
 * notices; each pair maps to one value.
 *
 * Source: FAA ReleasableAircraft ardata.pdf field specification.
 */
export const REGISTRATION_STATUS_MAP: Record<string, RegistrationStatus> = {
  A: 'triennialFormMailed',
  D: 'expiredDealer',
  E: 'revokedByEnforcement',
  M: 'validManufacturerDealer',
  N: 'nonCitizenFlightHoursNotReported',
  R: 'registrationPending',
  S: 'triennialSecondFormMailed',
  T: 'validTrainee',
  V: 'valid',
  W: 'ineffectiveOrInvalid',
  X: 'enforcementLetter',
  Z: 'permanentReserved',
  '1': 'triennialFormUndeliverable',
  '2': 'assignedNotRegistered',
  '3': 'assignedNotRegisteredNonTypeCertificated',
  '4': 'assignedNotRegisteredImport',
  '5': 'reserved',
  '6': 'administrativelyCanceled',
  '7': 'saleReported',
  '8': 'triennialNoResponse',
  '9': 'revoked',
  '10': 'assignedNotRegisteredPendingCancellation',
  '11': 'assignedNotRegisteredNonTypeCertificatedPendingCancellation',
  '12': 'assignedNotRegisteredImportPendingCancellation',
  '13': 'expired',
  '14': 'renewalFirstNotice',
  '15': 'renewalSecondNotice',
  '16': 'expiredPendingCancellation',
  '17': 'saleReportedPendingCancellation',
  '18': 'saleReportedCanceled',
  '19': 'registrationPendingPendingCancellation',
  '20': 'registrationPendingCanceled',
  '21': 'revokedPendingCancellation',
  '22': 'revokedCanceled',
  '23': 'expiredDealerPendingCancellation',
  '24': 'renewalThirdNotice',
  '25': 'renewalFirstNotice',
  '26': 'renewalSecondNotice',
  '27': 'expired',
  '28': 'renewalThirdNotice',
  '29': 'expiredPendingCancellation',
};

/**
 * Registrant names the FAA publishes in place of a name when a registration
 * has no current registrant on record. They name no operator.
 */
export const PLACEHOLDER_REGISTRANT_NAMES: ReadonlySet<string> = new Set([
  'REGISTRATION PENDING',
  'SALE REPORTED',
]);
