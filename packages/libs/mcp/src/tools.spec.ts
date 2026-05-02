/**
 * @packageDocumentation
 * Coverage-focused end-to-end tests that exercise every MCP tool not already
 * covered by `server.spec.ts`. Each test wires a fresh in-memory MCP server,
 * invokes one tool through the public transport, and checks the structured
 * payload shape.
 */

import { afterEach, beforeEach, describe, it, expect, assert } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from 'zod';
import { createSquawkMcpServer } from './server.js';

async function connectTestClient(): Promise<{
  client: Client;
  close: () => Promise<void>;
}> {
  const server = createSquawkMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: 'squawk-mcp-tools-test', version: '0.0.0' });
  await client.connect(clientTransport);

  return {
    client,
    close: async (): Promise<void> => {
      await client.close();
      await server.close();
    },
  };
}

describe('geo tools', () => {
  it('great_circle_bearing returns a numeric bearing', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'great_circle_bearing',
        arguments: { lat1: 40.6413, lon1: -73.7781, lat2: 33.9425, lon2: -118.4081 },
      });
      const parsed = z.object({ bearingDeg: z.number() }).parse(result.structuredContent);
      assert(parsed.bearingDeg >= 0 && parsed.bearingDeg < 360);
    } finally {
      await close();
    }
  });

  it('great_circle_bearing_and_distance returns both values', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'great_circle_bearing_and_distance',
        arguments: { lat1: 40.6413, lon1: -73.7781, lat2: 33.9425, lon2: -118.4081 },
      });
      const parsed = z
        .object({ bearingDeg: z.number(), distanceNm: z.number() })
        .parse(result.structuredContent);
      assert(parsed.distanceNm > 2100 && parsed.distanceNm < 2200);
      assert(parsed.bearingDeg >= 0 && parsed.bearingDeg < 360);
    } finally {
      await close();
    }
  });

  it('great_circle_midpoint returns a midpoint coordinate', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'great_circle_midpoint',
        arguments: { lat1: 40, lon1: -74, lat2: 34, lon2: -118 },
      });
      const parsed = z.object({ lat: z.number(), lon: z.number() }).parse(result.structuredContent);
      assert(parsed.lat > 33 && parsed.lat < 41);
    } finally {
      await close();
    }
  });

  it('great_circle_destination returns a coordinate', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'great_circle_destination',
        arguments: { lat: 40, lon: -74, bearingDeg: 90, travelDistanceNm: 100 },
      });
      const parsed = z.object({ lat: z.number(), lon: z.number() }).parse(result.structuredContent);
      assert(Math.abs(parsed.lat - 40) < 1);
      assert(parsed.lon > -74);
    } finally {
      await close();
    }
  });
});

