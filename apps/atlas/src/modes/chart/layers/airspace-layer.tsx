import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
import { getRouteApi } from '@tanstack/react-router';
import { Source, Layer } from '@vis.gl/react-maplibre';
import type { LayerProps } from '@vis.gl/react-maplibre';
import { useMemo } from 'react';
import type { ReactElement } from 'react';

import type { AirspaceType } from '@squawk/types';

import { useAirspaceDataset } from '../../../shared/data/airspace-dataset.ts';
import {
  AIRSPACE_CEILING_FT_PROPERTY,
  AIRSPACE_CEILING_REF_PROPERTY,
  AIRSPACE_FLOOR_FT_PROPERTY,
  AIRSPACE_FLOOR_REF_PROPERTY,
  AIRSPACE_MATCH_KEY_PROPERTY,
} from '../../../shared/inspector/airspace-feature.ts';
import { useChartColors } from '../../../shared/styles/chart-colors.ts';
import type {
  ChartAirspaceBadgeColors,
  ChartAirspaceColors,
  ChartHighlightColors,
} from '../../../shared/styles/chart-colors.ts';
import { useActiveHighlightRef, useHoveredFeatureIndex } from '../highlight-context.ts';
import { AIRSPACE_CLASS_TYPES, CHART_ROUTE_PATH } from '../url-state.ts';

import { AIRPORTS_HIGHLIGHT_LAYER_ID } from './airports-layer.tsx';
import { hatchImageId, useHatchPatternImage } from './airspace-hatch-pattern.ts';
import {
  AIRSPACE_BADGE_OFFSET_PROPERTY,
  AIRSPACE_FEATURE_COUNT_PROPERTY,
  AIRSPACE_FEATURE_INDEX_PROPERTY,
  AIRSPACE_FEATURE_LABEL_PROPERTY,
  projectAirspaceSource,
} from './airspace-source-projection.ts';
import { AIRWAYS_HIGHLIGHT_LAYER_ID } from './airways-layer.tsx';
import { FIXES_HIGHLIGHT_LAYER_ID } from './fixes-layer.tsx';
import { NAVAIDS_HIGHLIGHT_LAYER_ID } from './navaids-layer.tsx';
import { useTopOfStack } from './use-top-of-stack.ts';

const route = getRouteApi(CHART_ROUTE_PATH);

/** MapLibre source id for the airspace overlay. */
const AIRSPACE_SOURCE_ID = 'atlas-airspace';

/** MapLibre layer id for the airspace polygon fill. */
export const AIRSPACE_FILL_LAYER_ID = 'atlas-airspace-fill';

/** MapLibre layer id for the airspace polygon outline. */
export const AIRSPACE_LINE_LAYER_ID = 'atlas-airspace-line';

/**
 * MapLibre layer id for the 3D airspace extrusion. Renders each
 * polygon as a vertical box between its floor and ceiling, with
 * `layout.visibility` toggled by the chart pitch URL param so the
 * extrusion only paints when the camera is tilted off the plan view.
 * Registered in `INSPECTABLE_LAYER_IDS` so a click on the box's side
 * wall or top face at high pitch resolves to the same airspace
 * selection a click on the flat footprint at z=0 would produce.
 */
export const AIRSPACE_FILL_EXTRUSION_LAYER_ID = 'atlas-airspace-fill-extrusion';

/** MapLibre layer id for the airspace selection-highlight outline overlay. */
const AIRSPACE_HIGHLIGHT_LAYER_ID = 'atlas-airspace-highlight';

/**
 * MapLibre layer id for the cross-hatched fill rendered on top of the
 * selected airspace's interior. Helps the user spot the selection even
 * when the polygon's outline is partially or fully offscreen.
 */
const AIRSPACE_HIGHLIGHT_FILL_LAYER_ID = 'atlas-airspace-highlight-fill';

/**
 * MapLibre layer id for the 3D selection-highlight extrusion. Renders
 * the currently-selected airspace as a high-opacity yellow box on top
 * of the regular low-opacity airspace extrusion so the selection is
 * unmistakable in 3D view (the 2D ring + cross-hatch on the ground
 * are hard to spot from a tilted camera looking through translucent
 * stacked boxes). Hidden in plan view (pitch === 0) where the 2D
 * ring on the ground is the natural selection indicator.
 */
