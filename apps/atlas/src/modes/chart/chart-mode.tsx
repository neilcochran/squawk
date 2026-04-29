import { useCallback, useState } from 'react';
import type { ReactElement } from 'react';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { MapProvider } from '@vis.gl/react-maplibre';
import type { MapLayerMouseEvent } from '@vis.gl/react-maplibre';
import { MapCanvas } from '../../shared/map/map-canvas.tsx';
import type { ViewStateChange } from '../../shared/map/map-canvas.tsx';
import { ZoomControls } from '../../shared/map/zoom-controls.tsx';
import { EntityInspector } from '../../shared/inspector/inspector.tsx';
import { ChartLoadingIndicator } from './chart-loading-indicator.tsx';
import { classifyClick, INSPECTABLE_LAYER_IDS, selectedFromFeature } from './click-to-select.ts';
import type { InspectableFeature } from './click-to-select.ts';
import { DisambiguationPopover } from './disambiguation-popover.tsx';
import { HighlightProvider } from './highlight-provider.tsx';
import { InspectableHoverCursor } from './inspectable-cursor.tsx';
import { ChartViewResetListener } from './view-reset-listener.tsx';
import { LayerToggle } from './layer-toggle.tsx';
import { AirportsLayer } from './layers/airports-layer.tsx';
import { AirspaceFeatureOverlayLayers, AirspaceLayer } from './layers/airspace-layer.tsx';
import { AirwayLegFocusLayer, AirwaysLayer } from './layers/airways-layer.tsx';
import { FixesLayer } from './layers/fixes-layer.tsx';
import { NavaidsLayer } from './layers/navaids-layer.tsx';
import { CHART_ROUTE_PATH } from './url-state.ts';

const route = getRouteApi(CHART_ROUTE_PATH);

/**
 * Returns the pixel radius of the bbox used for click feature lookup,
 * scaled by zoom. At high zoom (12+) we want a generous radius so
 * dense fix/navaid clusters and near-miss clicks land in the popover.
 * At low zoom (CONUS view), the same pixel radius spans hundreds of
 * nautical miles and pulls in dozens of unrelated features per click,
 * so we taper toward zero for a near-strict point query.
 *
 * Stops:
 * - zoom <= 5: 0px (point query)
 * - zoom 8: 4px
 * - zoom 12+: 10px
 *
 * Linear interpolation between stops.
 */
function clickQueryRadiusPx(zoom: number): number {
  if (zoom <= 5) {
    return 0;
  }
  if (zoom >= 12) {
    return 10;
  }
  if (zoom <= 8) {
    return ((zoom - 5) / (8 - 5)) * 4;
  }
  return 4 + ((zoom - 8) / (12 - 8)) * (10 - 4);
}

/**
 * Chart mode: an interactive aeronautical map. Renders the shared map
 * primitive with chart-specific overlays - airports, navaids, fixes,
 * airways, and airspace - each gated on the URL's active layer set, plus
 * the layer-toggle dropdown. Round-trips the view state and active layers
 * through the URL.
 */
