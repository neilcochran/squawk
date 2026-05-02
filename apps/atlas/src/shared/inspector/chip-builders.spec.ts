import { describe, it, expect } from 'vitest';
import type { Feature, Polygon } from 'geojson';
import type { Airway, AirspaceFeature } from '@squawk/types';
import { AIRPORTS_LAYER_ID } from '../../modes/chart/layers/airports-layer.tsx';
import { AIRSPACE_FILL_LAYER_ID } from '../../modes/chart/layers/airspace-layer.tsx';
import type { InspectableFeature } from '../../modes/chart/click-to-select.ts';
import {
  buildInspectorChipList,
  buildOverlappingAirspaceChips,
  disambiguateLabels,
  footprintForSelection,
  MAX_OVERLAP_CHIPS,
} from './chip-builders.ts';
import { AIRSPACE_CEILING_FT_PROPERTY, AIRSPACE_FLOOR_FT_PROPERTY } from './airspace-feature.ts';
import type { ChartDatasetStates, ResolvedEntityState } from './entity-resolver.ts';

const ALL_CLASSES = [
  'CLASS_B',
  'CLASS_C',
  'CLASS_D',
  'CLASS_E',
  'MOA',
  'RESTRICTED',
  'PROHIBITED',
  'WARNING',
  'ALERT',
  'NSA',
  'ARTCC',
] as const;

function squarePolygon(x: number, y: number, size = 1): Polygon {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [x, y],
        [x + size, y],
        [x + size, y + size],
        [x, y + size],
        [x, y],
      ],
    ],
  };
}

function buildAirspaceFeature(overrides: {
  type: AirspaceFeature['type'];
  identifier: string;
  name?: string;
  ceilingFt?: number;
  floorFt?: number;
  boundary?: Polygon;
}): AirspaceFeature {
  return {
    type: overrides.type,
    identifier: overrides.identifier,
    name: overrides.name ?? '',
    floor: { valueFt: overrides.floorFt ?? 0, reference: 'SFC' },
    ceiling: { valueFt: overrides.ceilingFt ?? 10000, reference: 'MSL' },
    boundary: overrides.boundary ?? squarePolygon(0, 0),
    state: null,
    controllingFacility: null,
    scheduleDescription: null,
    artccStratum: null,
  };
}

function buildAirspaceGeoJsonFeature(overrides: {
  type: string;
  identifier: string;
  name?: string;
  ceilingFt?: number;
  floorFt?: number;
  geometry?: Polygon;
}): Feature<Polygon> {
  const geometry = overrides.geometry ?? squarePolygon(0, 0);
  return {
    type: 'Feature',
    geometry,
    properties: {
      type: overrides.type,
      identifier: overrides.identifier,
      name: overrides.name ?? '',
      floor: { valueFt: overrides.floorFt ?? 0, reference: 'SFC' },
      ceiling: { valueFt: overrides.ceilingFt ?? 10000, reference: 'MSL' },
      boundary: geometry,
      state: null,
      controllingFacility: null,
      scheduleDescription: null,
      artccStratum: null,
      [AIRSPACE_CEILING_FT_PROPERTY]: overrides.ceilingFt ?? 10000,
      [AIRSPACE_FLOOR_FT_PROPERTY]: overrides.floorFt ?? 0,
    },
  };
}

function buildAirway(overrides: Partial<Airway> & Pick<Airway, 'designation'>): Airway {
  return {
    designation: overrides.designation,
    type: overrides.type ?? 'VICTOR',
    region: overrides.region ?? 'US',
    waypoints: overrides.waypoints ?? [
      { identifier: 'A', lat: 0, lon: 0 } as never,
      { identifier: 'B', lat: 1, lon: 1 } as never,
    ],
  };
}