const AIRSPACE_HIGHLIGHT_EXTRUSION_LAYER_ID = 'atlas-airspace-highlight-extrusion';

/**
 * MapLibre layer id for the per-feature focus outline that brightens a
 * single polygon inside a multi-feature airspace grouping when the user
 * hovers its section in the inspector. Sits above the entity-level
 * highlight so the focused ring stands out against its siblings.
 */
const AIRSPACE_FEATURE_FOCUS_LAYER_ID = 'atlas-airspace-feature-focus';

/**
 * MapLibre layer id for the per-feature badge rendered at each polygon's
 * centroid when an airspace with multiple features is selected. The
 * badge text is the feature's index ("1", "2", "3") or its ARTCC
 * stratum name ("LOW", "HIGH"); matches the inspector section title.
 */
const AIRSPACE_FEATURE_BADGE_LAYER_ID = 'atlas-airspace-feature-badge';

/**
 * Stable array of layer ids that {@link AirspaceFeatureOverlayLayers}
 * pins to the top of the MapLibre layer stack via {@link useTopOfStack}.
 * The order is "lowest first, highest last" because the hook's
 * `moveLayer` calls walk the array in order and each move sends the
 * id to the very top - so the entry at the end of the array ends up
 * topmost in the rendered stack.
 *
 * The chart-mode draw stack at high pitch (lowest -> highest):
 * 1. Ground-feature layers (airports / navaids / fixes / airways /
 *    airspace 2D fill + line). Mount first in JSX, paint at z=0.
 * 2. {@link AIRSPACE_FILL_EXTRUSION_LAYER_ID} - the regular
 *    low-opacity 3D airspace box. Must paint above the ground layers
 *    so it visually occludes them at high pitch (the user expects
 *    the airspace volume to be on top of the ground points it
 *    covers, since the box is at altitude and the points are not).
 *    JSX child order alone is not sufficient because each ground
 *    layer mounts only when its dataset finishes loading - if
 *    navaids load after airspace, the navaid layer ends up topmost
 *    at the moment of registration.
 * 3. {@link AIRSPACE_HIGHLIGHT_EXTRUSION_LAYER_ID} - high-opacity
 *    yellow 3D box for the currently-selected airspace, sitting on
 *    top of the regular extrusion so the selection pops out of the
 *    surrounding low-opacity field.
 * 4. Ground-feature highlight layers (airspace ring, airport /
 *    navaid / fix / airway selection rings). Pinned above the 3D
 *    extrusion so the selection indicator stays visible for
 *    features whose lateral position falls inside an extruded box -
 *    without this pin the 3D box's stacked alpha would wash the
 *    yellow ring out at high pitch.
 * 5. Airspace per-feature focus outline + numbered badges. Pinned
 *    last so they sit above every other indicator when an airspace
 *    with multiple sub-polygons is active.
 *
 * JSX-order pinning would also work for items 2-3 in isolation, but
 * spelling out the order centrally here makes the priority explicit
 * and removes the cross-component coupling.
 */
const TOP_OF_STACK_LAYER_IDS = [
  // Regular 3D extrusion (low opacity), pinned above ground features.
  AIRSPACE_FILL_EXTRUSION_LAYER_ID,
  // Selection-highlight 3D extrusion, pinned above the regular one.
  AIRSPACE_HIGHLIGHT_EXTRUSION_LAYER_ID,
  // 2D selection-highlight overlays for airspace, above the 3D box
  // so the ring stays visible when looking through the translucent
  // extrusion at high pitch.
  AIRSPACE_HIGHLIGHT_FILL_LAYER_ID,
  AIRSPACE_HIGHLIGHT_LAYER_ID,
  // 2D selection-highlight overlays for ground point / line
  // features. Pinned above the 3D box so an airport / navaid / fix /
  // airway selection stays visible inside an overlapping airspace
  // extrusion. The relative order between these four does not
  // matter visually (they highlight features at non-overlapping
  // positions); listed in the same order as `INSPECTABLE_LAYER_IDS`
  // for consistency.
  AIRPORTS_HIGHLIGHT_LAYER_ID,
  NAVAIDS_HIGHLIGHT_LAYER_ID,
  FIXES_HIGHLIGHT_LAYER_ID,
  AIRWAYS_HIGHLIGHT_LAYER_ID,
  // Per-feature focus outline + numbered badges, pinned last so they
  // remain above every selection indicator above.
  AIRSPACE_FEATURE_FOCUS_LAYER_ID,
  AIRSPACE_FEATURE_BADGE_LAYER_ID,
] as const;

