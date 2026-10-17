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
  | 'hybridLift'
  | 'other';

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
 * Status of an aircraft registration, as the FAA aircraft registry publishes it.
 *
 * Each value is one status of the registry's `STATUS CODE` column. The FAA
 * describes three as valid registrations: `valid`, `validManufacturerDealer`
 * and `validTrainee`. Every other value is a registration that is pending,
 * was never completed, has lapsed, or has been revoked or canceled.
 *
 * - `valid` - valid registration (code `V`).
 * - `validManufacturerDealer` - valid; the aircraft is assigned to its
 *   manufacturer under the manufacturer's dealer certificate (`M`).
 * - `validTrainee` - valid registration from a trainee (`T`).
 * - `registrationPending` - registration pending (`R`).
 * - `registrationPendingPendingCancellation` - registration pending, and
 *   pending cancellation (`19`).
 * - `registrationPendingCanceled` - registration pending, canceled (`20`).
 * - `assignedNotRegistered` - the N-number is assigned but the aircraft has
 *   not yet been registered (`2`).
 * - `assignedNotRegisteredNonTypeCertificated` - assigned to an aircraft
 *   without a type certificate, such as an amateur-built one, and not yet
 *   registered (`3`).
 * - `assignedNotRegisteredImport` - assigned to an import and not yet
 *   registered (`4`).
 * - `assignedNotRegisteredPendingCancellation` - assigned, never registered,
 *   and pending cancellation (`10`).
 * - `assignedNotRegisteredNonTypeCertificatedPendingCancellation` - assigned
 *   to an aircraft without a type certificate, never registered, and pending
 *   cancellation (`11`).
 * - `assignedNotRegisteredImportPendingCancellation` - assigned to an import,
 *   never registered, and pending cancellation (`12`).
 * - `reserved` - reserved N-number (`5`).
 * - `permanentReserved` - permanently reserved (`Z`).
 * - `saleReported` - a sale of the aircraft has been reported (`7`).
 * - `saleReportedPendingCancellation` - sale reported, pending cancellation
 *   (`17`).
 * - `saleReportedCanceled` - sale reported, canceled (`18`).
 * - `nonCitizenFlightHoursNotReported` - registered to a non-citizen
 *   corporation that has not returned its flight hour reports (`N`).
 * - `triennialFormMailed` - the triennial registration form was mailed and
 *   has not been returned by the post office (`A`).
 * - `triennialSecondFormMailed` - a second triennial form was mailed and has
 *   not been returned by the post office (`S`).
 * - `triennialFormUndeliverable` - the triennial form was returned by the
 *   post office as undeliverable (`1`).
 * - `triennialNoResponse` - a second attempt to mail the triennial form drew
 *   no response (`8`).
 * - `renewalFirstNotice` - first notice for re-registration or renewal (`14`,
 *   `25`).
 * - `renewalSecondNotice` - second notice for re-registration or renewal
 *   (`15`, `26`).
 * - `renewalThirdNotice` - third notice for re-registration or renewal (`24`,
 *   `28`).
 * - `expired` - registration expired (`13`, `27`).
 * - `expiredPendingCancellation` - registration expired, pending cancellation
 *   (`16`, `29`).
 * - `expiredDealer` - expired dealer certificate (`D`).
 * - `expiredDealerPendingCancellation` - expired dealer certificate, pending
 *   cancellation (`23`).
 * - `administrativelyCanceled` - administratively canceled (`6`).
 * - `ineffectiveOrInvalid` - the certificate of registration has been deemed
 *   ineffective or invalid (`W`).
 * - `enforcementLetter` - enforcement letter (`X`).
 * - `revoked` - the certificate of registration has been revoked (`9`).
 * - `revokedByEnforcement` - the certificate of registration was revoked by
 *   enforcement action (`E`).
 * - `revokedPendingCancellation` - revoked, pending cancellation (`21`).
 * - `revokedCanceled` - revoked, canceled (`22`).
 */
export type RegistrationStatus =
  | 'valid'
  | 'validManufacturerDealer'
  | 'validTrainee'
  | 'registrationPending'
  | 'registrationPendingPendingCancellation'
  | 'registrationPendingCanceled'
  | 'assignedNotRegistered'
  | 'assignedNotRegisteredNonTypeCertificated'
  | 'assignedNotRegisteredImport'
  | 'assignedNotRegisteredPendingCancellation'
  | 'assignedNotRegisteredNonTypeCertificatedPendingCancellation'
  | 'assignedNotRegisteredImportPendingCancellation'
  | 'reserved'
  | 'permanentReserved'
  | 'saleReported'
  | 'saleReportedPendingCancellation'
  | 'saleReportedCanceled'
  | 'nonCitizenFlightHoursNotReported'
  | 'triennialFormMailed'
  | 'triennialSecondFormMailed'
  | 'triennialFormUndeliverable'
  | 'triennialNoResponse'
  | 'renewalFirstNotice'
  | 'renewalSecondNotice'
  | 'renewalThirdNotice'
  | 'expired'
  | 'expiredPendingCancellation'
  | 'expiredDealer'
  | 'expiredDealerPendingCancellation'
  | 'administrativelyCanceled'
  | 'ineffectiveOrInvalid'
  | 'enforcementLetter'
  | 'revoked'
  | 'revokedByEnforcement'
  | 'revokedPendingCancellation'
  | 'revokedCanceled';

/**
 * Aircraft registration record, including identification and manufacturer metadata.
 */
export interface AircraftRegistration {
  /** 24-bit ICAO address. */
  icaoHex: string;
  /** N-number or equivalent registration string. */
  registration: string;
  /**
   * Status of the registration. A record is not necessarily a current, valid
   * registration: the FAA registry also lists pending, expired, sale-reported
   * and revoked registrations, and this field tells them apart. Absent when
   * the source publishes no status or one this type does not know.
   */
  registrationStatus?: RegistrationStatus;
  /**
   * Date the registration expires, as an ISO 8601 calendar date
   * (`YYYY-MM-DD`). Absent when the source publishes none, which the FAA
   * registry does for most registrations that are not valid.
   */
  registrationExpirationDate?: string;
  /** Manufacturer name. Present on every bundled record. */
  make?: string;
  /** Model name. Present on every bundled record. */
  model?: string;
  /**
   * Operator name / company. Absent when the registry lists no registrant,
   * including the pending and sale-reported registrations where the FAA
   * publishes a placeholder instead of a name.
   */
  operator?: string;
  /** Aircraft usage category. */
  aircraftType?: AircraftType;
  /** Engine classification. Present on every bundled record. */
  engineType?: EngineType;
  /** Year of manufacture. Absent when the registry publishes none. */
  yearManufactured?: number;
}
