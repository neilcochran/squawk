import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
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
});