/**
 * Filter expression that matches no feature. Used as the default highlight
 * filter when nothing airspace-shaped is currently active.
 */
const MATCH_NONE_FILTER: ExpressionSpecification = [
  '==',
  ['get', AIRSPACE_MATCH_KEY_PROPERTY],
  '__atlas-no-match__',
];

/**
 * Conversion factor from feet to meters. MapLibre's
 * `fill-extrusion-base` and `fill-extrusion-height` paint properties
 * accept altitudes in meters, while the airspace dataset and every
 * downstream consumer in atlas use feet, so the extrusion expressions
 * scale by this constant exactly once at the MapLibre boundary.
 */
const FT_TO_METERS = 0.3048;

/**
 * Upper clamp applied to the raw ceiling feet value before
 * exaggeration. The bundled airspace dataset uses `99999` as a
 * sentinel for "no upper limit" (every Class E5/E6/E7 ceiling, plus
 * many Class E2/E3/E4 surface areas, plus a smaller subset of Warning,
 * Restricted, and ARTCC features). Multiplying that sentinel through
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
const CEILING_CAP_FT = 60000;

/**
 * Builds the `fill-extrusion-base` / `fill-extrusion-height` expression
 * for the airspace 3D extrusion layer. The structure is forced by a
 * MapLibre constraint - the `zoom` expression may only be used as
 * input to a top-level `interpolate` or `step`, so the per-feature
 * `match` (which collapses SFC/AGL refs to zero - terrain-aware
 * rendering is deferred, see `ATLAS_PLAN.md`) lives inside each
 * interpolation stop value rather than wrapping the whole expression.
 *
 * The stops apply zoom-driven vertical exaggeration so airspace
 * volume stays readable at continental zooms, where true-scale
 * altitude (e.g. 18,000 ft / 5.5 km Class B ceiling) is dwarfed by
 * camera distance and collapses to a paper-thin slab regardless of
 * pitch. The curve is intentionally restrained - early iterations
 * used 100x at zoom 4, which made every airspace appear as a
 * continent-scale tower and amplified the visual artifact where
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
 * 4 and 1x above zoom 12. Each stop bakes the feet-to-meters
 * conversion together with the stop's exaggeration factor into a
 * single multiplier so the runtime arithmetic per feature is one
 * `coalesce` plus one `*`. Symmetric application to base and height
 * preserves vertical proportions between stacked features (Class B
 * inner ring at 1500 ft floor vs outer at SFC) at every zoom.
 *
 * SFC/AGL references collapse to 0; MSL (and any unrecognized future
 * reference) multiplies the feet value by the baked multiplier. A
 * missing feet primitive coalesces to 0 so the per-feature output is
 * always a finite number.
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
 * @returns A MapLibre expression suitable for `fill-extrusion-base` or
 *   `fill-extrusion-height`.
 */
function buildExtrusionAltitudeExpression(
  refProperty: string,
  ftProperty: string,
  capFt: number | undefined,
): ExpressionSpecification {
  const rawFt: ExpressionSpecification = ['coalesce', ['get', ftProperty], 0];
  const altFt: ExpressionSpecification = capFt === undefined ? rawFt : ['min', rawFt, capFt];
  function stop(metersPerFoot: number): ExpressionSpecification {
    return ['match', ['get', refProperty], ['SFC', 'AGL'], 0, ['*', altFt, metersPerFoot]];
  }
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    4,
    stop(FT_TO_METERS * 20),
    6,
    stop(FT_TO_METERS * 8),
    8,
    stop(FT_TO_METERS * 3),
    10,
    stop(FT_TO_METERS * 1.5),
    12,
    stop(FT_TO_METERS * 1),
  ];
}

