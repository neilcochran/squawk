import { describe, it, vi, afterEach, expect, assert } from 'vitest';
import {
  AwcFetchError,
  buildAwcUrl,
  DEFAULT_AWC_BASE_URL,
  parseRecords,
  requestAwcText,
  splitAwcBulletins,
  splitLines,
  splitTafs,
} from './client.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildAwcUrl', () => {
  it('joins the default base URL with the endpoint', () => {
    const url = buildAwcUrl('metar', { ids: 'KJFK', format: 'raw' });
    expect(url).toBe(`${DEFAULT_AWC_BASE_URL}/metar?ids=KJFK&format=raw`);
  });

  it('joins array values with commas', () => {
    const url = buildAwcUrl('metar', { ids: ['KJFK', 'KLAX'], format: 'raw' });
    expect(url).toBe(`${DEFAULT_AWC_BASE_URL}/metar?ids=KJFK%2CKLAX&format=raw`);
  });

  it('drops undefined parameter values', () => {
    const url = buildAwcUrl('taf', { ids: 'KJFK', format: 'raw', hours: undefined });
    expect(url).toBe(`${DEFAULT_AWC_BASE_URL}/taf?ids=KJFK&format=raw`);
  });

  it('honors a custom base URL with a trailing slash', () => {
    const url = buildAwcUrl('metar', { ids: 'KJFK' }, 'https://example.test/api/');
    expect(url).toBe('https://example.test/api/metar?ids=KJFK');
  });

  it('honors a custom base URL with a leading slash on the endpoint', () => {
    const url = buildAwcUrl('/metar', { ids: 'KJFK' }, 'https://example.test/api');
    expect(url).toBe('https://example.test/api/metar?ids=KJFK');
  });
});

describe('requestAwcText', () => {
  it('returns the response body on 200 OK', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response('raw body', { status: 200 }),
    );
    const body = await requestAwcText('https://example.test/metar');
    expect(body).toBe('raw body');
  });

  it('throws AwcFetchError on non-2xx responses with status and body', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response('service unavailable', { status: 503, statusText: 'Service Unavailable' }),
    );
    const error: unknown = await requestAwcText('https://example.test/metar').catch(
      (e: unknown) => e,
    );
    assert(error instanceof AwcFetchError);
    expect(error.status).toBe(503);
    expect(error.statusText).toBe('Service Unavailable');
    expect(error.body).toBe('service unavailable');
    expect(error.url).toBe('https://example.test/metar');
  });

  it('forwards the AbortSignal to fetch', async () => {
    const controller = new AbortController();
    let observedSignal: AbortSignal | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: unknown, init?: RequestInit) => {
      observedSignal = init?.signal ?? undefined;
      return new Response('ok', { status: 200 });
    });
    await requestAwcText('https://example.test/metar', { signal: controller.signal });
    expect(observedSignal).toBe(controller.signal);
  });

  it('rethrows network errors from fetch', async () => {
    const boom = new Error('network down');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw boom;
    });
    await expect(() => requestAwcText('https://example.test/metar')).rejects.toThrow(boom);
  });
});

describe('splitLines', () => {
  it('returns non-empty trimmed lines in order', () => {
    const lines = splitLines('KJFK ...\n\n  KLAX ...  \r\nKORD ...\n');
    expect(lines).toEqual(['KJFK ...', 'KLAX ...', 'KORD ...']);
  });

  it('returns an empty array when the body is only whitespace', () => {
    expect(splitLines('   \n\n  \r\n')).toEqual([]);
  });

  it('handles CRLF line endings', () => {
    const lines = splitLines('KJFK ...\r\nKLAX ...\r\nKORD ...\r\n');
    expect(lines).toEqual(['KJFK ...', 'KLAX ...', 'KORD ...']);
  });
});

