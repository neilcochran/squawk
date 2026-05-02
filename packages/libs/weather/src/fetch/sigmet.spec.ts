import { describe, it, vi, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import { fetchSigmets } from './sigmet.js';
import { AwcFetchError, DEFAULT_AWC_BASE_URL } from './client.js';

afterEach(() => {
  vi.restoreAllMocks();
});

// Real AWC /airsigmet?format=raw wire format: each bulletin is preceded by a
// "Type: X Hazard: Y" preamble, and bulletins are separated by a line of 20+
// dashes. The WMO-format bodies themselves are multi-line.
const AWC_WIRE_BODY = `Type: SIGMET Hazard: CONVECTIVE
WSUS31 KKCI 162355
SIGE
CONVECTIVE SIGMET 39E
VALID UNTIL 0155Z
ME MA NH AND CSTL WTRS
FROM 60ENE ENE-70ESE ENE-30WNW BOS-10W CON-60ENE ENE
AREA TS MOV FROM 25040KT. TOPS TO FL410.
----------------------
Type: SIGMET Hazard: CONVECTIVE
WSUS31 KKCI 162355
SIGE
CONVECTIVE SIGMET 40E
VALID UNTIL 0155Z
VT NY LO
FROM MSS-40N MPV-40SW ALB-40E BUF-MSS
AREA SEV TS MOV FROM 24040KT. TOPS TO FL450.
HAIL TO 1 IN...WIND GUSTS TO 50KT POSS.`;

// A mixed bulletin combining a convective and a non-convective SIGMET in the
// AWC wire format, proving the fetch layer handles both without being
// convective-specific. Non-convective body is a real WMO-format SIGMET
// (turbulence, series UNIFORM).
const AWC_MIXED_BODY = `Type: SIGMET Hazard: CONVECTIVE
WSUS31 KKCI 162355
SIGE
CONVECTIVE SIGMET 39E
VALID UNTIL 0155Z
ME MA NH AND CSTL WTRS
FROM 60ENE ENE-70ESE ENE-30WNW BOS-10W CON-60ENE ENE
AREA TS MOV FROM 25040KT. TOPS TO FL410.
----------------------
Type: SIGMET Hazard: TURB
WSUS03 KKCI 070250
WS3U
CHIU WS 070250
SIGMET UNIFORM 4 VALID UNTIL 070650
KS OK TX UT CO AZ NM
FROM 30NW DVC TO 50SE GCK TO CDS TO 60ENE INW TO 30NW DVC
OCNL SEV TURB BTN FL280 AND FL380. DUE TO WNDSHR ASSOCD WITH
JTST. RPTD BY ACFT. CONDS CONTG BYD 0650Z.`;

describe('fetchSigmets', () => {
  it('builds the expected URL with format=raw and no deprecated type filter', async () => {
    let observedUrl: string | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      observedUrl = url.toString();
      return new Response('', { status: 200 });
    });
    await fetchSigmets();
    assert.equal(observedUrl, `${DEFAULT_AWC_BASE_URL}/airsigmet?format=raw`);
  });

  it('splits AWC-wrapped multi-SIGMET responses and parses each bulletin', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(AWC_WIRE_BODY, { status: 200 }),
    );
    const { sigmets, parseErrors, raw } = await fetchSigmets();
    assert.equal(sigmets.length, 2);
    assert.equal(sigmets[0]?.format, 'CONVECTIVE');
    assert.equal(sigmets[1]?.format, 'CONVECTIVE');
    if (sigmets[0]?.format === 'CONVECTIVE') {
      assert.equal(sigmets[0].number, 39);
      assert.equal(sigmets[0].region, 'E');
    }
    if (sigmets[1]?.format === 'CONVECTIVE') {
      assert.equal(sigmets[1].number, 40);
      assert.equal(sigmets[1].region, 'E');
    }
    assert.deepEqual(parseErrors, []);
    assert.equal(raw, AWC_WIRE_BODY);
  });

  it('handles a mixed convective + non-convective bulletin response', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(AWC_MIXED_BODY, { status: 200 }),
    );
    const { sigmets, parseErrors } = await fetchSigmets();
    assert.equal(sigmets.length, 2);
    assert.equal(sigmets[0]?.format, 'CONVECTIVE');
    assert.equal(sigmets[1]?.format, 'NONCONVECTIVE');
    if (sigmets[1]?.format === 'NONCONVECTIVE') {
      assert.equal(sigmets[1].seriesName, 'UNIFORM');
      assert.equal(sigmets[1].seriesNumber, 4);
    }
    assert.deepEqual(parseErrors, []);
  });

  it('returns empty arrays for a whitespace-only body', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response('\n\n  \n', { status: 200 }),
    );
    const { sigmets, parseErrors } = await fetchSigmets();
    assert.deepEqual(sigmets, []);
    assert.deepEqual(parseErrors, []);
  });

  it('captures a malformed bulletin in parseErrors without losing good ones', async () => {
    const body = `${AWC_WIRE_BODY}\n----------------------\nType: SIGMET Hazard: CONVECTIVE\nnot a real sigmet body`;
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(body, { status: 200 }),
    );
    const { sigmets, parseErrors } = await fetchSigmets();
    assert.equal(sigmets.length, 2);
    assert.equal(parseErrors.length, 1);
    assert.equal(parseErrors[0]?.raw, 'not a real sigmet body');
  });

  it('includes the hazard filter when provided', async () => {
    let observedUrl: string | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      observedUrl = url.toString();
      return new Response('', { status: 200 });
    });
    await fetchSigmets({ hazard: 'turb' });
    const parsed = new URL(observedUrl ?? '');
    assert.equal(parsed.searchParams.get('hazard'), 'turb');
    assert.equal(parsed.searchParams.get('format'), 'raw');
  });

  it('omits the hazard filter when not provided', async () => {
    let observedUrl: string | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      observedUrl = url.toString();
      return new Response('', { status: 200 });
    });
    await fetchSigmets();
    const parsed = new URL(observedUrl ?? '');
    assert.equal(parsed.searchParams.has('hazard'), false);
  });

  it('throws AwcFetchError on non-2xx responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response('boom', { status: 500, statusText: 'Internal Server Error' }),
    );
    await assert.rejects(() => fetchSigmets(), AwcFetchError);
  });

  it('honors baseUrl and signal options', async () => {
    const controller = new AbortController();
    let observedUrl: string | undefined;
    let observedSignal: AbortSignal | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (url: string | URL | Request, init?: RequestInit) => {
        observedUrl = url.toString();
        observedSignal = init?.signal ?? undefined;
        return new Response(AWC_WIRE_BODY, { status: 200 });
      },
    );
    await fetchSigmets({ baseUrl: 'https://mirror.test/api', signal: controller.signal });
    assert.equal(observedUrl, 'https://mirror.test/api/airsigmet?format=raw');
    assert.equal(observedSignal, controller.signal);
  });
});
