import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';
import type { LayerProps } from '@vis.gl/react-maplibre';
import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { Feature, FeatureCollection, Point } from 'geojson';
import type { Airport } from '@squawk/types';
import { useAirportDataset } from '../../../shared/data/airport-dataset.ts';
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
const AIRPORTS_HIGHLIGHT_LAYER_ID = 'atlas-airports-highlight';

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
 * Highlight overlay for the currently-selected (or chip-hovered) airport.
 * A larger yellow circle with a dark stroke, drawn on top of the regular
 * airport layer. Filtered to the active airport's `faaId`; renders
 * nothing when no airport is active.
 */
const AIRPORTS_HIGHLIGHT_LAYER_BASE: LayerProps = {
  id: AIRPORTS_HIGHLIGHT_LAYER_ID,
  source: AIRPORTS_SOURCE_ID,
  type: 'circle',
  paint: {
    'circle-radius': 9,
    'circle-color': '#fde047',
    'circle-stroke-color': '#0f172a',
    'circle-stroke-width': 2,
  },
};

/**
 * MapLibre layer styling. Radius interpolates by zoom and is gated by
 * runway length, so large airports stay visible at low zoom while smaller
 * fields appear as the user zooms in. Color separates major airports
 * (longest runway >= 8000 ft) from the rest.
 */
const AIRPORTS_LAYER_PROPS: LayerProps = {
  id: AIRPORTS_LAYER_ID,
  source: AIRPORTS_SOURCE_ID,
  type: 'circle',
  paint: {
    'circle-radius': [
      'interpolate',
      ['linear'],
      ['zoom'],
      4,
      ['case', ['>=', ['get', 'longestRunwayFt'], 8000], 2.5, 0],
      6,
      ['case', ['>=', ['get', 'longestRunwayFt'], 5000], 3, 1],
      9,
      ['case', ['>=', ['get', 'longestRunwayFt'], 3000], 4, 2],
      12,
      5,
    ],
    'circle-color': ['case', ['>=', ['get', 'longestRunwayFt'], 8000], '#1d4ed8', '#0f172a'],
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 1,
  },
};

/**
 * Chart-mode overlay that renders airports from `@squawk/airport-data` as
 * MapLibre circle symbols. Returns `null` while the dataset is still being
 * fetched or if the load failed; callers needing fetch-state UI should read
 * the same hook directly.
 */
export function AirportsLayer(): ReactElement | null {
  const state = useAirportDataset();
  const activeRef = useActiveHighlightRef();

  const data = useMemo<FeatureCollection<Point, AirportFeatureProperties> | undefined>(() => {
    if (state.status !== 'loaded') {
      return undefined;
    }
    return toFeatureCollection(state.dataset.records);
  }, [state]);

  const highlightLayerProps = useMemo<LayerProps>(() => {
    const filter: ExpressionSpecification =
      activeRef?.type === 'airport' ? ['==', ['get', 'faaId'], activeRef.id] : MATCH_NONE_FILTER;
    return { ...AIRPORTS_HIGHLIGHT_LAYER_BASE, filter };
  }, [activeRef]);

  if (data === undefined) {
    return null;
  }

  return (
    <Source id={AIRPORTS_SOURCE_ID} type="geojson" data={data}>
      <Layer {...AIRPORTS_LAYER_PROPS} />
      <Layer {...highlightLayerProps} />
    </Source>
  );
}