/**
 * `fill-extrusion-base` expression for the airspace 3D extrusion layer.
 * No ceiling-cap is applied to the floor: real floor values are bounded
 * (Class B / MOA inner rings climb to ~10 k ft, restricted areas top
 * out near 18 k ft) and the `99999` sentinel only ever appears on
 * ceilings. See {@link buildExtrusionAltitudeExpression} for the
 * structure rationale.
 */
const FILL_EXTRUSION_BASE_EXPRESSION = buildExtrusionAltitudeExpression(
  AIRSPACE_FLOOR_REF_PROPERTY,
  AIRSPACE_FLOOR_FT_PROPERTY,
  undefined,
);

/**
 * `fill-extrusion-height` expression for the airspace 3D extrusion layer.
 * Same shape as {@link FILL_EXTRUSION_BASE_EXPRESSION} but reads the ceiling
 * primitives and applies {@link CEILING_CAP_FT} to bound the `99999`
 * sentinel before the zoom-driven exaggeration multiplies it into orbit.
 * Special-use airspace with an AGL ceiling collapses to a zero-thickness
 * extrusion (the documented v1 limitation) until terrain support is wired
 * up; the 2D fill / outline below still renders unchanged so the airspace
 * stays selectable.
 */
const FILL_EXTRUSION_HEIGHT_EXPRESSION = buildExtrusionAltitudeExpression(
  AIRSPACE_CEILING_REF_PROPERTY,
  AIRSPACE_CEILING_FT_PROPERTY,
  CEILING_CAP_FT,
);

/**
 * Builds the MapLibre `match` expression that maps airspace type to
 * color. Shared between the fill and outline layers so they always
 * agree. Covers every `AirspaceType` value the dataset emits; the
 * trailing string is the default fallback for any unrecognized future
 * type. Class E subtypes (E2 through E7) all share a single pink,
 * mirroring how sectional charts use a magenta family for every Class
 * E variant.
 *
 * Built per-render from the resolved palette so a theme switch flips
 * every airspace fill/outline color in lockstep.
 */
function buildTypeColorExpression(airspace: ChartAirspaceColors): ExpressionSpecification {
  return [
    'match',
    ['get', 'type'],
    'CLASS_B',
    airspace.classB,
    'CLASS_C',
    airspace.classC,
    'CLASS_D',
    airspace.classD,
    ['CLASS_E2', 'CLASS_E3', 'CLASS_E4', 'CLASS_E5', 'CLASS_E6', 'CLASS_E7'],
    airspace.classE,
    'MOA',
    airspace.moa,
    'RESTRICTED',
    airspace.restricted,
    'PROHIBITED',
    airspace.prohibited,
    'WARNING',
    airspace.warning,
    'ALERT',
    airspace.alert,
    'NSA',
    airspace.nsa,
    'ARTCC',
    airspace.artcc,
    airspace.fallback,
  ];
}

/**
 * Chart-mode overlay that renders airspace polygons from
 * `@squawk/airspace-data` using a fill layer for tinted boundaries and a
 * line layer for the outlines. The dataset is already a GeoJSON
 * `FeatureCollection`, so MapLibre consumes it directly without a
 * client-side projection step. The fill and line layers share a MapLibre
 * `filter` expression built from the active `airspaceClasses` URL state,
 * so toggling sub-classes shows or hides only the matching features
 * without rebuilding the source. Returns `null` while the dataset is still
 * being fetched or if the load failed.
 */