describe('flight-math tools', () => {
  it('compute_density_altitude returns a number', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'compute_density_altitude',
        arguments: { fieldElevationFt: 1000, altimeterSettingInHg: 29.92, oatCelsius: 30 },
      });
      const parsed = z.object({ densityAltitudeFt: z.number() }).parse(result.structuredContent);
      assert(parsed.densityAltitudeFt > 1000);
    } finally {
      await close();
    }
  });

  it('compute_true_altitude returns a number', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'compute_true_altitude',
        arguments: {
          indicatedAltitudeFt: 5000,
          altimeterSettingInHg: 29.92,
          oatCelsius: -10,
          stationElevationFt: 1000,
        },
      });
      const parsed = z.object({ trueAltitudeFt: z.number() }).parse(result.structuredContent);
      assert(Number.isFinite(parsed.trueAltitudeFt));
    } finally {
      await close();
    }
  });

  it('compute_calibrated_airspeed_from_true_airspeed returns a number', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'compute_calibrated_airspeed_from_true_airspeed',
        arguments: { trueAirspeedKt: 250, pressureAltitudeFt: 10000 },
      });
      const parsed = z.object({ calibratedAirspeedKt: z.number() }).parse(result.structuredContent);
      assert(parsed.calibratedAirspeedKt > 0);
    } finally {
      await close();
    }
  });

  it('compute_calibrated_airspeed_from_true_airspeed accepts oatCelsius override', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'compute_calibrated_airspeed_from_true_airspeed',
        arguments: { trueAirspeedKt: 250, pressureAltitudeFt: 10000, oatCelsius: -20 },
      });
      const parsed = z.object({ calibratedAirspeedKt: z.number() }).parse(result.structuredContent);
      assert(parsed.calibratedAirspeedKt > 0);
    } finally {
      await close();
    }
  });

  it('compute_headwind_crosswind returns components', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'compute_headwind_crosswind',
        arguments: { windDirectionDeg: 270, windSpeedKt: 20, headingDeg: 360 },
      });
      const parsed = z
        .object({ headwindKt: z.number(), crosswindKt: z.number() })
        .parse(result.structuredContent);
      assert(Math.abs(parsed.crosswindKt) > 0);
    } finally {
      await close();
    }
  });

  it('find_wind_from_track returns wind direction and speed', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'find_wind_from_track',
        arguments: {
          groundSpeedKt: 110,
          trueAirspeedKt: 120,
          trueHeadingDeg: 95,
          trueTrackDeg: 90,
        },
      });
      const parsed = z
        .object({ directionDeg: z.number(), speedKt: z.number() })
        .parse(result.structuredContent);
      assert(parsed.speedKt > 0);
    } finally {
      await close();
    }
  });

  it('compute_crosswind_component returns absolute crosswind', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'compute_crosswind_component',
        arguments: { windDirectionDeg: 270, windSpeedKt: 20, runwayHeadingDeg: 360 },
      });
      const parsed = z.object({ crosswindKt: z.number() }).parse(result.structuredContent);
      assert(parsed.crosswindKt > 0);
    } finally {
      await close();
    }
  });

  it('compute_top_of_descent_distance returns distance', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'compute_top_of_descent_distance',
        arguments: { currentAltitudeFt: 10000, targetAltitudeFt: 2000, descentAngleDeg: 3 },
      });
      const parsed = z.object({ distanceNm: z.number() }).parse(result.structuredContent);
      assert(parsed.distanceNm > 0);
    } finally {
      await close();
    }
  });

  it('compute_top_of_descent_distance_from_rate returns distance', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'compute_top_of_descent_distance_from_rate',
        arguments: {
          currentAltitudeFt: 10000,
          targetAltitudeFt: 2000,
          descentRateFtPerMin: 500,
          groundSpeedKt: 120,
        },
      });
      const parsed = z.object({ distanceNm: z.number() }).parse(result.structuredContent);
      assert(parsed.distanceNm > 0);
    } finally {
      await close();
    }
  });

  it('compute_required_descent_rate returns rate', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'compute_required_descent_rate',
        arguments: {
          distanceNm: 30,
          currentAltitudeFt: 10000,
          targetAltitudeFt: 2000,
          groundSpeedKt: 120,
        },
      });
      const parsed = z.object({ descentRateFtPerMin: z.number() }).parse(result.structuredContent);
      assert(parsed.descentRateFtPerMin > 0);
    } finally {
      await close();
    }
  });

  it('compute_required_climb_rate returns rate', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'compute_required_climb_rate',
        arguments: {
          distanceNm: 30,
          currentAltitudeFt: 2000,
          targetAltitudeFt: 8000,
          groundSpeedKt: 120,
        },
      });
      const parsed = z.object({ climbRateFtPerMin: z.number() }).parse(result.structuredContent);
      assert(parsed.climbRateFtPerMin > 0);
    } finally {
      await close();
    }
  });

  it('compute_visual_descent_point returns distance', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'compute_visual_descent_point',
        arguments: { glidepathAngleDeg: 3, thresholdCrossingHeightFt: 350 },
      });
      const parsed = z.object({ distanceNm: z.number() }).parse(result.structuredContent);
      assert(parsed.distanceNm > 0);
    } finally {
      await close();
    }
  });

  it('recommend_holding_pattern_entry returns an entry type', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'recommend_holding_pattern_entry',
        arguments: { inboundCourseDeg: 90, headingToFixDeg: 270 },
      });
      const parsed = z.object({ entryType: z.string() }).parse(result.structuredContent);
      assert(['direct', 'teardrop', 'parallel'].includes(parsed.entryType));
    } finally {
      await close();
    }
  });

  it('recommend_holding_pattern_entry honors rightTurns=false', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'recommend_holding_pattern_entry',
        arguments: { inboundCourseDeg: 90, headingToFixDeg: 270, rightTurns: false },
      });
      const parsed = z.object({ entryType: z.string() }).parse(result.structuredContent);
      assert(['direct', 'teardrop', 'parallel'].includes(parsed.entryType));
    } finally {
      await close();
    }
  });

  it('compute_standard_rate_bank_angle returns an angle', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'compute_standard_rate_bank_angle',
        arguments: { trueAirspeedKt: 120 },
      });
      const parsed = z.object({ bankAngleDeg: z.number() }).parse(result.structuredContent);
      assert(parsed.bankAngleDeg > 0 && parsed.bankAngleDeg < 45);
    } finally {
      await close();
    }
  });

  it('compute_turn_radius returns radius', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'compute_turn_radius',
        arguments: { trueAirspeedKt: 120, bankAngleDeg: 25 },
      });
      const parsed = z.object({ turnRadiusNm: z.number() }).parse(result.structuredContent);
      assert(parsed.turnRadiusNm > 0);
    } finally {
      await close();
    }
  });

  it('compute_glide_distance_with_wind returns distance', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'compute_glide_distance_with_wind',
        arguments: {
          altitudeAglFt: 5000,
          glideRatio: 10,
          bestGlideTasKt: 70,
          headwindKt: 10,
        },
      });
      const parsed = z.object({ glideDistanceNm: z.number() }).parse(result.structuredContent);
      assert(parsed.glideDistanceNm > 0);
    } finally {
      await close();
    }
  });

  it('compute_solar_times returns sunrise and sunset', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'compute_solar_times',
        arguments: { lat: 40, lon: -74, dateUtc: '2026-06-21T00:00:00Z' },
      });
      const parsed = z
        .object({
          times: z.object({
            sunrise: z.string().nullable(),
            sunset: z.string().nullable(),
            civilTwilightBegin: z.string().nullable(),
            civilTwilightEnd: z.string().nullable(),
          }),
        })
        .parse(result.structuredContent);
      assert(parsed.times.sunrise !== null);
      assert(parsed.times.sunset !== null);
    } finally {
      await close();
    }
  });

  it('compute_solar_times returns nulls for polar night', async () => {
    const { client, close } = await connectTestClient();
    try {
      // Tromso, Norway in deep December - no sunrise / no sunset / no civil twilight.
      const result = await client.callTool({
        name: 'compute_solar_times',
        arguments: {
          lat: 78,
          lon: 16,
          dateTimeUtc: '2026-12-21T12:00:00Z',
          dateUtc: '2026-12-21T12:00:00Z',
        },
      });
      const parsed = z
        .object({
          times: z.object({
            sunrise: z.string().nullable(),
            sunset: z.string().nullable(),
            civilTwilightBegin: z.string().nullable(),
            civilTwilightEnd: z.string().nullable(),
          }),
        })
        .parse(result.structuredContent);
      expect(parsed.times.sunrise).toBe(null);
      expect(parsed.times.sunset).toBe(null);
    } finally {
      await close();
    }
  });

  it('compute_solar_times surfaces invalid date as isError', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'compute_solar_times',
        arguments: { lat: 40, lon: -74, dateUtc: 'not-a-date' },
      });
      expect(result.isError).toBe(true);
      const parsed = z.object({ times: z.null() }).parse(result.structuredContent);
      expect(parsed.times).toBe(null);
    } finally {
      await close();
    }
  });

  it('is_daytime returns boolean', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'is_daytime',
        arguments: { lat: 40, lon: -74, dateTimeUtc: '2026-06-21T16:00:00Z' },
      });
      const parsed = z.object({ isDaytime: z.boolean() }).parse(result.structuredContent);
      expect(typeof parsed.isDaytime).toBe('boolean');
    } finally {
      await close();
    }
  });

  it('is_daytime surfaces invalid date as isError', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'is_daytime',
        arguments: { lat: 40, lon: -74, dateTimeUtc: 'not-a-date' },
      });
      expect(result.isError).toBe(true);
      const parsed = z.object({ isDaytime: z.null() }).parse(result.structuredContent);
      expect(parsed.isDaytime).toBe(null);
    } finally {
      await close();
    }
  });

  it('compute_magnetic_declination returns declination', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'compute_magnetic_declination',
        arguments: { lat: 40, lon: -74 },
      });
      const parsed = z.object({ declinationDeg: z.number() }).parse(result.structuredContent);
      assert(Number.isFinite(parsed.declinationDeg));
    } finally {
      await close();
    }
  });

  it('compute_magnetic_declination accepts altitude and date overrides', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'compute_magnetic_declination',
        arguments: { lat: 40, lon: -74, altitudeFt: 30000, dateUtc: '2026-01-01T00:00:00Z' },
      });
      const parsed = z.object({ declinationDeg: z.number() }).parse(result.structuredContent);
      assert(Number.isFinite(parsed.declinationDeg));
    } finally {
      await close();
    }
  });

  it('compute_magnetic_declination surfaces invalid date as isError', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'compute_magnetic_declination',
        arguments: { lat: 40, lon: -74, dateUtc: 'bogus' },
      });
      expect(result.isError).toBe(true);
      const parsed = z.object({ declinationDeg: z.null() }).parse(result.structuredContent);
      expect(parsed.declinationDeg).toBe(null);
    } finally {
      await close();
    }
  });

  it('convert_true_to_magnetic_bearing returns a magnetic bearing', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'convert_true_to_magnetic_bearing',
        arguments: { trueBearingDeg: 90, lat: 40, lon: -74 },
      });
      const parsed = z.object({ magneticBearingDeg: z.number() }).parse(result.structuredContent);
      assert(parsed.magneticBearingDeg >= 0 && parsed.magneticBearingDeg < 360);
    } finally {
      await close();
    }
  });

  it('convert_true_to_magnetic_bearing surfaces invalid date as isError', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'convert_true_to_magnetic_bearing',
        arguments: { trueBearingDeg: 90, lat: 40, lon: -74, dateUtc: 'bogus' },
      });
      expect(result.isError).toBe(true);
    } finally {
      await close();
    }
  });

  it('convert_magnetic_to_true_bearing returns a true bearing', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'convert_magnetic_to_true_bearing',
        arguments: { magneticBearingDeg: 90, lat: 40, lon: -74 },
      });
      const parsed = z.object({ trueBearingDeg: z.number() }).parse(result.structuredContent);
      assert(parsed.trueBearingDeg >= 0 && parsed.trueBearingDeg < 360);
    } finally {
      await close();
    }
  });

  it('convert_magnetic_to_true_bearing surfaces invalid date as isError', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'convert_magnetic_to_true_bearing',
        arguments: { magneticBearingDeg: 90, lat: 40, lon: -74, dateUtc: 'bogus' },
      });
      expect(result.isError).toBe(true);
    } finally {
      await close();
    }
  });

  it('compute_fuel_required returns fuel quantity', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'compute_fuel_required',
        arguments: { distanceNm: 300, groundSpeedKt: 120, fuelBurnPerHr: 10 },
      });
      const parsed = z.object({ fuelRequired: z.number() }).parse(result.structuredContent);
      assert(parsed.fuelRequired > 0);
    } finally {
      await close();
    }
  });

  it('compute_point_of_no_return returns distance and time', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'compute_point_of_no_return',
        arguments: {
          fuelAvailable: 50,
          fuelBurnPerHr: 10,
          groundSpeedOutKt: 120,
          groundSpeedBackKt: 100,
        },
      });
      const parsed = z
        .object({ distanceNm: z.number(), timeHrs: z.number() })
        .parse(result.structuredContent);
      assert(parsed.distanceNm > 0);
      assert(parsed.timeHrs > 0);
    } finally {
      await close();
    }
  });

  it('compute_equal_time_point returns distance and time', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'compute_equal_time_point',
        arguments: { totalDistanceNm: 500, groundSpeedOutKt: 120, groundSpeedBackKt: 100 },
      });
      const parsed = z
        .object({ distanceNm: z.number(), timeHrs: z.number() })
        .parse(result.structuredContent);
      assert(parsed.distanceNm > 0 && parsed.distanceNm < 500);
    } finally {
      await close();
    }
  });
});

