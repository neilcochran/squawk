import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchInternationalSigmets } from './international-sigmet.js';
import { AwcFetchError, DEFAULT_AWC_BASE_URL } from './client.js';

afterEach(() => {
  mock.restoreAll();
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
    mock.method(globalThis, 'fetch', async (url: string | URL) => {
      observedUrl = url.toString();
      return new Response('', { status: 200 });
    });
    await fetchInternationalSigmets();
    assert.equal(observedUrl, `${DEFAULT_AWC_BASE_URL}/isigmet?format=raw`);
  });

  it('splits AWC-wrapped multi-SIGMET responses and parses each bulletin', async () => {
    mock.method(globalThis, 'fetch', async () => new Response(AWC_ISIGMET_BODY, { status: 200 }));
    const { sigmets, parseErrors, raw } = await fetchInternationalSigmets();
    assert.equal(sigmets.length, 2);
    assert.equal(sigmets[0]?.format, 'INTERNATIONAL');
    assert.equal(sigmets[1]?.format, 'INTERNATIONAL');
    assert.deepEqual(parseErrors, []);
    assert.equal(raw, AWC_ISIGMET_BODY);
  });

  it('returns empty arrays for a whitespace-only body', async () => {
    mock.method(globalThis, 'fetch', async () => new Response('\n\n  \n', { status: 200 }));
    const { sigmets, parseErrors } = await fetchInternationalSigmets();
    assert.deepEqual(sigmets, []);
    assert.deepEqual(parseErrors, []);
  });

  it('captures a malformed bulletin in parseErrors without losing good ones', async () => {
    const body = `${AWC_ISIGMET_BODY}\n----------------------\nHazard: TS\nnot a real sigmet body`;
    mock.method(globalThis, 'fetch', async () => new Response(body, { status: 200 }));
    const { sigmets, parseErrors } = await fetchInternationalSigmets();
    assert.equal(sigmets.length, 2);
    assert.equal(parseErrors.length, 1);
    assert.equal(parseErrors[0]?.raw, 'not a real sigmet body');
  });

  it('throws AwcFetchError on non-2xx responses', async () => {
    mock.method(
      globalThis,
      'fetch',
      async () => new Response('boom', { status: 500, statusText: 'Internal Server Error' }),
    );
    await assert.rejects(() => fetchInternationalSigmets(), AwcFetchError);
  });
});
