import type { Feature, FeatureCollection, Polygon } from 'geojson';
import { describe, it, expect } from 'vitest';

import {
  AIRSPACE_CEILING_FT_PROPERTY,
  AIRSPACE_CEILING_INCLUSIVE_PROPERTY,
  AIRSPACE_CEILING_REF_PROPERTY,
  AIRSPACE_FLOOR_FT_PROPERTY,
  AIRSPACE_FLOOR_INCLUSIVE_PROPERTY,
  AIRSPACE_FLOOR_REF_PROPERTY,
  AIRSPACE_MATCH_KEY_PROPERTY,
} from '../../../shared/inspector/airspace-feature.ts';

import {
  AIRSPACE_FEATURE_INDEX_PROPERTY,
  MAX_SOURCE_LATITUDE,
  airspaceBadgeGroups,
  getAirspaceProjection,
  projectAirspaceSource,
} from './airspace-source-projection.ts';

interface BuildFeatureParams {
  type: string;
  identifier: string;
  floor?: { valueFt: number; reference: 'MSL' | 'AGL' | 'SFC'; inclusive?: boolean };
  ceiling?: { valueFt: number; reference: 'MSL' | 'AGL' | 'SFC'; inclusive?: boolean };
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

/** A strip from the Alaska coast over both poles, the shape of an ARTCC that runs to the pole. */
const STRIP_POLE_TO_POLE: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-141, 90],
      [-141, -90],
      [-169, -90],
      [-169, 90],
      [-141, 90],
    ],
  ],
};

/** A cap from 80 north to the pole: its unclamped pole of inaccessibility sits at 85. */
const NORTH_CAP: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-141, 90],
      [-141, 80],
      [-169, 80],
      [-169, 90],
      [-141, 90],
    ],
  ],
};

/** A zero-area polygon: no pole of inaccessibility can be found for it. */
const DEGENERATE_LINE: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [5, 5],
      [6, 5],
      [5, 5],
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

/** Two rings of one Class B in dataset order: the lower ring first. */
function twoRingClassB(): Feature[] {
  return [
    buildFeature({
      type: 'CLASS_B',
      identifier: 'BOS',
      floor: { valueFt: 1000, reference: 'MSL' },
      ceiling: { valueFt: 7000, reference: 'MSL' },
      geometry: SQUARE_AT_ORIGIN,
    }),
    buildFeature({
      type: 'CLASS_B',
      identifier: 'BOS',
      floor: { valueFt: 4000, reference: 'MSL' },
      ceiling: { valueFt: 7000, reference: 'MSL' },
      geometry: SQUARE_AT_TEN,
    }),
  ];
}

