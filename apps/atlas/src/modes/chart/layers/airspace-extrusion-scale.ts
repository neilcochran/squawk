import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';

import type { AirspaceType, AltitudeBound } from '@squawk/types';

import {
  AIRSPACE_CEILING_FT_PROPERTY,
  AIRSPACE_CEILING_REF_PROPERTY,
  AIRSPACE_FLOOR_FT_PROPERTY,
  AIRSPACE_FLOOR_REF_PROPERTY,
} from '../../../shared/inspector/airspace-feature.ts';

/**
 * Conversion factor from feet to meters. MapLibre's
 * `fill-extrusion-base` and `fill-extrusion-height` paint properties
 * accept altitudes in meters, while the airspace dataset and every
 * downstream consumer in atlas use feet, so the extrusion expressions
 * scale by this constant exactly once at the MapLibre boundary.
 */
export const FT_TO_METERS = 0.3048;

/**
 * Upper clamp applied to the raw ceiling feet value before
 * exaggeration. The bundled airspace dataset uses `99999` as a
 * sentinel for "no upper limit" (the upper ARTCC strata, some Warning
 * and Restricted areas, and the Class E areas that lie beyond the
 * lateral extent of Class A). Multiplying that sentinel through
 * the zoom-driven exaggeration produces extrusions on the order of
 * thousands of kilometres at low zoom - the side walls extend above
 * the camera and clip at the top of the screen, the top face covers
 * the entire visible viewport, and the layer reads as a uniform
 * "ghost carpet" that hides every feature stacked underneath. FL600
 * (60,000 ft) is the top of conventional high-altitude airspace
 * structure, so capping there keeps "unlimited" features tall enough
 * to read as a stratum without producing visual artifacts. Real
 * features that already exceed FL600 (one outlier Restricted at
 * 100,000 ft) clamp to the same ceiling - the inspector / popover
 * still surface the true value via the un-projected `ceiling` field.
 */
export const CEILING_CAP_FT = 60000;

/**
 * Altitude reference datums the 3D extrusion anchors at ground level.
 * The map has no terrain, so an AGL value cannot be placed at its true
 * height; both it and SFC collapse to MSL=0 in
 * {@link buildExtrusionAltitudeExpression} and
 * {@link extrudedAltitudeMeters}. The airspace layer's tilted-view
 * ground filter reads the same list, so the 2D footprint that survives
 * in the tilted view is drawn exactly where a box meets the ground and
 * the two can never disagree about which features those are.
 */
export const GROUND_ANCHORED_ALTITUDE_REFS = ['SFC', 'AGL'] as const;

/**
 * Airspace types from least to most specific; a type's index in this
 * list is its depth rank. Many boxes of different types end at the same
 * altitude - every "unlimited" ceiling caps to FL600 alongside Class A,
 * and Class E areas, most MOAs and many restricted areas all end at
 * 18,000 ft, whether the ceiling is published as inclusive or not - and
 * two translucent top faces on the same plane both pass the depth test
 * and blend into a muddy mix. The ceiling expression lifts a
 * box by {@link CEILING_DEPTH_BIAS_METERS_PER_RANK} per rank, so where
 * tops coincide the more specific airspace sits a few meters higher,
 * wins the depth test, and reads as a crisp box poking through the
 * blanket one. Blanket classes rank lowest, terminal classes in the
 * middle, special-use areas highest. Every {@link AirspaceType} appears
 * exactly once; a type missing here would rank lowest.
 */
export const AIRSPACE_TYPE_DEPTH_ORDER = [
  ['ARTCC'],
  ['CLASS_A'],
  ['CLASS_E2', 'CLASS_E3', 'CLASS_E4', 'CLASS_E5', 'CLASS_E6', 'CLASS_E7'],
  ['CLASS_D'],
  ['CLASS_C'],
  ['CLASS_B'],
  ['MOA', 'RESTRICTED', 'PROHIBITED', 'WARNING', 'ALERT', 'NSA'],
] as const satisfies ReadonlyArray<readonly AirspaceType[]>;

/**
 * Meters of lift per depth rank, before exaggeration. Ten meters is
 * far below anything the eye can register against a box thousands of
 * meters tall, yet with the exaggeration multiplier applied it stays
 * above the depth buffer's resolution at every zoom the chart uses, so
 * coincident tops separate cleanly instead of flickering.
 */
export const CEILING_DEPTH_BIAS_METERS_PER_RANK = 10;

/**
 * Zoom-driven vertical exaggeration curve, as `[zoom, multiplier]`
 * stops. Airspace volume has to stay readable at continental zooms,
 * where true-scale altitude (e.g. 18,000 ft / 5.5 km Class B ceiling)
 * is dwarfed by camera distance and collapses to a paper-thin slab
 * regardless of pitch. The curve is intentionally restrained - early
 * iterations used 100x at zoom 4, which made every airspace appear as
 * a continent-scale tower and amplified the visual artifact where
 * panning forward at a tilted camera "shrinks" the boxes (the same
 * lateral feature occupies a smaller proportion of the screen as the
 * effective zoom changes mid-pan):
 *
 * | zoom | exaggeration | rationale                                |
 * |------|--------------|------------------------------------------|
 * |  4   |   20x        | CONUS view: 18k ft -> ~110 km           |
 * |  6   |    8x        | regional view: 18k ft -> ~44 km         |
 * |  8   |    3x        | metro view: 18k ft -> ~16 km            |
 * | 10   |  1.5x        | terminal view: 18k ft -> ~8 km          |
 * | 12+  |    1x        | airport view: true scale                |
 *
 * Linear interpolation between stops; values clamp to 20x below zoom
 * 4 and 1x above zoom 12.
 */