export function AirspaceLayer(): ReactElement | null {
  const { airspaceClasses, pitch } = route.useSearch();
  const state = useAirspaceDataset();
  const activeRef = useActiveHighlightRef();
  const colors = useChartColors();
  const hatchId = hatchImageId(colors.highlight.primary);

  const enabledTypes = useMemo<readonly AirspaceType[]>(
    () => airspaceClasses.flatMap((cls) => AIRSPACE_CLASS_TYPES[cls]),
    [airspaceClasses],
  );

  const filter = useMemo<ExpressionSpecification>(
    () => ['in', ['get', 'type'], ['literal', [...enabledTypes]]],
    [enabledTypes],
  );

  // Outline filter for the polygon line layer. In plan view (pitch ===
  // 0) it matches the regular type filter, so every enabled airspace
  // gets a ground-level outline. Once the camera tilts, the line layer
  // still draws at z = 0, which would render a misleading "ground
  // outline" beneath floating airspaces (Class B inner ring at 1500 ft
  // MSL, MOAs starting at FL050, etc.) that don't actually touch the
  // ground. Restricting the line layer to features whose floor
  // reference is `'SFC'` keeps the ground outline only where the
  // airspace really meets the ground; floating airspaces lose the
  // misleading 2D outline and read purely as 3D boxes.
  const lineFilter = useMemo<ExpressionSpecification>(() => {
    if (pitch === 0) {
      return filter;
    }
    return ['all', filter, ['==', ['get', AIRSPACE_FLOOR_REF_PROPERTY], 'SFC']];
  }, [filter, pitch]);

  // Polygon fill layer. Uses a low alpha so airspace boundaries read
  // as gentle tints rather than dominant blocks of color, leaving the
  // basemap and other overlays legible. Re-memoized when the resolved
  // palette flips so the type-color expression follows the theme.
  const fillLayerProps = useMemo<LayerProps>(
    () => ({
      id: AIRSPACE_FILL_LAYER_ID,
      source: AIRSPACE_SOURCE_ID,
      type: 'fill',
      filter,
      paint: {
        'fill-color': buildTypeColorExpression(colors.airspace),
        'fill-opacity': 0.08,
      },
    }),
    [filter, colors],
  );

  // Polygon outline layer. Stroke color matches the fill so each
  // airspace reads as a single unit; stroke is thin so dense areas do
  // not clutter.
  const lineLayerProps = useMemo<LayerProps>(
    () => ({
      id: AIRSPACE_LINE_LAYER_ID,
      source: AIRSPACE_SOURCE_ID,
      type: 'line',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      filter: lineFilter,
      paint: {
        'line-color': buildTypeColorExpression(colors.airspace),
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 8, 1.2, 12, 2],
        'line-opacity': 0.7,
      },
    }),
    [lineFilter, colors],
  );

  // Project the source dataset to add a synthetic match-key property
  // per feature. The chip / URL path encodes selections as either
  // `airspace:{TYPE}/{IDENTIFIER}` (named) or
  // `airspace:{TYPE}/c:{LON},{LAT}` (empty-id, centroid disambiguator);
  // mirroring that exact format here lets the highlight filter use a
  // single equality check that works for both. Memoized so the
  // re-projection runs once per dataset load, not per render.
  const sourceData = useMemo(() => projectAirspaceSource(state), [state]);

  // Same filter is shared between the highlight outline and the
  // cross-hatched highlight fill, so the outline + interior pattern
  // render together for whatever airspace is currently selected.
  const highlightFilter = useMemo<ExpressionSpecification>(() => {
    if (activeRef?.type === 'airspace' && activeRef.id.length > 0) {
      return ['==', ['get', AIRSPACE_MATCH_KEY_PROPERTY], activeRef.id];
    }
    return MATCH_NONE_FILTER;
  }, [activeRef]);

  // Highlight outline overlay for the currently-selected (or
  // chip-hovered) airspace. Thick yellow stroke makes the active
  // polygon pop against the basemap and against neighbouring
  // airspaces of the same type.
  const highlightLayerProps = useMemo<LayerProps>(
    () => ({
      id: AIRSPACE_HIGHLIGHT_LAYER_ID,
      source: AIRSPACE_SOURCE_ID,
      type: 'line',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      filter: highlightFilter,
      paint: {
        'line-color': colors.highlight.primary,
        'line-width': 3,
        'line-opacity': 1,
      },
    }),
    [highlightFilter, colors],
  );

  // Cross-hatched fill rendered across the entire interior of the
  // highlighted airspace. Lives on top of the regular tinted fill so
  // the underlying class color stays visible underneath; rendered at
  // moderate opacity so dense overlapping selections do not wash out
  // the basemap. Without this layer, panning so the polygon's outline
  // goes offscreen would leave the user with no visual indicator of
  // which airspace is selected.
  const highlightFillLayerProps = useMemo<LayerProps>(
    () => ({
      id: AIRSPACE_HIGHLIGHT_FILL_LAYER_ID,
      source: AIRSPACE_SOURCE_ID,
      type: 'fill',
      filter: highlightFilter,
      paint: {
        'fill-pattern': hatchId,
        'fill-opacity': 0.6,
      },
    }),
    [highlightFilter, hatchId],
  );

  // Register the hatch pattern image once per map instance per theme.
  // The fill layer references the per-theme image by name; if the
  // image is missing MapLibre silently skips the fill, so a slight
  // delay between mount and pattern-load is harmless.
  useHatchPatternImage(hatchId, colors.highlight.primary);

  if (state.status !== 'loaded' || sourceData === undefined) {
    return null;
  }

  return (
    <Source id={AIRSPACE_SOURCE_ID} type="geojson" data={sourceData}>
      <Layer {...fillLayerProps} />
      <Layer {...lineLayerProps} />
      <Layer {...highlightFillLayerProps} />
      <Layer {...highlightLayerProps} />
    </Source>
  );
}

