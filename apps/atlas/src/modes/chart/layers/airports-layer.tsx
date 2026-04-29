import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';
import type { LayerProps } from '@vis.gl/react-maplibre';
import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { Feature, FeatureCollection, Point } from 'geojson';
import type { Airport } from '@squawk/types';
import { useAirportDataset } from '../../../shared/data/airport-dataset.ts';
import { useChartColors } from '../../../shared/styles/chart-colors.ts';
import { useActiveHighlightRef } from '../highlight-context.ts';

/**
 * Properties carried on each airport point feature in the GeoJSON source.
 * Kept narrow so the source payload stays small; richer fields are read
 * straight from the originating `Airport` record once entity inspection
 * lands.
 */
interface AirportFeatureProperties {
  /** FAA location identifier (e.g. "JFK"). */
  faaId: string;
  /** ICAO code, when assigned (e.g. "KJFK"). */
  icao: string | undefined;
  /** Official facility name. */
  name: string;
  /** Length of the longest runway in feet, or 0 when unknown. */
  longestRunwayFt: number;
}

/** MapLibre source id for the airports overlay. */
const AIRPORTS_SOURCE_ID = 'atlas-airports';

/** MapLibre layer id for the airports circle symbology. */
export const AIRPORTS_LAYER_ID = 'atlas-airports-circle';

/** MapLibre layer id for the airport selection-highlight overlay. */
export const AIRPORTS_HIGHLIGHT_LAYER_ID = 'atlas-airports-highlight';

/**
 * Filter expression that matches no feature. Used as the default for the
 * highlight layer when nothing is selected (or when the active selection
 * is for a different entity type), so the highlight layer renders nothing
 * without unmounting and re-mounting.
 */
const MATCH_NONE_FILTER: ExpressionSpecification = ['==', ['get', 'faaId'], '__atlas-no-match__'];

/**
 * Returns the longest runway length in feet across an airport's runways,
 * or 0 when no runway has a known length.
 */
function longestRunwayFt(airport: Airport): number {
  let max = 0;
  for (const runway of airport.runways) {
    if (runway.lengthFt !== undefined && runway.lengthFt > max) {
      max = runway.lengthFt;
    }
  }
  return max;
}

/**
 * Projects the bundled airport records into a GeoJSON `FeatureCollection`
 * suitable for a MapLibre `geojson` source. Filters to `facilityType ===
 * 'AIRPORT'` so heliports, seaplane bases, and other facility types do not
 * appear on this layer; they will land in their own layers later.
 */
