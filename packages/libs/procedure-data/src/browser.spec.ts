import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { usBundledProcedures } from './node.js';
import { loadUsBundledProcedures } from './browser.js';

const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/procedures.json.gz');
const gzBytes = readFileSync(dataPath);
const decompressedBytes = gunzipSync(gzBytes);

describe('loadUsBundledProcedures', () => {
  it('produces the same dataset as the Node export when the body is raw gzip', async () => {
    const dataset = await loadUsBundledProcedures({
      fetch: async () => new Response(gzBytes),
    });

    assert.deepEqual(dataset, usBundledProcedures);
  });

  it('produces the same dataset when the server advertises Content-Encoding: gzip', async () => {
    const dataset = await loadUsBundledProcedures({
      fetch: async () =>
        new Response(decompressedBytes, {
          headers: { 'content-encoding': 'gzip' },
        }),
    });

    assert.deepEqual(dataset, usBundledProcedures);
  });

  it('throws when the response is not ok', async () => {
    await assert.rejects(
      loadUsBundledProcedures({
        fetch: async () => new Response('', { status: 404, statusText: 'Not Found' }),
      }),
      /404/,
    );
  });

  it('passes the resolved URL to the custom fetch', async () => {
    let received: string | URL | undefined;

    await loadUsBundledProcedures({
      url: 'https://cdn.example/procedures.json.gz',
      fetch: async (input) => {
        received = input instanceof Request ? input.url : input;
        return new Response(gzBytes);
      },
    });

    assert.equal(received, 'https://cdn.example/procedures.json.gz');
  });
});