describe('splitTafs', () => {
  it('splits on one or more blank lines and trims each block', () => {
    const body = 'TAF KJFK ...\n  FM050000 ...\n\nTAF KLAX ...\n  FM050000 ...';
    expect(splitTafs(body)).toEqual([
      'TAF KJFK ...\n  FM050000 ...',
      'TAF KLAX ...\n  FM050000 ...',
    ]);
  });

  it('splits on a single newline before a TAF header (AWC default format)', () => {
    const body =
      'TAF KBOS 190530Z 1906/2012 15003KT 2SM -DZ FG OVC003\n' +
      '     FM200000 30012G21KT P6SM OVC035\n' +
      'TAF KPWM 190520Z 1906/2006 VRB03KT 3SM BR OVC002\n' +
      '     FM192100 33012KT 3SM -RA BR OVC012';
    expect(splitTafs(body)).toEqual([
      'TAF KBOS 190530Z 1906/2012 15003KT 2SM -DZ FG OVC003\n     FM200000 30012G21KT P6SM OVC035',
      'TAF KPWM 190520Z 1906/2006 VRB03KT 3SM BR OVC002\n     FM192100 33012KT 3SM -RA BR OVC012',
    ]);
  });

  it('splits on a single newline before TAF AMD or TAF COR headers', () => {
    const body =
      'TAF KJFK 041730Z 0418/0524 21012KT P6SM FEW250\n' +
      'TAF AMD KLAX 041800Z 0418/0524 25010KT P6SM SKC\n' +
      'TAF COR KSFO 041830Z 0418/0524 27008KT P6SM SCT020';
    const blocks = splitTafs(body);
    expect(blocks.length).toBe(3);
    assert(blocks[0]?.startsWith('TAF KJFK'));
    assert(blocks[1]?.startsWith('TAF AMD KLAX'));
    assert(blocks[2]?.startsWith('TAF COR KSFO'));
  });

  it('returns an empty array when the body is only whitespace', () => {
    expect(splitTafs('\n\n   \r\n\r\n')).toEqual([]);
  });

  it('handles CRLF line endings for both blank-line and single-newline separators', () => {
    const blankSeparated = 'TAF KJFK ...\r\n  FM050000 ...\r\n\r\nTAF KLAX ...\r\n  FM050000 ...';
    expect(splitTafs(blankSeparated)).toEqual([
      'TAF KJFK ...\r\n  FM050000 ...',
      'TAF KLAX ...\r\n  FM050000 ...',
    ]);

    const singleNewlineSeparated =
      'TAF KJFK ...\r\n  FM050000 ...\r\nTAF KLAX ...\r\n  FM050000 ...';
    expect(splitTafs(singleNewlineSeparated)).toEqual([
      'TAF KJFK ...\r\n  FM050000 ...',
      'TAF KLAX ...\r\n  FM050000 ...',
    ]);
  });
});

