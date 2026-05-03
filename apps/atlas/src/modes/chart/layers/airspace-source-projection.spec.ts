import type { Feature, FeatureCollection, Polygon } from 'geojson';
import { describe, it, expect } from 'vitest';

import {
  AIRSPACE_CEILING_FT_PROPERTY,
  AIRSPACE_CEILING_REF_PROPERTY,
  AIRSPACE_FLOOR_FT_PROPERTY,
  AIRSPACE_FLOOR_REF_PROPERTY,
  AIRSPACE_MATCH_KEY_PROPERTY,
} from '../../../shared/inspector/airspace-feature.ts';

import {
  AIRSPACE_BADGE_OFFSET_PROPERTY,
  AIRSPACE_FEATURE_COUNT_PROPERTY,
  AIRSPACE_FEATURE_INDEX_PROPERTY,
  AIRSPACE_FEATURE_LABEL_PROPERTY,
  projectAirspaceSource,
} from './airspace-source-projection.ts';

interface BuildFeatureParams {
  type: string;
  identifier: string;
  floor?: { valueFt: number; reference: 'MSL' | 'AGL' | 'SFC' };
  ceiling?: { valueFt: number; reference: 'MSL' | 'AGL' | 'SFC' };
  artccStratum?: string;
  geometry?: Polygon;
}

const SQUARE_AT_ORIGIN: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ],
};

const SQUARE_AT_TEN: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [10, 10],
      [11, 10],
      [11, 11],
      [10, 11],
      [10, 10],
    ],
  ],
};

function buildFeature(params: BuildFeatureParams): Feature {
  const props: Record<string, unknown> = {
    type: params.type,
    identifier: params.identifier,
  };
  if (params.floor !== undefined) {
    props['floor'] = params.floor;
  }
  if (params.ceiling !== undefined) {
    props['ceiling'] = params.ceiling;
  }
  if (params.artccStratum !== undefined) {
    props['artccStratum'] = params.artccStratum;
  }
  return {
    type: 'Feature',
    geometry: params.geometry ?? SQUARE_AT_ORIGIN,
    properties: props,
  };
}

function loadedState(features: Feature[]): Parameters<typeof projectAirspaceSource>[0] {
  return {
    status: 'loaded',
    dataset: {
      features,
      // The projection only reads `dataset.features`, so the metadata
      // shape can be a stub.
    } as never,
  };
}

