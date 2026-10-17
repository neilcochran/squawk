import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import { describe, it, expect } from 'vitest';

import { loadUsBundledProcedures } from './browser.js';
import { usBundledProcedures } from './node.js';

const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/procedures.json.gz');

/**
 * A small dataset in the bundled file's on-disk shape. The tests that only
 * exercise fetching and decoding use it instead of the real snapshot, so they
 * do not decompress the whole file; the first test still loads the real file
 * end to end.
 */
const fixtureFile = {
  meta: {
    generatedAt: '2026-01-01T00:00:00.000Z',
    cifpCycleDate: '2026-01-22',
    recordCount: 1,
    sidCount: 1,
    starCount: 0,
    iapCount: 0,
    legCount: 0,
  },
  records: [
    {
      identifier: 'TEST1',
      name: 'TEST ONE',
      type: 'SID',
      airports: ['TST'],
      commonRoutes: [],
      transitions: [],
    },
  ],
};
const fixtureDataset = { properties: fixtureFile.meta, records: fixtureFile.records };
const fixtureJson = Buffer.from(JSON.stringify(fixtureFile));
const fixtureGz = gzipSync(fixtureJson);

describe('loadUsBundledProcedures', () => {
  it('produces the same dataset as the Node export from the bundled file', async () => {
    const dataset = await loadUsBundledProcedures({
      fetch: async () => new Response(readFileSync(dataPath)),
    });

    expect(dataset).toEqual(usBundledProcedures);
  });

  it('decompresses a body served as raw gzip', async () => {
    const dataset = await loadUsBundledProcedures({
      fetch: async () => new Response(fixtureGz),
    });

    expect(dataset).toEqual(fixtureDataset);
  });

  it('reads the body as is when the server advertises Content-Encoding: gzip', async () => {
    const dataset = await loadUsBundledProcedures({
      fetch: async () =>
        new Response(fixtureJson, {
          headers: { 'content-encoding': 'gzip' },
        }),
    });

    expect(dataset).toEqual(fixtureDataset);
  });

  it('throws when the response is not ok', async () => {
    await expect(
      loadUsBundledProcedures({
        fetch: async () => new Response('', { status: 404, statusText: 'Not Found' }),
      }),
    ).rejects.toThrow(/404/);
  });

  it('passes the resolved URL to the custom fetch', async () => {
    let received: string | URL | undefined;

    await loadUsBundledProcedures({
      url: 'https://cdn.example/procedures.json.gz',
      fetch: async (input) => {
        received = input instanceof Request ? input.url : input;
        return new Response(fixtureGz);
      },
    });

    expect(received).toBe('https://cdn.example/procedures.json.gz');
  });

  it('throws when the response body is null', async () => {
    await expect(
      loadUsBundledProcedures({
        fetch: async () => new Response(null),
      }),
    ).rejects.toThrow(/body is null/);
  });

  it('falls back to globalThis.fetch when no fetch override is provided', async () => {
    const original = globalThis.fetch;
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return new Response(fixtureGz);
    };
    try {
      const dataset = await loadUsBundledProcedures();
      expect(called).toBe(true);
      expect(dataset).toEqual(fixtureDataset);
    } finally {
      globalThis.fetch = original;
    }
  });
});