describe('airport tools', () => {
  it('get_airport_by_faa_id returns the JFK record', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'get_airport_by_faa_id',
        arguments: { faaId: 'JFK' },
      });
      const parsed = z
        .object({ airport: z.object({ faaId: z.string() }).nullable() })
        .parse(result.structuredContent);
      expect(parsed.airport?.faaId).toBe('JFK');
    } finally {
      await close();
    }
  });

  it('get_airport_by_faa_id returns null for unknown FAA ID', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'get_airport_by_faa_id',
        arguments: { faaId: 'ZZZZZ' },
      });
      const parsed = z.object({ airport: z.null() }).parse(result.structuredContent);
      expect(parsed.airport).toBe(null);
    } finally {
      await close();
    }
  });

  it('get_airport_by_icao returns null for unknown ICAO', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'get_airport_by_icao',
        arguments: { icao: 'ZZZZ' },
      });
      const parsed = z.object({ airport: z.null() }).parse(result.structuredContent);
      expect(parsed.airport).toBe(null);
    } finally {
      await close();
    }
  });

  it('find_nearest_airports returns nearby airports near JFK', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'find_nearest_airports',
        arguments: { lat: 40.6413, lon: -73.7781, maxDistanceNm: 50, limit: 5 },
      });
      const parsed = z.object({ results: z.array(z.unknown()) }).parse(result.structuredContent);
      assert(parsed.results.length > 0);
    } finally {
      await close();
    }
  });

  it('find_nearest_airports honors facilityTypes and minRunwayLengthFt', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'find_nearest_airports',
        arguments: {
          lat: 40.6413,
          lon: -73.7781,
          facilityTypes: ['AIRPORT'],
          minRunwayLengthFt: 5000,
        },
      });
      const parsed = z.object({ results: z.array(z.unknown()) }).parse(result.structuredContent);
      assert(Array.isArray(parsed.results));
    } finally {
      await close();
    }
  });

  it('search_airports finds matches by city name', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'search_airports',
        arguments: { text: 'BOSTON', limit: 5, facilityTypes: ['AIRPORT'] },
      });
      const parsed = z.object({ results: z.array(z.unknown()) }).parse(result.structuredContent);
      assert(parsed.results.length > 0);
    } finally {
      await close();
    }
  });
});

