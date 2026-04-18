import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from 'zod';
import { createSquawkMcpServer } from './server.js';

const EXPECTED_TOOLS: readonly string[] = [
  'great_circle_distance',
  'great_circle_bearing',
  'great_circle_bearing_and_distance',
  'great_circle_midpoint',
  'great_circle_destination',
  'get_airport_by_faa_id',
  'get_airport_by_icao',
  'find_nearest_airports',
  'search_airports',
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
});
