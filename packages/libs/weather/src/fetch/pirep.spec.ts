import { describe, it, vi, afterEach, expect } from 'vitest';
import { fetchPirep } from './pirep.js';
import { AwcFetchError, DEFAULT_AWC_BASE_URL } from './client.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchPirep', () => {
  it('builds the expected URL using the id query parameter', async () => {
    let observedUrl: string | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      observedUrl = url.toString();
      return new Response('', { status: 200 });
    });
    await fetchPirep('KDEN');
    expect(observedUrl).toBe(`${DEFAULT_AWC_BASE_URL}/pirep?id=KDEN&format=raw`);
  });

  it('parses one PIREP per line and preserves order', async () => {
    const body = [
      'UA /OV OKC063015/TM 1522/FL085/TP C172/SK BKN065-TOP090/TB LGT',
      'UA /OV DEN180030/TM 2012/FL120/TP B737/TB MOD',
    ].join('\n');
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(body, { status: 200 }),
    );
    const { pireps, parseErrors, raw } = await fetchPirep('KDEN');
    expect(pireps.length).toBe(2);
    expect(pireps[0]?.aircraftType).toBe('C172');
    expect(pireps[1]?.aircraftType).toBe('B737');
    expect(parseErrors).toEqual([]);
    expect(raw).toBe(body);
  });

  it('returns empty arrays for an empty body', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('', { status: 200 }));
    const { pireps, parseErrors } = await fetchPirep('KZZZZ');
    expect(pireps).toEqual([]);
    expect(parseErrors).toEqual([]);
  });

  it('throws AwcFetchError on non-2xx responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response('boom', { status: 500, statusText: 'Internal Server Error' }),
    );
    await expect(() => fetchPirep('KDEN')).rejects.toThrow(AwcFetchError);
  });

  it('includes optional filter params when provided', async () => {
    let observedUrl: string | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      observedUrl = url.toString();
      return new Response('', { status: 200 });
    });
    await fetchPirep('KDEN', { distance: 100, age: 6, level: 200, inten: 'mod' });
    const parsed = new URL(observedUrl ?? '');
    expect(parsed.searchParams.get('id')).toBe('KDEN');
    expect(parsed.searchParams.get('format')).toBe('raw');
    expect(parsed.searchParams.get('distance')).toBe('100');
    expect(parsed.searchParams.get('age')).toBe('6');
    expect(parsed.searchParams.get('level')).toBe('200');
    expect(parsed.searchParams.get('inten')).toBe('mod');
  });

  it('omits optional filter params when not provided', async () => {
    let observedUrl: string | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      observedUrl = url.toString();
      return new Response('', { status: 200 });
    });
    await fetchPirep('KDEN');
    const parsed = new URL(observedUrl ?? '');
    expect(parsed.searchParams.has('distance')).toBe(false);
    expect(parsed.searchParams.has('age')).toBe(false);
    expect(parsed.searchParams.has('level')).toBe(false);
    expect(parsed.searchParams.has('inten')).toBe(false);
  });

  it('surfaces AWC 400 for an empty id as AwcFetchError', async () => {
    let observedUrl: string | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      observedUrl = url.toString();
      return new Response('Invalid location specified', {
        status: 400,
        statusText: 'Bad Request',
      });
    });
    await expect(() => fetchPirep('')).rejects.toThrow(AwcFetchError);
    expect(observedUrl).toBe(`${DEFAULT_AWC_BASE_URL}/pirep?id=&format=raw`);
  });
});
