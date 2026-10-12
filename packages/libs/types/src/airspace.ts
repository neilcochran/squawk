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
 *
 * A ceiling of `{ valueFt: 99999, reference: 'MSL' }` is a sentinel for an upper
 * limit the FAA leaves undefined or unlimited: the upper ARTCC strata, some
 * restricted and warning areas, and Class E areas outside Class A. See
 * {@link AirspaceType} for how Class E ceilings beneath Class A are resolved.
 * One published ceiling sits above the sentinel: R-2535B San Nicolas Island
 * is designated from the surface to 100,000 ft MSL and carries that value.
 */
export interface AltitudeBound {
  /** Altitude value in feet. For SFC reference this is 0. */
  valueFt: number;
  /** Reference datum that determines how valueFt should be interpreted. */
  reference: AltitudeReference;
  /**
   * `false` when the bound excludes its own value, as in a MOA designated
   * "to but not including FL 180" or an area "excluding the airspace below
   * 5,500 ft". Absent or `true` means the value is included. The FAA
   * publishes the distinction for Special Use Airspace volumes, and the data
   * build uses it for the Class E ceiling beneath Class A, which ends where
   * Class A begins.
   */
  inclusive?: boolean;
}

/**
 * A block of airspace: a lateral polygon between a floor and a ceiling.
 * Used for the volumes an {@link AirspaceFeature} excludes.
 */
export interface AirspaceVolume {
  /** Lower vertical bound of the volume. */
  floor: AltitudeBound;
  /** Upper vertical bound of the volume. */
  ceiling: AltitudeBound;
  /** Lateral boundary polygon in WGS84 coordinates. */
  boundary: Polygon;
}

/**
 * The type or class designation of an airspace feature.
 *
 * CLASS_A, CLASS_B, CLASS_C, CLASS_D, and CLASS_E variants are controlled
 * airspace. CLASS_A is not published by the FAA as geometry: it is derived
 * by the data build from the HIGH stratum of each domestic ARTCC (plus San
 * Juan's single stratum), carrying the 18,000 ft MSL to FL600 block that
 * 14 CFR 71.33 designates, so one Class A feature exists per stratum shape.
 * Class E subtypes follow FAA NASR LOCAL_TYPE designations:
 * - CLASS_E2: Surface area (SFC floor) around airports without an operating control tower
 * - CLASS_E3: Airspace extending to SFC for instrument approach procedures
 * - CLASS_E4: Transition area with a 1,200 ft AGL floor
 * - CLASS_E5: Surface area with a 700 ft AGL floor (most common)
 * - CLASS_E6: Transition area (miscellaneous)
 * - CLASS_E7: Federal airway extensions
 *
 * The FAA publishes no upper limit for most Class E areas, because 14 CFR
 * 71.71 ends them at the overlying controlled airspace rather than at a
 * number. Where a Class E area lies beneath Class A, the data build resolves
 * that to a ceiling of 18,000 ft MSL marked exclusive (`inclusive: false`),
 * the altitude at which Class A begins; elsewhere (Hawaii, and beyond the
 * lateral extent of Class A) the ceiling stays the 99999 sentinel. A Class E
 * area with a published ceiling, such as a surface area under a Class B
 * shelf, keeps it.
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
  | 'CLASS_A'
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
 * The full set of {@link AirspaceType} values, in declaration order.
 *
 * Use as the single source of truth for value-side iteration (e.g. building a
 * lookup table keyed by airspace type) or with {@link isAirspaceType} to
 * narrow an external string into the union. The `as const satisfies` brand
 * keeps this array in sync with the type at compile time - adding a new
 * union member without updating the array fails the build.
 */
export const AIRSPACE_TYPES = [
  'CLASS_A',
  'CLASS_B',
  'CLASS_C',
  'CLASS_D',
  'CLASS_E2',
  'CLASS_E3',
  'CLASS_E4',
  'CLASS_E5',
  'CLASS_E6',
  'CLASS_E7',
  'MOA',
  'RESTRICTED',
  'PROHIBITED',
  'WARNING',
  'ALERT',
  'NSA',
  'ARTCC',
] as const satisfies readonly AirspaceType[];

const AIRSPACE_TYPE_SET: ReadonlySet<string> = new Set(AIRSPACE_TYPES);

/**
 * Type guard that narrows a string to {@link AirspaceType} when it matches a
 * member of {@link AIRSPACE_TYPES}.
 *
 * Useful when consuming external strings (URL params, config files, MCP tool
 * inputs) that should be validated before being used as an airspace type.
 *
 * @param value - The string to test.
 * @returns `true` if `value` is a valid `AirspaceType`.
 */