describe('splitAwcBulletins', () => {
  it('splits on a dashed separator line and strips Type/Hazard preambles', () => {
    const body = [
      'Type: SIGMET Hazard: CONVECTIVE',
      'WSUS31 KKCI 162355',
      'SIGE ',
      'CONVECTIVE SIGMET 39E',
      'VALID UNTIL 0155Z',
      '----------------------',
      'Type: SIGMET Hazard: CONVECTIVE',
      'WSUS31 KKCI 162355',
      'SIGE ',
      'CONVECTIVE SIGMET 40E',
      'VALID UNTIL 0155Z',
    ].join('\n');
    const bulletins = splitAwcBulletins(body);
    expect(bulletins.length).toBe(2);
    assert(bulletins[0]?.startsWith('WSUS31 KKCI'));
    assert(bulletins[0]?.includes('CONVECTIVE SIGMET 39E'));
    assert(!bulletins[0]?.includes('Type:'));
    assert(!bulletins[0]?.includes('Hazard:'));
    assert(bulletins[1]?.includes('CONVECTIVE SIGMET 40E'));
  });

  it('handles the international ISIGMET preamble (Hazard: only)', () => {
    const body = [
      'Hazard: TS',
      'WSMS31 WMKK 162028',
      'WMFC SIGMET 11 VALID 162028/170025 WMKK-',
      'WMFC KUALA LUMPUR FIR EMBD TS',
      '----------------------',
      'Hazard: TURB',
      'WSCH31 SCCI 161940',
      'SCCZ SIGMET 06 VALID 162020/170020 SCCI-',
    ].join('\n');
    const bulletins = splitAwcBulletins(body);
    expect(bulletins.length).toBe(2);
    assert(bulletins[0]?.startsWith('WSMS31 WMKK'));
    assert(bulletins[1]?.startsWith('WSCH31 SCCI'));
  });

  it('returns a single bulletin when there is no separator', () => {
    const body = [
      'Type: SIGMET Hazard: CONVECTIVE',
      'WSUS31 KKCI 162355',
      'SIGE ',
      'CONVECTIVE SIGMET 39E',
    ].join('\n');
    const bulletins = splitAwcBulletins(body);
    expect(bulletins.length).toBe(1);
    assert(bulletins[0]?.startsWith('WSUS31 KKCI'));
  });

  it('returns an empty array for a whitespace-only body', () => {
    expect(splitAwcBulletins('\n\n   \n')).toEqual([]);
  });

  it('leaves inline dashes inside bulletin geography unaffected', () => {
    const body = [
      'Type: SIGMET Hazard: CONVECTIVE',
      'WSUS31 KKCI 162355',
      'SIGE ',
      'CONVECTIVE SIGMET 39E',
      'FROM 60ENE ENE-70ESE ENE-30WNW BOS-10W CON-60ENE ENE',
    ].join('\n');
    const bulletins = splitAwcBulletins(body);
    expect(bulletins.length).toBe(1);
    assert(bulletins[0]?.includes('FROM 60ENE ENE-70ESE ENE-30WNW BOS-10W CON-60ENE ENE'));
  });

  it('handles CRLF line endings', () => {
    const body = [
      'Type: SIGMET Hazard: CONVECTIVE',
      'WSUS31 KKCI 162355',
      'SIGE',
      'CONVECTIVE SIGMET 39E',
      '----------------------',
      'Type: SIGMET Hazard: CONVECTIVE',
      'WSUS31 KKCI 162355',
      'SIGE',
      'CONVECTIVE SIGMET 40E',
    ].join('\r\n');
    const bulletins = splitAwcBulletins(body);
    expect(bulletins.length).toBe(2);
    assert(bulletins[0]?.startsWith('WSUS31 KKCI'));
    assert(bulletins[0]?.includes('CONVECTIVE SIGMET 39E'));
    assert(bulletins[1]?.includes('CONVECTIVE SIGMET 40E'));
    assert(!bulletins[0]?.includes('Type:'));
  });

  it('strips preamble lines that have no space after the colon', () => {
    const body = [
      'Type:SIGMET Hazard:CONVECTIVE',
      'WSUS31 KKCI 162355',
      'SIGE',
      'CONVECTIVE SIGMET 39E',
    ].join('\n');
    const bulletins = splitAwcBulletins(body);
    expect(bulletins.length).toBe(1);
    assert(bulletins[0]?.startsWith('WSUS31 KKCI'));
    assert(!bulletins[0]?.includes('Type:'));
  });
});

describe('parseRecords', () => {
  it('returns results in order and collects errors for failed records', () => {
    const parser = (raw: string): number => {
      const value = Number.parseInt(raw, 10);
      if (Number.isNaN(value)) {
        throw new Error(`bad input: ${raw}`);
      }
      return value;
    };
    const { results, parseErrors } = parseRecords(['1', 'oops', '3'], parser);
    expect(results).toEqual([1, 3]);
    expect(parseErrors.length).toBe(1);
    expect(parseErrors[0]?.raw).toBe('oops');
    assert(parseErrors[0]?.error instanceof Error);
  });

  it('returns empty arrays when no records are provided', () => {
    const { results, parseErrors } = parseRecords<number>([], () => 0);
    expect(results).toEqual([]);
    expect(parseErrors).toEqual([]);
  });
});
