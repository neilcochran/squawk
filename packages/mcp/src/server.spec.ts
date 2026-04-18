import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from 'zod';
import { createSquawkMcpServer } from './server.js';

/** Tool names every freshly-constructed server is expected to register. */
const EXPECTED_TOOLS: readonly string[] = [
  // geo
  'great_circle_distance',
  'great_circle_bearing',
  'great_circle_bearing_and_distance',
  'great_circle_midpoint',
  'great_circle_destination',
  // flight-math
  'compute_density_altitude',
  'compute_true_altitude',
  'compute_calibrated_airspeed_from_true_airspeed',
  'solve_wind_triangle',
  'compute_headwind_crosswind',
  'find_wind_from_track',
  'compute_crosswind_component',
  'compute_top_of_descent_distance',
  'compute_top_of_descent_distance_from_rate',
  'compute_required_descent_rate',
  'compute_required_climb_rate',
  'compute_visual_descent_point',
  'recommend_holding_pattern_entry',
  'compute_standard_rate_bank_angle',
  'compute_turn_radius',
  'compute_glide_distance_with_wind',
  'compute_solar_times',
  'is_daytime',
  'compute_magnetic_declination',
  'convert_true_to_magnetic_bearing',
  'convert_magnetic_to_true_bearing',
  'compute_fuel_required',
  'compute_point_of_no_return',
  'compute_equal_time_point',
  // airports
  'get_airport_by_faa_id',
  'get_airport_by_icao',
  'find_nearest_airports',
  'search_airports',
  // airspace
  'query_airspace_at_position',
  // navaids
  'get_navaid_by_ident',
  'find_navaids_by_frequency',
  'find_nearest_navaids',
  'search_navaids',
  // fixes
  'get_fix_by_ident',
  'find_nearest_fixes',
  'search_fixes',
  // airways
  'get_airway_by_designation',
  'expand_airway_segment',
  'find_airways_by_fix',
  'search_airways',
  // procedures
  'get_procedure_by_code',
  'find_procedures_by_airport',
  'expand_procedure',
  'search_procedures',
  // icao-registry
  'lookup_aircraft_by_icao_hex',
  // weather
  'parse_metar',
  'parse_taf',
  'parse_sigmet',
  'parse_airmet',
  'parse_pirep',
  'fetch_metar',
  'fetch_taf',
  'fetch_pirep',
  'fetch_sigmets',
  'fetch_international_sigmets',
  // notams
  'parse_icao_notam',
  'parse_faa_notam',
  // flightplan
  'parse_flightplan_route',
  'compute_route_distance',
  // datasets
  'get_dataset_status',
];

async function connectTestClient(): Promise<{
  client: Client;
  close: () => Promise<void>;
}> {
  const server = createSquawkMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: 'squawk-mcp-test', version: '0.0.0' });
  await client.connect(clientTransport);

  return {
    client,
    close: async (): Promise<void> => {
      await client.close();
      await server.close();
    },
  };
}