function buildDatasetStates(
  overrides: {
    airspaceFeatures?: Feature<Polygon>[];
    airwayRecords?: Airway[];
    airportRecords?: unknown[];
  } = {},
): ChartDatasetStates {
  return {
    airport: {
      status: 'loaded',
      dataset: { records: overrides.airportRecords ?? [] },
    } as never,
    navaid: { status: 'loaded', dataset: { records: [] } } as never,
    fix: { status: 'loaded', dataset: { records: [] } } as never,
    airway: {
      status: 'loaded',
      dataset: { records: overrides.airwayRecords ?? [] },
    } as never,
    airspace: {
      status: 'loaded',
      dataset: { features: overrides.airspaceFeatures ?? [] },
    } as never,
  };
}

describe('footprintForSelection', () => {
  it('returns undefined when the resolution is not "resolved"', () => {
    const idle: ResolvedEntityState = { status: 'idle' };
    expect(footprintForSelection(idle, ['airspace'])).toBeUndefined();
  });

  it('returns undefined for non-airspace, non-airway entities', () => {
    const state: ResolvedEntityState = {
      status: 'resolved',
      entity: {
        kind: 'airport',
        record: { faaId: 'BOS' } as never,
      },
    };
    expect(footprintForSelection(state, ['airports'])).toBeUndefined();
  });

  it('returns an airspace-polygons footprint when the airspace layer is active', () => {
    const feature = buildAirspaceFeature({
      type: 'CLASS_B',
      identifier: 'JFK',
      boundary: squarePolygon(0, 0),
    });
    const state: ResolvedEntityState = {
      status: 'resolved',
      entity: {
        kind: 'airspace',
        airspaceType: 'CLASS_B',
        identifier: 'JFK',
        features: [feature],
      },
    };
    const footprint = footprintForSelection(state, ['airspace']);
    expect(footprint?.kind).toBe('airspace-polygons');
    if (footprint?.kind === 'airspace-polygons') {
      expect(footprint.polygons).toHaveLength(1);
    }
  });

  it('returns undefined when the airspace layer is hidden', () => {
    const feature = buildAirspaceFeature({ type: 'CLASS_B', identifier: 'JFK' });
    const state: ResolvedEntityState = {
      status: 'resolved',
      entity: {
        kind: 'airspace',
        airspaceType: 'CLASS_B',
        identifier: 'JFK',
        features: [feature],
      },
    };
    expect(footprintForSelection(state, [])).toBeUndefined();
  });

  it('returns undefined when the airspace footprint has no usable bbox', () => {
    const feature = buildAirspaceFeature({
      type: 'CLASS_B',
      identifier: 'JFK',
      boundary: { type: 'Polygon', coordinates: [] },
    });
    const state: ResolvedEntityState = {
      status: 'resolved',
      entity: {
        kind: 'airspace',
        airspaceType: 'CLASS_B',
        identifier: 'JFK',
        features: [feature],
      },
    };
    expect(footprintForSelection(state, ['airspace'])).toBeUndefined();
  });

  it('returns an airway-bbox footprint when the airways layer is active', () => {
    const state: ResolvedEntityState = {
      status: 'resolved',
      entity: {
        kind: 'airway',
        record: buildAirway({ designation: 'V16' }),
      },
    };
    const footprint = footprintForSelection(state, ['airways']);
    expect(footprint?.kind).toBe('airway-bbox');
  });

  it('returns undefined when the airways layer is hidden', () => {
    const state: ResolvedEntityState = {
      status: 'resolved',
      entity: {
        kind: 'airway',
        record: buildAirway({ designation: 'V16' }),
      },
    };
    expect(footprintForSelection(state, [])).toBeUndefined();
  });

  it('returns undefined when the airway has no waypoints to bound', () => {
    const state: ResolvedEntityState = {
      status: 'resolved',
      entity: {
        kind: 'airway',
        record: buildAirway({ designation: 'V16', waypoints: [] }),
      },
    };
    expect(footprintForSelection(state, ['airways'])).toBeUndefined();
  });
});