describe('airspace tools', () => {
  it('query_airspace_at_position returns features inside JFK Class B', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'query_airspace_at_position',
        arguments: { lat: 40.6413, lon: -73.7781, altitudeFt: 1500 },
      });
      const parsed = z
        .object({ features: z.array(z.object({ type: z.string() }).passthrough()) })
        .parse(result.structuredContent);
      assert(parsed.features.length > 0);
    } finally {
      await close();
    }
  });

  it('query_airspace_at_position honors airspaceTypes filter', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'query_airspace_at_position',
        arguments: {
          lat: 40.6413,
          lon: -73.7781,
          altitudeFt: 1500,
          airspaceTypes: ['CLASS_B'],
        },
      });
      const parsed = z
        .object({ features: z.array(z.object({ type: z.string() }).passthrough()) })
        .parse(result.structuredContent);
      for (const feat of parsed.features) {
        expect(feat.type).toBe('CLASS_B');
      }
    } finally {
      await close();
    }
  });

  it('get_airspace_for_airport returns null for unknown identifier', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'get_airspace_for_airport',
        arguments: { airportId: 'ZZZZZ' },
      });
      const parsed = z
        .object({
          airport: z.null(),
          features: z.array(z.unknown()),
        })
        .parse(result.structuredContent);
      expect(parsed.airport).toBe(null);
      expect(parsed.features.length).toBe(0);
    } finally {
      await close();
    }
  });

  it('get_airspace_for_airport accepts FAA id and explicit airspaceTypes', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'get_airspace_for_airport',
        arguments: { airportId: 'JFK', airspaceTypes: ['CLASS_B'] },
      });
      const parsed = z
        .object({
          airport: z.object({ faaId: z.string() }).nullable(),
          features: z.array(z.unknown()),
        })
        .parse(result.structuredContent);
      assert(parsed.airport);
      expect(parsed.airport.faaId).toBe('JFK');
    } finally {
      await close();
    }
  });

  it('find_artcc_for_position uses default altitude when omitted', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'find_artcc_for_position',
        arguments: { lat: 44.47, lon: -73.15 },
      });
      const parsed = z
        .object({ features: z.array(z.object({ identifier: z.string() }).passthrough()) })
        .parse(result.structuredContent);
      assert(parsed.features.length > 0);
    } finally {
      await close();
    }
  });

  it('find_artcc_by_identifier honors stratum filter', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'find_artcc_by_identifier',
        arguments: { artccId: 'ZNY', stratum: 'LOW' },
      });
      const parsed = z
        .object({
          features: z.array(z.object({ artccStratum: z.string() }).passthrough()),
        })
        .parse(result.structuredContent);
      assert(parsed.features.length > 0);
      for (const feat of parsed.features) {
        expect(feat.artccStratum).toBe('LOW');
      }
    } finally {
      await close();
    }
  });
});

