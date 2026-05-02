import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { usBundledRegistry } from './node.js';
import { loadUsBundledRegistry } from './browser.js';

const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/icao-registry.json.gz');
const gzBytes = readFileSync(dataPath);
const decompressedBytes = gunzipSync(gzBytes);

describe('loadUsBundledRegistry', () => {
  it('produces the same dataset as the Node export when the body is raw gzip', async () => {
    const dataset = await loadUsBundledRegistry({
      fetch: async () => new Response(gzBytes),
    });

    assert.deepEqual(dataset, usBundledRegistry);
  });

  it('produces the same dataset when the server advertises Content-Encoding: gzip', async () => {
    const dataset = await loadUsBundledRegistry({
      fetch: async () =>
        new Response(decompressedBytes, {
          headers: { 'content-encoding': 'gzip' },
        }),
    });

    assert.deepEqual(dataset, usBundledRegistry);
  });

  it('throws when the response is not ok', async () => {
    await assert.rejects(
      loadUsBundledRegistry({
        fetch: async () => new Response('', { status: 404, statusText: 'Not Found' }),
      }),
      /404/,
    );
  });

  it('passes the resolved URL to the custom fetch', async () => {
    let received: string | URL | undefined;

    await loadUsBundledRegistry({
      url: 'https://cdn.example/icao-registry.json.gz',
      fetch: async (input) => {
        received = input instanceof Request ? input.url : input;
        return new Response(gzBytes);
      },
    });

    assert.equal(received, 'https://cdn.example/icao-registry.json.gz');
  });
});