const EXAGGERATION_STOPS: ReadonlyArray<readonly [zoom: number, exaggeration: number]> = [
  [4, 20],
  [6, 8],
  [8, 3],
  [10, 1.5],
  [12, 1],
];

/**
 * Vertical exaggeration multiplier for the camera zoom, from
 * {@link EXAGGERATION_STOPS}. Evaluated in JavaScript rather than as a
 * `['zoom']` expression on purpose: MapLibre bakes a zoom-dependent,
 * data-driven paint expression per tile at that tile's own zoom level,
 * interpolating only toward the next level, and a tilted camera loads
 * distant tiles at lower zoom than nearby ones. Two rings with the same
 * 7000 ft ceiling then extrude to different heights depending on which
 * tile each lands in, with a visible shelf along the tile boundary. One
 * multiplier computed here and baked into the expression as a constant
 * gives every tile the same height for the same altitude.
 */
export function extrusionExaggerationForZoom(zoom: number): number {
  const first = EXAGGERATION_STOPS[0];
  const last = EXAGGERATION_STOPS[EXAGGERATION_STOPS.length - 1];
  if (first === undefined || last === undefined) {
    return 1;
  }
  if (zoom <= first[0]) {
    return first[1];
  }
  if (zoom >= last[0]) {
    return last[1];
  }
  for (let i = 1; i < EXAGGERATION_STOPS.length; i++) {
    const lower = EXAGGERATION_STOPS[i - 1];
    const upper = EXAGGERATION_STOPS[i];
    if (lower === undefined || upper === undefined) {
      continue;
    }
    if (zoom <= upper[0]) {
      const t = (zoom - lower[0]) / (upper[0] - lower[0]);
      return lower[1] + (upper[1] - lower[1]) * t;
    }
  }
  return last[1];
}

/**
 * Granularity at which the camera zoom is sampled for the exaggeration
 * multiplier. Between two consecutive stops the multiplier changes by at
 * most 6x per zoom level, so a tenth of a level moves a box by no more
 * than a few percent of its height - below what the eye registers as a
 * pop, while cutting the paint-property updates during a zoom gesture
 * from one per frame to one per tenth of a level.
 */
export const MAP_ZOOM_QUANTUM = 0.1;

/** Rounds a camera zoom to the nearest {@link MAP_ZOOM_QUANTUM}. */
export function quantizeMapZoom(zoom: number): number {
  return Math.round(zoom / MAP_ZOOM_QUANTUM) * MAP_ZOOM_QUANTUM;
}

/** Depth rank of an airspace type per {@link AIRSPACE_TYPE_DEPTH_ORDER}; unknown types rank lowest. */
export function depthRankOfAirspaceType(type: string | undefined): number {
  const rank = AIRSPACE_TYPE_DEPTH_ORDER.findIndex((group) => group.some((t) => t === type));
  return rank < 0 ? 0 : rank;
}

/** Whether a bound is one the extrusion anchors at ground level. */
function isGroundAnchored(bound: AltitudeBound): boolean {
  return GROUND_ANCHORED_ALTITUDE_REFS.some((ref) => ref === bound.reference);
}

/**
 * Height in meters at which the 3D layer draws an altitude bound for the
 * given exaggeration: ground-anchored references collapse to 0, MSL
 * values convert to meters and scale by the multiplier, and an optional
 * cap bounds the raw feet first. This is the JavaScript twin of
 * {@link buildExtrusionAltitudeExpression}.
 */
export function extrudedAltitudeMeters(
  bound: AltitudeBound | undefined,
  exaggeration: number,
  capFt?: number,
): number {
  if (bound === undefined || isGroundAnchored(bound)) {
    return 0;
  }
  const altFt = capFt === undefined ? bound.valueFt : Math.min(bound.valueFt, capFt);
  return altFt * FT_TO_METERS * exaggeration;
}

/**
 * Height in meters of a feature's box top as the 3D layer draws it: the
 * capped, exaggerated ceiling plus the type's depth lift. Anything that
 * must line up with a box top (the feature badges) derives its height
 * here so it cannot drift from what the GPU draws through
 * {@link buildExtrusionHeightExpression}.
 */
export function extrusionCeilingMeters(
  ceiling: AltitudeBound | undefined,
  type: string | undefined,
  exaggeration: number,
): number {
  if (ceiling === undefined || isGroundAnchored(ceiling)) {
    return 0;
  }
  return (
    extrudedAltitudeMeters(ceiling, exaggeration, CEILING_CAP_FT) +
    depthRankOfAirspaceType(type) * CEILING_DEPTH_BIAS_METERS_PER_RANK * exaggeration
  );
}

