import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import AdmZip from 'adm-zip';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractCycleDate, fetchCifp, loadCifpFromPath } from './fetch-cifp.js';

const SAMPLE_HEADER =
  'HDR01FAACIFP18      001P013203974102604  25-MAR-202612:51:00  U.S.A. DOT FAA';

let sandbox: string;
const originalLog = console.log;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'fetch-cifp-'));
  console.log = () => undefined;
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
  console.log = originalLog;
  vi.restoreAllMocks();
});

describe('loadCifpFromPath', () => {
  it('reads an extracted FAACIFP18 file directly', async () => {
    const filePath = join(sandbox, 'FAACIFP18');
    writeFileSync(filePath, SAMPLE_HEADER, 'utf-8');

    const loaded = loadCifpFromPath(filePath);
    expect(loaded.contents).toBe(SAMPLE_HEADER);
    expect(loaded.cycleDate).toBe('2026-03-25');
    expect(loaded.sourceName).toBe(filePath);
    await loaded.cleanup();
  });

  it('opens a CIFP zip and extracts FAACIFP18 contents', async () => {
    const zipPath = join(sandbox, 'CIFP_260325.zip');
    const zip = new AdmZip();
    zip.addFile('FAACIFP18', Buffer.from(SAMPLE_HEADER, 'utf-8'));
    zip.writeZip(zipPath);

    const loaded = loadCifpFromPath(zipPath);
    expect(loaded.contents).toBe(SAMPLE_HEADER);
    expect(loaded.cycleDate).toBe('2026-03-25');
    expect(loaded.sourceName).toBe(zipPath);
    await loaded.cleanup();
  });

  it('throws when a CIFP zip does not contain FAACIFP18', () => {
    const zipPath = join(sandbox, 'no-faacifp.zip');
    const zip = new AdmZip();
    zip.addFile('OTHER.txt', Buffer.from('nope', 'utf-8'));
    zip.writeZip(zipPath);

    expect(() => loadCifpFromPath(zipPath)).toThrow(/does not contain FAACIFP18/);
  });
});

describe('fetchCifp', () => {
  it('downloads a CIFP zip and extracts FAACIFP18 contents', async () => {
    const zip = new AdmZip();
    zip.addFile('FAACIFP18', Buffer.from(SAMPLE_HEADER, 'utf-8'));
    const buffer = zip.toBuffer();

    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(buffer, { status: 200 }),
    );

    const loaded = await fetchCifp('CIFP_260325.zip');
    expect(loaded.contents).toBe(SAMPLE_HEADER);
    expect(loaded.cycleDate).toBe('2026-03-25');
    expect(loaded.sourceName).toBe('CIFP_260325.zip');
    await loaded.cleanup();
  });

  it('throws when the FAA download responds with a non-2xx status', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response('', { status: 404, statusText: 'Not Found' }),
    );
    await expect(fetchCifp('CIFP_999999.zip')).rejects.toThrow(/FAA download failed: 404/);
  });

  it('cleanup removes the temp zip without throwing if already gone', async () => {
    const zip = new AdmZip();
    zip.addFile('FAACIFP18', Buffer.from(SAMPLE_HEADER, 'utf-8'));
    const buffer = zip.toBuffer();

    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(buffer, { status: 200 }),
    );

    const loaded = await fetchCifp('CIFP_260325.zip');
    await loaded.cleanup();
    // Second cleanup should be a silent no-op since the file is already removed.
    await loaded.cleanup();
  });
});

describe('extractCycleDate', () => {
  it('extracts the date from a canonical FAACIFP18 header line', () => {
    const header = 'HDR01FAACIFP18      001P013203974102604  25-MAR-202612:51:00  U.S.A. DOT FAA';
    expect(extractCycleDate(header)).toBe('2026-03-25');
  });

  it('parses all twelve month abbreviations', () => {
    const cases: Array<[string, string]> = [
      ['01-JAN-2026', '2026-01-01'],
      ['15-FEB-2026', '2026-02-15'],
      ['31-MAR-2026', '2026-03-31'],
      ['01-APR-2026', '2026-04-01'],
      ['12-MAY-2026', '2026-05-12'],
      ['20-JUN-2026', '2026-06-20'],
      ['04-JUL-2026', '2026-07-04'],
      ['08-AUG-2026', '2026-08-08'],
      ['15-SEP-2026', '2026-09-15'],
      ['31-OCT-2026', '2026-10-31'],
      ['11-NOV-2026', '2026-11-11'],
      ['25-DEC-2026', '2026-12-25'],
    ];
    for (const [input, expected] of cases) {
      expect(extractCycleDate(`HDR01 ${input} junk`)).toBe(expected);
    }
  });

  it('only inspects the first 200 bytes of the contents', () => {
    // A valid-looking date past the 200-byte mark must not be matched.
    const body = ' '.repeat(500) + '01-FEB-2030';
    expect(() => extractCycleDate(body)).toThrow(/Could not extract/);
  });

  it('throws when the contents contain no recognized date pattern', () => {
    expect(() => extractCycleDate('HDR01 no date here')).toThrow(/Could not extract/);
  });

  it('throws when the month abbreviation is unrecognized', () => {
    expect(() => extractCycleDate('HDR01 25-FOO-2026')).toThrow(/Unrecognized month abbreviation/);
  });
});
