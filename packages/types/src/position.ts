/**
 * Geographic position used by flight tracking and airspace calculations.
 */
export interface Position {
  /** Latitude in decimal degrees, positive north. */
  lat: number;
  /** Longitude in decimal degrees, positive east. */
  lon: number;
  /** Barometric altitude in feet (MSL). */
  baroAltitudeFt?: number;
  /** Geometric altitude in feet (geoid). */
  geoAltitudeFt?: number;
}
