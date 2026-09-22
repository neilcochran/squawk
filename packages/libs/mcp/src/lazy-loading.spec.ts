/**
 * @packageDocumentation
 * Tests that bundled snapshots stay out of memory until a tool actually
 * reads one, and that `get_dataset_status` can describe the server without
 * pulling anything in.
 *
 * Load state is process-wide and only ever moves from unloaded to loaded, so
 * these assertions live in their own spec file: vitest gives each file a
 * fresh module registry, while tests inside one file share it. For the same
 * reason the tests below run in declaration order, from "nothing is loaded"
 * outwards - adding a test that loads a dataset above them would break them.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, it, expect, assert } from 'vitest';
import { z } from 'zod';

import { getBundledDatasetLoadState, getNavaidResolver } from './resolvers.js';
import { createSquawkMcpServer } from './server.js';

/**
 * Connects a client to a server carrying every tool group.
 *
 * @returns The connected client and a matching teardown function.
 */
async function connectTestClient(): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = createSquawkMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: 'squawk-mcp-lazy-loading-test', version: '0.0.0' });
  await client.connect(clientTransport);

  return {
    client,
    close: async (): Promise<void> => {
      await client.close();
      await server.close();
    },
  };
}

describe('demand-driven dataset loading', () => {
  it('registers the full catalog without loading any snapshot', async () => {
    const { client, close } = await connectTestClient();
    try {
      const { tools } = await client.listTools();
      assert(tools.length > 0, 'expected the server to register tools');
      expect(getBundledDatasetLoadState()).toEqual({
        airports: false,
        airspace: false,
        airways: false,
        fixes: false,
        navaids: false,
        procedures: false,
      });
    } finally {
      await close();
    }
  });

  it('answers get_dataset_status with real cycle dates while everything is still unloaded', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({ name: 'get_dataset_status', arguments: {} });
      const parsed = z
        .object({
          datasets: z.object({
            airports: z.object({
              loaded: z.literal(false),
              nasrCycleDate: z.string(),
              generatedAt: z.string(),
              recordCount: z.number().positive(),
            }),
            procedures: z.object({
              loaded: z.literal(false),
              cifpCycleDate: z.string(),
              legCount: z.number().positive(),
            }),
          }),
        })
        .parse(result.structuredContent);

      // The point of the metadata subpath: a real cycle date, reported by a
      // server that has not decompressed a single record.
      expect(parsed.datasets.airports.nasrCycleDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(parsed.datasets.procedures.cifpCycleDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(getBundledDatasetLoadState().airports).toBe(false);
      expect(getBundledDatasetLoadState().procedures).toBe(false);
    } finally {
      await close();
    }
  });

  it('loads only the snapshot the invoked tool needs', async () => {
    const { client, close } = await connectTestClient();
    try {
      await client.callTool({ name: 'get_airport_by_icao', arguments: { icao: 'KJFK' } });
      const state = getBundledDatasetLoadState();
      expect(state.airports).toBe(true);
      expect(state.procedures).toBe(false);
      expect(state.airspace).toBe(false);
      expect(state.airways).toBe(false);
    } finally {
      await close();
    }
  });

  it('reports a dataset as loaded once a tool has read it', async () => {
    const { client, close } = await connectTestClient();
    try {
      const result = await client.callTool({ name: 'get_dataset_status', arguments: {} });
      const parsed = z
        .object({ datasets: z.object({ airports: z.object({ loaded: z.boolean() }) }) })
        .parse(result.structuredContent);
      expect(parsed.datasets.airports.loaded).toBe(true);
    } finally {
      await close();
    }
  });

  it('shares one load between concurrent callers', async () => {
    // navaids is untouched by the tests above, so this exercises the
    // in-flight memo rather than the already-resolved fast path.
    expect(getBundledDatasetLoadState().navaids).toBe(false);
    const [first, second] = await Promise.all([getNavaidResolver(), getNavaidResolver()]);
    expect(first).toBe(second);
  });
});