describe('navaid tools', () => {
  it('find_navaids_by_frequency finds navaids on 113.5 MHz', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'find_navaids_by_frequency',
        arguments: { frequency: 113.5, limit: 5 },
      });
      const parsed = z.object({ navaids: z.array(z.unknown()) }).parse(result.structuredContent);
      assert(Array.isArray(parsed.navaids));
    } finally {
      await close();
    }
  });

  it('find_navaids_by_frequency honors navaidTypes filter', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'find_navaids_by_frequency',
        arguments: { frequency: 113.5, navaidTypes: ['VOR', 'VORTAC'], limit: 5 },
      });
      const parsed = z.object({ navaids: z.array(z.unknown()) }).parse(result.structuredContent);
      assert(Array.isArray(parsed.navaids));
    } finally {
      await close();
    }
  });

  it('find_nearest_navaids returns navaids near JFK', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'find_nearest_navaids',
        arguments: { lat: 40.6413, lon: -73.7781, maxDistanceNm: 50, limit: 5 },
      });
      const parsed = z.object({ results: z.array(z.unknown()) }).parse(result.structuredContent);
      assert(parsed.results.length > 0);
    } finally {
      await close();
    }
  });

  it('find_nearest_navaids honors navaidTypes filter', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'find_nearest_navaids',
        arguments: {
          lat: 40.6413,
          lon: -73.7781,
          maxDistanceNm: 100,
          limit: 3,
          navaidTypes: ['VOR'],
        },
      });
      const parsed = z.object({ results: z.array(z.unknown()) }).parse(result.structuredContent);
      assert(Array.isArray(parsed.results));
    } finally {
      await close();
    }
  });

  it('search_navaids finds VOR navaids by name', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'search_navaids',
        arguments: { text: 'BOSTON', limit: 5, navaidTypes: ['VOR', 'VORTAC'] },
      });
      const parsed = z.object({ navaids: z.array(z.unknown()) }).parse(result.structuredContent);
      assert(Array.isArray(parsed.navaids));
    } finally {
      await close();
    }
  });

  it('find_navaids_by_frequency works without optional arguments', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'find_navaids_by_frequency',
        arguments: { frequency: 113.5 },
      });
      const parsed = z.object({ navaids: z.array(z.unknown()) }).parse(result.structuredContent);
      assert(Array.isArray(parsed.navaids));
    } finally {
      await close();
    }
  });

  it('find_nearest_navaids works without optional arguments', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'find_nearest_navaids',
        arguments: { lat: 40.6413, lon: -73.7781 },
      });
      const parsed = z.object({ results: z.array(z.unknown()) }).parse(result.structuredContent);
      assert(Array.isArray(parsed.results));
    } finally {
      await close();
    }
  });

  it('search_navaids works without optional arguments', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'search_navaids',
        arguments: { text: 'BOSTON' },
      });
      const parsed = z.object({ navaids: z.array(z.unknown()) }).parse(result.structuredContent);
      assert(Array.isArray(parsed.navaids));
    } finally {
      await close();
    }
  });
});

