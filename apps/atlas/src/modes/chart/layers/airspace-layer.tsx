import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
import { getRouteApi } from '@tanstack/react-router';
import { Source, Layer } from '@vis.gl/react-maplibre';
import type { LayerProps } from '@vis.gl/react-maplibre';
import { useMemo } from 'react';
import type { ReactElement } from 'react';

import type { AirspaceType } from '@squawk/types';

import { useAirspaceDataset } from '../../../shared/data/airspace-dataset.ts';
import {
  AIRSPACE_FLOOR_REF_PROPERTY,
  AIRSPACE_MATCH_KEY_PROPERTY,
} from '../../../shared/inspector/airspace-feature.ts';
import { useChartColors } from '../../../shared/styles/chart-colors.ts';
import type {
  ChartAirspaceColors,
  ChartHighlightColors,
} from '../../../shared/styles/chart-colors.ts';
import { useActiveHighlightRef, useHoveredFeatureIndex } from '../highlight-context.ts';
import { AIRSPACE_CLASS_TYPES, CHART_ROUTE_PATH } from '../url-state.ts';

import { AIRPORTS_HIGHLIGHT_LAYER_ID } from './airports-layer.tsx';
import {
  GROUND_ANCHORED_ALTITUDE_REFS,
  buildExtrusionBaseExpression,
  buildExtrusionHeightExpression,
  extrusionExaggerationForZoom,
} from './airspace-extrusion-scale.ts';
import { hatchImageId, useHatchPatternImage } from './airspace-hatch-pattern.ts';
import {
  AIRSPACE_FEATURE_INDEX_PROPERTY,
  projectAirspaceSource,
} from './airspace-source-projection.ts';
import { AIRWAYS_HIGHLIGHT_LAYER_ID } from './airways-layer.tsx';
import { FIXES_HIGHLIGHT_LAYER_ID } from './fixes-layer.tsx';
import { NAVAIDS_HIGHLIGHT_LAYER_ID } from './navaids-layer.tsx';
import { useMapZoom } from './use-map-zoom.ts';
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

/**
 * MapLibre layer id for the airspace selection-highlight outline
 * overlay. Draws at ground level, so once the camera tilts it is
 * restricted to airspace whose 3D box rests on the ground (see
 * {@link restrictToGroundAnchoredWhenTilted}); for everything else the
 * 3D selection indicator is {@link AIRSPACE_HIGHLIGHT_EXTRUSION_LAYER_ID}.
 */
export const AIRSPACE_HIGHLIGHT_LAYER_ID = 'atlas-airspace-highlight';

/**
 * MapLibre layer id for the cross-hatched fill rendered on top of the
 * selected airspace's interior. Helps the user spot the selection even
 * when the polygon's outline is partially or fully offscreen. Subject
 * to the same tilted-view restriction as {@link AIRSPACE_HIGHLIGHT_LAYER_ID}.
 */
export const AIRSPACE_HIGHLIGHT_FILL_LAYER_ID = 'atlas-airspace-highlight-fill';

/**
 * MapLibre layer id for the 3D selection-highlight extrusion. Renders
 * the currently-selected airspace as a high-opacity yellow box so the
 * selection is unmistakable in 3D view (the 2D ring + cross-hatch on
 * the ground are hard to spot from a tilted camera looking through
 * translucent stacked boxes). It sits BENEATH the regular extrusion in
 * the draw stack: boxes that overlap the selection blend over it at
 * their own low opacity, so the whole selected shape stays visible,
 * tinted wherever another box is in front, which is what tells the
 * user it is behind. The regular extrusion leaves the selected
 * airspace out so the box is not tinted by its own class color.
 * Hidden in plan view (pitch === 0) where the 2D ring on the ground
 * is the natural selection indicator. While an inspector section is
 * hovered, that feature's box is painted in the lighter focus color
 * (see {@link buildHighlightExtrusionColor}) so the per-feature focus
 * ring has a 3D counterpart.
 */
export const AIRSPACE_HIGHLIGHT_EXTRUSION_LAYER_ID = 'atlas-airspace-highlight-extrusion';

/**
 * MapLibre layer id for the per-feature focus outline that brightens a
 * single polygon inside a multi-feature airspace grouping when the user
 * hovers its section in the inspector. Sits above the entity-level
 * highlight so the focused ring stands out against its siblings. Draws
 * at ground level, so in the tilted view it is restricted to features
 * whose box rests on the ground; a floating feature is focused by
 * recoloring its box in {@link AIRSPACE_HIGHLIGHT_EXTRUSION_LAYER_ID}.
 */