export function ChartMode(): ReactElement {
  const { lat, lon, zoom, pitch, layers, selected } = route.useSearch();
  const navigate = useNavigate({ from: CHART_ROUTE_PATH });
  // Snapshot of every feature returned by the most recent map click. The
  // inspector reads this to render an "Also here" chip strip so the user
  // can switch between stacked features (e.g. Class B and ARTCC at the
  // same point) without re-clicking the map. Cleared/replaced on each
  // click; intentionally lives in component state, not URL, since it is
  // transient context for the most recent click rather than a shareable
  // selection.
  const [featuresAtLastClick, setFeaturesAtLastClick] = useState<readonly InspectableFeature[]>([]);
  // Selection of the chip the user is currently hovering in the inspector,
  // used to temporarily highlight that chip's feature on the map. Falls
  // back to the URL `selected` for the persistent highlight when no chip
  // is hovered. Lives in component state, not URL, since hover is
  // transient interaction state.
  const [hoveredChipSelection, setHoveredChipSelection] = useState<string | undefined>(undefined);
  // Index of the airspace feature whose inspector section is currently
  // hovered, used by the airspace layer's feature-focus filter to brighten
  // a single polygon inside a multi-feature airspace grouping. Cleared on
  // mouseLeave; component-local because the hover state should not survive
  // refreshes or be shareable via URL.
  const [hoveredFeatureIndex, setHoveredFeatureIndex] = useState<number | undefined>(undefined);
  // Index of the airway waypoint row that's currently hovered in the
  // inspector, used by the airway focus layer to brighten the
  // matching waypoint dot (and, when index > 0, its incoming leg) and
  // by the row-hover-pan hook to ease the camera if that area is
  // offscreen. Cleared on mouseLeave; component-local for the same
  // reasons as `hoveredFeatureIndex`.
  const [hoveredAirwayWaypointIndex, setHoveredAirwayWaypointIndex] = useState<number | undefined>(
    undefined,
  );
  // Snapshot of the most recent click that the click classifier ruled
  // ambiguous (e.g. an airway intersection or two close VORs at the
  // same pixel). Drives the disambiguation popover - when set, the
  // popover renders at `screen` listing every feature in `candidates`
  // and the URL `selected` is intentionally NOT updated until the user
  // either picks a row or dismisses. Cleared on selection, dismissal,
  // or any subsequent click.
  const [pendingDisambiguation, setPendingDisambiguation] = useState<
    { screen: { x: number; y: number }; candidates: readonly InspectableFeature[] } | undefined
  >(undefined);
  const activeHighlight = hoveredChipSelection ?? selected;

  const handleViewStateChange = useCallback(
    (view: ViewStateChange): void => {
      void navigate({
        search: (prev) => ({
          ...prev,
          lat: view.lat,
          lon: view.lon,
          zoom: view.zoom,
          pitch: view.pitch,
        }),
        replace: true,
      });
    },
    [navigate],
  );

  const handleMapClick = useCallback(
    (event: MapLayerMouseEvent): void => {
      // Widen from MapLibre's default point-query (`event.features`) to a
      // small bbox so dense fix/navaid clusters and near-miss clicks both
      // surface in the popover. The bbox is centered on the click pixel
      // and limited to inspectable layers so the basemap's roads, water,
      // and labels never enter the candidate set.
      //
      // `queryRenderedFeatures` throws when any layer id passed in
      // `layers` is not registered on the map's style (e.g. a layer
      // whose dataset is still loading and whose React component is
      // returning null, or a layer the user has toggled off). Filter
      // the id list down to the currently-registered subset so the
      // call never throws. MapLibre's older `event.features` path was
      // tolerant of missing layers; this path is not.
      const { x, y } = event.point;
      const liveLayerIds = INSPECTABLE_LAYER_IDS.filter(
        (id) => event.target.getLayer(id) !== undefined,
      );
      if (liveLayerIds.length === 0) {
        return;
      }
      const radius = clickQueryRadiusPx(event.target.getZoom());
      const features = event.target.queryRenderedFeatures(
        [
          [x - radius, y - radius],
          [x + radius, y + radius],
        ],
        { layers: liveLayerIds },
      );
      const classification = classifyClick(features);
      if (classification.kind === 'ambiguous') {
        // Defer URL/inspector updates until the user picks. Keep the
        // previous click's chip strip in place so the inspector stays
        // visually stable behind the popover.
        setPendingDisambiguation({
          screen: { x, y },
          candidates: classification.allFeatures,
        });
        return;
      }
      // Empty or unambiguous: replace the chip strip and the URL
      // selection, and clear any in-flight popover.
      setPendingDisambiguation(undefined);
      setFeaturesAtLastClick(features);
      const next =
        classification.kind === 'unambiguous'
          ? selectedFromFeature(classification.winner)
          : undefined;
      void navigate({
        search: (prev) => ({ ...prev, selected: next }),
        replace: true,
      });
    },
    [navigate],
  );

  const handleDisambiguationSelect = useCallback(
    (next: string): void => {
      // Promote the deferred candidates to the chip strip so the
      // inspector's "Also here" list reflects the click that produced
      // the popover (matching the post-auto-pick experience).
      setPendingDisambiguation((current) => {
        if (current !== undefined) {
          setFeaturesAtLastClick(current.candidates);
        }
        return undefined;
      });
      void navigate({
        search: (prev) => ({ ...prev, selected: next }),
        replace: true,
      });
    },
    [navigate],
  );

  const handleDisambiguationDismiss = useCallback((): void => {
    setPendingDisambiguation(undefined);
  }, []);

  // `<MapProvider>` lets the loading indicator (a sibling of MapCanvas)
  // reach the underlying MapLibre instance via `useMap()`, so it can
  // subscribe to the map's `idle` event and dismiss only after the
  // basemap and freshly-added layer sources have actually painted.
  // The loading indicator stays last in the JSX so its z-10 wash paints
  // on top of the layer-toggle button while data is still streaming.
  return (
    <MapProvider>
      <HighlightProvider
        activeHighlight={activeHighlight}
        setHoveredChipSelection={setHoveredChipSelection}
        hoveredFeatureIndex={hoveredFeatureIndex}
        setHoveredFeatureIndex={setHoveredFeatureIndex}
        hoveredAirwayWaypointIndex={hoveredAirwayWaypointIndex}
        setHoveredAirwayWaypointIndex={setHoveredAirwayWaypointIndex}
      >
        <MapCanvas
          lat={lat}
          lon={lon}
          zoom={zoom}
          pitch={pitch}
          onViewStateChange={handleViewStateChange}
          onMapClick={handleMapClick}
          interactiveLayerIds={INSPECTABLE_LAYER_IDS}
        >
          {layers.includes('airspace') ? <AirspaceLayer /> : null}
          {layers.includes('airways') ? <AirwaysLayer /> : null}
          {layers.includes('fixes') ? <FixesLayer /> : null}
          {layers.includes('navaids') ? <NavaidsLayer /> : null}
          {layers.includes('airports') ? <AirportsLayer /> : null}
          {/*
            Airspace feature-focus outline and per-feature badge labels
            mount LAST so MapLibre stacks them above every other source's
            layers - airport / navaid / fix circles included. Without
            this trailing position the badges sit underneath the point
            symbols and get visually clipped.
          */}
          {layers.includes('airspace') ? <AirspaceFeatureOverlayLayers /> : null}
          {/*
            Airway-leg focus mounts after the airspace overlay so a
            hovered leg's brighter stroke sits above every base layer
            and above the airspace feature focus / badge stack. The
            component returns null whenever the active selection is
            not an airway, so it costs nothing for non-airway views.
          */}
          {layers.includes('airways') ? <AirwayLegFocusLayer /> : null}
        </MapCanvas>
        <InspectableHoverCursor />
        <ChartViewResetListener />
        <LayerToggle />
        <ZoomControls />
        {pendingDisambiguation !== undefined ? (
          <DisambiguationPopover
            screen={pendingDisambiguation.screen}
            candidates={pendingDisambiguation.candidates}
            onSelect={handleDisambiguationSelect}
            onDismiss={handleDisambiguationDismiss}
          />
        ) : null}
        <EntityInspector siblings={featuresAtLastClick} />
        <ChartLoadingIndicator />
      </HighlightProvider>
    </MapProvider>
  );
}