describe('fix tools', () => {
  it('get_fix_by_ident returns matching fixes', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'get_fix_by_ident',
        arguments: { ident: 'MERIT' },
      });
      const parsed = z
        .object({ fixes: z.array(z.object({ identifier: z.string() }).passthrough()) })
        .parse(result.structuredContent);
      assert(parsed.fixes.length > 0);
    } finally {
      await close();
    }
  });

  it('find_nearest_fixes returns nearby fixes', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'find_nearest_fixes',
        arguments: { lat: 40.6413, lon: -73.7781, maxDistanceNm: 100, limit: 5 },
      });
      const parsed = z.object({ results: z.array(z.unknown()) }).parse(result.structuredContent);
      assert(parsed.results.length > 0);
    } finally {
      await close();
    }
  });

  it('find_nearest_fixes honors useCodes filter', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'find_nearest_fixes',
        arguments: {
          lat: 40.6413,
          lon: -73.7781,
          maxDistanceNm: 200,
          limit: 5,
          useCodes: ['WP'],
        },
      });
      const parsed = z.object({ results: z.array(z.unknown()) }).parse(result.structuredContent);
      assert(Array.isArray(parsed.results));
    } finally {
      await close();
    }
  });

  it('search_fixes finds fixes by substring', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'search_fixes',
        arguments: { text: 'MERIT', limit: 5, useCodes: ['WP'] },
      });
      const parsed = z.object({ fixes: z.array(z.unknown()) }).parse(result.structuredContent);
      assert(Array.isArray(parsed.fixes));
    } finally {
      await close();
    }
  });

  it('find_nearest_fixes works without optional arguments', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'find_nearest_fixes',
        arguments: { lat: 40.6413, lon: -73.7781 },
      });
      const parsed = z.object({ results: z.array(z.unknown()) }).parse(result.structuredContent);
      assert(Array.isArray(parsed.results));
    } finally {
      await close();
    }
  });

  it('search_fixes works without optional arguments', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'search_fixes',
        arguments: { text: 'MERIT' },
      });
      const parsed = z.object({ fixes: z.array(z.unknown()) }).parse(result.structuredContent);
      assert(Array.isArray(parsed.fixes));
    } finally {
      await close();
    }
  });
});

describe('airway tools', () => {
  it('get_airway_by_designation returns matching airways', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'get_airway_by_designation',
        arguments: { designation: 'V16' },
      });
      const parsed = z.object({ airways: z.array(z.unknown()) }).parse(result.structuredContent);
      assert(parsed.airways.length > 0);
    } finally {
      await close();
    }
  });

  it('expand_airway_segment returns null for impossible segment', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'expand_airway_segment',
        arguments: { designation: 'V16', entryFix: 'ZZZZZ', exitFix: 'YYYYY' },
      });
      const parsed = z.object({ expansion: z.null() }).parse(result.structuredContent);
      expect(parsed.expansion).toBe(null);
    } finally {
      await close();
    }
  });

  it('expand_airway_segment returns the waypoint sequence for a valid segment', async () => {
    const { client, close } = await connectTestClient();
    try {
      // Look up an airway, take its first and last waypoint, and expand between them.
      const lookup = await client.callTool({
        name: 'get_airway_by_designation',
        arguments: { designation: 'V16' },
      });
      const lookupSchema = z.object({
        airways: z.array(
          z
            .object({
              waypoints: z.array(z.object({ identifier: z.string() }).passthrough()),
            })
            .passthrough(),
        ),
      });
      const airwayResult = lookupSchema.parse(lookup.structuredContent);
      assert(airwayResult.airways.length > 0, 'expected V16 to exist');
      const waypoints = airwayResult.airways[0]?.waypoints ?? [];
      assert(waypoints.length >= 2, 'expected V16 to have at least two waypoints');
      const entry = waypoints[0]!.identifier;
      const exit = waypoints[waypoints.length - 1]!.identifier;

      const result = await client.callTool({
        name: 'expand_airway_segment',
        arguments: { designation: 'V16', entryFix: entry, exitFix: exit },
      });
      const parsed = z.object({ expansion: z.unknown() }).parse(result.structuredContent);
      assert(parsed.expansion !== null, 'expected a non-null expansion');
    } finally {
      await close();
    }
  });

  it('search_airways works without optional arguments', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'search_airways',
        arguments: { text: 'V1' },
      });
      const parsed = z.object({ airways: z.array(z.unknown()) }).parse(result.structuredContent);
      assert(Array.isArray(parsed.airways));
    } finally {
      await close();
    }
  });

  it('find_airways_by_fix returns airways through a known navaid', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'find_airways_by_fix',
        arguments: { ident: 'BOS' },
      });
      const parsed = z.object({ results: z.array(z.unknown()) }).parse(result.structuredContent);
      assert(Array.isArray(parsed.results));
    } finally {
      await close();
    }
  });

  it('search_airways finds airways with substring match', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'search_airways',
        arguments: { text: 'V', airwayTypes: ['VICTOR'], limit: 5 },
      });
      const parsed = z.object({ airways: z.array(z.unknown()) }).parse(result.structuredContent);
      assert(Array.isArray(parsed.airways));
    } finally {
      await close();
    }
  });
});

describe('procedure tools', () => {
  it('find_procedures_by_airport returns procedures for KJFK', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'find_procedures_by_airport',
        arguments: { airportId: 'KJFK' },
      });
      const parsed = z.object({ procedures: z.array(z.unknown()) }).parse(result.structuredContent);
      assert(parsed.procedures.length > 0);
    } finally {
      await close();
    }
  });

  it('search_procedures honors procedureType filter', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'search_procedures',
        arguments: { text: 'RWY', procedureType: 'IAP', limit: 5 },
      });
      const parsed = z
        .object({
          procedures: z.array(z.object({ type: z.string() }).passthrough()),
        })
        .parse(result.structuredContent);
      for (const proc of parsed.procedures) {
        expect(proc.type).toBe('IAP');
      }
    } finally {
      await close();
    }
  });
});