export function isAirspaceType(value: string): value is AirspaceType {
  return AIRSPACE_TYPE_SET.has(value);
}

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
 * The full set of {@link ArtccStratum} values, in declaration order.
 *
 * Use as the single source of truth for value-side iteration over ARTCC
 * stratum kinds (e.g. building a lookup table keyed by stratum) or with
 * {@link isArtccStratum} to narrow an external string into the union. The
 * `as const satisfies` brand keeps this array in sync with the type at
 * compile time.
 */
export const ARTCC_STRATA = [
  'LOW',
  'HIGH',
  'UTA',
  'CTA',
  'FIR',
  'CTA/FIR',
] as const satisfies readonly ArtccStratum[];

const ARTCC_STRATUM_SET: ReadonlySet<string> = new Set(ARTCC_STRATA);

/**
 * Type guard that narrows a string to {@link ArtccStratum} when it matches a
 * member of {@link ARTCC_STRATA}.
 *
 * Useful when consuming external strings (URL params, config files, MCP tool
 * inputs) that should be validated before being used as an ARTCC stratum
 * filter.
 *
 * @param value - The string to test.
 * @returns `true` if `value` is a valid `ArtccStratum`.
 */
export function isArtccStratum(value: string): value is ArtccStratum {
  return ARTCC_STRATUM_SET.has(value);
}

/**
 * A single airspace designation feature derived from FAA NASR data.
 *
 * Each feature represents one lateral polygon with associated vertical bounds and
 * metadata. A single real-world airspace can produce multiple features:
 *
 * - Class B airspace is stored as multiple separate features (one per
 *   concentric ring), each with its own polygon and floor/ceiling.
 * - Special Use Airspace published as several volumes (a base area plus
 *   further areas with their own altitude blocks, such as A-682 Travis AFB
 *   or the Birmingham 2 MOA) is stored as one feature per volume.
 * - A Class E area published as several disjoint parts (the Florida Class
 *   E5 area and its Key West part) is stored as one feature per part.
 * - ARTCC centers are stored as multiple features (one per stratum: LOW,
 *   HIGH, plus oceanic UTA/CTA/FIR strata), and a single stratum can map
 *   to multiple sub-polygons when the source data has disjoint shapes
 *   (e.g. ZOA UTA) or when an antimeridian-crossing oceanic boundary has
 *   been split at lon=180 (e.g. ZAK FIR).
 *
 * Consumers that need to treat the full structure as a unit can group
 * features by `identifier` (and optionally `artccStratum` for ARTCC).
 * Polygon rings follow RFC 7946: the exterior ring runs counterclockwise
 * and holes clockwise.
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
   * - Class B/C/D/E2/E3/E4: the associated airport's identifier as NASR
   *   publishes it, normally the FAA location identifier (e.g. "DCA",
   *   "JFK"); a handful of areas carry an ICAO code (e.g. "KRME"). Empty
   *   for the few areas that belong to a Canadian airport whose zone
   *   crosses the border (the Lynden and Sault Ste Marie Class D areas),
   *   which NASR publishes without an identifier.
   * - Class E5/E6/E7: NASR publishes no designator for most of these
   *   areas, so the identifier is usually empty.
   * - Special Use Airspace: official NASR designator (e.g. "R2303A").
   * - ARTCC: three-letter center code (e.g. "ZNY", "ZBW").
   * - Class A: empty; the feature is derived, not published.
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
   * The controlling ARTCC for Special Use Airspace, as the three-letter
   * center code (e.g. "ZKC"), where the source publishes one; most MOAs,
   * restricted areas and warning areas carry it, alert, prohibited and
   * national security areas do not. NASR publishes no controlling facility
   * for Class B/C/D/E areas, so it is null for them, and it is always null
   * for ARTCC and Class A features.
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
  /**
   * Volumes carved out of this feature. Within an exclusion's boundary,
   * between its floor and ceiling, the airspace does not apply: A-211 Dothan
   * excludes the Class D areas of three airports, R-5601F Fort Sill excludes
   * the airspace below 5,500 ft MSL over part of its area. Most exclusions
   * cover only part of the feature's height, so they cannot be expressed as
   * holes in `boundary`. Only Special Use Airspace carries them (the `SUBTR`
   * components of the FAA's SAA data); absent when the feature has none.
   */
  exclusions?: AirspaceVolume[];
}