describe('createSquawkMcpServer', () => {
  it('registers tools across every enabled domain', async () => {
    const { client, close } = await connectTestClient();
    try {
      const { tools } = await client.listTools();
      const names = new Set(tools.map((tool) => tool.name));
      for (const expected of EXPECTED_TOOLS) {
        assert.ok(names.has(expected), `expected tool "${expected}" to be registered`);
      }
    } finally {
      await close();
    }
  });

  it('invokes great_circle_distance end-to-end via MCP', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'great_circle_distance',
        arguments: { lat1: 40.6413, lon1: -73.7781, lat2: 33.9425, lon2: -118.4081 },
      });
      const parsed = z.object({ distanceNm: z.number() }).parse(result.structuredContent);
      assert.ok(
        parsed.distanceNm > 2100 && parsed.distanceNm < 2200,
        `expected JFK-LAX distance near 2145 nm, got ${parsed.distanceNm}`,
      );
    } finally {
      await close();
    }
  });

  it('invokes get_airport_by_icao end-to-end via MCP', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'get_airport_by_icao',
        arguments: { icao: 'KJFK' },
      });
      const parsed = z
        .object({
          airport: z
            .object({
              faaId: z.string(),
              icao: z.string().optional(),
              name: z.string(),
            })
            .nullable(),
        })
        .parse(result.structuredContent);
      assert.ok(parsed.airport !== null, 'expected an airport for KJFK');
      assert.equal(parsed.airport.faaId, 'JFK');
      assert.equal(parsed.airport.icao, 'KJFK');
    } finally {
      await close();
    }
  });

  it('invokes get_navaid_by_ident end-to-end via MCP', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'get_navaid_by_ident',
        arguments: { ident: 'BOS' },
      });
      const parsed = z
        .object({
          navaids: z.array(
            z.object({
              identifier: z.string(),
              type: z.string(),
            }),
          ),
        })
        .parse(result.structuredContent);
      assert.ok(parsed.navaids.length > 0, 'expected at least one BOS navaid');
      for (const navaid of parsed.navaids) {
        assert.equal(navaid.identifier, 'BOS');
      }
    } finally {
      await close();
    }
  });

  it('invokes parse_metar end-to-end via MCP', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'parse_metar',
        arguments: {
          raw: 'KJFK 181851Z 19014KT 10SM FEW250 22/12 A3001 RMK AO2 SLP163',
        },
      });
      const parsed = z
        .object({
          metar: z
            .object({
              stationId: z.string(),
            })
            .passthrough(),
        })
        .parse(result.structuredContent);
      assert.equal(parsed.metar.stationId, 'KJFK');
    } finally {
      await close();
    }
  });

  it('invokes solve_wind_triangle end-to-end via MCP', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'solve_wind_triangle',
        arguments: {
          trueAirspeedKt: 120,
          trueCourseDeg: 90,
          windDirectionDeg: 180,
          windSpeedKt: 20,
        },
      });
      const parsed = z
        .object({
          trueHeadingDeg: z.number(),
          windCorrectionAngleDeg: z.number(),
          groundSpeedKt: z.number(),
        })
        .parse(result.structuredContent);
      // A south wind on an east course is a left crosswind, requiring a
      // positive (right) wind correction angle. Sanity-check the magnitudes.
      assert.ok(
        parsed.windCorrectionAngleDeg > 0 && parsed.windCorrectionAngleDeg < 15,
        `expected positive WCA under 15 deg, got ${parsed.windCorrectionAngleDeg}`,
      );
      assert.ok(
        parsed.groundSpeedKt > 110 && parsed.groundSpeedKt < 125,
        `expected GS roughly equal to TAS for pure crosswind, got ${parsed.groundSpeedKt}`,
      );
    } finally {
      await close();
    }
  });

  it('invokes get_dataset_status end-to-end via MCP', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'get_dataset_status',
        arguments: {},
      });
      const parsed = z
        .object({
          datasets: z.object({
            airports: z.object({
              nasrCycleDate: z.string(),
              generatedAt: z.string(),
              recordCount: z.number().positive(),
            }),
            airspace: z.object({
              nasrCycleDate: z.string(),
              generatedAt: z.string(),
              featureCount: z.number().positive(),
            }),
            navaids: z.object({ recordCount: z.number().positive() }).passthrough(),
            fixes: z.object({ recordCount: z.number().positive() }).passthrough(),
            airways: z.object({ recordCount: z.number().positive() }).passthrough(),
            procedures: z
              .object({
                sidCount: z.number().nonnegative(),
                starCount: z.number().nonnegative(),
              })
              .passthrough(),
            // The lazy ICAO registry should report `loaded: false` here -
            // no other test in this suite triggers a tail-number lookup.
            icaoRegistry: z.object({ loaded: z.literal(false) }),
          }),
        })
        .parse(result.structuredContent);
      assert.match(
        parsed.datasets.airports.nasrCycleDate,
        /^\d{4}-\d{2}-\d{2}$/,
        'expected ISO-8601 date for the airports NASR cycle',
      );
    } finally {
      await close();
    }
  });

  it('invokes compute_route_distance end-to-end via MCP', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'compute_route_distance',
        arguments: {
          routeString: 'KJFK DCT KLAX',
          groundSpeedKt: 450,
        },
      });
      const parsed = z
        .object({
          result: z.object({
            totalDistanceNm: z.number(),
            estimatedTimeEnrouteHrs: z.number().nullable().optional(),
            legs: z.array(
              z.object({
                from: z.string(),
                to: z.string(),
                distanceNm: z.number(),
              }),
            ),
          }),
        })
        .parse(result.structuredContent);
      assert.ok(
        parsed.result.totalDistanceNm > 2100 && parsed.result.totalDistanceNm < 2200,
        `expected JFK-LAX total around 2145 nm, got ${parsed.result.totalDistanceNm}`,
      );
      assert.equal(parsed.result.legs.length, 1);
      assert.equal(parsed.result.legs[0]?.from, 'KJFK');
      assert.equal(parsed.result.legs[0]?.to, 'KLAX');
    } finally {
      await close();
    }
  });
});

/**
 * Stubs `globalThis.fetch` so the live AWC weather tools can be exercised
 * end-to-end through the MCP transport without making real network calls.
 * Captures the URL the tool requested so each test can assert correct query
 * parameter construction.
 */
interface FetchStub {
  /** Most recent URL the stub was called with. */
  lastUrl: string | undefined;
  /** Body returned by the next call. */
  body: string;
  /** HTTP status returned by the next call. */
  status: number;
}

