import { describe, it, expect } from 'vitest';

import type { AirportSearchField, AirportSearchQuery, AirportSearchResult } from '@squawk/airports';
import type { AirspaceSearchField, AirspaceSearchResult } from '@squawk/airspace';
import type { AirwaySearchResult } from '@squawk/airways';
import type { FixSearchQuery, FixSearchResult } from '@squawk/fixes';
import type { NavaidSearchField, NavaidSearchResult } from '@squawk/navaids';
import type {
  Airport,
  AirspaceFeature,
  AirspaceType,
  AirwayType,
  Airway,
  Fix,
  Navaid,
} from '@squawk/types';

import { RENDERED_AIRPORT_FACILITY_TYPES, RENDERED_NAVAID_TYPES } from '../layers/drawable-sets.ts';

import { DEFAULT_RESULT_LIMIT, searchChartFeatures } from './search-features.ts';
import type { ChartSearchResolvers, ChartSearchResult } from './search-features.ts';
import type { LayerVisibility, SearchScope } from './search-scope.ts';

/**
 * Builds a minimal {@link Airport} record, defaulting every required field so
 * a test states only the attributes it asserts on.
 */
function makeAirport(overrides: Partial<Airport> = {}): Airport {
  return {
    faaId: 'TST',
    name: 'TEST FIELD',
    facilityType: 'AIRPORT',
    ownershipType: 'PUBLIC',
    useType: 'PUBLIC',
    status: 'OPEN',
    city: 'TESTVILLE',
    country: 'US',
    lat: 40,
    lon: -75,
    timezone: 'America/New_York',
    runways: [],
    frequencies: [],
    ...overrides,
  };
}

/**
 * Builds a minimal {@link Navaid} record, defaulting to an operational VOR.
 */
function makeNavaid(overrides: Partial<Navaid> = {}): Navaid {
  return {
    identifier: 'TST',
    name: 'TEST VOR',
    type: 'VOR',
    status: 'OPERATIONAL_IFR',
    lat: 41,
    lon: -73,
    country: 'US',
    ...overrides,
  };
}

/**
 * Builds a minimal {@link Fix} record.
 */
function makeFix(overrides: Partial<Fix> = {}): Fix {
  return {
    identifier: 'TESTT',
    icaoRegionCode: 'K6',
    country: 'US',
    lat: 42,
    lon: -71,
    useCode: 'WP',
    pitch: false,
    catch: false,
    suaAtcaa: false,
    chartTypes: [],
    navaidAssociations: [],
    ...overrides,
  };
}

/**
 * Builds a minimal {@link Airway} record with a two-waypoint route whose
 * bounding-box center is `{ lng: -72, lat: 43 }`.
 */
function makeAirway(overrides: Partial<Airway> = {}): Airway {
  return {
    designation: 'V1',
    type: 'VICTOR',
    region: 'US',
    waypoints: [
      { name: 'ALPHA', waypointType: 'FIX', lat: 42, lon: -71 },
      { name: 'BRAVO', waypointType: 'FIX', lat: 44, lon: -73 },
    ],
    ...overrides,
  };
}

/**
 * Builds a minimal {@link AirspaceFeature} whose square boundary has a
 * centroid of `[1.6, 1.6]`.
 */
function makeAirspace(overrides: Partial<AirspaceFeature> = {}): AirspaceFeature {
  return {
    type: 'CLASS_B',
    name: 'TEST BRAVO',
    identifier: 'TST',
    floor: { valueFt: 0, reference: 'SFC' },
    ceiling: { valueFt: 10000, reference: 'MSL' },
    boundary: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [4, 0],
          [4, 4],
          [0, 4],
          [0, 0],
        ],
      ],
    },
    state: null,
    controllingFacility: null,
    scheduleDescription: null,
    artccStratum: null,
    ...overrides,
  };
}

/**
 * Wraps an airport in a resolver search result with empty highlight ranges.
 */