/**
 * `fill-extrusion-base` expression at one exaggeration multiplier. No
 * ceiling cap is applied to the floor, as real floor values are bounded
 * and the `99999` sentinel only ever appears on ceilings; no depth lift
 * either, so a box's thickness changes only by the lift of its top.
 */
export function buildExtrusionBaseExpression(exaggeration: number): ExpressionSpecification {
  return buildExtrusionAltitudeExpression(
    AIRSPACE_FLOOR_REF_PROPERTY,
    AIRSPACE_FLOOR_FT_PROPERTY,
    undefined,
    exaggeration,
    0,
  );
}

/**
 * `fill-extrusion-height` expression at one exaggeration multiplier:
 * the ceiling primitives, capped to bound the `99999` sentinel before
 * the exaggeration multiplies it into orbit, lifted by the type's depth
 * rank. A feature whose ceiling is itself SFC / AGL collapses to a
 * zero-thickness extrusion with no lift.
 */
export function buildExtrusionHeightExpression(exaggeration: number): ExpressionSpecification {
  return buildExtrusionAltitudeExpression(
    AIRSPACE_CEILING_REF_PROPERTY,
    AIRSPACE_CEILING_FT_PROPERTY,
    CEILING_CAP_FT,
    exaggeration,
    CEILING_DEPTH_BIAS_METERS_PER_RANK * exaggeration,
  );
}

/**
 * Builds a `fill-extrusion-base` / `fill-extrusion-height` expression
 * for the airspace 3D extrusion layer at one exaggeration multiplier.
 * The expression is purely data-driven: the per-feature `match`
 * collapses {@link GROUND_ANCHORED_ALTITUDE_REFS} to 0 so the extrusion
 * anchors to MSL=0 rather than tracking ground elevation, and
 * everything else multiplies the feet value by a constant that already
 * folds the feet-to-meters conversion together with the exaggeration,
 * so the runtime arithmetic per feature is one `coalesce` plus one `*`.
 * A missing feet primitive coalesces to 0 so the output is always a
 * finite number. Applying the same multiplier to base and height
 * preserves vertical proportions between stacked features (Class B
 * inner ring at 1500 ft floor vs outer at SFC) at every zoom.
 *
 * @param refProperty - GeoJSON property name carrying the altitude
 *   reference datum (`'MSL'` / `'AGL'` / `'SFC'`).
 * @param ftProperty - GeoJSON property name carrying the altitude
 *   value in feet.
 * @param capFt - Optional upper clamp applied to the raw feet value
 *   before exaggeration. Used on the ceiling expression to bound the
 *   `99999` "no upper limit" sentinel (see {@link CEILING_CAP_FT});
 *   `undefined` for the floor expression where real values are
 *   bounded.
 * @param exaggeration - Vertical multiplier from
 *   {@link extrusionExaggerationForZoom}.
 * @param depthBiasMetersPerRank - Meters added per depth rank of the
 *   feature's type (see {@link AIRSPACE_TYPE_DEPTH_ORDER}), already
 *   scaled by the exaggeration; `0` adds nothing.
 * @returns A MapLibre expression suitable for `fill-extrusion-base` or
 *   `fill-extrusion-height`.
 */
export function buildExtrusionAltitudeExpression(
  refProperty: string,
  ftProperty: string,
  capFt: number | undefined,
  exaggeration: number,
  depthBiasMetersPerRank: number,
): ExpressionSpecification {
  const rawFt: ExpressionSpecification = ['coalesce', ['get', ftProperty], 0];
  const altFt: ExpressionSpecification = capFt === undefined ? rawFt : ['min', rawFt, capFt];
  const scaled: ExpressionSpecification = ['*', altFt, FT_TO_METERS * exaggeration];
  const lifted: ExpressionSpecification =
    depthBiasMetersPerRank === 0
      ? scaled
      : ['+', scaled, buildDepthBiasExpression(depthBiasMetersPerRank)];
  return ['match', ['get', refProperty], [...GROUND_ANCHORED_ALTITUDE_REFS], 0, lifted];
}

/**
 * `match` on the feature's `type` yielding its depth lift in meters:
 * every group of {@link AIRSPACE_TYPE_DEPTH_ORDER} maps to its rank
 * times `metersPerRank`, and an unknown type lifts by nothing. Spelled
 * out per rank because MapLibre's expression type fixes the arity of
 * the first label pair; the list is a tuple, so a rank added to it
 * without a line here is a type error, not a silent omission.
 */
function buildDepthBiasExpression(metersPerRank: number): ExpressionSpecification {
  const [rank0, rank1, rank2, rank3, rank4, rank5, rank6] = AIRSPACE_TYPE_DEPTH_ORDER;
  return [
    'match',
    ['get', 'type'],
    [...rank0],
    0,
    [...rank1],
    metersPerRank,
    [...rank2],
    2 * metersPerRank,
    [...rank3],
    3 * metersPerRank,
    [...rank4],
    4 * metersPerRank,
    [...rank5],
    5 * metersPerRank,
    [...rank6],
    6 * metersPerRank,
    0,
  ];
}