describe('projectAirspaceSource', () => {
  it('returns undefined when the dataset is still loading', () => {
    expect(projectAirspaceSource({ status: 'loading' })).toBeUndefined();
    expect(airspaceBadgeGroups({ status: 'loading' })).toBeUndefined();
  });

  it('returns undefined when the dataset has errored', () => {
    expect(projectAirspaceSource({ status: 'error', error: new Error('x') })).toBeUndefined();
  });

  it('annotates a single-feature airspace with index 0 and no badge group', () => {
    const state = loadedState([
      buildFeature({
        type: 'CLASS_B',
        identifier: 'BOS',
        floor: { valueFt: 0, reference: 'SFC' },
        ceiling: { valueFt: 10000, reference: 'MSL' },
      }),
    ]);
    const result = projectAirspaceSource(state);
    expect(result).toBeDefined();
    const projected = (result as FeatureCollection).features[0];
    const props = projected?.properties;
    expect(props?.[AIRSPACE_MATCH_KEY_PROPERTY]).toBe('CLASS_B/BOS');
    expect(props?.[AIRSPACE_FEATURE_INDEX_PROPERTY]).toBe(0);
    expect(props?.[AIRSPACE_FLOOR_FT_PROPERTY]).toBe(0);
    expect(props?.[AIRSPACE_FLOOR_REF_PROPERTY]).toBe('SFC');
    expect(props?.[AIRSPACE_CEILING_FT_PROPERTY]).toBe(10000);
    expect(props?.[AIRSPACE_CEILING_REF_PROPERTY]).toBe('MSL');
    expect(airspaceBadgeGroups(state)?.get('CLASS_B/BOS')).toBeUndefined();
  });

  it('flags an exclusive bound and leaves an inclusive one unflagged', () => {
    const result = projectAirspaceSource(
      loadedState([
        buildFeature({
          type: 'MOA',
          identifier: 'MEUREKAL',
          floor: { valueFt: 5000, reference: 'MSL', inclusive: false },
          ceiling: { valueFt: 18000, reference: 'MSL', inclusive: false },
        }),
        buildFeature({
          type: 'CLASS_B',
          identifier: 'BOS',
          floor: { valueFt: 0, reference: 'SFC' },
          ceiling: { valueFt: 7000, reference: 'MSL', inclusive: true },
        }),
      ]),
    );
    const [moa, classB] = (result as FeatureCollection).features;
    expect(moa?.properties?.[AIRSPACE_FLOOR_INCLUSIVE_PROPERTY]).toBe(false);
    expect(moa?.properties?.[AIRSPACE_CEILING_INCLUSIVE_PROPERTY]).toBe(false);
    expect(classB?.properties).not.toHaveProperty(AIRSPACE_FLOOR_INCLUSIVE_PROPERTY);
    expect(classB?.properties).not.toHaveProperty(AIRSPACE_CEILING_INCLUSIVE_PROPERTY);
  });

  it('numbers a multi-feature group highest layer first, not in dataset order', () => {
    const result = projectAirspaceSource(loadedState(twoRingClassB()));
    const features = (result as FeatureCollection).features;
    expect(features).toHaveLength(2);
    // The 4000 ft ring is dataset feature 2 but presents as Feature 1.
    expect(features[0]?.properties?.[AIRSPACE_FEATURE_INDEX_PROPERTY]).toBe(1);
    expect(features[1]?.properties?.[AIRSPACE_FEATURE_INDEX_PROPERTY]).toBe(0);
  });

  it('keeps dataset order for features that tie on altitude', () => {
    const result = projectAirspaceSource(
      loadedState([
        buildFeature({ type: 'CLASS_B', identifier: 'BOS', geometry: SQUARE_AT_ORIGIN }),
        buildFeature({ type: 'CLASS_B', identifier: 'BOS', geometry: SQUARE_AT_TEN }),
      ]),
    );
    const features = (result as FeatureCollection).features;
    expect(features[0]?.properties?.[AIRSPACE_FEATURE_INDEX_PROPERTY]).toBe(0);
    expect(features[1]?.properties?.[AIRSPACE_FEATURE_INDEX_PROPERTY]).toBe(1);
  });

  it('builds one badge per feature of a multi-feature group, anchored inside its own polygon', () => {
    const badges = airspaceBadgeGroups(loadedState(twoRingClassB()))?.get('CLASS_B/BOS');
    expect(badges).toBeDefined();
    expect(badges).toHaveLength(2);
    const first = badges?.[0];
    const second = badges?.[1];
    // Presentation order: the 4000 ft ring (at 10..11) is Feature 1.
    expect(first?.featureIndex).toBe(0);
    expect(first?.label).toBe('1');
    expect(first?.anchor[0]).toBeGreaterThan(10);
    expect(first?.anchor[0]).toBeLessThan(11);
    expect(first?.anchor[1]).toBeGreaterThan(10);
    expect(first?.anchor[1]).toBeLessThan(11);
    expect(first?.ceiling).toEqual({ valueFt: 7000, reference: 'MSL' });
    expect(second?.featureIndex).toBe(1);
    expect(second?.label).toBe('2');
    expect(second?.anchor[0]).toBeGreaterThan(0);
    expect(second?.anchor[0]).toBeLessThan(1);
    // Distinct anchors: no column spreading.
    expect(first?.columnOffsetEm).toBe(0);
    expect(second?.columnOffsetEm).toBe(0);
  });

  it('spreads badges that share an anchor into a centered column', () => {
    const badges = airspaceBadgeGroups(
      loadedState([
        buildFeature({ type: 'ARTCC', identifier: 'ZBW', artccStratum: 'LOW' }),
        buildFeature({ type: 'ARTCC', identifier: 'ZBW', artccStratum: 'HIGH' }),
      ]),
    )?.get('ARTCC/ZBW');
    expect(badges).toHaveLength(2);
    expect(badges?.[0]?.columnOffsetEm).toBeCloseTo(-0.7);
    expect(badges?.[1]?.columnOffsetEm).toBeCloseTo(0.7);
  });

  it('uses the artccStratum string as the badge label when present', () => {
    const badges = airspaceBadgeGroups(
      loadedState([
        buildFeature({ type: 'ARTCC', identifier: 'ZBW', artccStratum: 'LOW' }),
        buildFeature({ type: 'ARTCC', identifier: 'ZBW', artccStratum: 'HIGH' }),
      ]),
    )?.get('ARTCC/ZBW');
    expect(badges?.map((badge) => badge.label)).toEqual(['LOW', 'HIGH']);
  });

  it('falls back to a numeric label when artccStratum is empty', () => {
    const badges = airspaceBadgeGroups(
      loadedState([
        buildFeature({ type: 'ARTCC', identifier: 'ZBW', artccStratum: '' }),
        buildFeature({ type: 'ARTCC', identifier: 'ZBW', artccStratum: '' }),
      ]),
    )?.get('ARTCC/ZBW');
    expect(badges?.map((badge) => badge.label)).toEqual(['1', '2']);
  });

  it('skips the badge of a feature whose polygon has no interior', () => {
    const badges = airspaceBadgeGroups(
      loadedState([
        buildFeature({ type: 'CLASS_B', identifier: 'BOS', geometry: SQUARE_AT_ORIGIN }),
        buildFeature({ type: 'CLASS_B', identifier: 'BOS', geometry: DEGENERATE_LINE }),
      ]),
    )?.get('CLASS_B/BOS');
    expect(badges).toHaveLength(1);
    expect(badges?.[0]?.featureIndex).toBe(0);
  });

  it('memoizes the projection on the dataset object', () => {
    const state = loadedState(twoRingClassB());
    if (state.status !== 'loaded') {
      throw new Error('expected a loaded state');
    }
    expect(getAirspaceProjection(state.dataset)).toBe(getAirspaceProjection(state.dataset));
    expect(projectAirspaceSource(state)).toBe(projectAirspaceSource(state));
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
    const state = loadedState([
      buildFeature({ type: 'CLASS_E5', identifier: '', geometry: SQUARE_AT_ORIGIN }),
      buildFeature({ type: 'CLASS_E5', identifier: '', geometry: SQUARE_AT_TEN }),
    ]);
    const result = projectAirspaceSource(state);
    const features = (result as FeatureCollection).features;
    const keys = features.map((f) => f.properties?.[AIRSPACE_MATCH_KEY_PROPERTY]);
    expect(keys[0]).toMatch(/^CLASS_E5\/c:0\.\d{5},0\.\d{5}$/);
    expect(keys[1]).toMatch(/^CLASS_E5\/c:10\.\d{5},10\.\d{5}$/);
    expect(keys[0]).not.toEqual(keys[1]);
    // Two distinct centroids -> distinct single-feature groups: index 0
    // each and no badges.
    expect(features[0]?.properties?.[AIRSPACE_FEATURE_INDEX_PROPERTY]).toBe(0);
    expect(features[1]?.properties?.[AIRSPACE_FEATURE_INDEX_PROPERTY]).toBe(0);
    expect(airspaceBadgeGroups(state)?.size).toBe(0);
  });
});

