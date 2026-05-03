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
    expect(loaded.cycleDate).toBe('2026-04-16');
    expect(loaded.sourceName).toBe(filePath);
    await loaded.cleanup();
  });

  it('opens a CIFP zip and extracts FAACIFP18 contents', async () => {
    const zipPath = join(sandbox, 'CIFP_260416.zip');
    const zip = new AdmZip();
    zip.addFile('FAACIFP18', Buffer.from(SAMPLE_HEADER, 'utf-8'));
    zip.writeZip(zipPath);

    const loaded = loadCifpFromPath(zipPath);
    expect(loaded.contents).toBe(SAMPLE_HEADER);
    expect(loaded.cycleDate).toBe('2026-04-16');
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

    const loaded = await fetchCifp('CIFP_260416.zip');
    expect(loaded.contents).toBe(SAMPLE_HEADER);
    expect(loaded.cycleDate).toBe('2026-04-16');
    expect(loaded.sourceName).toBe('CIFP_260416.zip');
    await loaded.cleanup();
  });

  it('throws when the FAA download responds with a non-2xx status', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response('', { status: 404, statusText: 'Not Found' }),
    );
    await expect(fetchCifp('CIFP_999999.zip')).rejects.toThrow(/FAA download failed: 404/);
  });

  it('rejects filenames that do not match the CIFP_YYMMDD.zip pattern without fetching', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const invalidNames = [
      '../etc/passwd',
      'CIFP_260416.zip\n',
      'cifp_260416.zip',
      'CIFP_26041.zip',
      'CIFP_260416.tar',
      '',
    ];
    for (const name of invalidNames) {
      await expect(fetchCifp(name)).rejects.toThrow(/Invalid CIFP zip filename/);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('cleanup removes the temp zip without throwing if already gone', async () => {
    const zip = new AdmZip();
    zip.addFile('FAACIFP18', Buffer.from(SAMPLE_HEADER, 'utf-8'));
    const buffer = zip.toBuffer();

    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(buffer, { status: 200 }),
    );

    const loaded = await fetchCifp('CIFP_260416.zip');
    await loaded.cleanup();
    // Second cleanup should be a silent no-op since the file is already removed.
    await loaded.cleanup();
  });
});

describe('extractCycleDate', () => {
  it('maps the AIRAC cycle code to the cycle effective date', () => {
    const header = 'HDR01FAACIFP18      001P013203974102604  25-MAR-202612:51:00  U.S.A. DOT FAA';
    expect(extractCycleDate(header)).toBe('2026-04-16');
  });

  it('handles the next AIRAC cycle (2605) immediately after 2604', () => {
    const header = 'HDR01FAACIFP18      001P013203962302605  22-APR-202618:05:22  U.S.A. DOT FAA';
    expect(extractCycleDate(header)).toBe('2026-05-14');
  });

  it('uses 2024-01-25 as the anchor for cycle 2401', () => {
    expect(extractCycleDate('HDR01 02401  01-JAN-2024')).toBe('2024-01-25');
  });

  it('rolls year cycle 2613 into early 2027', () => {
    // 2026 cycle 13 = 2026-01-22 + 12 * 28 = 2026-12-24
    expect(extractCycleDate('HDR01 02613  01-JAN-2027')).toBe('2026-12-24');
  });

  it('only inspects the first 200 bytes of the contents', () => {
    // A valid-looking cycle-code + date pattern past the 200-byte mark must not be matched.
    const body = ' '.repeat(500) + '02604  25-MAR-2026';
    expect(() => extractCycleDate(body)).toThrow(/Could not extract AIRAC cycle code/);
  });

  it('throws when the contents contain no cycle-code pattern', () => {
    expect(() => extractCycleDate('HDR01 no cycle here')).toThrow(
      /Could not extract AIRAC cycle code/,
    );
  });

  it('throws when the cycle year is below the supported range', () => {
    expect(() => extractCycleDate('HDR01 02301  01-JAN-2023')).toThrow(
      /outside supported range 2024-2057/,
    );
  });

  it('throws when the cycle year is above the supported range', () => {
    expect(() => extractCycleDate('HDR01 05801  01-JAN-2058')).toThrow(
      /outside supported range 2024-2057/,
    );
  });

  it('throws when the cycle number within the year is out of range', () => {
    expect(() => extractCycleDate('HDR01 02614  01-JAN-2027')).toThrow(
      /outside supported range 1-13/,
    );
  });
});
