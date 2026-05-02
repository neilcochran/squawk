import { describe, it, vi, afterEach, expect } from 'vitest';
import { fetchWindsAloft } from './winds-aloft.js';
import { AwcFetchError, DEFAULT_AWC_BASE_URL } from './client.js';

afterEach(() => {
  vi.restoreAllMocks();
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
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      observedUrl = url.toString();
      return new Response(MINIMAL_BULLETIN, { status: 200 });
    });
    await fetchWindsAloft();
    expect(observedUrl).toBe(`${DEFAULT_AWC_BASE_URL}/windtemp`);
  });

  it('maps region names to AWC wire values', async () => {
    let observedUrl: string | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      observedUrl = url.toString();
      return new Response(MINIMAL_BULLETIN, { status: 200 });
    });
    await fetchWindsAloft({ region: 'northeast' });
    expect(observedUrl).toBe(`${DEFAULT_AWC_BASE_URL}/windtemp?region=bos`);
  });

  it('maps westernPacific to the AWC other_pac value', async () => {
    let observedUrl: string | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      observedUrl = url.toString();
      return new Response(MINIMAL_BULLETIN, { status: 200 });
    });
    await fetchWindsAloft({ region: 'westernPacific' });
    expect(observedUrl).toBe(`${DEFAULT_AWC_BASE_URL}/windtemp?region=other_pac`);
  });

  it('passes altitudeBand through as the AWC level parameter', async () => {
    let observedUrl: string | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      observedUrl = url.toString();
      return new Response(MINIMAL_BULLETIN, { status: 200 });
    });
    await fetchWindsAloft({ altitudeBand: 'high' });
    expect(observedUrl).toBe(`${DEFAULT_AWC_BASE_URL}/windtemp?level=high`);
  });

  it('pads numeric forecastHours into a zero-prefixed AWC fcst value', async () => {
    let observedUrl: string | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      observedUrl = url.toString();
      return new Response(MINIMAL_BULLETIN, { status: 200 });
    });
    await fetchWindsAloft({ forecastHours: 6 });
    expect(observedUrl).toBe(`${DEFAULT_AWC_BASE_URL}/windtemp?fcst=06`);
  });

  it('does not pad forecastHours that are already two digits', async () => {
    let observedUrl: string | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      observedUrl = url.toString();
      return new Response(MINIMAL_BULLETIN, { status: 200 });
    });
    await fetchWindsAloft({ forecastHours: 12 });
    expect(observedUrl).toBe(`${DEFAULT_AWC_BASE_URL}/windtemp?fcst=12`);
  });

  it('combines all options into a single URL', async () => {
    let observedUrl: string | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      observedUrl = url.toString();
      return new Response(MINIMAL_BULLETIN, { status: 200 });
    });
    await fetchWindsAloft({
      region: 'alaska',
      altitudeBand: 'low',
      forecastHours: 24,
    });
    expect(observedUrl).toBe(`${DEFAULT_AWC_BASE_URL}/windtemp?region=alaska&level=low&fcst=24`);
  });

  it('parses the response body into a structured forecast', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(MINIMAL_BULLETIN, { status: 200 }),
    );
    const { forecast, raw } = await fetchWindsAloft();
    expect(forecast.wmoHeader).toBe('FBUS31 KWNO 241359');
    expect(forecast.productCode).toBe('FD1US1');
    expect(forecast.altitudesFt).toEqual([3000]);
    expect(forecast.stations[0]?.stationId).toBe('BDL');
    expect(raw).toBe(MINIMAL_BULLETIN);
  });

  it('throws AwcFetchError on non-2xx responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response('boom', { status: 500, statusText: 'Internal Server Error' }),
    );
    await expect(() => fetchWindsAloft()).rejects.toThrow(AwcFetchError);
  });

  it('honors a custom baseUrl', async () => {
    let observedUrl: string | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      observedUrl = url.toString();
      return new Response(MINIMAL_BULLETIN, { status: 200 });
    });
    await fetchWindsAloft({ baseUrl: 'https://mirror.test/api' });
    expect(observedUrl).toBe('https://mirror.test/api/windtemp');
  });

  it('forwards the AbortSignal to fetch', async () => {
    const controller = new AbortController();
    let observedSignal: AbortSignal | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: unknown, init?: RequestInit) => {
      observedSignal = init?.signal ?? undefined;
      return new Response(MINIMAL_BULLETIN, { status: 200 });
    });
    await fetchWindsAloft({ signal: controller.signal });
    expect(observedSignal).toBe(controller.signal);
  });

  it('propagates parser errors thrown on a malformed body', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response('not a bulletin', { status: 200 }),
    );
    await expect(() => fetchWindsAloft()).rejects.toThrow(/DATA BASED ON/);
  });
});
