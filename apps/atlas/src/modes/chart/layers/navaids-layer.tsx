import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';
import type { LayerProps } from '@vis.gl/react-maplibre';
import type { Feature, FeatureCollection, Point } from 'geojson';
import type { Navaid, NavaidType } from '@squawk/types';
import { useNavaidDataset } from '../../../shared/data/navaid-dataset.ts';

/**
 * Properties carried on each navaid point feature in the GeoJSON source.
 * Kept narrow so the source payload stays small; richer fields are read
 * straight from the originating `Navaid` record once entity inspection
 * lands.
 */
interface NavaidFeatureProperties {
  /** Three-letter navaid identifier (e.g. "BOS"). */
  identifier: string;
  /** Official facility name (e.g. "BOSTON"). */
  name: string;
  /** Navaid type (`'VOR'`, `'VORTAC'`, `'NDB'`, etc.). */
  type: NavaidType;
}

/** MapLibre source id for the navaids overlay. */
const NAVAIDS_SOURCE_ID = 'atlas-navaids';

/** MapLibre layer id for the navaids circle symbology. */
const NAVAIDS_LAYER_ID = 'atlas-navaids-circle';

/**
 * Navaid types we render. `FAN_MARKER`, `MARINE_NDB`, and `VOT` are
 * intentionally excluded: too niche for a general chart view, and they
 * clutter at low zoom without informing typical IFR or VFR navigation.
 */
const RENDERED_NAVAID_TYPES: ReadonlySet<NavaidType> = new Set<NavaidType>([
  'VOR',
  'VORTAC',
  'VOR/DME',
  'TACAN',
  'DME',
  'NDB',
  'NDB/DME',
]);

/**
 * Projects the bundled navaid records into a GeoJSON `FeatureCollection`
 * suitable for a MapLibre `geojson` source. Filters to operational
 * navaids of types in {@link RENDERED_NAVAID_TYPES}; shutdown facilities
 * and niche types do not appear on this layer.
 */
function toFeatureCollection(records: Navaid[]): FeatureCollection<Point, NavaidFeatureProperties> {
  const features: Feature<Point, NavaidFeatureProperties>[] = [];
  for (const navaid of records) {
    if (navaid.status === 'SHUTDOWN') {
      continue;
    }
    if (!RENDERED_NAVAID_TYPES.has(navaid.type)) {
      continue;
    }
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [navaid.lon, navaid.lat] },
      properties: {
        identifier: navaid.identifier,
        name: navaid.name,
        type: navaid.type,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

/**
 * MapLibre layer styling. Radius interpolates by zoom and is tiered by
 * navaid type so the IFR backbone (`VOR`, `VORTAC`, `VOR/DME`) stays
 * visible at low zoom while DMEs and NDBs only appear once the user has
 * zoomed in. Color uses a magenta hue to distinguish navaids from the
 * blue/slate airports layer at a glance.
 */
const NAVAIDS_LAYER_PROPS: LayerProps = {
  id: NAVAIDS_LAYER_ID,
  source: NAVAIDS_SOURCE_ID,
  type: 'circle',
  paint: {
    'circle-radius': [
      'interpolate',
      ['linear'],
      ['zoom'],
      4,
      ['match', ['get', 'type'], ['VOR', 'VORTAC', 'VOR/DME'], 2, 0],
      6,
      ['match', ['get', 'type'], ['VOR', 'VORTAC', 'VOR/DME'], 3, ['TACAN', 'DME'], 1.5, 0],
      9,
      ['match', ['get', 'type'], ['VOR', 'VORTAC', 'VOR/DME'], 4, 2.5],
      12,
      5,
    ],
    'circle-color': '#7c3aed',
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 1,
  },
};

/**
 * Chart-mode overlay that renders navaids from `@squawk/navaid-data` as
 * MapLibre circle symbols. Returns `null` while the dataset is still being
 * fetched or if the load failed; callers needing fetch-state UI should read
 * the same hook directly.
 */
export function NavaidsLayer(): ReactElement | null {
  const state = useNavaidDataset();

  const data = useMemo<FeatureCollection<Point, NavaidFeatureProperties> | undefined>(() => {
    if (state.status !== 'loaded') {
      return undefined;
    }
    return toFeatureCollection(state.dataset.records);
  }, [state]);

  if (data === undefined) {
    return null;
  }

  return (
    <Source id={NAVAIDS_SOURCE_ID} type="geojson" data={data}>
      <Layer {...NAVAIDS_LAYER_PROPS} />
    </Source>
  );
}
