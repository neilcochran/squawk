import type { Polygon } from 'geojson';

/**
 * The reference datum for a vertical altitude bound sourced from FAA NASR data.
 *
 * - `MSL` - feet above mean sea level; comparable directly to aircraft altitude
 * - `AGL` - feet above ground level; requires terrain elevation to convert to MSL
 * - `SFC` - surface/ground level; treated as 0 ft MSL for query purposes
 */
export type AltitudeReference = 'MSL' | 'AGL' | 'SFC';

/**
 * A vertical altitude bound with its reference datum.
 * Used to represent airspace floor and ceiling values as sourced from FAA NASR data
 * without silently converting AGL values that would require terrain elevation data.
 */
export interface AltitudeBound {
  /** Altitude value in feet. For SFC reference this is 0. */
  valueFt: number;
  /** Reference datum that determines how valueFt should be interpreted. */
  reference: AltitudeReference;
}

/**
 * The type or class designation of an airspace feature.
 * CLASS_B, CLASS_C, and CLASS_D are controlled airspace.
 * All remaining values are Special Use Airspace (SUA) types.
 */
export type AirspaceType =
  | 'CLASS_B'
  | 'CLASS_C'
  | 'CLASS_D'
  | 'MOA'
  | 'RESTRICTED'
  | 'PROHIBITED'
  | 'WARNING'
  | 'ALERT';

/**
 * A single airspace designation feature derived from FAA NASR data.
 *
 * Each feature represents one lateral polygon with associated vertical bounds and
 * metadata. Class B airspace is stored as multiple separate features (one per
 * concentric ring), each with its own polygon and floor/ceiling. Consumers that
 * need to treat the full Class B structure as a unit can group features by name
 * or identifier.
 *
 * Vertical bounds whose reference is AGL cannot be precisely compared to an
 * aircraft MSL altitude without terrain elevation data. The @squawk/airspace
 * resolver handles AGL bounds conservatively - see that package for details.
 */
export interface AirspaceFeature {
  /** The type or class designation of this airspace feature. */
  type: AirspaceType;
  /** Human-readable name of the airspace (e.g. "WASHINGTON", "DEMO 1 MOA"). */
  name: string;
  /**
   * Unique NASR designator for this feature. For SUA this is the official
   * designator (e.g. "R-2303A"). For Class B/C/D this is the associated
   * airport ICAO identifier (e.g. "KDCA").
   */
  identifier: string;
  /** Lower vertical bound of this feature. */
  floor: AltitudeBound;
  /** Upper vertical bound of this feature. */
  ceiling: AltitudeBound;
  /** Lateral boundary polygon in WGS84 coordinates. */
  boundary: Polygon;
  /**
   * Two-letter US state or territory abbreviation associated with this
   * airspace feature. For Class B/C/D this is the state of the associated
   * airport, not a guarantee that all geometry falls within that state -
   * outer Class B rings in particular commonly extend into adjacent states.
   * For SUA this is the administrative area recorded in the NASR source data.
   * Null if not available in the source data.
   */
  state: string | null;
  /**
   * The controlling facility or agency. For Class B/C/D this is the TRACON
   * or ARTCC identifier (e.g. "PCT"). For SUA this is the controlling
   * military or civil authority name. Null if not available in the source data.
   */
  controllingFacility: string | null;
  /**
   * Operating schedule for part-time airspace, as provided verbatim in NASR
   * source data (e.g. "MON-FRI 0700-2200 LOCAL, OTHER TIMES BY NOTAM").
   * Null for always-active airspace or when schedule data is unavailable.
   */
  scheduleDescription: string | null;
}
