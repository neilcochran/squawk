import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';
import type { LayerProps } from '@vis.gl/react-maplibre';
import type { Feature, FeatureCollection, Point } from 'geojson';
import type { Fix, FixUseCode } from '@squawk/types';
import { useFixDataset } from '../../../shared/data/fix-dataset.ts';

/**
 * Properties carried on each fix point feature in the GeoJSON source.
 * Kept narrow so the source payload stays small; richer fields are read
 * straight from the originating `Fix` record once entity inspection
 * lands.
 */
interface FixFeatureProperties {
  /** Fix identifier (e.g. "MERIT", "BOSCO"). */
  identifier: string;
  /** Usage category (`'WP'`, `'RP'`, `'MW'`, etc.). */
  useCode: FixUseCode;
  /** Whether the fix carries a compulsory reporting designation. */
  compulsory: boolean;
}

/** MapLibre source id for the fixes overlay. */
const FIXES_SOURCE_ID = 'atlas-fixes';

/** MapLibre layer id for the fixes circle symbology. */
const FIXES_LAYER_ID = 'atlas-fixes-circle';

/**
 * Fix usage codes we render. `CN` (computer navigation fix - internal FAA
 * automation) and `RADAR` (operational radar fix) are intentionally
 * excluded: neither is meaningful to a typical user browsing the chart.
 */
const RENDERED_FIX_USE_CODES: ReadonlySet<FixUseCode> = new Set<FixUseCode>([
  'WP',
  'RP',
  'MW',
  'MR',
  'VFR',
  'NRS',
]);

/**
 * Projects the bundled fix records into a GeoJSON `FeatureCollection`
 * suitable for a MapLibre `geojson` source. Filters to fixes with a
 * usage code in {@link RENDERED_FIX_USE_CODES}.
 */
function toFeatureCollection(records: Fix[]): FeatureCollection<Point, FixFeatureProperties> {
  const features: Feature<Point, FixFeatureProperties>[] = [];
  for (const fix of records) {
    if (!RENDERED_FIX_USE_CODES.has(fix.useCode)) {
      continue;
    }
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [fix.lon, fix.lat] },
      properties: {
        identifier: fix.identifier,
        useCode: fix.useCode,
        compulsory: fix.compulsory !== undefined,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

/**
 * MapLibre layer styling. Radius interpolates by zoom and is tiered by
 * usage so compulsory reporting points appear earliest, then enroute
 * waypoints and reporting points, then military and other categories.
 * Color uses an amber hue to distinguish fixes from the blue airports
 * and magenta navaids layers.
 */
const FIXES_LAYER_PROPS: LayerProps = {
  id: FIXES_LAYER_ID,
  source: FIXES_SOURCE_ID,
  type: 'circle',
  paint: {
    'circle-radius': [
      'interpolate',
      ['linear'],
      ['zoom'],
      5,
      ['case', ['get', 'compulsory'], 1.5, 0],
      7,
      ['case', ['get', 'compulsory'], 2.5, ['match', ['get', 'useCode'], ['WP', 'RP'], 1.5, 0]],
      9,
      ['match', ['get', 'useCode'], ['WP', 'RP'], 2.5, 1.5],
      12,
      3,
    ],
    'circle-color': '#ea580c',
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 0.75,
  },
};

/**
 * Chart-mode overlay that renders fixes from `@squawk/fix-data` as
 * MapLibre circle symbols. Returns `null` while the dataset is still being
 * fetched or if the load failed; callers needing fetch-state UI should read
 * the same hook directly.
 */
export function FixesLayer(): ReactElement | null {
  const state = useFixDataset();

  const data = useMemo<FeatureCollection<Point, FixFeatureProperties> | undefined>(() => {
    if (state.status !== 'loaded') {
      return undefined;
    }
    return toFeatureCollection(state.dataset.records);
  }, [state]);

  if (data === undefined) {
    return null;
  }

  return (
    <Source id={FIXES_SOURCE_ID} type="geojson" data={data}>
      <Layer {...FIXES_LAYER_PROPS} />
    </Source>
  );
}
