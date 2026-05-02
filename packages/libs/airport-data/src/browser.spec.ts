import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { usBundledAirports } from './node.js';
import { loadUsBundledAirports } from './browser.js';

const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/airports.json.gz');
const gzBytes = readFileSync(dataPath);
const decompressedBytes = gunzipSync(gzBytes);

describe('loadUsBundledAirports', () => {
  it('produces the same dataset as the Node export when the body is raw gzip', async () => {
    const dataset = await loadUsBundledAirports({
      fetch: async () => new Response(gzBytes),
    });

    assert.deepEqual(dataset, usBundledAirports);
  });

  it('produces the same dataset when the server advertises Content-Encoding: gzip', async () => {
    const dataset = await loadUsBundledAirports({
      fetch: async () =>
        new Response(decompressedBytes, {
          headers: { 'content-encoding': 'gzip' },
        }),
    });

    assert.deepEqual(dataset, usBundledAirports);
  });

  it('throws when the response is not ok', async () => {
    await assert.rejects(
      loadUsBundledAirports({
        fetch: async () => new Response('', { status: 404, statusText: 'Not Found' }),
      }),
      /404/,
    );
  });

  it('passes the resolved URL to the custom fetch', async () => {
    let received: string | URL | undefined;

    await loadUsBundledAirports({
      url: 'https://cdn.example/airports.json.gz',
      fetch: async (input) => {
        received = input instanceof Request ? input.url : input;
        return new Response(gzBytes);
      },
    });

    assert.equal(received, 'https://cdn.example/airports.json.gz');
  });
});
