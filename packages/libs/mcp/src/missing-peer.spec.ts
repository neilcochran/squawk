/**
 * Tests covering the optional peer dependency story for
 * `@squawk/icao-registry-data`. Three paths under test:
 *
 * 1. The {@link MissingDataPackageError} class formats its message and
 *    surfaces the install command on dedicated properties.
 * 2. {@link getIcaoRegistry} catches `ERR_MODULE_NOT_FOUND` from the lazy
 *    import, wraps it in a {@link MissingDataPackageError}, and stays
 *    sticky on subsequent calls so the import is not retried.
 * 3. The `lookup_aircraft_by_icao_hex` tool surfaces a structured
 *    `isError: true` result with the install command when the peer is
 *    missing, while still appearing in the catalog.
 *
 * The data package import is swapped at the resolver level via
 * {@link __setIcaoRegistryDataLoaderForTest} rather than via vitest module
 * mocking, because vitest cannot easily make a dynamic import throw with
 * `ERR_MODULE_NOT_FOUND` at module-load time. Routing through the seam
 * exercises the real {@link getIcaoRegistry} body and the tool handler so
 * coverage reflects the production path.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { z } from 'zod';

import {
  MissingDataPackageError,
  __setIcaoRegistryDataLoaderForTest,
  getIcaoRegistry,
  getIcaoRegistryMetadata,
  isIcaoRegistryLoaded,
} from './resolvers.js';
import { createSquawkMcpServer } from './server.js';

/**
 * Builds a loader that mimics Node's `ERR_MODULE_NOT_FOUND` rejection,
 * matching the shape `getIcaoRegistry` keys off when deciding whether to
 * surface a {@link MissingDataPackageError}.
 */
function rejectingLoader(): () => Promise<never> {
  return () => {
    const err = Object.assign(new Error("Cannot find package '@squawk/icao-registry-data'"), {
      code: 'ERR_MODULE_NOT_FOUND',
    });
    return Promise.reject(err);
  };
}

describe('MissingDataPackageError', () => {
  it('formats the message and exposes the install command on its properties', () => {
    const err = new MissingDataPackageError('icao-registry', '@squawk/icao-registry-data');
    expect(err.name).toBe('MissingDataPackageError');
    expect(err.datasetName).toBe('icao-registry');
    expect(err.packageName).toBe('@squawk/icao-registry-data');
    expect(err.installCommand).toBe('npm install @squawk/icao-registry-data');
    expect(err.message).toBe(
      'icao-registry data is not installed. Run: npm install @squawk/icao-registry-data',
    );
    expect(err).toBeInstanceOf(Error);
  });
});

describe('getIcaoRegistry when the optional peer is missing', () => {
  beforeEach(() => {
    __setIcaoRegistryDataLoaderForTest(rejectingLoader());
  });

  afterEach(() => {
    __setIcaoRegistryDataLoaderForTest(undefined);
  });

  it('throws MissingDataPackageError on first call', async () => {
    await expect(getIcaoRegistry()).rejects.toBeInstanceOf(MissingDataPackageError);
  });

  it('keeps throwing MissingDataPackageError without retrying the import', async () => {
    await expect(getIcaoRegistry()).rejects.toBeInstanceOf(MissingDataPackageError);
    await expect(getIcaoRegistry()).rejects.toBeInstanceOf(MissingDataPackageError);
  });

  it('reports the registry as not loaded and exposes no metadata', () => {
    expect(isIcaoRegistryLoaded()).toBe(false);
    expect(getIcaoRegistryMetadata()).toBeUndefined();
  });

  it('rethrows non-ERR_MODULE_NOT_FOUND errors unchanged', async () => {
    const otherError = new Error('boom');
    __setIcaoRegistryDataLoaderForTest(() => Promise.reject(otherError));
    await expect(getIcaoRegistry()).rejects.toBe(otherError);
  });
});

describe('lookup_aircraft_by_icao_hex when the optional peer is missing', () => {
  beforeEach(() => {
    __setIcaoRegistryDataLoaderForTest(rejectingLoader());
  });

  afterEach(() => {
    __setIcaoRegistryDataLoaderForTest(undefined);
  });

  it('returns isError with the install command in the structured payload', async () => {
    const server = createSquawkMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client({ name: 'squawk-mcp-missing-peer-test', version: '0.0.0' });
    await client.connect(clientTransport);

    try {
      const result = await client.callTool({
        name: 'lookup_aircraft_by_icao_hex',
        arguments: { icaoHex: 'AC82EC' },
      });
      expect(result.isError).toBe(true);
      const parsed = z
        .object({
          aircraft: z.null(),
          missingDataPackage: z.object({
            datasetName: z.literal('icao-registry'),
            packageName: z.literal('@squawk/icao-registry-data'),
            installCommand: z.literal('npm install @squawk/icao-registry-data'),
          }),
        })
        .parse(result.structuredContent);
      expect(parsed.aircraft).toBe(null);
      expect(parsed.missingDataPackage.installCommand).toBe(
        'npm install @squawk/icao-registry-data',
      );
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('still lists the tool in the catalog so the LLM can surface the error', async () => {
    const server = createSquawkMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client({ name: 'squawk-mcp-missing-peer-test', version: '0.0.0' });
    await client.connect(clientTransport);

    try {
      const { tools } = await client.listTools();
      const names = new Set(tools.map((tool) => tool.name));
      expect(names.has('lookup_aircraft_by_icao_hex')).toBe(true);
    } finally {
      await client.close();
      await server.close();
    }
  });
});

describe('lookup_aircraft_by_icao_hex when the loader throws an unrelated error', () => {
  beforeEach(() => {
    __setIcaoRegistryDataLoaderForTest(() => Promise.reject(new Error('boom')));
  });

  afterEach(() => {
    __setIcaoRegistryDataLoaderForTest(undefined);
  });

  it('rethrows so the SDK marks the call as isError without the missing-peer shape', async () => {
    const server = createSquawkMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client({ name: 'squawk-mcp-missing-peer-test', version: '0.0.0' });
    await client.connect(clientTransport);

    try {
      const result = await client.callTool({
        name: 'lookup_aircraft_by_icao_hex',
        arguments: { icaoHex: 'AC82EC' },
      });
      expect(result.isError).toBe(true);
      // The missing-peer payload must only fire for MissingDataPackageError;
      // unrelated failures fall through to the SDK's default error shape.
      const structured = result.structuredContent as Record<string, unknown> | undefined;
      expect(structured?.missingDataPackage).toBeUndefined();
    } finally {
      await client.close();
      await server.close();
    }
  });
});
