import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Airport, Airway, AirspaceFeature, Fix, Navaid } from '@squawk/types';

import { useResolvedEntity } from './entity-resolver.ts';

const { airportStateMock, navaidStateMock, fixStateMock, airwayStateMock, airspaceStateMock } =
  vi.hoisted(() => ({
    airportStateMock: vi.fn(),
    navaidStateMock: vi.fn(),
    fixStateMock: vi.fn(),
    airwayStateMock: vi.fn(),
    airspaceStateMock: vi.fn(),
  }));

vi.mock('../data/airport-dataset.ts', () => ({ useAirportDataset: airportStateMock }));
vi.mock('../data/navaid-dataset.ts', () => ({ useNavaidDataset: navaidStateMock }));
vi.mock('../data/fix-dataset.ts', () => ({ useFixDataset: fixStateMock }));
vi.mock('../data/airway-dataset.ts', () => ({ useAirwayDataset: airwayStateMock }));
vi.mock('../data/airspace-dataset.ts', () => ({ useAirspaceDataset: airspaceStateMock }));

const sampleAirport: Airport = {
  faaId: 'BOS',
  icao: 'KBOS',
  name: 'GENERAL EDWARD LAWRENCE LOGAN INTL',
  facilityType: 'AIRPORT',
  ownershipType: 'PUBLIC',
  useType: 'PUBLIC',
  status: 'OPEN',
  city: 'BOSTON',
  state: 'MA',
  country: 'US',
  lat: 42.3643,
  lon: -71.0052,
  timezone: 'America/New_York',
  runways: [],
  frequencies: [],
};

const sampleNavaid: Navaid = {
  identifier: 'BOS',
  name: 'BOSTON',
  type: 'VOR/DME',
  status: 'OPERATIONAL_IFR',
  lat: 42.3643,
  lon: -71.0052,
  country: 'US',
};

const sampleFix: Fix = {
  identifier: 'MERIT',
  icaoRegionCode: 'K6',
  country: 'US',
  lat: 42.0,
  lon: -71.5,
  useCode: 'WP',
  pitch: false,
  catch: false,
  suaAtcaa: false,
  chartTypes: ['ENROUTE LOW'],
  navaidAssociations: [],
};

const sampleAirway: Airway = {
  designation: 'V16',
  type: 'VICTOR',
  region: 'US',
  waypoints: [],
};

function buildAirspaceFeature(
  overrides: Partial<AirspaceFeature> & Pick<AirspaceFeature, 'type' | 'identifier'>,
): AirspaceFeature {
  return {
    type: overrides.type,
    name: overrides.name ?? 'TEST AIRSPACE',
    identifier: overrides.identifier,
    floor: overrides.floor ?? { valueFt: 0, reference: 'SFC' },
    ceiling: overrides.ceiling ?? { valueFt: 10000, reference: 'MSL' },
    boundary: overrides.boundary ?? { type: 'Polygon', coordinates: [] },
    state: overrides.state ?? null,
    controllingFacility: overrides.controllingFacility ?? null,
    scheduleDescription: overrides.scheduleDescription ?? null,
    artccStratum: overrides.artccStratum ?? null,
  };
}

