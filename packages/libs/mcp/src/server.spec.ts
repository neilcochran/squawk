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
  'get_airspace_for_airport',
  'find_artcc_for_position',
  'find_artcc_by_identifier',
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
  'find_procedures_by_identifier',
  'get_procedure_by_airport_and_identifier',
  'find_procedures_by_airport',
  'find_procedures_by_airport_and_runway',
  'find_approaches_by_type',
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
  'parse_winds_aloft',
  'fetch_metar',
  'fetch_taf',
  'fetch_pirep',
  'fetch_sigmets',
  'fetch_international_sigmets',
  'fetch_winds_aloft',
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
              timezone: z.string(),
            })
            .nullable(),
        })
        .parse(result.structuredContent);
      assert.ok(parsed.airport !== null, 'expected an airport for KJFK');
      assert.equal(parsed.airport.faaId, 'JFK');
      assert.equal(parsed.airport.icao, 'KJFK');
      assert.equal(parsed.airport.timezone, 'America/New_York');
    } finally {
      await close();
    }
  });

  it('invokes get_airspace_for_airport end-to-end via MCP', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'get_airspace_for_airport',
        arguments: { airportId: 'KJFK' },
      });
      const parsed = z
        .object({
          airport: z
            .object({
              faaId: z.string(),
            })
            .nullable(),
          features: z.array(
            z
              .object({
                type: z.string(),
                identifier: z.string(),
                boundary: z.object({
                  type: z.literal('Polygon'),
                  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
                }),
              })
              .passthrough(),
          ),
        })
        .parse(result.structuredContent);
      assert.ok(parsed.airport !== null, 'expected an airport for KJFK');
      assert.equal(parsed.airport.faaId, 'JFK');
      assert.ok(parsed.features.length > 1, 'JFK Class B has multiple sectors');
      for (const feature of parsed.features) {
        assert.equal(feature.identifier, 'JFK');
        assert.ok(feature.type === 'CLASS_B', 'default filter keeps only surface classes');
        const ring = feature.boundary.coordinates[0];
        assert.ok(ring && ring.length >= 4, 'boundary ring must be returned intact');
      }
    } finally {
      await close();
    }
  });

  it('invokes find_artcc_for_position end-to-end via MCP', async () => {
    const { client, close } = await connectTestClient();
    try {
      // Burlington VT at 5000 ft - well inside ZBW LOW
      const result = await client.callTool({
        name: 'find_artcc_for_position',
        arguments: { lat: 44.47, lon: -73.15, altitudeFt: 5000 },
      });
      const parsed = z
        .object({
          features: z.array(
            z
              .object({
                type: z.literal('ARTCC'),
                identifier: z.string(),
                artccStratum: z.enum(['LOW', 'HIGH', 'UTA', 'CTA', 'FIR', 'CTA/FIR']),
                vertexCount: z.number(),
              })
              .passthrough(),
          ),
        })
        .parse(result.structuredContent);
      assert.ok(
        parsed.features.some((f) => f.identifier === 'ZBW' && f.artccStratum === 'LOW'),
        'expected ZBW LOW for a position at FL050 over Burlington VT',
      );
    } finally {
      await close();
    }
  });

  it('invokes find_artcc_by_identifier end-to-end via MCP', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'find_artcc_by_identifier',
        arguments: { artccId: 'ZNY' },
      });
      const parsed = z
        .object({
          features: z.array(
            z
              .object({
                type: z.literal('ARTCC'),
                identifier: z.literal('ZNY'),
                artccStratum: z.enum(['LOW', 'HIGH', 'UTA', 'CTA', 'FIR', 'CTA/FIR']),
                boundary: z.object({
                  type: z.literal('Polygon'),
                  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
                }),
              })
              .passthrough(),
          ),
        })
        .parse(result.structuredContent);
      assert.ok(parsed.features.length >= 2, 'expected ZNY LOW and HIGH features');
      const strata = new Set(parsed.features.map((f) => f.artccStratum));
      assert.ok(strata.has('LOW'), 'expected ZNY LOW');
      assert.ok(strata.has('HIGH'), 'expected ZNY HIGH');
      for (const feature of parsed.features) {
        const ring = feature.boundary.coordinates[0];
        assert.ok(ring && ring.length >= 4, 'boundary ring must be returned intact');
      }
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

  it('invokes parse_winds_aloft end-to-end via MCP', async () => {
    const { client, close } = await connectTestClient();
    try {
      const raw = [
        '(Extracted from FBUS31 KWNO 241359)',
        'FD1US1',
        'DATA BASED ON 241200Z',
        'VALID 241800Z   FOR USE 1400-2100Z. TEMPS NEG ABV 24000',
        '',
        'FT  3000',
        'BDL 3509',
      ].join('\n');
      const result = await client.callTool({
        name: 'parse_winds_aloft',
        arguments: { raw },
      });
      const parsed = z
        .object({
          windsAloft: z
            .object({
              productCode: z.string(),
              altitudesFt: z.array(z.number()),
              stations: z.array(z.object({ stationId: z.string() }).passthrough()),
            })
            .passthrough(),
        })
        .parse(result.structuredContent);
      assert.equal(parsed.windsAloft.productCode, 'FD1US1');
      assert.deepEqual(parsed.windsAloft.altitudesFt, [3000]);
      assert.equal(parsed.windsAloft.stations[0]?.stationId, 'BDL');
    } finally {
      await close();
    }
  });

  it('parse_winds_aloft flags malformed input via isError without throwing', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'parse_winds_aloft',
        arguments: { raw: 'not a bulletin' },
      });
      assert.equal(result.isError, true);
      const parsed = z.object({ windsAloft: z.null() }).parse(result.structuredContent);
      assert.equal(parsed.windsAloft, null);
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
                cifpCycleDate: z.string(),
                sidCount: z.number().nonnegative(),
                starCount: z.number().nonnegative(),
                iapCount: z.number().nonnegative(),
                legCount: z.number().positive(),
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

  it('invokes find_procedures_by_identifier end-to-end via MCP', async () => {
    const { client, close } = await connectTestClient();
    try {
      // I04L is published at multiple airports; every hit must be an IAP.
      const result = await client.callTool({
        name: 'find_procedures_by_identifier',
        arguments: { identifier: 'I04L' },
      });
      const parsed = z
        .object({
          procedures: z.array(
            z.object({
              identifier: z.string(),
              type: z.string(),
              airports: z.array(z.string()),
            }),
          ),
        })
        .parse(result.structuredContent);
      assert.ok(parsed.procedures.length >= 1);
      for (const proc of parsed.procedures) {
        assert.equal(proc.identifier, 'I04L');
        assert.equal(proc.type, 'IAP');
      }
    } finally {
      await close();
    }
  });

  it('invokes get_procedure_by_airport_and_identifier end-to-end via MCP', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'get_procedure_by_airport_and_identifier',
        arguments: { airportId: 'KJFK', identifier: 'I04L' },
      });
      const parsed = z
        .object({
          procedure: z
            .object({
              identifier: z.string(),
              type: z.string(),
              approachType: z.string().optional(),
              runway: z.string().optional(),
              airports: z.array(z.string()),
            })
            .nullable(),
        })
        .parse(result.structuredContent);
      assert.ok(parsed.procedure !== null);
      assert.equal(parsed.procedure.identifier, 'I04L');
      assert.equal(parsed.procedure.approachType, 'ILS');
      assert.equal(parsed.procedure.runway, '04L');
      assert.ok(parsed.procedure.airports.includes('KJFK'));
    } finally {
      await close();
    }
  });

  it('invokes find_procedures_by_airport_and_runway end-to-end via MCP', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'find_procedures_by_airport_and_runway',
        arguments: { airportId: 'KJFK', runway: '04L' },
      });
      const parsed = z
        .object({
          procedures: z.array(
            z.object({
              identifier: z.string(),
              type: z.string(),
              runway: z.string().optional(),
            }),
          ),
        })
        .parse(result.structuredContent);
      // Every matched IAP must carry runway = 04L.
      const iaps = parsed.procedures.filter((p) => p.type === 'IAP');
      assert.ok(iaps.length > 0);
      for (const iap of iaps) {
        assert.equal(iap.runway, '04L');
      }
    } finally {
      await close();
    }
  });

  it('invokes find_approaches_by_type end-to-end via MCP', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'find_approaches_by_type',
        arguments: { approachType: 'ILS' },
      });
      const parsed = z
        .object({
          procedures: z.array(
            z.object({
              type: z.string(),
              approachType: z.string(),
            }),
          ),
        })
        .parse(result.structuredContent);
      assert.ok(parsed.procedures.length > 100);
      for (const proc of parsed.procedures) {
        assert.equal(proc.type, 'IAP');
        assert.equal(proc.approachType, 'ILS');
      }
    } finally {
      await close();
    }
  });

  it('invokes expand_procedure end-to-end via MCP', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'expand_procedure',
        arguments: { airportId: 'KJFK', identifier: 'I04L' },
      });
      const parsed = z
        .object({
          expansion: z
            .object({
              procedure: z.object({ identifier: z.string() }).passthrough(),
              legs: z.array(
                z
                  .object({
                    pathTerminator: z.string(),
                  })
                  .passthrough(),
              ),
            })
            .nullable(),
        })
        .parse(result.structuredContent);
      assert.ok(parsed.expansion !== null);
      assert.equal(parsed.expansion.procedure.identifier, 'I04L');
      assert.ok(parsed.expansion.legs.length > 0);
      assert.equal(parsed.expansion.legs[0]?.pathTerminator, 'IF');
    } finally {
      await close();
    }
  });

  it('invokes search_procedures end-to-end via MCP', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'search_procedures',
        arguments: { text: 'AALLE', limit: 10 },
      });
      const parsed = z
        .object({
          procedures: z.array(
            z.object({
              identifier: z.string(),
              name: z.string(),
            }),
          ),
        })
        .parse(result.structuredContent);
      assert.ok(parsed.procedures.length > 0);
      for (const proc of parsed.procedures) {
        const matches =
          proc.identifier.toUpperCase().includes('AALLE') ||
          proc.name.toUpperCase().includes('AALLE');
        assert.ok(matches);
      }
    } finally {
      await close();
    }
  });

  it('invokes expand_procedure with a transition name end-to-end via MCP', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'expand_procedure',
        arguments: {
          airportId: 'KJFK',
          identifier: 'I13L',
          transitionName: 'BUZON',
        },
      });
      const parsed = z
        .object({
          expansion: z
            .object({
              procedure: z.object({ identifier: z.string() }).passthrough(),
              legs: z.array(
                z
                  .object({
                    pathTerminator: z.string(),
                    fixIdentifier: z.string().optional(),
                  })
                  .passthrough(),
              ),
            })
            .nullable(),
        })
        .parse(result.structuredContent);
      assert.ok(parsed.expansion !== null);
      assert.equal(parsed.expansion.procedure.identifier, 'I13L');
      assert.ok(parsed.expansion.legs.length > 0);
      // First leg of the expansion should come from the BUZON transition.
      assert.equal(parsed.expansion.legs[0]?.fixIdentifier, 'BUZON');
    } finally {
      await close();
    }
  });

  it('expand_procedure returns null for an unknown airport/identifier combination', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'expand_procedure',
        arguments: { airportId: 'KDEN', identifier: 'I04L' },
      });
      const parsed = z.object({ expansion: z.null() }).parse(result.structuredContent);
      assert.equal(parsed.expansion, null);
    } finally {
      await close();
    }
  });

  it('get_procedure_by_airport_and_identifier returns null for an unknown identifier', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'get_procedure_by_airport_and_identifier',
        arguments: { airportId: 'KJFK', identifier: 'ZZZ99' },
      });
      const parsed = z.object({ procedure: z.null() }).parse(result.structuredContent);
      assert.equal(parsed.procedure, null);
    } finally {
      await close();
    }
  });

  it('find_procedures_by_identifier returns an empty array for unknown identifier', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'find_procedures_by_identifier',
        arguments: { identifier: 'ZZZZZ9' },
      });
      const parsed = z.object({ procedures: z.array(z.unknown()) }).parse(result.structuredContent);
      assert.equal(parsed.procedures.length, 0);
    } finally {
      await close();
    }
  });

  it('find_procedures_by_airport_and_runway returns an empty array for an unknown runway', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'find_procedures_by_airport_and_runway',
        arguments: { airportId: 'KJFK', runway: '99Z' },
      });
      const parsed = z.object({ procedures: z.array(z.unknown()) }).parse(result.structuredContent);
      assert.equal(parsed.procedures.length, 0);
    } finally {
      await close();
    }
  });

  it('search_procedures honors the approachType filter', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'search_procedures',
        arguments: { text: 'RWY', approachType: 'ILS', limit: 20 },
      });
      const parsed = z
        .object({
          procedures: z.array(
            z.object({
              type: z.string(),
              approachType: z.string().optional(),
            }),
          ),
        })
        .parse(result.structuredContent);
      assert.ok(parsed.procedures.length > 0);
      for (const proc of parsed.procedures) {
        assert.equal(proc.type, 'IAP');
        assert.equal(proc.approachType, 'ILS');
      }
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

  it('fetch_winds_aloft maps options to AWC wire params and returns a parsed forecast', async () => {
    stub.body = [
      '(Extracted from FBUS31 KWNO 241359)',
      'FD1US1',
      'DATA BASED ON 241200Z',
      'VALID 241800Z   FOR USE 1400-2100Z. TEMPS NEG ABV 24000',
      '',
      'FT  3000',
      'BDL 3509',
    ].join('\n');
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'fetch_winds_aloft',
        arguments: {
          region: 'northeast',
          altitudeBand: 'low',
          forecastHours: 6,
        },
      });
      const parsed = z
        .object({
          forecast: z
            .object({
              productCode: z.string(),
              altitudesFt: z.array(z.number()),
              stations: z.array(z.object({ stationId: z.string() }).passthrough()),
            })
            .passthrough(),
        })
        .parse(result.structuredContent);
      assert.equal(parsed.forecast.productCode, 'FD1US1');
      assert.deepEqual(parsed.forecast.altitudesFt, [3000]);
      assert.equal(parsed.forecast.stations[0]?.stationId, 'BDL');
      assert.ok(stub.lastUrl?.includes('/windtemp?'));
      assert.ok(stub.lastUrl?.includes('region=bos'));
      assert.ok(stub.lastUrl?.includes('level=low'));
      assert.ok(stub.lastUrl?.includes('fcst=06'));
    } finally {
      await close();
    }
  });
});
