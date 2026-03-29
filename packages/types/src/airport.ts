/**
 * Airport reference data with identifiers and location.
 */
export interface Airport {
  /** ICAO airport code (e.g. "KJFK"). */
  icao: string;
  /** IATA airport code when available (e.g. "JFK"). */
  iata?: string;
  /** Official airport name. */
  name: string;
  /** City where the airport is located. */
  city: string;
  /** Latitude in decimal degrees. */
  lat: number;
  /** Longitude in decimal degrees. */
  lon: number;
  /** Field elevation in feet MSL. */
  elevationFt?: number;
}