describe('live weather fetch tools (mocked)', () => {
  const originalFetch = globalThis.fetch;
  const stub: FetchStub = { lastUrl: undefined, body: '', status: 200 };

  beforeEach(() => {
    stub.lastUrl = undefined;
    stub.body = '';
    stub.status = 200;
    globalThis.fetch = ((input: Parameters<typeof fetch>[0]) => {
      stub.lastUrl = typeof input === 'string' ? input : input.toString();
      return Promise.resolve(
        new Response(stub.body, {
          status: stub.status,
          statusText: stub.status === 200 ? 'OK' : 'Error',
        }),
      );
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetch_metar requests the AWC metar endpoint and returns parsed records', async () => {
    stub.body = 'KJFK 181851Z 19014KT 10SM FEW250 22/12 A3001 RMK AO2 SLP163\n';
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'fetch_metar',
        arguments: { stations: ['KJFK'] },
      });
      const parsed = z
        .object({
          metars: z.array(z.object({ stationId: z.string() }).passthrough()),
          parseErrors: z.array(z.unknown()),
        })
        .parse(result.structuredContent);
      assert.equal(parsed.metars.length, 1);
      assert.equal(parsed.metars[0]?.stationId, 'KJFK');
      assert.equal(parsed.parseErrors.length, 0);
      assert.ok(
        stub.lastUrl?.includes('/metar?'),
        `expected /metar? in ${stub.lastUrl ?? '<none>'}`,
      );
      assert.ok(stub.lastUrl?.includes('ids=KJFK'));
      assert.ok(stub.lastUrl?.includes('format=raw'));
    } finally {
      await close();
    }
  });

  it('fetch_metar surfaces per-record parse errors', async () => {
    // First line is a valid METAR; second line is garbage that the parser
    // will throw on. Both records are returned so the model can decide what
    // to do with the partial failure.
    stub.body = 'KJFK 181851Z 19014KT 10SM FEW250 22/12 A3001 RMK AO2 SLP163\nNOT_A_METAR\n';
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'fetch_metar',
        arguments: { stations: ['KJFK'] },
      });
      const parsed = z
        .object({
          metars: z.array(z.object({ stationId: z.string() }).passthrough()),
          parseErrors: z.array(z.object({ raw: z.string(), message: z.string() })),
        })
        .parse(result.structuredContent);
      assert.equal(parsed.metars.length, 1);
      assert.equal(parsed.metars[0]?.stationId, 'KJFK');
      assert.equal(parsed.parseErrors.length, 1);
      assert.equal(parsed.parseErrors[0]?.raw, 'NOT_A_METAR');
      assert.ok(
        parsed.parseErrors[0]?.message.length ?? 0 > 0,
        'expected a non-empty parser message',
      );
    } finally {
      await close();
    }
  });

  it('fetch_taf splits multi-line TAF blocks separated by blank lines', async () => {
    // AWC delivers TAFs as multi-line blocks separated by blank lines. The
    // fetch wrapper hands each block to the parser intact (preserving the
    // internal whitespace it depends on).
    stub.body =
      'TAF KJFK 181720Z 1818/1924 19012KT P6SM FEW250\n' +
      '     FM190200 20008KT P6SM SCT250\n' +
      '\n' +
      'TAF KLAX 181720Z 1818/1924 27010KT P6SM SKC\n';
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'fetch_taf',
        arguments: { stations: ['KJFK', 'KLAX'] },
      });
      const parsed = z
        .object({
          tafs: z.array(z.object({ stationId: z.string() }).passthrough()),
          parseErrors: z.array(z.unknown()),
        })
        .parse(result.structuredContent);
      assert.equal(parsed.tafs.length, 2);
      assert.deepEqual(
        parsed.tafs.map((t) => t.stationId),
        ['KJFK', 'KLAX'],
      );
      assert.equal(parsed.parseErrors.length, 0);
      assert.ok(stub.lastUrl?.includes('/taf?'));
      assert.ok(
        stub.lastUrl?.includes('ids=KJFK%2CKLAX') || stub.lastUrl?.includes('ids=KJFK,KLAX'),
      );
    } finally {
      await close();
    }
  });

  it('fetch_sigmets forwards the hazard filter on the request URL', async () => {
    // AWC returns no SIGMETs when the filter matches nothing; an empty body
    // exercises the URL construction without forcing the bulletin-splitting
    // path (which is already covered by the @squawk/weather parser tests).
    stub.body = '';
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'fetch_sigmets',
        arguments: { hazard: 'turb' },
      });
      const parsed = z
        .object({
          sigmets: z.array(z.unknown()),
          parseErrors: z.array(z.unknown()),
        })
        .parse(result.structuredContent);
      assert.equal(parsed.sigmets.length, 0);
      assert.equal(parsed.parseErrors.length, 0);
      assert.ok(stub.lastUrl?.includes('/airsigmet?'));
      assert.ok(stub.lastUrl?.includes('hazard=turb'));
      assert.ok(stub.lastUrl?.includes('format=raw'));
    } finally {
      await close();
    }
  });
});
