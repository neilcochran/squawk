import { describe, it, vi, afterEach, expect } from 'vitest';
import { fetchInternationalSigmets } from './international-sigmet.js';
import { AwcFetchError, DEFAULT_AWC_BASE_URL } from './client.js';

afterEach(() => {
  vi.restoreAllMocks();
});

// Real AWC /isigmet?format=raw wire format: each bulletin is preceded by a
// "Hazard: X" line (no "Type:" prefix), and bulletins are separated by a
// line of 20+ dashes. Bodies are standard ICAO-format SIGMETs.
const AWC_ISIGMET_BODY = `Hazard: TS
WSMS31 WMKK 162028
WMFC SIGMET 11 VALID 162028/170025 WMKK-
WMFC KUALA LUMPUR FIR EMBD TS
OBS WI N0507 E09828 - N0555 E09843 - N0252 E10144 - N0223 E10120 -
N0507 E09828 TOP FL540 MOV WNW 05KT INTSF=
----------------------
Hazard: TURB
WSCH31 SCCI 161940
SCCZ SIGMET 06 VALID 162020/170020 SCCI-
SCCZ PUNTA ARENAS FIR SEV TURB FCST E OF LINE S4700 W07800 - S6000
W07600 FL160/360 STNR NC=`;

describe('fetchInternationalSigmets', () => {
  it('builds the expected URL with format=raw', async () => {
    let observedUrl: string | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      observedUrl = url.toString();
      return new Response('', { status: 200 });
    });
    await fetchInternationalSigmets();
    expect(observedUrl).toBe(`${DEFAULT_AWC_BASE_URL}/isigmet?format=raw`);
  });

  it('splits AWC-wrapped multi-SIGMET responses and parses each bulletin', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(AWC_ISIGMET_BODY, { status: 200 }),
    );
    const { sigmets, parseErrors, raw } = await fetchInternationalSigmets();
    expect(sigmets.length).toBe(2);
    expect(sigmets[0]?.format).toBe('INTERNATIONAL');
    expect(sigmets[1]?.format).toBe('INTERNATIONAL');
    expect(parseErrors).toEqual([]);
    expect(raw).toBe(AWC_ISIGMET_BODY);
  });

  it('returns empty arrays for a whitespace-only body', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response('\n\n  \n', { status: 200 }),
    );
    const { sigmets, parseErrors } = await fetchInternationalSigmets();
    expect(sigmets).toEqual([]);
    expect(parseErrors).toEqual([]);
  });

  it('captures a malformed bulletin in parseErrors without losing good ones', async () => {
    const body = `${AWC_ISIGMET_BODY}\n----------------------\nHazard: TS\nnot a real sigmet body`;
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(body, { status: 200 }),
    );
    const { sigmets, parseErrors } = await fetchInternationalSigmets();
    expect(sigmets.length).toBe(2);
    expect(parseErrors.length).toBe(1);
    expect(parseErrors[0]?.raw).toBe('not a real sigmet body');
  });

  it('throws AwcFetchError on non-2xx responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response('boom', { status: 500, statusText: 'Internal Server Error' }),
    );
    await expect(() => fetchInternationalSigmets()).rejects.toThrow(AwcFetchError);
  });
});