describe('disambiguateLabels', () => {
  it('passes labels through unchanged when none repeat', () => {
    const chips = [
      { selection: 'a', label: 'BOS' },
      { selection: 'b', label: 'JFK' },
    ];
    expect(disambiguateLabels(chips)).toEqual(chips);
  });

  it('appends ascending suffixes to duplicate labels', () => {
    const chips = [
      { selection: 'a', label: 'BILLINGS CLASS E5' },
      { selection: 'b', label: 'BILLINGS CLASS E5' },
      { selection: 'c', label: 'BILLINGS CLASS E5' },
    ];
    expect(disambiguateLabels(chips).map((c) => c.label)).toEqual([
      'BILLINGS CLASS E5 (1)',
      'BILLINGS CLASS E5 (2)',
      'BILLINGS CLASS E5 (3)',
    ]);
  });

  it('only suffixes the labels that actually repeat', () => {
    const chips = [
      { selection: 'a', label: 'BOS' },
      { selection: 'b', label: 'JFK' },
      { selection: 'c', label: 'BOS' },
    ];
    const labels = disambiguateLabels(chips).map((c) => c.label);
    expect(labels).toEqual(['BOS (1)', 'JFK', 'BOS (2)']);
  });
});

describe('buildOverlappingAirspaceChips', () => {
  it('returns nothing when the airspace dataset has not loaded', () => {
    const states: ChartDatasetStates = {
      airport: { status: 'loaded', dataset: { records: [] } } as never,
      navaid: { status: 'loaded', dataset: { records: [] } } as never,
      fix: { status: 'loaded', dataset: { records: [] } } as never,
      airway: { status: 'loaded', dataset: { records: [] } } as never,
      airspace: { status: 'loading' } as never,
    };
    const result = Array.from(
      buildOverlappingAirspaceChips(
        { kind: 'airway-bbox', bbox: { minLon: 0, minLat: 0, maxLon: 1, maxLat: 1 } },
        undefined,
        states,
        new Set(),
        undefined,
        ALL_CLASSES,
      ),
    );
    expect(result).toEqual([]);
  });

  it('skips features whose class is not in the active set', () => {
    const states = buildDatasetStates({
      airspaceFeatures: [buildAirspaceGeoJsonFeature({ type: 'CLASS_B', identifier: 'JFK' })],
    });
    const result = Array.from(
      buildOverlappingAirspaceChips(
        { kind: 'airway-bbox', bbox: { minLon: 0, minLat: 0, maxLon: 1, maxLat: 1 } },
        undefined,
        states,
        new Set(),
        undefined,
        ['CLASS_C'],
      ),
    );
    expect(result).toEqual([]);
  });

  it('excludes the active selection key', () => {
    const states = buildDatasetStates({
      airspaceFeatures: [buildAirspaceGeoJsonFeature({ type: 'CLASS_B', identifier: 'JFK' })],
    });
    const result = Array.from(
      buildOverlappingAirspaceChips(
        { kind: 'airway-bbox', bbox: { minLon: 0, minLat: 0, maxLon: 1, maxLat: 1 } },
        'CLASS_B/JFK',
        states,
        new Set(),
        undefined,
        ALL_CLASSES,
      ),
    );
    expect(result).toEqual([]);
  });

  it('skips already-seen selections', () => {
    const states = buildDatasetStates({
      airspaceFeatures: [buildAirspaceGeoJsonFeature({ type: 'CLASS_B', identifier: 'JFK' })],
    });
    const result = Array.from(
      buildOverlappingAirspaceChips(
        { kind: 'airway-bbox', bbox: { minLon: 0, minLat: 0, maxLon: 1, maxLat: 1 } },
        undefined,
        states,
        new Set(['airspace:CLASS_B/JFK']),
        undefined,
        ALL_CLASSES,
      ),
    );
    expect(result).toEqual([]);
  });

  it('skips features whose bbox does not overlap the footprint', () => {
    const states = buildDatasetStates({
      airspaceFeatures: [
        buildAirspaceGeoJsonFeature({
          type: 'CLASS_B',
          identifier: 'JFK',
          geometry: squarePolygon(50, 50),
        }),
      ],
    });
    const result = Array.from(
      buildOverlappingAirspaceChips(
        { kind: 'airway-bbox', bbox: { minLon: 0, minLat: 0, maxLon: 1, maxLat: 1 } },
        undefined,
        states,
        new Set(),
        undefined,
        ALL_CLASSES,
      ),
    );
    expect(result).toEqual([]);
  });

  it('skips features whose centroid is outside the viewport', () => {
    const states = buildDatasetStates({
      airspaceFeatures: [
        buildAirspaceGeoJsonFeature({
          type: 'CLASS_B',
          identifier: 'JFK',
          geometry: squarePolygon(0, 0),
        }),
      ],
    });
    const result = Array.from(
      buildOverlappingAirspaceChips(
        { kind: 'airway-bbox', bbox: { minLon: 0, minLat: 0, maxLon: 1, maxLat: 1 } },
        undefined,
        states,
        new Set(),
        { minLon: 50, minLat: 50, maxLon: 60, maxLat: 60 },
        ALL_CLASSES,
      ),
    );
    expect(result).toEqual([]);
  });

  it('yields an airway-bbox-overlapping airspace feature with its altitude key', () => {
    const states = buildDatasetStates({
      airspaceFeatures: [
        buildAirspaceGeoJsonFeature({
          type: 'CLASS_B',
          identifier: 'JFK',
          ceilingFt: 7000,
          floorFt: 0,
          geometry: squarePolygon(0, 0),
        }),
      ],
    });
    const result = Array.from(
      buildOverlappingAirspaceChips(
        { kind: 'airway-bbox', bbox: { minLon: 0, minLat: 0, maxLon: 1, maxLat: 1 } },
        undefined,
        states,
        new Set(),
        undefined,
        ALL_CLASSES,
      ),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.selection).toBe('airspace:CLASS_B/JFK');
    expect(result[0]?.altitudeKey).toEqual({ ceilingFt: 7000, floorFt: 0 });
  });

  it('keeps airspace-polygons selections only when the polygons substantially overlap', () => {
    // Footprint: small square at origin. Two candidate features:
    // (a) overlapping polygon at origin, (b) far-away polygon that
    // should be filtered out by the overlap test.
    const overlapping = buildAirspaceGeoJsonFeature({
      type: 'CLASS_C',
      identifier: 'BOS',
      geometry: squarePolygon(0, 0),
    });
    const far = buildAirspaceGeoJsonFeature({
      type: 'CLASS_C',
      identifier: 'JFK',
      geometry: squarePolygon(100, 100),
    });
    const states = buildDatasetStates({ airspaceFeatures: [overlapping, far] });
    const result = Array.from(
      buildOverlappingAirspaceChips(
        {
          kind: 'airspace-polygons',
          polygons: [squarePolygon(0, 0)],
          bbox: { minLon: 0, minLat: 0, maxLon: 1, maxLat: 1 },
        },
        undefined,
        states,
        new Set(),
        undefined,
        ALL_CLASSES,
      ),
    );
    expect(result.map((r) => r.selection)).toEqual(['airspace:CLASS_C/BOS']);
  });

  it('skips features that are missing a usable selection encoding', () => {
    // Empty identifier with a malformed geometry can't be encoded.
    const noCentroid: Feature<Polygon> = {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [] },
      properties: {
        type: 'CLASS_B',
        identifier: '',
        name: 'NO ID',
        floor: { valueFt: 0, reference: 'SFC' },
        ceiling: { valueFt: 10000, reference: 'MSL' },
        boundary: { type: 'Polygon', coordinates: [] },
        state: null,
        controllingFacility: null,
        scheduleDescription: null,
        artccStratum: null,
      },
    };
    const states = buildDatasetStates({ airspaceFeatures: [noCentroid] });
    const result = Array.from(
      buildOverlappingAirspaceChips(
        { kind: 'airway-bbox', bbox: { minLon: 0, minLat: 0, maxLon: 1, maxLat: 1 } },
        undefined,
        states,
        new Set(),
        undefined,
        ALL_CLASSES,
      ),
    );
    expect(result).toEqual([]);
  });
});