describe('useResolvedEntity', () => {
  beforeEach(() => {
    airportStateMock.mockReturnValue({ status: 'loaded', dataset: { records: [sampleAirport] } });
    navaidStateMock.mockReturnValue({ status: 'loaded', dataset: { records: [sampleNavaid] } });
    fixStateMock.mockReturnValue({ status: 'loaded', dataset: { records: [sampleFix] } });
    airwayStateMock.mockReturnValue({ status: 'loaded', dataset: { records: [sampleAirway] } });
    airspaceStateMock.mockReturnValue({ status: 'loaded', dataset: { features: [] } });
  });

  it('returns idle when selected is undefined', () => {
    const { result } = renderHook(() => useResolvedEntity(undefined));
    expect(result.current.status).toBe('idle');
  });

  it('returns idle when selected is malformed', () => {
    const { result } = renderHook(() => useResolvedEntity('not-a-valid-ref'));
    expect(result.current.status).toBe('idle');
  });

  it('resolves an airport reference', () => {
    const { result } = renderHook(() => useResolvedEntity('airport:BOS'));
    expect(result.current.status).toBe('resolved');
    if (result.current.status === 'resolved') {
      expect(result.current.entity.kind).toBe('airport');
      if (result.current.entity.kind === 'airport') {
        expect(result.current.entity.record.faaId).toBe('BOS');
      }
    }
  });

  it('returns not-found when the airport dataset has no matching record', () => {
    const { result } = renderHook(() => useResolvedEntity('airport:UNKNOWN'));
    expect(result.current.status).toBe('not-found');
  });

  it('returns loading when the relevant dataset is still loading', () => {
    airportStateMock.mockReturnValue({ status: 'loading' });
    const { result } = renderHook(() => useResolvedEntity('airport:BOS'));
    expect(result.current.status).toBe('loading');
  });

  it('resolves a navaid reference', () => {
    const { result } = renderHook(() => useResolvedEntity('navaid:BOS'));
    expect(result.current.status).toBe('resolved');
    if (result.current.status === 'resolved' && result.current.entity.kind === 'navaid') {
      expect(result.current.entity.record.identifier).toBe('BOS');
    }
  });

  it('resolves a fix reference', () => {
    const { result } = renderHook(() => useResolvedEntity('fix:MERIT'));
    expect(result.current.status).toBe('resolved');
    if (result.current.status === 'resolved' && result.current.entity.kind === 'fix') {
      expect(result.current.entity.record.identifier).toBe('MERIT');
    }
  });

  it('resolves an airway reference', () => {
    const { result } = renderHook(() => useResolvedEntity('airway:V16'));
    expect(result.current.status).toBe('resolved');
    if (result.current.status === 'resolved' && result.current.entity.kind === 'airway') {
      expect(result.current.entity.record.designation).toBe('V16');
    }
  });

  it('resolves an airspace compound key to all matching features', () => {
    const featureA = buildAirspaceFeature({
      type: 'CLASS_B',
      identifier: 'JFK',
      ceiling: { valueFt: 7000, reference: 'MSL' },
    });
    const featureB = buildAirspaceFeature({
      type: 'CLASS_B',
      identifier: 'JFK',
      ceiling: { valueFt: 10000, reference: 'MSL' },
    });
    const decoy = buildAirspaceFeature({ type: 'CLASS_C', identifier: 'JFK' });
    airspaceStateMock.mockReturnValue({
      status: 'loaded',
      dataset: {
        features: [
          { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] }, properties: featureA },
          { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] }, properties: featureB },
          { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] }, properties: decoy },
        ],
      },
    });
    const { result } = renderHook(() => useResolvedEntity('airspace:CLASS_B/JFK'));
    expect(result.current.status).toBe('resolved');
    if (result.current.status === 'resolved' && result.current.entity.kind === 'airspace') {
      expect(result.current.entity.airspaceType).toBe('CLASS_B');
      expect(result.current.entity.identifier).toBe('JFK');
      expect(result.current.entity.features).toHaveLength(2);
    }
  });

  it('returns not-found for an airspace compound key with no matching features', () => {
    const { result } = renderHook(() => useResolvedEntity('airspace:CLASS_B/UNKNOWN'));
    expect(result.current.status).toBe('not-found');
  });

  it('returns not-found for a malformed airspace compound key (missing slash)', () => {
    const { result } = renderHook(() => useResolvedEntity('airspace:JFK'));
    expect(result.current.status).toBe('not-found');
  });

  it('returns not-found when the airport dataset is in error', () => {
    airportStateMock.mockReturnValue({ status: 'error', error: new Error('boom') });
    const { result } = renderHook(() => useResolvedEntity('airport:BOS'));
    expect(result.current.status).toBe('not-found');
  });

  it('returns loading/not-found through the navaid pipeline', () => {
    navaidStateMock.mockReturnValue({ status: 'loading' });
    expect(renderHook(() => useResolvedEntity('navaid:BOS')).result.current.status).toBe('loading');
    navaidStateMock.mockReturnValue({ status: 'error', error: new Error('x') });
    expect(renderHook(() => useResolvedEntity('navaid:BOS')).result.current.status).toBe(
      'not-found',
    );
    navaidStateMock.mockReturnValue({ status: 'loaded', dataset: { records: [] } });
    expect(renderHook(() => useResolvedEntity('navaid:UNKNOWN')).result.current.status).toBe(
      'not-found',
    );
  });

  it('returns loading/not-found through the fix pipeline', () => {
    fixStateMock.mockReturnValue({ status: 'loading' });
    expect(renderHook(() => useResolvedEntity('fix:MERIT')).result.current.status).toBe('loading');
    fixStateMock.mockReturnValue({ status: 'error', error: new Error('x') });
    expect(renderHook(() => useResolvedEntity('fix:MERIT')).result.current.status).toBe(
      'not-found',
    );
    fixStateMock.mockReturnValue({ status: 'loaded', dataset: { records: [] } });
    expect(renderHook(() => useResolvedEntity('fix:UNKNOWN')).result.current.status).toBe(
      'not-found',
    );
  });

  it('returns loading/not-found through the airway pipeline', () => {
    airwayStateMock.mockReturnValue({ status: 'loading' });
    expect(renderHook(() => useResolvedEntity('airway:V16')).result.current.status).toBe('loading');
    airwayStateMock.mockReturnValue({ status: 'error', error: new Error('x') });
    expect(renderHook(() => useResolvedEntity('airway:V16')).result.current.status).toBe(
      'not-found',
    );
    airwayStateMock.mockReturnValue({ status: 'loaded', dataset: { records: [] } });
    expect(renderHook(() => useResolvedEntity('airway:UNKNOWN')).result.current.status).toBe(
      'not-found',
    );
  });

  it('returns loading/not-found through the airspace pipeline', () => {
    airspaceStateMock.mockReturnValue({ status: 'loading' });
    expect(renderHook(() => useResolvedEntity('airspace:CLASS_B/JFK')).result.current.status).toBe(
      'loading',
    );
    airspaceStateMock.mockReturnValue({ status: 'error', error: new Error('x') });
    expect(renderHook(() => useResolvedEntity('airspace:CLASS_B/JFK')).result.current.status).toBe(
      'not-found',
    );
  });

  it('returns not-found when the airspace compound key has an empty identifier (slash at end)', () => {
    const { result } = renderHook(() => useResolvedEntity('airspace:CLASS_B/'));
    expect(result.current.status).toBe('not-found');
  });

  it('resolves an airspace centroid-encoded selection', () => {
    const polygon = {
      type: 'Polygon' as const,
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
    const feature = buildAirspaceFeature({
      type: 'CLASS_E5',
      identifier: '',
      boundary: polygon,
    });
    airspaceStateMock.mockReturnValue({
      status: 'loaded',
      dataset: {
        features: [
          {
            type: 'Feature',
            geometry: polygon,
            properties: feature,
          },
        ],
      },
    });
    // Centroid of the unit square at origin per @squawk/geo's
    // polygonCentroid is approximately (0.4, 0.4); encode that.
    const { result } = renderHook(() => useResolvedEntity('airspace:CLASS_E5/c:0.40000,0.40000'));
    expect(result.current.status).toBe('resolved');
    if (result.current.status === 'resolved' && result.current.entity.kind === 'airspace') {
      expect(result.current.entity.identifier).toBe('');
    }
  });

  it('returns not-found for a centroid encoding with the wrong number of components', () => {
    const { result } = renderHook(() => useResolvedEntity('airspace:CLASS_E5/c:0.40000'));
    expect(result.current.status).toBe('not-found');
  });

  it('returns not-found for a centroid encoding with non-numeric coordinates', () => {
    const { result } = renderHook(() => useResolvedEntity('airspace:CLASS_E5/c:foo,bar'));
    expect(result.current.status).toBe('not-found');
  });

  it('orders matched airspace features by altitude descending', () => {
    // Insert in low-to-high order; the resolver must return high-to-low
    // so the inspector renders the top stratum first. Tie-break by floor
    // descending puts the outer Class B ring before its inner ring.
    const surfaceCore = buildAirspaceFeature({
      type: 'CLASS_B',
      identifier: 'JFK',
      floor: { valueFt: 0, reference: 'SFC' },
      ceiling: { valueFt: 7000, reference: 'MSL' },
    });
    const innerRing = buildAirspaceFeature({
      type: 'CLASS_B',
      identifier: 'JFK',
      floor: { valueFt: 0, reference: 'SFC' },
      ceiling: { valueFt: 10000, reference: 'MSL' },
    });
    const outerRing = buildAirspaceFeature({
      type: 'CLASS_B',
      identifier: 'JFK',
      floor: { valueFt: 3000, reference: 'MSL' },
      ceiling: { valueFt: 10000, reference: 'MSL' },
    });
    airspaceStateMock.mockReturnValue({
      status: 'loaded',
      dataset: {
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [] },
            properties: surfaceCore,
          },
          {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [] },
            properties: innerRing,
          },
          {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [] },
            properties: outerRing,
          },
        ],
      },
    });
    const { result } = renderHook(() => useResolvedEntity('airspace:CLASS_B/JFK'));
    expect(result.current.status).toBe('resolved');
    if (result.current.status === 'resolved' && result.current.entity.kind === 'airspace') {
      const ceilings = result.current.entity.features.map((f) => f.ceiling.valueFt);
      const floors = result.current.entity.features.map((f) => f.floor.valueFt);
      // outerRing (10k/3k) -> innerRing (10k/0) -> surfaceCore (7k/0)
      expect(ceilings).toEqual([10000, 10000, 7000]);
      expect(floors).toEqual([3000, 0, 0]);
    }
  });
});
