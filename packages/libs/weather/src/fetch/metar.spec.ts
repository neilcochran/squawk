import { describe, it, vi, afterEach, expect } from 'vitest';
import { fetchMetar } from './metar.js';
import { AwcFetchError, DEFAULT_AWC_BASE_URL } from './client.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchMetar', () => {
  it('builds the expected URL for a single station', async () => {
    let observedUrl: string | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      observedUrl = url.toString();
      return new Response('', { status: 200 });
    });
    await fetchMetar('KJFK');
    expect(observedUrl).toBe(`${DEFAULT_AWC_BASE_URL}/metar?ids=KJFK&format=raw`);
  });

  it('comma-joins multiple station IDs into a single request', async () => {
    let observedUrl: string | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      observedUrl = url.toString();
      return new Response('', { status: 200 });
    });
    await fetchMetar(['KJFK', 'KLAX', 'KORD']);
    expect(observedUrl).toBe(`${DEFAULT_AWC_BASE_URL}/metar?ids=KJFK%2CKLAX%2CKORD&format=raw`);
  });

  it('parses one METAR per line and preserves response order', async () => {
    const body = [
      'KJFK 041853Z 21010KT 10SM FEW250 18/06 A3012',
      'KLAX 041853Z 25015KT 10SM CLR 22/12 A2998',
    ].join('\n');
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(body, { status: 200 }),
    );
    const { metars, parseErrors, raw } = await fetchMetar(['KJFK', 'KLAX']);
    expect(metars.length).toBe(2);
    expect(metars[0]?.stationId).toBe('KJFK');
    expect(metars[1]?.stationId).toBe('KLAX');
    expect(parseErrors).toEqual([]);
    expect(raw).toBe(body);
  });

  it('captures malformed records in parseErrors without throwing', async () => {
    const body = ['KJFK 041853Z 21010KT 10SM FEW250 18/06 A3012', 'not a metar at all'].join('\n');
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(body, { status: 200 }),
    );
    const { metars, parseErrors } = await fetchMetar(['KJFK', 'NOPE']);
    expect(metars.length).toBe(1);
    expect(metars[0]?.stationId).toBe('KJFK');
    expect(parseErrors.length).toBe(1);
    expect(parseErrors[0]?.raw).toBe('not a metar at all');
  });

  it('returns empty arrays for an empty body', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('', { status: 200 }));
    const { metars, parseErrors, raw } = await fetchMetar('KZZZZ');
    expect(metars).toEqual([]);
    expect(parseErrors).toEqual([]);
    expect(raw).toBe('');
  });

  it('throws AwcFetchError on non-2xx responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response('boom', { status: 500, statusText: 'Internal Server Error' }),
    );
    await expect(() => fetchMetar('KJFK')).rejects.toThrow(AwcFetchError);
  });

  it('honors a custom baseUrl', async () => {
    let observedUrl: string | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      observedUrl = url.toString();
      return new Response('', { status: 200 });
    });
    await fetchMetar('KJFK', { baseUrl: 'https://mirror.test/api' });
    expect(observedUrl).toBe('https://mirror.test/api/metar?ids=KJFK&format=raw');
  });

  it('surfaces AWC 400 for empty input (string) as AwcFetchError', async () => {
    let observedUrl: string | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      observedUrl = url.toString();
      return new Response('Invalid station id', { status: 400, statusText: 'Bad Request' });
    });
    await expect(() => fetchMetar('')).rejects.toThrow(AwcFetchError);
    expect(observedUrl).toBe(`${DEFAULT_AWC_BASE_URL}/metar?ids=&format=raw`);
  });

  it('surfaces AWC 400 for empty input (array) as AwcFetchError', async () => {
    let observedUrl: string | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      observedUrl = url.toString();
      return new Response('Invalid station id', { status: 400, statusText: 'Bad Request' });
    });
    await expect(() => fetchMetar([])).rejects.toThrow(AwcFetchError);
    expect(observedUrl).toBe(`${DEFAULT_AWC_BASE_URL}/metar?ids=&format=raw`);
  });

  it('forwards the AbortSignal to fetch', async () => {
    const controller = new AbortController();
    let observedSignal: AbortSignal | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: unknown, init?: RequestInit) => {
      observedSignal = init?.signal ?? undefined;
      return new Response('', { status: 200 });
    });
    await fetchMetar('KJFK', { signal: controller.signal });
    expect(observedSignal).toBe(controller.signal);
  });
});
