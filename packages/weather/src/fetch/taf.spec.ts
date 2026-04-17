import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchTaf } from './taf.js';
import { AwcFetchError, DEFAULT_AWC_BASE_URL } from './client.js';

afterEach(() => {
  mock.restoreAll();
});

describe('fetchTaf', () => {
  it('builds the expected URL for a single station', async () => {
    let observedUrl: string | undefined;
    mock.method(globalThis, 'fetch', async (url: string | URL) => {
      observedUrl = url.toString();
      return new Response('', { status: 200 });
    });
    await fetchTaf('KJFK');
    assert.equal(observedUrl, `${DEFAULT_AWC_BASE_URL}/taf?ids=KJFK&format=raw`);
  });

  it('comma-joins multiple station IDs', async () => {
    let observedUrl: string | undefined;
    mock.method(globalThis, 'fetch', async (url: string | URL) => {
      observedUrl = url.toString();
      return new Response('', { status: 200 });
    });
    await fetchTaf(['KJFK', 'KLAX']);
    assert.equal(observedUrl, `${DEFAULT_AWC_BASE_URL}/taf?ids=KJFK%2CKLAX&format=raw`);
  });

  it('splits multi-line TAFs on blank lines and parses each block', async () => {
    const body = [
      'TAF KJFK 041730Z 0418/0524 21012KT P6SM FEW250',
      '     FM042200 24015G25KT P6SM SCT040 BKN080',
      '',
      'TAF KLAX 041730Z 0418/0524 25010KT P6SM SKC',
    ].join('\n');
    mock.method(globalThis, 'fetch', async () => new Response(body, { status: 200 }));
    const { tafs, parseErrors, raw } = await fetchTaf(['KJFK', 'KLAX']);
    assert.equal(tafs.length, 2);
    assert.equal(tafs[0]?.stationId, 'KJFK');
    assert.equal(tafs[1]?.stationId, 'KLAX');
    assert.deepEqual(parseErrors, []);
    assert.equal(raw, body);
  });

  it('captures malformed TAFs in parseErrors without throwing', async () => {
    const body = ['TAF KJFK 041730Z 0418/0524 21012KT P6SM FEW250', '', 'not a taf at all'].join(
      '\n',
    );
    mock.method(globalThis, 'fetch', async () => new Response(body, { status: 200 }));
    const { tafs, parseErrors } = await fetchTaf(['KJFK', 'NOPE']);
    assert.equal(tafs.length, 1);
    assert.equal(tafs[0]?.stationId, 'KJFK');
    assert.equal(parseErrors.length, 1);
    assert.equal(parseErrors[0]?.raw, 'not a taf at all');
  });

  it('throws AwcFetchError on non-2xx responses', async () => {
    mock.method(
      globalThis,
      'fetch',
      async () => new Response('boom', { status: 500, statusText: 'Internal Server Error' }),
    );
    await assert.rejects(() => fetchTaf('KJFK'), AwcFetchError);
  });
});
