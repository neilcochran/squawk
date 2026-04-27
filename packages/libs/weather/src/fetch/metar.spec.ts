import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchMetar } from './metar.js';
import { AwcFetchError, DEFAULT_AWC_BASE_URL } from './client.js';

afterEach(() => {
  mock.restoreAll();
});

describe('fetchMetar', () => {
  it('builds the expected URL for a single station', async () => {
    let observedUrl: string | undefined;
    mock.method(globalThis, 'fetch', async (url: string | URL) => {
      observedUrl = url.toString();
      return new Response('', { status: 200 });
    });
    await fetchMetar('KJFK');
    assert.equal(observedUrl, `${DEFAULT_AWC_BASE_URL}/metar?ids=KJFK&format=raw`);
  });

  it('comma-joins multiple station IDs into a single request', async () => {
    let observedUrl: string | undefined;
    mock.method(globalThis, 'fetch', async (url: string | URL) => {
      observedUrl = url.toString();
      return new Response('', { status: 200 });
    });
    await fetchMetar(['KJFK', 'KLAX', 'KORD']);
    assert.equal(observedUrl, `${DEFAULT_AWC_BASE_URL}/metar?ids=KJFK%2CKLAX%2CKORD&format=raw`);
  });

  it('parses one METAR per line and preserves response order', async () => {
    const body = [
      'KJFK 041853Z 21010KT 10SM FEW250 18/06 A3012',
      'KLAX 041853Z 25015KT 10SM CLR 22/12 A2998',
    ].join('\n');
    mock.method(globalThis, 'fetch', async () => new Response(body, { status: 200 }));
    const { metars, parseErrors, raw } = await fetchMetar(['KJFK', 'KLAX']);
    assert.equal(metars.length, 2);
    assert.equal(metars[0]?.stationId, 'KJFK');
    assert.equal(metars[1]?.stationId, 'KLAX');
    assert.deepEqual(parseErrors, []);
    assert.equal(raw, body);
  });

  it('captures malformed records in parseErrors without throwing', async () => {
    const body = ['KJFK 041853Z 21010KT 10SM FEW250 18/06 A3012', 'not a metar at all'].join('\n');
    mock.method(globalThis, 'fetch', async () => new Response(body, { status: 200 }));
    const { metars, parseErrors } = await fetchMetar(['KJFK', 'NOPE']);
    assert.equal(metars.length, 1);
    assert.equal(metars[0]?.stationId, 'KJFK');
    assert.equal(parseErrors.length, 1);
    assert.equal(parseErrors[0]?.raw, 'not a metar at all');
  });

  it('returns empty arrays for an empty body', async () => {
    mock.method(globalThis, 'fetch', async () => new Response('', { status: 200 }));
    const { metars, parseErrors, raw } = await fetchMetar('KZZZZ');
    assert.deepEqual(metars, []);
    assert.deepEqual(parseErrors, []);
    assert.equal(raw, '');
  });

  it('throws AwcFetchError on non-2xx responses', async () => {
    mock.method(
      globalThis,
      'fetch',
      async () => new Response('boom', { status: 500, statusText: 'Internal Server Error' }),
    );
    await assert.rejects(() => fetchMetar('KJFK'), AwcFetchError);
  });

  it('honors a custom baseUrl', async () => {
    let observedUrl: string | undefined;
    mock.method(globalThis, 'fetch', async (url: string | URL) => {
      observedUrl = url.toString();
      return new Response('', { status: 200 });
    });
    await fetchMetar('KJFK', { baseUrl: 'https://mirror.test/api' });
    assert.equal(observedUrl, 'https://mirror.test/api/metar?ids=KJFK&format=raw');
  });

  it('surfaces AWC 400 for empty input (string) as AwcFetchError', async () => {
    let observedUrl: string | undefined;
    mock.method(globalThis, 'fetch', async (url: string | URL) => {
      observedUrl = url.toString();
      return new Response('Invalid station id', { status: 400, statusText: 'Bad Request' });
    });
    await assert.rejects(() => fetchMetar(''), AwcFetchError);
    assert.equal(observedUrl, `${DEFAULT_AWC_BASE_URL}/metar?ids=&format=raw`);
  });

  it('surfaces AWC 400 for empty input (array) as AwcFetchError', async () => {
    let observedUrl: string | undefined;
    mock.method(globalThis, 'fetch', async (url: string | URL) => {
      observedUrl = url.toString();
      return new Response('Invalid station id', { status: 400, statusText: 'Bad Request' });
    });
    await assert.rejects(() => fetchMetar([]), AwcFetchError);
    assert.equal(observedUrl, `${DEFAULT_AWC_BASE_URL}/metar?ids=&format=raw`);
  });

  it('forwards the AbortSignal to fetch', async () => {
    const controller = new AbortController();
    let observedSignal: AbortSignal | undefined;
    mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
      observedSignal = init?.signal ?? undefined;
      return new Response('', { status: 200 });
    });
    await fetchMetar('KJFK', { signal: controller.signal });
    assert.equal(observedSignal, controller.signal);
  });
});
