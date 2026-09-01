/**
 * Decoded ADS-B Aircraft Operational Status (BDS 6,5, type code 31) -
 * capability/operational mode codes, ADS-B version, and navigation
 * integrity/accuracy fields, per RTCA DO-260B section 2.2.3.2.7.2.
 */
export interface AircraftOperationalStatus {
  /** Whether this report describes a surface (on-ground) aircraft, from the 3-bit subtype field (1 = surface; only 0 and 1 are defined, so anything else reports as `false`). */
  surface: boolean;
  /** The ADS-B version this message was encoded to (0, 1, or 2 in practice). Gates whether `nicBaro`/`silSupplementPerHour` are populated, and how `capabilityClassCode`/`operationalModeCode` should be interpreted. */
  adsbVersion: number;
  /** Raw 16-bit Capability Class Code field. Its sub-field breakdown depends on both `surface` and `adsbVersion`; not decoded further by this package - see RTCA DO-260B section 2.2.3.2.7.2.1 (or DO-260/DO-260A for earlier versions). */
  capabilityClassCode: number;
  /** Raw 16-bit Operational Mode Code field. Its sub-field breakdown depends on both `surface` and `adsbVersion`; not decoded further by this package - see RTCA DO-260B section 2.2.3.2.7.2.2 (or DO-260/DO-260A for earlier versions). */
  operationalModeCode: number;
  /** Navigation Integrity Category Supplement-A. */
  nicSupplementA: boolean;
  /** Navigation Accuracy Category for Position, 0-15 (higher is more accurate). */
  navAccuracyCategoryPosition: number;
  /** Source Integrity Level, 0-3 (higher is more reliable). */
  sourceIntegrityLevel: number;
  /** Whether the reported altitude source meets the Navigation Integrity Category barometric requirement. Only populated for an airborne report on ADS-B version 1 or 2 - undefined otherwise (version 0 has no defined meaning for this bit, and surface reports do not carry it). */
  nicBaro: boolean | undefined;
  /** Heading/track reference direction. */
  headingReference: 'true' | 'magnetic';
  /** Whether the Source Integrity Level is based on a per-hour probability (true) rather than a per-sample probability (false). Only populated on ADS-B version 2 - undefined otherwise. */
  silSupplementPerHour: boolean | undefined;
}