/**
 * 3D extrusion overlay for airspace polygons. Renders each visible
 * airspace as a vertical box between its floor and ceiling so a
 * tilted camera reveals stacked airspace structure (Class B inverted
 * wedding-cake, MOA / restricted-area strata, ARTCC LOW/HIGH split).
 *
 * Mounted as a separate component from {@link AirspaceLayer} so
 * `chart-mode.tsx` can position it AFTER the ground-feature layers
 * (airports / navaids / fixes / airways) in the JSX child order and
 * therefore above them in MapLibre's draw stack. Without this split,
 * the extrusion would mount inside the airspace `<Source>` before
 * any other component, and ground points like airport circles would
 * paint on top of the 3D box at high pitch even though the box is at
 * altitude. The extrusion references the airspace source mounted by
 * {@link AirspaceLayer} by id, so this component renders nothing
 * until the dataset is loaded.
 *
 * `visibility` is gated on the URL pitch so the box is hidden in
 * plan view (pitch === 0) and only appears once the user tilts. The
 * flat fill in {@link AirspaceLayer} stays visible underneath the
 * box at any pitch so the lateral footprint reads as a stable 2D
 * anchor and clicks keep landing on the fill layer (the extrusion
 * is intentionally not registered as an inspectable layer).
 *
 * `fill-extrusion-opacity` tuned to balance two competing goals: low
 * enough that stacked airspaces (Class B + ARTCC at the same
 * lat/lon) read as overlapping translucent boxes rather than the
 * topmost occluding the rest, but high enough that side-wall
 * silhouettes plus the default `fill-extrusion-vertical-gradient`
 * shading approximate visible edges - MapLibre 5 has no
 * fill-extrusion outline / edge paint property, so explicit edge
 * strokes on the 3D box would require a different rendering library
 * (deck.gl) or custom WebGL. Tracked in `ATLAS_PLAN.md`.
 */
