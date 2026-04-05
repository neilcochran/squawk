/**
 * A geographic position specified by latitude and longitude in decimal degrees.
 */
export interface Coordinates {
  /** Latitude in decimal degrees. Positive values are north, negative values are south. */
  lat: number;
  /** Longitude in decimal degrees. Positive values are east, negative values are west. */
  lon: number;
}

/**
 * Geographic position with optional altitude data, used by flight tracking
 * and airspace calculations. Extends {@link Coordinates} with barometric
 * and geometric altitude fields.
 */
export interface Position extends Coordinates {
  /** Barometric altitude in feet (MSL). */
  baroAltitudeFt?: number;
  /** Geometric altitude in feet (geoid). */
  geoAltitudeFt?: number;
}