function airportMatch(
  airport: Airport,
  score: number,
  matchedField: AirportSearchField = 'faaId',
): AirportSearchResult {
  return { airport, score, matchedField, ranges: [] };
}

/**
 * Wraps a navaid in a resolver search result with empty highlight ranges.
 */
function navaidMatch(
  navaid: Navaid,
  score: number,
  matchedField: NavaidSearchField = 'identifier',
): NavaidSearchResult {
  return { navaid, score, matchedField, ranges: [] };
}

/**
 * Wraps a fix in a resolver search result with empty highlight ranges.
 */
function fixMatch(fix: Fix, score: number): FixSearchResult {
  return { fix, score, matchedField: 'identifier', ranges: [] };
}

/**
 * Wraps an airway in a resolver search result with empty highlight ranges.
 */
function airwayMatch(airway: Airway, score: number): AirwaySearchResult {
  return { airway, score, matchedField: 'designation', ranges: [] };
}

/**
 * Wraps an airspace feature in a resolver search result with empty ranges.
 */
function airspaceMatch(
  feature: AirspaceFeature,
  score: number,
  matchedField: AirspaceSearchField = 'identifier',
): AirspaceSearchResult {
  return { feature, score, matchedField, ranges: [] };
}

/**
 * The canned per-dataset matches a fake resolver set returns, regardless of
 * the query it receives.
 */
interface CannedMatches {
  /** Airport matches returned by the fake airport resolver. */
  airports?: AirportSearchResult[];
  /** Navaid matches returned by the fake navaid resolver. */
  navaids?: NavaidSearchResult[];
  /** Fix matches returned by the fake fix resolver. */
  fixes?: FixSearchResult[];
  /** Airway matches returned by the fake airway resolver. */
  airways?: AirwaySearchResult[];
  /** Airspace matches returned by the fake airspace resolver. */
  airspace?: AirspaceSearchResult[];
}

/**
 * Builds a set of fake resolvers whose `search` ignores its query and returns
 * the supplied canned matches (or an empty list when none are given).
 */
function makeResolvers(canned: CannedMatches = {}): ChartSearchResolvers {
  return {
    airports: { search: () => canned.airports ?? [] },
    navaids: { search: () => canned.navaids ?? [] },
    fixes: { search: () => canned.fixes ?? [] },
    airways: { search: () => canned.airways ?? [] },
    airspace: { search: () => canned.airspace ?? [] },
  };
}

/**
 * Builds a {@link SearchScope} with every dataset disabled by default, so a
 * test enables only the kinds it exercises.
 */
function makeScope(overrides: Partial<SearchScope> = {}): SearchScope {
  return {
    airports: { enabled: false, types: RENDERED_AIRPORT_FACILITY_TYPES },
    navaids: { enabled: false, types: RENDERED_NAVAID_TYPES },
    fixes: { enabled: false },
    airways: { enabled: false, types: new Set<AirwayType>() },
    airspace: { enabled: false, types: new Set<AirspaceType>() },
    ...overrides,
  };
}

/**
 * Builds a {@link LayerVisibility} with every dataset visible by default.
 */
function makeVisibility(overrides: Partial<LayerVisibility> = {}): LayerVisibility {
  return {
    airports: true,
    navaids: true,
    fixes: true,
    airwayTypes: new Set<AirwayType>(['VICTOR']),
    airspaceTypes: new Set<AirspaceType>(['CLASS_B']),
    ...overrides,
  };
}

/**
 * Convenience runner that fills in a non-blank query and all-visible defaults.
 */
function run(params: {
  /** Search text, defaulting to a non-blank value. */
  text?: string;
  /** Resolver set to query. */
  resolvers: ChartSearchResolvers;
  /** Query scope. */
  scope: SearchScope;
  /** Layer visibility, defaulting to all visible. */
  visibility?: LayerVisibility;
  /** Result cap. */
  limit?: number;
  /** Minimum score forwarded to resolvers. */
  minScore?: number;
}): ChartSearchResult[] {
  return searchChartFeatures({
    text: params.text ?? 'bos',
    resolvers: params.resolvers,
    scope: params.scope,
    visibility: params.visibility ?? makeVisibility(),
    ...(params.limit !== undefined && { limit: params.limit }),
    ...(params.minScore !== undefined && { minScore: params.minScore }),
  });
}