export function AirspaceExtrusionLayer(): ReactElement | null {
  const { airspaceClasses, pitch } = route.useSearch();
  const state = useAirspaceDataset();
  const activeRef = useActiveHighlightRef();
  const colors = useChartColors();

  const enabledTypes = useMemo<readonly AirspaceType[]>(
    () => airspaceClasses.flatMap((cls) => AIRSPACE_CLASS_TYPES[cls]),
    [airspaceClasses],
  );

  const filter = useMemo<ExpressionSpecification>(
    () => ['in', ['get', 'type'], ['literal', [...enabledTypes]]],
    [enabledTypes],
  );

  const fillExtrusionLayerProps = useMemo<LayerProps>(
    () => ({
      id: AIRSPACE_FILL_EXTRUSION_LAYER_ID,
      source: AIRSPACE_SOURCE_ID,
      type: 'fill-extrusion',
      filter,
      layout: {
        visibility: pitch > 0 ? 'visible' : 'none',
      },
      paint: {
        'fill-extrusion-color': buildTypeColorExpression(colors.airspace),
        'fill-extrusion-base': FILL_EXTRUSION_BASE_EXPRESSION,
        'fill-extrusion-height': FILL_EXTRUSION_HEIGHT_EXPRESSION,
        'fill-extrusion-opacity': 0.5,
      },
    }),
    [filter, colors, pitch],
  );

  // 3D selection-highlight extrusion. Renders only the polygon whose
  // synthetic match-key matches the active selection, painted in the
  // highlight color at high opacity so the chosen airspace pops out
  // of the surrounding low-opacity 3D field. Without this layer the
  // selection in 3D view is signalled only by the 2D ring + cross-
  // hatch on the ground, which is hard to spot from a tilted camera
  // looking through the regular 0.5-opacity extrusion of every
  // overlapping class.
  const highlightFilter = useMemo<ExpressionSpecification>(() => {
    if (activeRef?.type === 'airspace' && activeRef.id.length > 0) {
      return ['==', ['get', AIRSPACE_MATCH_KEY_PROPERTY], activeRef.id];
    }
    return MATCH_NONE_FILTER;
  }, [activeRef]);

  const highlightExtrusionLayerProps = useMemo<LayerProps>(
    () => ({
      id: AIRSPACE_HIGHLIGHT_EXTRUSION_LAYER_ID,
      source: AIRSPACE_SOURCE_ID,
      type: 'fill-extrusion',
      filter: highlightFilter,
      layout: {
        visibility: pitch > 0 ? 'visible' : 'none',
      },
      paint: {
        'fill-extrusion-color': colors.highlight.primary,
        'fill-extrusion-base': FILL_EXTRUSION_BASE_EXPRESSION,
        'fill-extrusion-height': FILL_EXTRUSION_HEIGHT_EXPRESSION,
        'fill-extrusion-opacity': 0.9,
      },
    }),
    [highlightFilter, colors, pitch],
  );

  // Bail until the airspace source is mounted; layers referencing a
  // not-yet-registered source generate noisy warnings and never
  // paint. The top-of-stack pinning that keeps these extrusions above
  // the ground-feature layers lives in {@link AirspaceFeatureOverlayLayers}
  // alongside the rest of the chart-mode top-stack chrome (focus
  // outline, badges) so the order is centrally specified.
  if (state.status !== 'loaded') {
    return null;
  }

  return (
    <>
      <Layer {...fillExtrusionLayerProps} />
      <Layer {...highlightExtrusionLayerProps} />
    </>
  );
}

/**
 * Top-of-stack overlay layers for an airspace's per-feature focus
 * outline and numbered badges. Mounted as a sibling of every other
 * chart layer (and rendered AFTER airports / navaids / fixes so the
 * badges sit above their circles), it references the airspace source
 * mounted by {@link AirspaceLayer} by id rather than wrapping its own
 * `<Source>` - one source, two layer subtrees.
 *
 * Renders nothing while the airspace dataset is still loading; the
 * filters resolve to "match nothing" when no airspace is selected, so
 * the layers are present but invisible until selection lands.
 */