describe('projectAirspaceSource', () => {
  it('returns undefined when the dataset is still loading', () => {
    expect(projectAirspaceSource({ status: 'loading' })).toBeUndefined();
  });

  it('returns undefined when the dataset has errored', () => {
    expect(projectAirspaceSource({ status: 'error', error: new Error('x') })).toBeUndefined();
  });

  it('annotates a single-feature airspace with index 0 and count 1', () => {
    const result = projectAirspaceSource(
      loadedState([
        buildFeature({
          type: 'CLASS_B',
          identifier: 'BOS',
          floor: { valueFt: 0, reference: 'SFC' },
          ceiling: { valueFt: 10000, reference: 'MSL' },
        }),
      ]),
    );
    expect(result).toBeDefined();
    const projected = (result as FeatureCollection).features[0];
    const props = projected?.properties;
    expect(props?.[AIRSPACE_MATCH_KEY_PROPERTY]).toBe('CLASS_B/BOS');
    expect(props?.[AIRSPACE_FEATURE_INDEX_PROPERTY]).toBe(0);
    expect(props?.[AIRSPACE_FEATURE_COUNT_PROPERTY]).toBe(1);
    expect(props?.[AIRSPACE_FEATURE_LABEL_PROPERTY]).toBe('1');
    expect(props?.[AIRSPACE_FLOOR_FT_PROPERTY]).toBe(0);
    expect(props?.[AIRSPACE_FLOOR_REF_PROPERTY]).toBe('SFC');
    expect(props?.[AIRSPACE_CEILING_FT_PROPERTY]).toBe(10000);
    expect(props?.[AIRSPACE_CEILING_REF_PROPERTY]).toBe('MSL');
    // Single-feature group: badge offset is centered at 0.
    expect(props?.[AIRSPACE_BADGE_OFFSET_PROPERTY]).toEqual([0, 0]);
  });

  it('assigns running indices and centered badge offsets across a multi-feature group', () => {
    const result = projectAirspaceSource(
      loadedState([
        buildFeature({ type: 'CLASS_B', identifier: 'BOS' }),
        buildFeature({ type: 'CLASS_B', identifier: 'BOS' }),
      ]),
    );
    const features = (result as FeatureCollection).features;
    expect(features).toHaveLength(2);
    expect(features[0]?.properties?.[AIRSPACE_FEATURE_INDEX_PROPERTY]).toBe(0);
    expect(features[1]?.properties?.[AIRSPACE_FEATURE_INDEX_PROPERTY]).toBe(1);
    for (const feature of features) {
      expect(feature.properties?.[AIRSPACE_FEATURE_COUNT_PROPERTY]).toBe(2);
    }
    // Two-feature column straddles the centroid: -0.7em then +0.7em.
    expect((features[0]?.properties?.[AIRSPACE_BADGE_OFFSET_PROPERTY] as number[])[1]).toBeCloseTo(
      -0.7,
    );
    expect((features[1]?.properties?.[AIRSPACE_BADGE_OFFSET_PROPERTY] as number[])[1]).toBeCloseTo(
      0.7,
    );
  });

  it('uses the artccStratum string as the badge label when present', () => {
    const result = projectAirspaceSource(
      loadedState([
        buildFeature({ type: 'ARTCC', identifier: 'ZBW', artccStratum: 'LOW' }),
        buildFeature({ type: 'ARTCC', identifier: 'ZBW', artccStratum: 'HIGH' }),
      ]),
    );
    const features = (result as FeatureCollection).features;
    expect(features[0]?.properties?.[AIRSPACE_FEATURE_LABEL_PROPERTY]).toBe('LOW');
    expect(features[1]?.properties?.[AIRSPACE_FEATURE_LABEL_PROPERTY]).toBe('HIGH');
  });

  it('falls back to a numeric index label when artccStratum is empty', () => {
    const result = projectAirspaceSource(
      loadedState([buildFeature({ type: 'ARTCC', identifier: 'ZBW', artccStratum: '' })]),
    );
    const feature = (result as FeatureCollection).features[0];
    expect(feature?.properties?.[AIRSPACE_FEATURE_LABEL_PROPERTY]).toBe('1');
  });

  it('omits primitive altitude properties when the source bound is malformed', () => {
    const feature = buildFeature({ type: 'CLASS_B', identifier: 'BOS' });
    const properties = feature.properties as Record<string, unknown>;
    properties['floor'] = { valueFt: 'not-a-number', reference: 'MSL' };
    properties['ceiling'] = { valueFt: 10000, reference: 'NONSENSE' };
    const result = projectAirspaceSource(loadedState([feature]));
    const projected = (result as FeatureCollection).features[0];
    expect(projected?.properties?.[AIRSPACE_FLOOR_FT_PROPERTY]).toBeUndefined();
    expect(projected?.properties?.[AIRSPACE_CEILING_FT_PROPERTY]).toBeUndefined();
  });

  it('omits primitive altitude properties when bounds are not objects', () => {
    const feature = buildFeature({ type: 'CLASS_B', identifier: 'BOS' });
    const properties = feature.properties as Record<string, unknown>;
    properties['floor'] = 'not-an-object';
    properties['ceiling'] = null;
    const result = projectAirspaceSource(loadedState([feature]));
    const projected = (result as FeatureCollection).features[0];
    expect(projected?.properties?.[AIRSPACE_FLOOR_FT_PROPERTY]).toBeUndefined();
    expect(projected?.properties?.[AIRSPACE_CEILING_FT_PROPERTY]).toBeUndefined();
  });

  it('skips bound copies when valueFt or reference are absent', () => {
    const feature = buildFeature({ type: 'CLASS_B', identifier: 'BOS' });
    const properties = feature.properties as Record<string, unknown>;
    properties['floor'] = { valueFt: 0 };
    properties['ceiling'] = { reference: 'MSL' };
    const result = projectAirspaceSource(loadedState([feature]));
    const projected = (result as FeatureCollection).features[0];
    expect(projected?.properties?.[AIRSPACE_FLOOR_FT_PROPERTY]).toBeUndefined();
    expect(projected?.properties?.[AIRSPACE_CEILING_FT_PROPERTY]).toBeUndefined();
  });

  it('passes through features whose properties are null', () => {
    const feature: Feature = {
      type: 'Feature',
      geometry: SQUARE_AT_ORIGIN,
      properties: null,
    };
    const result = projectAirspaceSource(loadedState([feature]));
    expect((result as FeatureCollection).features[0]).toEqual(feature);
  });

  it('passes through features whose geometry is not a Polygon', () => {
    const feature: Feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { type: 'CLASS_B', identifier: 'BOS' },
    };
    const result = projectAirspaceSource(loadedState([feature]));
    expect((result as FeatureCollection).features[0]).toEqual(feature);
  });

  it('passes through features whose type or identifier are missing', () => {
    const feature = buildFeature({ type: 'CLASS_B', identifier: 'BOS' });
    delete (feature.properties as Record<string, unknown>)['identifier'];
    const result = projectAirspaceSource(loadedState([feature]));
    const projected = (result as FeatureCollection).features[0];
    expect(projected?.properties?.[AIRSPACE_MATCH_KEY_PROPERTY]).toBeUndefined();
  });

  it('uses a polygon-centroid match key when the identifier is empty', () => {
    const result = projectAirspaceSource(
      loadedState([
        buildFeature({ type: 'CLASS_E5', identifier: '', geometry: SQUARE_AT_ORIGIN }),
        buildFeature({ type: 'CLASS_E5', identifier: '', geometry: SQUARE_AT_TEN }),
      ]),
    );
    const features = (result as FeatureCollection).features;
    const keys = features.map((f) => f.properties?.[AIRSPACE_MATCH_KEY_PROPERTY]);
    expect(keys[0]).toMatch(/^CLASS_E5\/c:0\.\d{5},0\.\d{5}$/);
    expect(keys[1]).toMatch(/^CLASS_E5\/c:10\.\d{5},10\.\d{5}$/);
    expect(keys[0]).not.toEqual(keys[1]);
    // Two distinct centroids -> distinct groups, both at index 0 / count 1.
    expect(features[0]?.properties?.[AIRSPACE_FEATURE_COUNT_PROPERTY]).toBe(1);
    expect(features[1]?.properties?.[AIRSPACE_FEATURE_COUNT_PROPERTY]).toBe(1);
  });
});
