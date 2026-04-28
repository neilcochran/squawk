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
import { AirspaceLayer } from './layers/airspace-layer.tsx';
import { AirwaysLayer } from './layers/airways-layer.tsx';
import { FixesLayer } from './layers/fixes-layer.tsx';
import { NavaidsLayer } from './layers/navaids-layer.tsx';
import { CHART_ROUTE_PATH } from './url-state.ts';

const route = getRouteApi(CHART_ROUTE_PATH);

/**
 * Pixel radius of the bbox used for click feature lookup. MapLibre's
 * default `event.features` (a strict-point query against the click
 * pixel) misses near-misses entirely - in dense fix or navaid clusters
 * a click 4-6 pixels off the symbol returns nothing inspectable, even
 * though the user clearly aimed at the cluster. Widening to a 10-pixel
 * bbox (so 21px square) lets the click classifier see every feature
 * the user could plausibly have meant. Tuned empirically against the
 * chart's symbol sizes; raise if dense clusters still feel finicky,
 * lower if visually distant features start sneaking into popovers.
 */
const CLICK_QUERY_RADIUS_PX = 10;

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
      const { x, y } = event.point;
      const features = event.target.queryRenderedFeatures(
        [
          [x - CLICK_QUERY_RADIUS_PX, y - CLICK_QUERY_RADIUS_PX],
          [x + CLICK_QUERY_RADIUS_PX, y + CLICK_QUERY_RADIUS_PX],
        ],
        { layers: [...INSPECTABLE_LAYER_IDS] },
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
