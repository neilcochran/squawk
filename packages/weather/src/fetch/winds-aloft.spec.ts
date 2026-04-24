import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchWindsAloft } from './winds-aloft.js';
import { AwcFetchError, DEFAULT_AWC_BASE_URL } from './client.js';

afterEach(() => {
  mock.restoreAll();
});

const MINIMAL_BULLETIN = [
  '(Extracted from FBUS31 KWNO 241359)',
  'FD1US1',
  'DATA BASED ON 241200Z',
  'VALID 241800Z   FOR USE 1400-2100Z. TEMPS NEG ABV 24000',
  '',
  'FT  3000',
  'BDL 3509',
].join('\n');

describe('fetchWindsAloft', () => {
  it('builds the bare endpoint URL when no options are provided', async () => {
    let observedUrl: string | undefined;
    mock.method(globalThis, 'fetch', async (url: string | URL) => {
      observedUrl = url.toString();
      return new Response(MINIMAL_BULLETIN, { status: 200 });
    });
    await fetchWindsAloft();
    assert.equal(observedUrl, `${DEFAULT_AWC_BASE_URL}/windtemp`);
  });

  it('maps region names to AWC wire values', async () => {
    let observedUrl: string | undefined;
    mock.method(globalThis, 'fetch', async (url: string | URL) => {
      observedUrl = url.toString();
      return new Response(MINIMAL_BULLETIN, { status: 200 });
    });
    await fetchWindsAloft({ region: 'northeast' });
    assert.equal(observedUrl, `${DEFAULT_AWC_BASE_URL}/windtemp?region=bos`);
  });

  it('maps westernPacific to the AWC other_pac value', async () => {
    let observedUrl: string | undefined;
    mock.method(globalThis, 'fetch', async (url: string | URL) => {
      observedUrl = url.toString();
      return new Response(MINIMAL_BULLETIN, { status: 200 });
    });
    await fetchWindsAloft({ region: 'westernPacific' });
    assert.equal(observedUrl, `${DEFAULT_AWC_BASE_URL}/windtemp?region=other_pac`);
  });

  it('passes altitudeBand through as the AWC level parameter', async () => {
    let observedUrl: string | undefined;
    mock.method(globalThis, 'fetch', async (url: string | URL) => {
      observedUrl = url.toString();
      return new Response(MINIMAL_BULLETIN, { status: 200 });
    });
    await fetchWindsAloft({ altitudeBand: 'high' });
    assert.equal(observedUrl, `${DEFAULT_AWC_BASE_URL}/windtemp?level=high`);
  });

  it('pads numeric forecastHours into a zero-prefixed AWC fcst value', async () => {
    let observedUrl: string | undefined;
    mock.method(globalThis, 'fetch', async (url: string | URL) => {
      observedUrl = url.toString();
      return new Response(MINIMAL_BULLETIN, { status: 200 });
    });
    await fetchWindsAloft({ forecastHours: 6 });
    assert.equal(observedUrl, `${DEFAULT_AWC_BASE_URL}/windtemp?fcst=06`);
  });

  it('does not pad forecastHours that are already two digits', async () => {
    let observedUrl: string | undefined;
    mock.method(globalThis, 'fetch', async (url: string | URL) => {
      observedUrl = url.toString();
      return new Response(MINIMAL_BULLETIN, { status: 200 });
    });
    await fetchWindsAloft({ forecastHours: 12 });
    assert.equal(observedUrl, `${DEFAULT_AWC_BASE_URL}/windtemp?fcst=12`);
  });

  it('combines all options into a single URL', async () => {
    let observedUrl: string | undefined;
    mock.method(globalThis, 'fetch', async (url: string | URL) => {
      observedUrl = url.toString();
      return new Response(MINIMAL_BULLETIN, { status: 200 });
    });
    await fetchWindsAloft({
      region: 'alaska',
      altitudeBand: 'low',
      forecastHours: 24,
    });
    assert.equal(observedUrl, `${DEFAULT_AWC_BASE_URL}/windtemp?region=alaska&level=low&fcst=24`);
  });

  it('parses the response body into a structured forecast', async () => {
    mock.method(globalThis, 'fetch', async () => new Response(MINIMAL_BULLETIN, { status: 200 }));
    const { forecast, raw } = await fetchWindsAloft();
    assert.equal(forecast.wmoHeader, 'FBUS31 KWNO 241359');
    assert.equal(forecast.productCode, 'FD1US1');
    assert.deepEqual(forecast.altitudesFt, [3000]);
    assert.equal(forecast.stations[0]?.stationId, 'BDL');
    assert.equal(raw, MINIMAL_BULLETIN);
  });

  it('throws AwcFetchError on non-2xx responses', async () => {
    mock.method(
      globalThis,
      'fetch',
      async () => new Response('boom', { status: 500, statusText: 'Internal Server Error' }),
    );
    await assert.rejects(() => fetchWindsAloft(), AwcFetchError);
  });

  it('honors a custom baseUrl', async () => {
    let observedUrl: string | undefined;
    mock.method(globalThis, 'fetch', async (url: string | URL) => {
      observedUrl = url.toString();
      return new Response(MINIMAL_BULLETIN, { status: 200 });
    });
    await fetchWindsAloft({ baseUrl: 'https://mirror.test/api' });
    assert.equal(observedUrl, 'https://mirror.test/api/windtemp');
  });

  it('forwards the AbortSignal to fetch', async () => {
    const controller = new AbortController();
    let observedSignal: AbortSignal | undefined;
    mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
      observedSignal = init?.signal ?? undefined;
      return new Response(MINIMAL_BULLETIN, { status: 200 });
    });
    await fetchWindsAloft({ signal: controller.signal });
    assert.equal(observedSignal, controller.signal);
  });

  it('propagates parser errors thrown on a malformed body', async () => {
    mock.method(globalThis, 'fetch', async () => new Response('not a bulletin', { status: 200 }));
    await assert.rejects(() => fetchWindsAloft(), /DATA BASED ON/);
  });
});