export const AIRSPACE_FEATURE_FOCUS_LAYER_ID = 'atlas-airspace-feature-focus';

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
 * 2. Airspace 2D selection overlays (cross-hatch, ring) and the
 *    per-feature focus outline. These also paint at z=0 and sit
 *    BELOW the extrusions on purpose: MapLibre disables depth
 *    testing for every 2D layer stacked above the first 3D layer,
 *    so a ground ring pinned above the box would paint straight
 *    through the box's walls and top face. Below the box, the
 *    translucent extrusion blends over the ring instead, and the
 *    ring reads as the base edge of a box that rests on the ground.
 *    In plan view the extrusions are hidden, so these still land
 *    above every ground feature.
 * 3. {@link AIRSPACE_HIGHLIGHT_EXTRUSION_LAYER_ID} - high-opacity
 *    yellow 3D box for the currently-selected airspace. Drawn before
 *    the regular boxes so the ones in front of it blend over it
 *    instead of hiding it: the whole selected shape stays visible,
 *    and the tint says which boxes are in front.
 * 4. {@link AIRSPACE_FILL_EXTRUSION_LAYER_ID} - the regular
 *    low-opacity 3D airspace boxes, minus the selected airspace. Must
 *    paint above the ground layers so it visually occludes them at
 *    high pitch (the user expects the airspace volume to be on top of
 *    the ground points it covers, since the box is at altitude and
 *    the points are not). JSX child order alone is not sufficient
 *    because each ground layer mounts only when its dataset finishes
 *    loading - if navaids load after airspace, the navaid layer ends
 *    up topmost at the moment of registration.
 * 5. Ground point / line highlight layers (airport / navaid / fix /
 *    airway selection rings). Pinned above the 3D extrusion so the
 *    selection indicator stays visible for features whose lateral
 *    position falls inside an extruded box - without this pin the
 *    3D box's stacked alpha would wash the yellow ring out at high
 *    pitch. The same no-depth-test behavior that is a problem for
 *    the airspace ring is what keeps these legible.
 *
 * The numbered feature badges are not in this stack at all: they are a
 * DOM overlay (`AirspaceFeatureBadges`) above the whole canvas, which is
 * what lets them ride on a box's top face in the tilted view.
 *
 * JSX-order pinning would also work for items 3-4 in isolation, but
 * spelling out the order centrally here makes the priority explicit
 * and removes the cross-component coupling.
 */
