import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { describe, it, beforeEach, afterEach, expect } from 'vitest';

import type { Fix } from '@squawk/types';

import { writeOutput } from './write-output.js';

let sandbox: string;
const originalLog = console.log;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'write-fix-'));
  console.log = () => undefined;
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
  console.log = originalLog;
});

function readOutput(path: string): {
  meta: { generatedAt: string; nasrCycleDate: string; recordCount: number };
  records: Fix[];
} {
  const compressed = readFileSync(path);
  const json = gunzipSync(compressed).toString('utf-8');
  return JSON.parse(json);
}

const sampleFix: Fix = {
  identifier: 'MERIT',
  icaoRegionCode: 'K6',
  state: 'MA',
  country: 'US',
  lat: 42.5,
  lon: -73.0,
  useCode: 'WP',
  pitch: false,
  catch: false,
  suaAtcaa: false,
  chartTypes: [],
  navaidAssociations: [],
};

describe('writeOutput', () => {
  it('writes fixes as a gzipped JSON file with cycle date metadata', async () => {
    const outPath = join(sandbox, 'fixes.json.gz');
    await writeOutput([sampleFix], '2026-04-16', outPath);

    const data = readOutput(outPath);
    expect(data.meta.recordCount).toBe(1);
    expect(data.meta.nasrCycleDate).toBe('2026-04-16');
    expect(data.records[0]?.identifier).toBe('MERIT');
  });

  it('records meta.generatedAt in ISO 8601 format', async () => {
    const outPath = join(sandbox, 'fixes.json.gz');
    await writeOutput([sampleFix], '2026-04-16', outPath);

    const data = readOutput(outPath);
    expect(data.meta.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('creates the parent directory if it does not exist', async () => {
    const outPath = join(sandbox, 'nested', 'deep', 'fixes.json.gz');
    await writeOutput([sampleFix], '2026-04-16', outPath);

    const data = readOutput(outPath);
    expect(data.meta.recordCount).toBe(1);
  });

  it('handles an empty record set', async () => {
    const outPath = join(sandbox, 'fixes.json.gz');
    await writeOutput([], '2026-04-16', outPath);

    const data = readOutput(outPath);
    expect(data.meta.recordCount).toBe(0);
    expect(data.records).toEqual([]);
  });
});
