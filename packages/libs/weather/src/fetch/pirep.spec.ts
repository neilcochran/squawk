import { describe, it, vi, afterEach } from 'vitest';
import assert from 'node:assert/strict';
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
    assert.equal(observedUrl, `${DEFAULT_AWC_BASE_URL}/pirep?id=KDEN&format=raw`);
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
    assert.equal(pireps.length, 2);
    assert.equal(pireps[0]?.aircraftType, 'C172');
    assert.equal(pireps[1]?.aircraftType, 'B737');
    assert.deepEqual(parseErrors, []);
    assert.equal(raw, body);
  });

  it('returns empty arrays for an empty body', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('', { status: 200 }));
    const { pireps, parseErrors } = await fetchPirep('KZZZZ');
    assert.deepEqual(pireps, []);
    assert.deepEqual(parseErrors, []);
  });

  it('throws AwcFetchError on non-2xx responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response('boom', { status: 500, statusText: 'Internal Server Error' }),
    );
    await assert.rejects(() => fetchPirep('KDEN'), AwcFetchError);
  });

  it('includes optional filter params when provided', async () => {
    let observedUrl: string | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      observedUrl = url.toString();
      return new Response('', { status: 200 });
    });
    await fetchPirep('KDEN', { distance: 100, age: 6, level: 200, inten: 'mod' });
    const parsed = new URL(observedUrl ?? '');
    assert.equal(parsed.searchParams.get('id'), 'KDEN');
    assert.equal(parsed.searchParams.get('format'), 'raw');
    assert.equal(parsed.searchParams.get('distance'), '100');
    assert.equal(parsed.searchParams.get('age'), '6');
    assert.equal(parsed.searchParams.get('level'), '200');
    assert.equal(parsed.searchParams.get('inten'), 'mod');
  });

  it('omits optional filter params when not provided', async () => {
    let observedUrl: string | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      observedUrl = url.toString();
      return new Response('', { status: 200 });
    });
    await fetchPirep('KDEN');
    const parsed = new URL(observedUrl ?? '');
    assert.equal(parsed.searchParams.has('distance'), false);
    assert.equal(parsed.searchParams.has('age'), false);
    assert.equal(parsed.searchParams.has('level'), false);
    assert.equal(parsed.searchParams.has('inten'), false);
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
    await assert.rejects(() => fetchPirep(''), AwcFetchError);
    assert.equal(observedUrl, `${DEFAULT_AWC_BASE_URL}/pirep?id=&format=raw`);
  });
});