describe('buildInspectorChipList', () => {
  function airportInspectableFeature(faaId: string): InspectableFeature {
    return {
      layer: { id: AIRPORTS_LAYER_ID },
      properties: { faaId },
    };
  }

  function airspaceInspectableFeature(type: string, identifier: string): InspectableFeature {
    return {
      layer: { id: AIRSPACE_FILL_LAYER_ID },
      properties: {
        type,
        identifier,
        name: '',
      },
    };
  }

  it('returns an empty list when there is no selection and no siblings', () => {
    const result = buildInspectorChipList({
      siblings: [],
      selected: undefined,
      datasets: buildDatasetStates(),
      state: { status: 'idle' },
      layers: ['airports'],
      airspaceClasses: [],
      viewportBounds: undefined,
    });
    expect(result).toEqual([]);
  });

  it('includes resolvable click siblings as chips', () => {
    const datasets = buildDatasetStates({
      airportRecords: [{ faaId: 'BOS' } as never],
    });
    const result = buildInspectorChipList({
      siblings: [airportInspectableFeature('BOS')],
      selected: undefined,
      datasets,
      state: { status: 'idle' },
      layers: ['airports'],
      airspaceClasses: [],
      viewportBounds: undefined,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.selection).toBe('airport:BOS');
    expect(result[0]?.type).toBe('airport');
  });

  it('drops siblings that resolve to not-found', () => {
    const datasets = buildDatasetStates({ airportRecords: [] });
    const result = buildInspectorChipList({
      siblings: [airportInspectableFeature('BOS')],
      selected: undefined,
      datasets,
      state: { status: 'idle' },
      layers: ['airports'],
      airspaceClasses: [],
      viewportBounds: undefined,
    });
    expect(result).toEqual([]);
  });

  it('skips sibling features whose selection encoding fails', () => {
    const datasets = buildDatasetStates();
    const noSelection: InspectableFeature = {
      layer: { id: AIRPORTS_LAYER_ID },
      properties: {},
    };
    const result = buildInspectorChipList({
      siblings: [noSelection],
      selected: undefined,
      datasets,
      state: { status: 'idle' },
      layers: ['airports'],
      airspaceClasses: [],
      viewportBounds: undefined,
    });
    expect(result).toEqual([]);
  });

  it('skips sibling features whose selection equals the active selected', () => {
    const datasets = buildDatasetStates({ airportRecords: [{ faaId: 'BOS' } as never] });
    const result = buildInspectorChipList({
      siblings: [airportInspectableFeature('BOS')],
      selected: 'airport:BOS',
      datasets,
      state: { status: 'idle' },
      layers: ['airports'],
      airspaceClasses: [],
      viewportBounds: undefined,
    });
    expect(result).toEqual([]);
  });

  it('dedupes sibling chips that share an encoded selection', () => {
    const datasets = buildDatasetStates({ airportRecords: [{ faaId: 'BOS' } as never] });
    const result = buildInspectorChipList({
      siblings: [airportInspectableFeature('BOS'), airportInspectableFeature('BOS')],
      selected: undefined,
      datasets,
      state: { status: 'idle' },
      layers: ['airports'],
      airspaceClasses: [],
      viewportBounds: undefined,
    });
    expect(result).toHaveLength(1);
  });

  it('extends the chip list with bbox-overlap airspace chips for an airspace selection', () => {
    const selectedFeature = buildAirspaceFeature({
      type: 'CLASS_B',
      identifier: 'JFK',
      boundary: squarePolygon(0, 0),
    });
    const overlap = buildAirspaceGeoJsonFeature({
      type: 'CLASS_B',
      identifier: 'BOS',
      ceilingFt: 7000,
      geometry: squarePolygon(0, 0),
    });
    const datasets = buildDatasetStates({ airspaceFeatures: [overlap] });
    const result = buildInspectorChipList({
      siblings: [],
      selected: 'airspace:CLASS_B/JFK',
      datasets,
      state: {
        status: 'resolved',
        entity: {
          kind: 'airspace',
          airspaceType: 'CLASS_B',
          identifier: 'JFK',
          features: [selectedFeature],
        },
      },
      layers: ['airspace'],
      airspaceClasses: ALL_CLASSES,
      viewportBounds: undefined,
    });
    expect(result.map((c) => c.selection)).toContain('airspace:CLASS_B/BOS');
  });

  it('caps overlap chips at MAX_OVERLAP_CHIPS', () => {
    const selectedFeature = buildAirspaceFeature({
      type: 'CLASS_B',
      identifier: 'JFK',
      boundary: squarePolygon(0, 0),
    });
    const features: Feature<Polygon>[] = [];
    for (let i = 0; i < MAX_OVERLAP_CHIPS + 5; i++) {
      features.push(
        buildAirspaceGeoJsonFeature({
          type: 'CLASS_B',
          identifier: `BOS${i}`,
          geometry: squarePolygon(0, 0),
        }),
      );
    }
    const datasets = buildDatasetStates({ airspaceFeatures: features });
    const result = buildInspectorChipList({
      siblings: [],
      selected: 'airspace:CLASS_B/JFK',
      datasets,
      state: {
        status: 'resolved',
        entity: {
          kind: 'airspace',
          airspaceType: 'CLASS_B',
          identifier: 'JFK',
          features: [selectedFeature],
        },
      },
      layers: ['airspace'],
      airspaceClasses: ALL_CLASSES,
      viewportBounds: undefined,
    });
    expect(result.length).toBeLessThanOrEqual(MAX_OVERLAP_CHIPS);
  });

  it('sorts airspace chips by altitude descending', () => {
    const selectedFeature = buildAirspaceFeature({
      type: 'CLASS_B',
      identifier: 'JFK',
      boundary: squarePolygon(0, 0),
    });
    const lowChip = airspaceInspectableFeature('CLASS_B', 'LOW_BOS');
    lowChip.properties = {
      ...lowChip.properties,
      [AIRSPACE_CEILING_FT_PROPERTY]: 5000,
      [AIRSPACE_FLOOR_FT_PROPERTY]: 0,
    };
    const highChip = airspaceInspectableFeature('CLASS_B', 'HIGH_BOS');
    highChip.properties = {
      ...highChip.properties,
      [AIRSPACE_CEILING_FT_PROPERTY]: 18000,
      [AIRSPACE_FLOOR_FT_PROPERTY]: 0,
    };
    const datasets = buildDatasetStates({
      airspaceFeatures: [
        buildAirspaceGeoJsonFeature({ type: 'CLASS_B', identifier: 'LOW_BOS' }),
        buildAirspaceGeoJsonFeature({ type: 'CLASS_B', identifier: 'HIGH_BOS' }),
      ],
    });
    const result = buildInspectorChipList({
      siblings: [lowChip, highChip],
      selected: 'airspace:CLASS_B/JFK',
      datasets,
      state: {
        status: 'resolved',
        entity: {
          kind: 'airspace',
          airspaceType: 'CLASS_B',
          identifier: 'JFK',
          features: [selectedFeature],
        },
      },
      layers: ['airspace'],
      airspaceClasses: ALL_CLASSES,
      viewportBounds: undefined,
    });
    const airspaceSelections = result.filter((c) => c.type === 'airspace').map((c) => c.selection);
    // HIGH_BOS (ceiling 18000) should sort before LOW_BOS (ceiling 5000).
    expect(airspaceSelections.indexOf('airspace:CLASS_B/HIGH_BOS')).toBeLessThan(
      airspaceSelections.indexOf('airspace:CLASS_B/LOW_BOS'),
    );
  });
});
