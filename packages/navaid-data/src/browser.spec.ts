import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { usBundledNavaids } from './node.js';
import { loadUsBundledNavaids } from './browser.js';

const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/navaids.json.gz');
const gzBytes = readFileSync(dataPath);
const decompressedBytes = gunzipSync(gzBytes);

describe('loadUsBundledNavaids', () => {
  it('produces the same dataset as the Node export when the body is raw gzip', async () => {
    const dataset = await loadUsBundledNavaids({
      fetch: async () => new Response(gzBytes),
    });

    assert.deepEqual(dataset, usBundledNavaids);
  });

  it('produces the same dataset when the server advertises Content-Encoding: gzip', async () => {
    const dataset = await loadUsBundledNavaids({
      fetch: async () =>
        new Response(decompressedBytes, {
          headers: { 'content-encoding': 'gzip' },
        }),
    });

    assert.deepEqual(dataset, usBundledNavaids);
  });

  it('throws when the response is not ok', async () => {
    await assert.rejects(
      loadUsBundledNavaids({
        fetch: async () => new Response('', { status: 404, statusText: 'Not Found' }),
      }),
      /404/,
    );
  });

  it('passes the resolved URL to the custom fetch', async () => {
    let received: string | URL | undefined;

    await loadUsBundledNavaids({
      url: 'https://cdn.example/navaids.json.gz',
      fetch: async (input) => {
        received = input instanceof Request ? input.url : input;
        return new Response(gzBytes);
      },
    });

    assert.equal(received, 'https://cdn.example/navaids.json.gz');
  });
});