export function AirspaceFeatureOverlayLayers(): ReactElement | null {
  const state = useAirspaceDataset();
  const activeRef = useActiveHighlightRef();
  const hoveredFeatureIndex = useHoveredFeatureIndex();
  const colors = useChartColors();

  // Badge filter: visible when an airspace with 2+ features is the
  // active selection. Single-feature airspaces don't need disambiguation
  // so the count > 1 clause keeps badges off when they would add noise.
  const badgeFilter = useMemo<ExpressionSpecification>(() => {
    if (activeRef?.type === 'airspace' && activeRef.id.length > 0) {
      return [
        'all',
        ['==', ['get', AIRSPACE_MATCH_KEY_PROPERTY], activeRef.id],
        ['>', ['get', AIRSPACE_FEATURE_COUNT_PROPERTY], 1],
      ];
    }
    return MATCH_NONE_FILTER;
  }, [activeRef]);

  // Per-feature badge label rendered at each polygon centroid. Symbol
  // layers default to point-placement on Polygon source features, so
  // MapLibre auto-positions the label at the polygon's representative
  // point without a separate Point source. The dark halo gives the
  // text legibility against any basemap or fill underneath. Filter is
  // empty when no airspace is selected or when the selected airspace
  // has only one feature (single-feature airspaces need no
  // disambiguation).
  const badgeLayerProps = useMemo<LayerProps>(
    () => buildBadgeLayerProps(badgeFilter, colors.airspaceBadge),
    [badgeFilter, colors],
  );

  // Feature-focus filter: matches the polygon whose inspector section
  // is currently hovered. When no section is hovered (or no airspace
  // selected) the filter matches nothing so the layer is effectively
  // absent.
  const featureFocusFilter = useMemo<ExpressionSpecification>(() => {
    if (
      activeRef?.type === 'airspace' &&
      activeRef.id.length > 0 &&
      hoveredFeatureIndex !== undefined
    ) {
      return [
        'all',
        ['==', ['get', AIRSPACE_MATCH_KEY_PROPERTY], activeRef.id],
        ['==', ['get', AIRSPACE_FEATURE_INDEX_PROPERTY], hoveredFeatureIndex],
      ];
    }
    return MATCH_NONE_FILTER;
  }, [activeRef, hoveredFeatureIndex]);

  // Per-feature focus outline. Rendered on top of the entity-level
  // highlight stroke so the hovered feature stands out from its
  // siblings. Brighter, lighter yellow + slightly thicker line so the
  // eye registers it as "the one". Filter is empty (matches nothing)
  // when no inspector section is hovered.
  const featureFocusLayerProps = useMemo<LayerProps>(
    () => buildFeatureFocusLayerProps(featureFocusFilter, colors.highlight),
    [featureFocusFilter, colors],
  );

  // Force the focus + badge layers to the very top of MapLibre's layer
  // stack on every render. Without this, any subsequent re-add by the
  // airport / navaid / fix layer components (e.g. when their filter
  // expression changes due to a URL toggle) would push our layers back
  // down, and the badges would render underneath the point symbols
  // they are meant to label.
  useTopOfStack(TOP_OF_STACK_LAYER_IDS);

  // Bail until the airspace source is mounted; layers referencing a
  // not-yet-registered source generate noisy warnings and never paint.
  if (state.status !== 'loaded') {
    return null;
  }

  return (
    <>
      <Layer {...featureFocusLayerProps} />
      <Layer {...badgeLayerProps} />
    </>
  );
}

/**
 * Builds the {@link LayerProps} for the per-feature focus outline,
 * sourcing the line color from the resolved highlight palette so a
 * theme switch flips the focused-polygon outline along with the rest
 * of the highlight chrome.
 */
function buildFeatureFocusLayerProps(
  filter: ExpressionSpecification,
  highlight: ChartHighlightColors,
): LayerProps {
  return {
    id: AIRSPACE_FEATURE_FOCUS_LAYER_ID,
    source: AIRSPACE_SOURCE_ID,
    type: 'line',
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    filter,
    paint: {
      'line-color': highlight.focusOutline,
      'line-width': 5,
      'line-opacity': 1,
    },
  };
}

/**
 * Builds the {@link LayerProps} for the per-feature badge label,
 * sourcing the text and halo colors from the resolved badge palette.
 */
function buildBadgeLayerProps(
  filter: ExpressionSpecification,
  badge: ChartAirspaceBadgeColors,
): LayerProps {
  return {
    id: AIRSPACE_FEATURE_BADGE_LAYER_ID,
    source: AIRSPACE_SOURCE_ID,
    type: 'symbol',
    layout: {
      'text-field': ['get', AIRSPACE_FEATURE_LABEL_PROPERTY],
      'text-font': ['Noto Sans Bold'],
      'text-size': 13,
      // Per-feature offset attached at projection time. Distributes
      // badges into a vertical column centered on the polygon
      // centroid so concentric rings (Class B) and stacked strata
      // (ARTCC) - whose centroids would otherwise sit on the same
      // pixel - end up readable at any zoom.
      'text-offset': ['get', AIRSPACE_BADGE_OFFSET_PROPERTY],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    filter,
    paint: {
      'text-color': badge.text,
      'text-halo-color': badge.halo,
      'text-halo-width': 2.5,
    },
  };
}