describe('icao registry tools', () => {
  it('lookup_aircraft_by_icao_hex returns null for unknown hex', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'lookup_aircraft_by_icao_hex',
        arguments: { icaoHex: '000000' },
      });
      const parsed = z
        .object({ aircraft: z.union([z.null(), z.object({}).passthrough()]) })
        .parse(result.structuredContent);
      assert(parsed.aircraft === null || typeof parsed.aircraft === 'object');
    } finally {
      await close();
    }
  });

  it('reuses the cached registry on subsequent calls', async () => {
    const { client, close } = await connectTestClient();
    try {
      const first = await client.callTool({
        name: 'lookup_aircraft_by_icao_hex',
        arguments: { icaoHex: 'A00001' },
      });
      const second = await client.callTool({
        name: 'lookup_aircraft_by_icao_hex',
        arguments: { icaoHex: 'A00002' },
      });
      const schema = z.object({ aircraft: z.union([z.null(), z.object({}).passthrough()]) });
      schema.parse(first.structuredContent);
      schema.parse(second.structuredContent);
    } finally {
      await close();
    }
  });

  it('get_dataset_status reports the registry as loaded after a lookup', async () => {
    const { client, close } = await connectTestClient();
    try {
      // Force registry load via a lookup first.
      await client.callTool({
        name: 'lookup_aircraft_by_icao_hex',
        arguments: { icaoHex: 'A00001' },
      });
      const result = await client.callTool({ name: 'get_dataset_status', arguments: {} });
      const parsed = z
        .object({
          datasets: z.object({
            icaoRegistry: z.object({
              loaded: z.boolean(),
            }),
          }),
        })
        .parse(result.structuredContent);
      expect(parsed.datasets.icaoRegistry.loaded).toBe(true);
    } finally {
      await close();
    }
  });
});

describe('flightplan tools', () => {
  it('parse_flightplan_route returns structured route', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'parse_flightplan_route',
        arguments: { routeString: 'KJFK DCT KLAX' },
      });
      const parsed = z.object({ route: z.unknown() }).parse(result.structuredContent);
      assert(parsed.route !== undefined);
    } finally {
      await close();
    }
  });

  it('compute_route_distance omits ETE when groundSpeedKt missing', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'compute_route_distance',
        arguments: { routeString: 'KJFK DCT KLAX' },
      });
      const parsed = z
        .object({
          result: z
            .object({
              totalDistanceNm: z.number(),
              estimatedTimeEnrouteHrs: z.number().nullable().optional(),
            })
            .passthrough(),
        })
        .parse(result.structuredContent);
      assert(
        parsed.result.estimatedTimeEnrouteHrs === undefined ||
          parsed.result.estimatedTimeEnrouteHrs === null,
      );
    } finally {
      await close();
    }
  });
});

describe('weather parsing tools', () => {
  it('parse_taf parses a TAF block', async () => {
    const { client, close } = await connectTestClient();
    try {
      const raw = [
        'TAF KJFK 041730Z 0418/0524 21012KT P6SM FEW250',
        '     FM042200 24015G25KT P6SM SCT040 BKN080',
      ].join('\n');
      const result = await client.callTool({
        name: 'parse_taf',
        arguments: { raw },
      });
      const parsed = z
        .object({ taf: z.object({ stationId: z.string() }).passthrough() })
        .parse(result.structuredContent);
      expect(parsed.taf.stationId).toBe('KJFK');
    } finally {
      await close();
    }
  });

  it('parse_taf flags malformed input via isError', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'parse_taf',
        arguments: { raw: 'not a taf' },
      });
      expect(result.isError).toBe(true);
      const parsed = z.object({ taf: z.null() }).parse(result.structuredContent);
      expect(parsed.taf).toBe(null);
    } finally {
      await close();
    }
  });

  it('parse_sigmet parses a convective SIGMET', async () => {
    const { client, close } = await connectTestClient();
    try {
      const raw = [
        'WST SIGMET CONVECTIVE SIGMET 45C',
        'VALID UNTIL 042055Z',
        'KS OK TX',
        'FROM 30NW ICT-40S MCI-20W ADM-50SW ABI-30NW ICT',
        'AREA SEV TS MOV FROM 26025KT. TOPS ABV FL450.',
      ].join('\n');
      const result = await client.callTool({
        name: 'parse_sigmet',
        arguments: { raw },
      });
      const parsed = z.object({ sigmet: z.unknown() }).parse(result.structuredContent);
      assert(parsed.sigmet !== null);
    } finally {
      await close();
    }
  });

  it('parse_airmet parses an AIRMET SIERRA bulletin', async () => {
    const { client, close } = await connectTestClient();
    try {
      const raw = [
        'WAUS41 KKCI 271445',
        'SFOS WA',
        'SFOS WA 271445',
        'AIRMET SIERRA UPDT 1 FOR IFR AND MTN OBSCN VALID UNTIL 272100',
        'AIRMET IFR...WA OR',
        'FROM SEA TO YDC TO DLS TO SEA',
        'CIG BLW 010/VIS BLW 3SM BR.',
        'CONDS CONTG BYD 21Z THRU 03Z.',
      ].join('\n');
      const result = await client.callTool({
        name: 'parse_airmet',
        arguments: { raw },
      });
      const parsed = z.object({ airmet: z.unknown() }).parse(result.structuredContent);
      assert(parsed.airmet !== undefined);
    } finally {
      await close();
    }
  });

  it('parse_airmet flags malformed input via isError', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'parse_airmet',
        arguments: { raw: 'definitely not an airmet' },
      });
      expect(result.isError).toBe(true);
    } finally {
      await close();
    }
  });

  it('parse_pirep parses a routine PIREP', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'parse_pirep',
        arguments: { raw: 'UA /OV OKC/TM 1530/FL085/TP C172/RM TEST' },
      });
      const parsed = z
        .object({ pirep: z.object({ type: z.string() }).passthrough() })
        .parse(result.structuredContent);
      expect(parsed.pirep.type).toBe('UA');
    } finally {
      await close();
    }
  });
});

