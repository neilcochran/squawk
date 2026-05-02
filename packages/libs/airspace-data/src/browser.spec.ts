import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { usBundledAirspace } from './node.js';
import { loadUsBundledAirspace } from './browser.js';

const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/airspace.geojson.gz');
const gzBytes = readFileSync(dataPath);
const decompressedBytes = gunzipSync(gzBytes);

describe('loadUsBundledAirspace', () => {
  it('produces the same dataset as the Node export when the body is raw gzip', async () => {
    const dataset = await loadUsBundledAirspace({
      fetch: async () => new Response(gzBytes),
    });

    expect(dataset).toEqual(usBundledAirspace);
  });

  it('produces the same dataset when the server advertises Content-Encoding: gzip', async () => {
    const dataset = await loadUsBundledAirspace({
      fetch: async () =>
        new Response(decompressedBytes, {
          headers: { 'content-encoding': 'gzip' },
        }),
    });

    expect(dataset).toEqual(usBundledAirspace);
  });

  it('throws when the response is not ok', async () => {
    await expect(
      loadUsBundledAirspace({
        fetch: async () => new Response('', { status: 404, statusText: 'Not Found' }),
      }),
    ).rejects.toThrow(/404/);
  });

  it('passes the resolved URL to the custom fetch', async () => {
    let received: string | URL | undefined;

    await loadUsBundledAirspace({
      url: 'https://cdn.example/airspace.geojson.gz',
      fetch: async (input) => {
        received = input instanceof Request ? input.url : input;
        return new Response(gzBytes);
      },
    });

    expect(received).toBe('https://cdn.example/airspace.geojson.gz');
  });

  it('throws when the response body is null', async () => {
    await expect(
      loadUsBundledAirspace({
        fetch: async () => new Response(null),
      }),
    ).rejects.toThrow(/body is null/);
  });

  it('falls back to globalThis.fetch when no fetch override is provided', async () => {
    const original = globalThis.fetch;
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return new Response(gzBytes);
    };
    try {
      const dataset = await loadUsBundledAirspace();
      expect(called).toBe(true);
      expect(dataset).toEqual(usBundledAirspace);
    } finally {
      globalThis.fetch = original;
    }
  });
});
