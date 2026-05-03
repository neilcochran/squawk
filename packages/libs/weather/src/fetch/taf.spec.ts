import { describe, it, vi, afterEach, expect, assert } from 'vitest';

import { AwcFetchError, DEFAULT_AWC_BASE_URL } from './client.js';
import { fetchTaf } from './taf.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchTaf', () => {
  it('builds the expected URL for a single station', async () => {
    let observedUrl: string | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      observedUrl = url.toString();
      return new Response('', { status: 200 });
    });
    await fetchTaf('KJFK');
    expect(observedUrl).toBe(`${DEFAULT_AWC_BASE_URL}/taf?ids=KJFK&format=raw`);
  });

  it('comma-joins multiple station IDs', async () => {
    let observedUrl: string | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      observedUrl = url.toString();
      return new Response('', { status: 200 });
    });
    await fetchTaf(['KJFK', 'KLAX']);
    expect(observedUrl).toBe(`${DEFAULT_AWC_BASE_URL}/taf?ids=KJFK%2CKLAX&format=raw`);
  });

  it('splits multi-line TAFs on blank lines and parses each block', async () => {
    const body = [
      'TAF KJFK 041730Z 0418/0524 21012KT P6SM FEW250',
      '     FM042200 24015G25KT P6SM SCT040 BKN080',
      '',
      'TAF KLAX 041730Z 0418/0524 25010KT P6SM SKC',
    ].join('\n');
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(body, { status: 200 }),
    );
    const { tafs, parseErrors, raw } = await fetchTaf(['KJFK', 'KLAX']);
    expect(tafs.length).toBe(2);
    expect(tafs[0]?.stationId).toBe('KJFK');
    expect(tafs[1]?.stationId).toBe('KLAX');
    expect(parseErrors).toEqual([]);
    expect(raw).toBe(body);
  });

  it('splits multi-station TAFs separated by a single newline (AWC default format)', async () => {
    const body = [
      'TAF KBOS 190530Z 1906/2012 15003KT 2SM -DZ FG OVC003',
      '     TEMPO 1906/1910 1/4SM -DZ FG OVC001',
      '     FM191500 17006KT 2SM RA BR OVC004',
      '     FM200400 28010KT P6SM FEW250',
      'TAF KPWM 190520Z 1906/2006 VRB03KT 3SM BR OVC002',
      '     FM190800 VRB05KT 1/4SM FG OVC002',
      '     FM192100 33012KT 3SM -RA BR OVC012',
      '     FM200000 VRB04KT P6SM OVC015',
    ].join('\n');
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(body, { status: 200 }),
    );
    const { tafs, parseErrors } = await fetchTaf(['KBOS', 'KPWM']);
    expect(tafs.length).toBe(2);
    expect(parseErrors).toEqual([]);

    const bos = tafs.find((t) => t.stationId === 'KBOS');
    const pwm = tafs.find((t) => t.stationId === 'KPWM');
    assert(bos, 'expected a parsed TAF for KBOS');
    assert(pwm, 'expected a parsed TAF for KPWM');

    const bosFmStarts = bos.forecast.filter((g) => g.changeType === 'FM').map((g) => g.start?.hour);
    expect(bosFmStarts).toEqual([15, 4]);

    const pwmFmStarts = pwm.forecast.filter((g) => g.changeType === 'FM').map((g) => g.start?.hour);
    expect(pwmFmStarts).toEqual([8, 21, 0]);
  });

  it('captures malformed TAFs in parseErrors without throwing', async () => {
    const body = ['TAF KJFK 041730Z 0418/0524 21012KT P6SM FEW250', '', 'not a taf at all'].join(
      '\n',
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(body, { status: 200 }),
    );
    const { tafs, parseErrors } = await fetchTaf(['KJFK', 'NOPE']);
    expect(tafs.length).toBe(1);
    expect(tafs[0]?.stationId).toBe('KJFK');
    expect(parseErrors.length).toBe(1);
    expect(parseErrors[0]?.raw).toBe('not a taf at all');
  });

  it('throws AwcFetchError on non-2xx responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response('boom', { status: 500, statusText: 'Internal Server Error' }),
    );
    await expect(() => fetchTaf('KJFK')).rejects.toThrow(AwcFetchError);
  });

  it('forwards the abort signal to the underlying fetch', async () => {
    let observedSignal: AbortSignal | null | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (_url: string | URL | Request, init?: RequestInit) => {
        observedSignal = init?.signal;
        return new Response('', { status: 200 });
      },
    );
    const controller = new AbortController();
    await fetchTaf('KJFK', { signal: controller.signal });
    expect(observedSignal).toBe(controller.signal);
  });
});