const TOP_OF_STACK_LAYER_IDS = [
  // Airspace 2D selection overlays + focus outline, above the ground
  // features but below the 3D boxes so a box blends over them rather
  // than having them paint through it.
  AIRSPACE_HIGHLIGHT_FILL_LAYER_ID,
  AIRSPACE_HIGHLIGHT_LAYER_ID,
  AIRSPACE_FEATURE_FOCUS_LAYER_ID,
  // Selection-highlight 3D extrusion, pinned beneath the regular one
  // so overlapping boxes blend over the selection instead of hiding it.
  AIRSPACE_HIGHLIGHT_EXTRUSION_LAYER_ID,
  // Regular 3D extrusion (low opacity), pinned above ground features.
  AIRSPACE_FILL_EXTRUSION_LAYER_ID,
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
 * Filter clause matching features whose floor is one of
 * {@link GROUND_ANCHORED_ALTITUDE_REFS}, i.e. whose 3D box starts at
 * the surface.
 */
const GROUND_ANCHORED_FLOOR_CLAUSE: ExpressionSpecification = [
  'in',
  ['get', AIRSPACE_FLOOR_REF_PROPERTY],
  ['literal', [...GROUND_ANCHORED_ALTITUDE_REFS]],
];

/**
 * Restricts a ground-level airspace layer (fill, outline, selection
 * hatch and ring, per-feature focus ring) to features whose 3D box
 * rests on the ground once the camera is tilted. Every one of those
 * layers draws at z=0 regardless of pitch, so in the tilted view a
 * floating airspace (Class B outer rings at 3000-4000 ft MSL, MOAs
 * starting at FL050, and so on) would otherwise get a misleading
 * footprint on the ground beneath its box - and, for the selection
 * and focus overlays, a highlight on the ground instead of on the
 * feature. Clamping to {@link GROUND_ANCHORED_FLOOR_CLAUSE} keeps the
 * footprint only where the box meets the ground, where it reads as
 * the box's base edge; floating airspace reads purely as a 3D box,
 * with its selection and focus carried by the extrusion layers.
 *
 * In plan view the filter passes through untouched so every enabled
 * airspace keeps its full 2D rendering.
 */
function restrictToGroundAnchoredWhenTilted(
  filter: ExpressionSpecification,
  pitch: number,
): ExpressionSpecification {
  if (pitch > 0) {
    return ['all', filter, GROUND_ANCHORED_FLOOR_CLAUSE];
  }
  return filter;
}

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
    'CLASS_A',
    airspace.classA,
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
 * without rebuilding the source. Every layer here draws on the ground;
 * once the camera tilts they are restricted to airspace whose 3D box
 * rests on the ground (see {@link restrictToGroundAnchoredWhenTilted}).
 * Returns `null` while the dataset is still being fetched or if the
 * load failed.
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

  // Footprint filter shared by the fill and outline layers: the type
  // filter in plan view, narrowed to ground-anchored floors once the
  // camera tilts so floating airspace reads purely as a 3D box.
  const groundFilter = useMemo<ExpressionSpecification>(
    () => restrictToGroundAnchoredWhenTilted(filter, pitch),
    [filter, pitch],
  );

  // Polygon fill layer. Uses a low alpha so airspace boundaries read
  // as gentle tints rather than dominant blocks of color, leaving the
  // basemap and other overlays legible. Re-memoized when the resolved
  // palette flips so the type-color expression follows the theme.
  const fillLayerProps = useMemo<LayerProps>(
    () => ({
      id: AIRSPACE_FILL_LAYER_ID,
      source: AIRSPACE_SOURCE_ID,
      type: 'fill',
      filter: groundFilter,
      paint: {
        'fill-color': buildTypeColorExpression(colors.airspace),
        'fill-opacity': 0.08,
      },
    }),
    [groundFilter, colors],
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
      filter: groundFilter,
      paint: {
        'line-color': buildTypeColorExpression(colors.airspace),
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 8, 1.2, 12, 2],
        'line-opacity': 0.7,
      },
    }),
    [groundFilter, colors],
  );

  // Project the source dataset to add a synthetic match-key property
  // per feature. The chip / URL path encodes selections as either
  // `airspace:{TYPE}/{IDENTIFIER}` (named) or
  // `airspace:{TYPE}/c:{LON},{LAT}` (empty-id, centroid disambiguator);
  // mirroring that exact format here lets the highlight filter use a
  // single equality check that works for both. Memoized per dataset
  // inside the projection module, so the re-projection runs once per
  // dataset load, not per render.
  const sourceData = useMemo(() => projectAirspaceSource(state), [state]);

  // Same filter is shared between the highlight outline and the
  // cross-hatched highlight fill, so the outline + interior pattern
  // render together for whatever airspace is currently selected. Both
  // draw on the ground, so in the tilted view the selection match is
  // narrowed to ground-anchored floors and the 3D box in
  // {@link AirspaceExtrusionLayer} carries the selection for the rest.
  const highlightFilter = useMemo<ExpressionSpecification>(() => {
    if (activeRef?.type === 'airspace' && activeRef.id.length > 0) {
      return restrictToGroundAnchoredWhenTilted(
        ['==', ['get', AIRSPACE_MATCH_KEY_PROPERTY], activeRef.id],
        pitch,
      );
    }
    return MATCH_NONE_FILTER;
  }, [activeRef, pitch]);

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
 * flat fill and outline in {@link AirspaceLayer} stay drawn beneath a
 * box that rests on the ground, where they read as its base edge;
 * beneath a floating box they are filtered out, so the box is the
 * whole rendering. Clicks land on the boxes as well as on the flat
 * footprint - both extrusions are registered in `INSPECTABLE_LAYER_IDS`
 * alongside the fill and line layers.
 *
 * The box heights follow the live camera zoom through
 * {@link useMapZoom} and {@link extrusionExaggerationForZoom}: the
 * exaggeration multiplier is computed here and baked into the base /
 * height expressions as a constant, so every tile draws the same
 * altitude at the same height. A `['zoom']` expression would instead
 * be evaluated per tile at that tile's zoom level, and a tilted camera
 * loads distant tiles at lower zoom than nearby ones.
 *
 * `fill-extrusion-opacity` tuned to balance two competing goals: low
 * enough that stacked airspaces (Class B + ARTCC at the same
 * lat/lon) read as overlapping translucent boxes rather than the
 * topmost occluding the rest, but high enough that side-wall
 * silhouettes plus the default `fill-extrusion-vertical-gradient`
 * shading approximate visible edges - MapLibre has no fill-extrusion
 * outline / edge paint property, so explicit edge strokes on the 3D
 * box would require a different rendering library (deck.gl) or
 * custom WebGL.
 */
