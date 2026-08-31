import type { AircraftCategory } from '@squawk/types';

/** Decoded ADS-B aircraft identification (BDS 0,8, type codes 1-4). */
export interface AircraftIdentification {
  /** Callsign, trimmed of leading/trailing whitespace. Undefined if the field is entirely blank. Invalid 6-bit characters decode to '#' and remain in the string rather than being silently dropped. */
  callsign: string | undefined;
  /** Wake vortex / performance category, if the type code and category subfield map to one of squawk's known category codes. Undefined for "no category information" or a reserved combination. */
  category: AircraftCategory | undefined;
}