describe('searchChartFeatures', () => {
  it('returns nothing for blank text without querying any resolver', () => {
    const throwing: ChartSearchResolvers = {
      airports: {
        search: () => {
          throw new Error('airports queried');
        },
      },
      navaids: {
        search: () => {
          throw new Error('navaids queried');
        },
      },
      fixes: {
        search: () => {
          throw new Error('fixes queried');
        },
      },
      airways: {
        search: () => {
          throw new Error('airways queried');
        },
      },
      airspace: {
        search: () => {
          throw new Error('airspace queried');
        },
      },
    };
    const results = run({
      text: '   ',
      resolvers: throwing,
      scope: makeScope({ airports: { enabled: true, types: RENDERED_AIRPORT_FACILITY_TYPES } }),
    });
    expect(results).toEqual([]);
  });

  it('does not query a dataset whose scope is disabled', () => {
    const resolvers: ChartSearchResolvers = {
      ...makeResolvers({ airports: [airportMatch(makeAirport({ faaId: 'BOS' }), 0.9)] }),
      navaids: {
        search: () => {
          throw new Error('navaids queried');
        },
      },
    };
    const results = run({
      resolvers,
      scope: makeScope({ airports: { enabled: true, types: RENDERED_AIRPORT_FACILITY_TYPES } }),
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.kind).toBe('airport');
  });

  it('merges results across datasets and sorts by descending score', () => {
    const results = run({
      resolvers: makeResolvers({
        airports: [airportMatch(makeAirport({ faaId: 'BOS' }), 0.5)],
        navaids: [navaidMatch(makeNavaid({ identifier: 'BOS' }), 0.9)],
        fixes: [fixMatch(makeFix({ identifier: 'BOSCO' }), 0.7)],
      }),
      scope: makeScope({
        airports: { enabled: true, types: RENDERED_AIRPORT_FACILITY_TYPES },
        navaids: { enabled: true, types: RENDERED_NAVAID_TYPES },
        fixes: { enabled: true },
      }),
    });
    expect(results.map((result) => result.kind)).toEqual(['navaid', 'fix', 'airport']);
    expect(results.map((result) => result.score)).toEqual([0.9, 0.7, 0.5]);
  });

  it('truncates the merged list to the default limit', () => {
    const matches = Array.from({ length: DEFAULT_RESULT_LIMIT + 5 }, (_unused, index) =>
      airportMatch(makeAirport({ faaId: `A${index}` }), 1 - index * 0.01),
    );
    const results = run({
      resolvers: makeResolvers({ airports: matches }),
      scope: makeScope({ airports: { enabled: true, types: RENDERED_AIRPORT_FACILITY_TYPES } }),
    });
    expect(results).toHaveLength(DEFAULT_RESULT_LIMIT);
  });

  it('honors a custom limit', () => {
    const results = run({
      resolvers: makeResolvers({
        airports: [
          airportMatch(makeAirport({ faaId: 'AAA' }), 0.9),
          airportMatch(makeAirport({ faaId: 'BBB' }), 0.8),
          airportMatch(makeAirport({ faaId: 'CCC' }), 0.7),
        ],
      }),
      scope: makeScope({ airports: { enabled: true, types: RENDERED_AIRPORT_FACILITY_TYPES } }),
      limit: 2,
    });
    expect(results.map((result) => result.label)).toEqual(['AAA', 'BBB']);
  });

  it('drops navaids the resolver returns that are not in the drawable corpus', () => {
    const results = run({
      resolvers: makeResolvers({
        navaids: [
          navaidMatch(
            makeNavaid({ identifier: 'GON', type: 'VOR', status: 'OPERATIONAL_IFR' }),
            0.9,
          ),
          navaidMatch(makeNavaid({ identifier: 'OLD', type: 'VOR', status: 'SHUTDOWN' }), 0.8),
          navaidMatch(
            makeNavaid({ identifier: 'VTX', type: 'VOT', status: 'OPERATIONAL_IFR' }),
            0.7,
          ),
        ],
      }),
      scope: makeScope({ navaids: { enabled: true, types: RENDERED_NAVAID_TYPES } }),
    });
    expect(results.map((result) => result.label)).toEqual(['GON']);
  });

  it('drops an airway with no waypoints to derive a center from', () => {
    const results = run({
      resolvers: makeResolvers({ airways: [airwayMatch(makeAirway({ waypoints: [] }), 0.9)] }),
      scope: makeScope({ airways: { enabled: true, types: new Set<AirwayType>(['VICTOR']) } }),
    });
    expect(results).toEqual([]);
  });

  it('centers an airway on its waypoint bounding box', () => {
    const results = run({
      resolvers: makeResolvers({ airways: [airwayMatch(makeAirway({ designation: 'V16' }), 0.9)] }),
      scope: makeScope({ airways: { enabled: true, types: new Set<AirwayType>(['VICTOR']) } }),
    });
    const result = results[0];
    expect(result?.kind).toBe('airway');
    expect(result?.selection).toBe('airway:V16');
    expect(result?.center).toEqual({ lng: -72, lat: 43 });
    if (result?.kind === 'airway') {
      expect(result.subtype).toBe('VICTOR');
      expect(result.bbox).toEqual({ minLon: -73, maxLon: -71, minLat: 42, maxLat: 44 });
    }
  });

  it('drops an airspace feature whose polygon has no computable centroid', () => {
    const results = run({
      resolvers: makeResolvers({
        airspace: [
          airspaceMatch(makeAirspace({ boundary: { type: 'Polygon', coordinates: [] } }), 0.9),
        ],
      }),
      scope: makeScope({ airspace: { enabled: true, types: new Set<AirspaceType>(['CLASS_B']) } }),
    });
    expect(results).toEqual([]);
  });

  it('encodes an airspace selection from its identifier when present', () => {
    const results = run({
      resolvers: makeResolvers({
        airspace: [
          airspaceMatch(
            makeAirspace({ type: 'CLASS_B', identifier: 'JFK', name: 'NEW YORK' }),
            0.9,
          ),
        ],
      }),
      scope: makeScope({ airspace: { enabled: true, types: new Set<AirspaceType>(['CLASS_B']) } }),
    });
    const result = results[0];
    expect(result?.selection).toBe('airspace:CLASS_B/JFK');
    expect(result?.label).toBe('CLASS B JFK');
    expect(result?.center.lng).toBeCloseTo(1.6, 10);
    expect(result?.center.lat).toBeCloseTo(1.6, 10);
  });

  it('encodes an empty-identifier airspace selection from its centroid', () => {
    const results = run({
      resolvers: makeResolvers({
        airspace: [
          airspaceMatch(makeAirspace({ type: 'CLASS_E5', identifier: '', name: 'PODUNK E5' }), 0.9),
        ],
      }),
      scope: makeScope({ airspace: { enabled: true, types: new Set<AirspaceType>(['CLASS_E5']) } }),
    });
    const result = results[0];
    expect(result?.selection).toBe('airspace:CLASS_E5/c:1.60000,1.60000');
    expect(result?.label).toBe('PODUNK E5');
  });

  it('selects the navaid matched text by matched field', () => {
    const results = run({
      resolvers: makeResolvers({
        navaids: [navaidMatch(makeNavaid({ identifier: 'BOS', name: 'BOSTON' }), 0.9, 'name')],
      }),
      scope: makeScope({ navaids: { enabled: true, types: RENDERED_NAVAID_TYPES } }),
    });
    const result = results[0];
    expect(result?.kind).toBe('navaid');
    if (result?.kind === 'navaid') {
      expect(result.matchedField).toBe('name');
      expect(result.matchedText).toBe('BOSTON');
      expect(result.subtype).toBe('VOR');
    }
  });

  it('selects the airspace matched text by matched field', () => {
    const results = run({
      resolvers: makeResolvers({
        airspace: [
          airspaceMatch(
            makeAirspace({ type: 'CLASS_B', identifier: 'JFK', name: 'NEW YORK' }),
            0.9,
            'name',
          ),
        ],
      }),
      scope: makeScope({ airspace: { enabled: true, types: new Set<AirspaceType>(['CLASS_B']) } }),
    });
    const result = results[0];
    if (result?.kind === 'airspace') {
      expect(result.matchedField).toBe('name');
      expect(result.matchedText).toBe('NEW YORK');
      expect(result.bbox).toEqual({ minLon: 0, maxLon: 4, minLat: 0, maxLat: 4 });
    }
  });

  it('passes the resolver highlight ranges through unchanged', () => {
    const match = airportMatch(makeAirport({ faaId: 'BOS' }), 0.9);
    const results = run({
      resolvers: makeResolvers({ airports: [match] }),
      scope: makeScope({ airports: { enabled: true, types: RENDERED_AIRPORT_FACILITY_TYPES } }),
    });
    expect(results[0]?.ranges).toBe(match.ranges);
  });

  it('tags a result hidden when its layer is not visible', () => {
    const visible = run({
      resolvers: makeResolvers({ airports: [airportMatch(makeAirport({ faaId: 'BOS' }), 0.9)] }),
      scope: makeScope({ airports: { enabled: true, types: RENDERED_AIRPORT_FACILITY_TYPES } }),
      visibility: makeVisibility({ airports: true }),
    });
    expect(visible[0]?.hidden).toBe(false);

    const hidden = run({
      resolvers: makeResolvers({ airports: [airportMatch(makeAirport({ faaId: 'BOS' }), 0.9)] }),
      scope: makeScope({ airports: { enabled: true, types: RENDERED_AIRPORT_FACILITY_TYPES } }),
      visibility: makeVisibility({ airports: false }),
    });
    expect(hidden[0]?.hidden).toBe(true);
  });

  it('tags an airway hidden when its type is absent from the visible types', () => {
    const results = run({
      resolvers: makeResolvers({ airways: [airwayMatch(makeAirway({ type: 'VICTOR' }), 0.9)] }),
      scope: makeScope({ airways: { enabled: true, types: new Set<AirwayType>(['VICTOR']) } }),
      visibility: makeVisibility({ airwayTypes: new Set<AirwayType>() }),
    });
    expect(results[0]?.hidden).toBe(true);
  });

  it('forwards the trimmed text, scope types, limit, and minScore to the resolvers', () => {
    let airportQuery: AirportSearchQuery | undefined;
    let fixQuery: FixSearchQuery | undefined;
    const resolvers: ChartSearchResolvers = {
      ...makeResolvers(),
      airports: {
        search: (query) => {
          airportQuery = query;
          return [];
        },
      },
      fixes: {
        search: (query) => {
          fixQuery = query;
          return [];
        },
      },
    };
    run({
      text: '  bos  ',
      resolvers,
      scope: makeScope({
        airports: { enabled: true, types: RENDERED_AIRPORT_FACILITY_TYPES },
        fixes: { enabled: true },
      }),
      limit: 7,
      minScore: 0.3,
    });
    expect(airportQuery?.text).toBe('bos');
    expect(airportQuery?.types).toBe(RENDERED_AIRPORT_FACILITY_TYPES);
    expect(airportQuery?.limit).toBe(7);
    expect(airportQuery?.minScore).toBe(0.3);
    expect(fixQuery?.text).toBe('bos');
    expect(fixQuery?.limit).toBe(7);
    expect(fixQuery?.minScore).toBe(0.3);
  });
});