function toFeatureCollection(
  records: Airport[],
): FeatureCollection<Point, AirportFeatureProperties> {
  const features: Feature<Point, AirportFeatureProperties>[] = [];
  for (const airport of records) {
    if (airport.facilityType !== 'AIRPORT') {
      continue;
    }
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [airport.lon, airport.lat] },
      properties: {
        faaId: airport.faaId,
        icao: airport.icao,
        name: airport.name,
        longestRunwayFt: longestRunwayFt(airport),
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

/**
 * Per-tier zoom thresholds. An airport is visible at the current zoom
 * iff its tier's threshold is met. A `circle-radius: 0` paint stop is
 * not enough on its own - MapLibre still draws the 1px white stroke
 * around a zero-radius circle, leaving thousands of speck-sized
 * artifacts at CONUS zoom. The visibility filter on the layer below
 * skips those features entirely so they neither paint nor respond to
 * `queryRenderedFeatures`.
 */
const AIRPORT_MID_TIER_MIN_ZOOM = 6;
/** Visibility threshold for the 3000-4999 ft tier. */
const AIRPORT_SMALL_TIER_MIN_ZOOM = 9;
/** Visibility threshold for the < 3000 ft tier. */
const AIRPORT_TINY_TIER_MIN_ZOOM = 12;

/**
 * Visibility filter shared by every render of {@link AirportsLayer}.
 * Pulled out so the per-render `useMemo` building the layer props
 * does not need to recreate the filter array (which is color-
 * independent) when the theme changes.
 */
const AIRPORTS_VISIBILITY_FILTER: ExpressionSpecification = [
  'any',
  ['>=', ['get', 'longestRunwayFt'], 8000],
  ['all', ['>=', ['zoom'], AIRPORT_MID_TIER_MIN_ZOOM], ['>=', ['get', 'longestRunwayFt'], 5000]],
  ['all', ['>=', ['zoom'], AIRPORT_SMALL_TIER_MIN_ZOOM], ['>=', ['get', 'longestRunwayFt'], 3000]],
  ['>=', ['zoom'], AIRPORT_TINY_TIER_MIN_ZOOM],
];

/**
 * Chart-mode overlay that renders airports from `@squawk/airport-data` as
 * MapLibre circle symbols. Returns `null` while the dataset is still being
 * fetched or if the load failed; callers needing fetch-state UI should read
 * the same hook directly.
 *
 * Visibility is gated by runway length: only 8000-ft+ airports show at
 * low zoom, mid-size fields appear at z6, smaller ones at z9, and the
 * long tail at z12. Color separates major airports (longest runway
 * >= 8000 ft) from the rest. Within a single zoom stop every visible
 * airport renders at the same radius - the visibility filter controls
 * *whether* an airport is visible, while the radius interpolation only
 * controls how big the dot grows as the user zooms in. So when 5000-ft
 * airports appear at z6 they pop in at the same dot size as the
 * 8000-ft airports already on screen, rather than as tinier sub-class
 * specks.
 */
export function AirportsLayer(): ReactElement | null {
  const state = useAirportDataset();
  const activeRef = useActiveHighlightRef();
  const colors = useChartColors();

  const data = useMemo<FeatureCollection<Point, AirportFeatureProperties> | undefined>(() => {
    if (state.status !== 'loaded') {
      return undefined;
    }
    return toFeatureCollection(state.dataset.records);
  }, [state]);

  // Layer paint props are themed: re-memoize when the resolved chart
  // palette flips so MapLibre receives the new color values through
  // its declarative `paint` prop pipeline.
  const layerProps = useMemo<LayerProps>(
    () => ({
      id: AIRPORTS_LAYER_ID,
      source: AIRPORTS_SOURCE_ID,
      type: 'circle',
      filter: AIRPORTS_VISIBILITY_FILTER,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.5, 6, 3, 9, 4, 12, 5, 16, 10],
        'circle-color': [
          'case',
          ['>=', ['get', 'longestRunwayFt'], 8000],
          colors.airport.major,
          colors.airport.minor,
        ],
        'circle-stroke-color': colors.symbolStroke,
        'circle-stroke-width': 1,
      },
    }),
    [colors],
  );

  // Highlight overlay for the currently-selected (or chip-hovered)
  // airport. A larger yellow circle with a contrasting stroke, drawn
  // on top of the regular airport layer. Filtered to the active
  // airport's `faaId`; renders nothing when no airport is active.
  const highlightLayerProps = useMemo<LayerProps>(() => {
    const filter: ExpressionSpecification =
      activeRef?.type === 'airport' ? ['==', ['get', 'faaId'], activeRef.id] : MATCH_NONE_FILTER;
    return {
      id: AIRPORTS_HIGHLIGHT_LAYER_ID,
      source: AIRPORTS_SOURCE_ID,
      type: 'circle',
      filter,
      paint: {
        'circle-radius': 9,
        'circle-color': colors.highlight.primary,
        'circle-stroke-color': colors.highlight.stroke,
        'circle-stroke-width': 2,
      },
    };
  }, [activeRef, colors]);

  if (data === undefined) {
    return null;
  }

  return (
    <Source id={AIRPORTS_SOURCE_ID} type="geojson" data={data}>
      <Layer {...layerProps} />
      <Layer {...highlightLayerProps} />
    </Source>
  );
}