export function AirspaceExtrusionLayer(): ReactElement | null {
  const { airspaceClasses, pitch, zoom: urlZoom } = route.useSearch();
  const zoom = useMapZoom(urlZoom);
  const state = useAirspaceDataset();
  const activeRef = useActiveHighlightRef();
  const hoveredFeatureIndex = useHoveredFeatureIndex();
  const colors = useChartColors();

  const enabledTypes = useMemo<readonly AirspaceType[]>(
    () => airspaceClasses.flatMap((cls) => AIRSPACE_CLASS_TYPES[cls]),
    [airspaceClasses],
  );

  // Regular boxes: every enabled type except the selected airspace,
  // which the highlight extrusion draws instead. Leaving it in here
  // would blend its class color over the yellow highlight box.
  const filter = useMemo<ExpressionSpecification>(() => {
    const typeFilter: ExpressionSpecification = [
      'in',
      ['get', 'type'],
      ['literal', [...enabledTypes]],
    ];
    if (activeRef?.type === 'airspace' && activeRef.id.length > 0) {
      return ['all', typeFilter, ['!=', ['get', AIRSPACE_MATCH_KEY_PROPERTY], activeRef.id]];
    }
    return typeFilter;
  }, [enabledTypes, activeRef]);

  const exaggeration = extrusionExaggerationForZoom(zoom);

  // Base and height expressions at the live exaggeration. The builders
  // own the ceiling cap, the ground-anchored collapse, and the per-type
  // depth lift that keeps coincident tops from blending into each
  // other; a feature whose ceiling is itself SFC / AGL collapses to a
  // zero-thickness extrusion, and its ground-anchored floor keeps its
  // 2D fill / outline drawn at any pitch so it stays selectable.
  const baseExpression = useMemo<ExpressionSpecification>(
    () => buildExtrusionBaseExpression(exaggeration),
    [exaggeration],
  );
  const heightExpression = useMemo<ExpressionSpecification>(
    () => buildExtrusionHeightExpression(exaggeration),
    [exaggeration],
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
        'fill-extrusion-base': baseExpression,
        'fill-extrusion-height': heightExpression,
        'fill-extrusion-opacity': 0.5,
      },
    }),
    [filter, colors, pitch, baseExpression, heightExpression],
  );

  // 3D selection-highlight extrusion. Renders only the polygon whose
  // synthetic match-key matches the active selection, painted in the
  // highlight color at high opacity so the chosen airspace pops out
  // of the surrounding low-opacity 3D field. Without this layer the
  // selection in 3D view is signalled only by the 2D ring + cross-
  // hatch on the ground, which is hard to spot from a tilted camera
  // looking through the regular 0.5-opacity extrusion of every
  // overlapping class. It is pinned beneath the regular boxes (see
  // TOP_OF_STACK_LAYER_IDS) so the ones in front tint it rather than
  // hide it. While an inspector section is hovered, that
  // feature's box takes the lighter focus color so the per-feature
  // focus has a 3D counterpart - the 2D focus ring draws on the
  // ground and is filtered out beneath a floating feature.
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
        'fill-extrusion-color': buildHighlightExtrusionColor(colors.highlight, hoveredFeatureIndex),
        'fill-extrusion-base': baseExpression,
        'fill-extrusion-height': heightExpression,
        'fill-extrusion-opacity': 0.9,
      },
    }),
    [highlightFilter, colors, pitch, hoveredFeatureIndex, baseExpression, heightExpression],
  );

  // Bail until the airspace source is mounted; layers referencing a
  // not-yet-registered source generate noisy warnings and never
  // paint. The top-of-stack pinning that keeps these extrusions above
  // the ground-feature layers lives in {@link AirspaceFeatureOverlayLayers}
  // alongside the rest of the chart-mode top-stack chrome so the
  // order is centrally specified.
  if (state.status !== 'loaded') {
    return null;
  }

  return (
    <>
      <Layer {...highlightExtrusionLayerProps} />
      <Layer {...fillExtrusionLayerProps} />
    </>
  );
}