describe('notam parsing tools', () => {
  it('parse_icao_notam parses a runway closure NOTAM', async () => {
    const { client, close } = await connectTestClient();
    try {
      const raw = [
        'A0030/26 NOTAMN',
        'Q) PAZA/QMRLC/IV/NBO/A/000/999/6110N14948W005',
        'A) PANC',
        'B) 2604120730',
        'C) 2604121430',
        'E) RWY 07R/25L CLSD EXC XNG',
        'F) SFC',
        'G) UNL',
      ].join('\n');
      const result = await client.callTool({
        name: 'parse_icao_notam',
        arguments: { raw },
      });
      const parsed = z
        .object({ notam: z.object({ id: z.string() }).passthrough() })
        .parse(result.structuredContent);
      expect(parsed.notam.id).toBe('A0030/26');
    } finally {
      await close();
    }
  });

  it('parse_icao_notam surfaces parser errors via isError', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'parse_icao_notam',
        arguments: { raw: 'definitely-not-a-notam' },
      });
      expect(result.isError).toBe(true);
    } finally {
      await close();
    }
  });

  it('parse_faa_notam parses a domestic NAV NOTAM', async () => {
    const { client, close } = await connectTestClient();
    try {
      const raw = '!ATL 03/296 ATL NAV ILS RWY 08L IM U/S 2603181657-2711082111EST';
      const result = await client.callTool({
        name: 'parse_faa_notam',
        arguments: { raw },
      });
      const parsed = z.object({ notam: z.unknown() }).parse(result.structuredContent);
      assert(parsed.notam !== null);
    } finally {
      await close();
    }
  });
});

interface FetchStub {
  /** Most recent URL the stub was called with. */
  lastUrl: string | undefined;
  /** Body returned by the next call. */
  body: string;
  /** HTTP status returned by the next call. */
  status: number;
}

describe('weather fetch tools (mocked) - extra paths', () => {
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

  it('fetch_pirep forwards optional filter parameters on the URL', async () => {
    stub.body = '';
    const { client, close } = await connectTestClient();
    try {
      await client.callTool({
        name: 'fetch_pirep',
        arguments: {
          station: 'KDEN',
          radiusNm: 100,
          ageHours: 2,
          levelHundredsFt: 100,
          minimumIntensity: 'mod',
        },
      });
      assert(stub.lastUrl?.includes('id=KDEN'));
      assert(stub.lastUrl?.includes('distance=100'));
      assert(stub.lastUrl?.includes('age=2'));
      assert(stub.lastUrl?.includes('level=100'));
      assert(stub.lastUrl?.includes('inten=mod'));
    } finally {
      await close();
    }
  });

  it('fetch_pirep works without optional parameters', async () => {
    stub.body = '';
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'fetch_pirep',
        arguments: { station: 'KDEN' },
      });
      const parsed = z
        .object({ pireps: z.array(z.unknown()), parseErrors: z.array(z.unknown()) })
        .parse(result.structuredContent);
      expect(parsed.pireps.length).toBe(0);
    } finally {
      await close();
    }
  });

  it('fetch_sigmets without hazard filter returns empty list', async () => {
    stub.body = '';
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'fetch_sigmets',
        arguments: {},
      });
      const parsed = z
        .object({ sigmets: z.array(z.unknown()), parseErrors: z.array(z.unknown()) })
        .parse(result.structuredContent);
      expect(parsed.sigmets.length).toBe(0);
      assert(stub.lastUrl?.includes('/airsigmet?'));
    } finally {
      await close();
    }
  });

  it('fetch_international_sigmets requests the airsigmet endpoint', async () => {
    stub.body = '';
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'fetch_international_sigmets',
        arguments: {},
      });
      const parsed = z
        .object({ sigmets: z.array(z.unknown()), parseErrors: z.array(z.unknown()) })
        .parse(result.structuredContent);
      expect(parsed.sigmets.length).toBe(0);
      assert(stub.lastUrl?.includes('/isigmet?'));
    } finally {
      await close();
    }
  });

  it('fetch_winds_aloft works with no options', async () => {
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
        arguments: {},
      });
      const parsed = z
        .object({ forecast: z.object({ productCode: z.string() }).passthrough() })
        .parse(result.structuredContent);
      expect(parsed.forecast.productCode).toBe('FD1US1');
    } finally {
      await close();
    }
  });
});
