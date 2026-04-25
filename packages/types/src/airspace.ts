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
 *
 * CLASS_B, CLASS_C, CLASS_D, and CLASS_E variants are controlled airspace.
 * Class E subtypes follow FAA NASR LOCAL_TYPE designations:
 * - CLASS_E2: Surface area (SFC floor) around airports without an operating control tower
 * - CLASS_E3: Airspace extending to SFC for instrument approach procedures
 * - CLASS_E4: Transition area with a 1,200 ft AGL floor
 * - CLASS_E5: Surface area with a 700 ft AGL floor (most common)
 * - CLASS_E6: Transition area (miscellaneous)
 * - CLASS_E7: Federal airway extensions
 *
 * MOA, RESTRICTED, PROHIBITED, WARNING, ALERT, and NSA are Special Use
 * Airspace (SUA) types.
 *
 * ARTCC features represent the lateral boundary of an Air Route Traffic
 * Control Center stratum (e.g. ZNY HIGH, ZBW LOW, ZAK FIR). One ARTCC is
 * typically published as multiple features - one per altitude tier or
 * boundary type - because the lateral extent can vary between strata. See
 * {@link ArtccStratum} for the stratum identifier carried on each feature.
 */
export type AirspaceType =
  | 'CLASS_B'
  | 'CLASS_C'
  | 'CLASS_D'
  | 'CLASS_E2'
  | 'CLASS_E3'
  | 'CLASS_E4'
  | 'CLASS_E5'
  | 'CLASS_E6'
  | 'CLASS_E7'
  | 'MOA'
  | 'RESTRICTED'
  | 'PROHIBITED'
  | 'WARNING'
  | 'ALERT'
  | 'NSA'
  | 'ARTCC';

/**
 * The boundary stratum of an ARTCC feature, derived from NASR ARB_SEG
 * `ALTITUDE` and `TYPE` columns.
 *
 * Each ARTCC publishes its boundary geometry separately for each stratum,
 * because the lateral extent varies with altitude tier and oceanic boundary
 * type. The values here are the union of distinct stratum kinds observed
 * across all US centers:
 *
 * - `LOW` - domestic low-altitude stratum (typically SFC to FL180)
 * - `HIGH` - domestic high-altitude stratum (typically FL180 to FL600)
 * - `UTA` - Upper Control Area, used only by ZOA (typically FL600 and above)
 * - `CTA` - oceanic Control Area
 * - `FIR` - oceanic Flight Information Region
 * - `CTA/FIR` - combined oceanic CTA and FIR boundary
 *
 * Set to `null` for non-ARTCC features.
 */
export type ArtccStratum = 'LOW' | 'HIGH' | 'UTA' | 'CTA' | 'FIR' | 'CTA/FIR';

/**
 * A single airspace designation feature derived from FAA NASR data.
 *
 * Each feature represents one lateral polygon with associated vertical bounds and
 * metadata. A single real-world airspace can produce multiple features:
 *
 * - Class B airspace is stored as multiple separate features (one per
 *   concentric ring), each with its own polygon and floor/ceiling.
 * - ARTCC centers are stored as multiple features (one per stratum: LOW,
 *   HIGH, plus oceanic UTA/CTA/FIR strata), and a single stratum can map
 *   to multiple sub-polygons when the source data has disjoint shapes
 *   (e.g. ZOA UTA) or when an antimeridian-crossing oceanic boundary has
 *   been split at lon=180 (e.g. ZAK FIR).
 *
 * Consumers that need to treat the full structure as a unit can group
 * features by `identifier` (and optionally `artccStratum` for ARTCC).
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
   * Identifier for this feature. The semantics depend on `type`:
   *
   * - Class B/C/D/E2: associated airport's FAA location identifier (e.g.
   *   "DCA", "JFK"). ICAO-prefixed codes such as "KDCA" do not appear here.
   * - Special Use Airspace: official NASR designator (e.g. "R-2303A").
   * - ARTCC: three-letter center code (e.g. "ZNY", "ZBW").
   * - Other Class E subtypes: NASR designator from the source data.
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
   * For ARTCC features this is the state of the center's headquarters
   * facility (e.g. "NY" for ZNY). Null if not available in the source data.
   */
  state: string | null;
  /**
   * The controlling facility or agency. For Class B/C/D this is the TRACON
   * or ARTCC identifier (e.g. "PCT"). For SUA this is the controlling
   * military or civil authority name. Always null for ARTCC features.
   * Null if not available in the source data.
   */
  controllingFacility: string | null;
  /**
   * Operating schedule for part-time airspace, as provided verbatim in NASR
   * source data (e.g. "MON-FRI 0700-2200 LOCAL, OTHER TIMES BY NOTAM").
   * Null for always-active airspace or when schedule data is unavailable.
   */
  scheduleDescription: string | null;
  /**
   * For ARTCC features, the boundary stratum that distinguishes this feature
   * from sibling features within the same center (e.g. the same ZNY ARTCC has
   * separate `LOW` and `HIGH` features with potentially different polygons).
   * Null for all non-ARTCC airspace types.
   */
  artccStratum: ArtccStratum | null;
}