/**
 * Top-of-stack overlay layer for an airspace's per-feature focus
 * outline. Mounted as a sibling of every other chart layer (and
 * rendered AFTER airports / navaids / fixes), it references the
 * airspace source mounted by {@link AirspaceLayer} by id rather than
 * wrapping its own `<Source>` - one source, two layer subtrees. It also
 * owns the {@link useTopOfStack} call that re-asserts the chart-mode
 * overlay order, so the order is specified in one place.
 *
 * Renders nothing while the airspace dataset is still loading; the
 * filter resolves to "match nothing" when no airspace section is
 * hovered, so the layer is present but invisible until then. The
 * numbered feature badges are a DOM overlay (`AirspaceFeatureBadges`)
 * rather than a MapLibre layer, so they can be lifted onto a box's top
 * face in the tilted view.
 */
export function AirspaceFeatureOverlayLayers(): ReactElement | null {
  const { pitch } = route.useSearch();
  const state = useAirspaceDataset();
  const activeRef = useActiveHighlightRef();
  const hoveredFeatureIndex = useHoveredFeatureIndex();
  const colors = useChartColors();

  // Feature-focus filter: matches the polygon whose inspector section
  // is currently hovered. When no section is hovered (or no airspace
  // selected) the filter matches nothing so the layer is effectively
  // absent. The ring draws on the ground, so in the tilted view it is
  // narrowed to ground-anchored floors; a floating feature is focused
  // by the recolored highlight extrusion instead.
  const featureFocusFilter = useMemo<ExpressionSpecification>(() => {
    if (
      activeRef?.type === 'airspace' &&
      activeRef.id.length > 0 &&
      hoveredFeatureIndex !== undefined
    ) {
      return restrictToGroundAnchoredWhenTilted(
        [
          'all',
          ['==', ['get', AIRSPACE_MATCH_KEY_PROPERTY], activeRef.id],
          ['==', ['get', AIRSPACE_FEATURE_INDEX_PROPERTY], hoveredFeatureIndex],
        ],
        pitch,
      );
    }
    return MATCH_NONE_FILTER;
  }, [activeRef, hoveredFeatureIndex, pitch]);

  // Per-feature focus outline. Rendered on top of the entity-level
  // highlight stroke so the hovered feature stands out from its
  // siblings. Brighter, lighter yellow + slightly thicker line so the
  // eye registers it as "the one". Filter is empty (matches nothing)
  // when no inspector section is hovered.
  const featureFocusLayerProps = useMemo<LayerProps>(
    () => buildFeatureFocusLayerProps(featureFocusFilter, colors.highlight),
    [featureFocusFilter, colors],
  );

  // Re-assert the chart-mode overlay order (see TOP_OF_STACK_LAYER_IDS)
  // on every render. Without this, any subsequent re-add by the
  // airport / navaid / fix layer components (e.g. when their filter
  // expression changes due to a URL toggle) would push these layers
  // back down, and the selection rings would render underneath the
  // point symbols they are meant to frame.
  useTopOfStack(TOP_OF_STACK_LAYER_IDS);

  // Bail until the airspace source is mounted; a layer referencing a
  // not-yet-registered source generates noisy warnings and never paints.
  if (state.status !== 'loaded') {
    return null;
  }

  return <Layer {...featureFocusLayerProps} />;
}

/**
 * Builds the `fill-extrusion-color` for the 3D selection-highlight box.
 * With no inspector section hovered the whole selection is the primary
 * highlight color. While one is hovered, the feature at that index is
 * painted in the lighter focus color and its siblings stay primary, so
 * the hovered ring of a Class B or stratum of an ARTCC stands out in
 * 3D the way the focus ring does in plan view. Color is the only
 * per-feature paint lever on a fill-extrusion (opacity is layer-wide),
 * and keeping it inside the one highlight layer avoids depth-test
 * interplay between two extrusions of the same geometry.
 */
function buildHighlightExtrusionColor(
  highlight: ChartHighlightColors,
  hoveredFeatureIndex: number | undefined,
): string | ExpressionSpecification {
  if (hoveredFeatureIndex === undefined) {
    return highlight.primary;
  }
  return [
    'case',
    ['==', ['get', AIRSPACE_FEATURE_INDEX_PROPERTY], hoveredFeatureIndex],
    highlight.focusOutline,
    highlight.primary,
  ];
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