describe('polar geometry', () => {
  it('clamps vertices beyond the Mercator edge to MAX_SOURCE_LATITUDE in the source geometry', () => {
    const feature = buildFeature({
      type: 'ARTCC',
      identifier: 'ZAN',
      geometry: STRIP_POLE_TO_POLE,
    });
    const result = projectAirspaceSource(loadedState([feature]));
    expect(result?.features[0]?.geometry).toEqual({
      type: 'Polygon',
      coordinates: [
        [
          [-141, MAX_SOURCE_LATITUDE],
          [-141, -MAX_SOURCE_LATITUDE],
          [-169, -MAX_SOURCE_LATITUDE],
          [-169, MAX_SOURCE_LATITUDE],
          [-141, MAX_SOURCE_LATITUDE],
        ],
      ],
    });
    expect(STRIP_POLE_TO_POLE.coordinates[0]?.[0]?.[1]).toBe(90);
  });

  it('keeps the geometry object of a feature with nothing to clamp', () => {
    const feature = buildFeature({
      type: 'CLASS_B',
      identifier: 'BOS',
      geometry: SQUARE_AT_ORIGIN,
    });
    const result = projectAirspaceSource(loadedState([feature]));
    expect(result?.features[0]?.geometry).toBe(SQUARE_AT_ORIGIN);
  });

  it('computes an empty-identifier match key from the unclamped dataset geometry', () => {
    // The entity resolver and the search index derive the centroid from
    // the dataset polygon, so the key must come from the same vertices:
    // the mean latitude of NORTH_CAP is 86 as stored and 83 once clamped.
    const feature = buildFeature({ type: 'CLASS_A', identifier: '', geometry: NORTH_CAP });
    const result = projectAirspaceSource(loadedState([feature]));
    expect(result?.features[0]?.properties?.[AIRSPACE_MATCH_KEY_PROPERTY]).toBe(
      'CLASS_A/c:-152.20000,86.00000',
    );
  });

  it('anchors the badges of a polar group inside the clamped shape', () => {
    const features = [
      buildFeature({
        type: 'ARTCC',
        identifier: 'ZAN',
        floor: { valueFt: 0, reference: 'SFC' },
        ceiling: { valueFt: 17999, reference: 'MSL' },
        artccStratum: 'LOW',
        geometry: NORTH_CAP,
      }),
      buildFeature({
        type: 'ARTCC',
        identifier: 'ZAN',
        floor: { valueFt: 18000, reference: 'MSL' },
        ceiling: { valueFt: 60000, reference: 'MSL' },
        artccStratum: 'HIGH',
        geometry: NORTH_CAP,
      }),
    ];
    const badges = airspaceBadgeGroups(loadedState(features))?.get('ARTCC/ZAN');
    expect(badges).toHaveLength(2);
    for (const badge of badges ?? []) {
      expect(badge.anchor[1]).toBeCloseTo((80 + MAX_SOURCE_LATITUDE) / 2, 1);
    }
  });
});
