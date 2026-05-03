import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { describe, it, beforeEach, afterEach, expect } from 'vitest';

import type { Navaid } from '@squawk/types';

import { writeOutput } from './write-output.js';

let sandbox: string;
const originalLog = console.log;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'write-navaid-'));
  console.log = () => undefined;
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
  console.log = originalLog;
});

function readOutput(path: string): {
  meta: { generatedAt: string; nasrCycleDate: string; recordCount: number };
  records: Navaid[];
} {
  const compressed = readFileSync(path);
  const json = gunzipSync(compressed).toString('utf-8');
  return JSON.parse(json);
}

const sampleNavaid: Navaid = {
  identifier: 'BOS',
  name: 'BOSTON',
  type: 'VORTAC',
  status: 'OPERATIONAL_IFR',
  lat: 42.3573,
  lon: -70.9892,
  state: 'MA',
  country: 'US',
  city: 'BOSTON',
  elevationFt: 18,
  frequencyMhz: 112.7,
};

describe('writeOutput', () => {
  it('writes navaids as a gzipped JSON file with cycle date metadata', async () => {
    const outPath = join(sandbox, 'navaids.json.gz');
    await writeOutput([sampleNavaid], '2026-04-16', outPath);

    const data = readOutput(outPath);
    expect(data.meta.recordCount).toBe(1);
    expect(data.meta.nasrCycleDate).toBe('2026-04-16');
    expect(data.records[0]).toEqual(sampleNavaid);
  });

  it('records meta.generatedAt in ISO 8601 format', async () => {
    const outPath = join(sandbox, 'navaids.json.gz');
    await writeOutput([sampleNavaid], '2026-04-16', outPath);

    const data = readOutput(outPath);
    expect(data.meta.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('creates the parent directory if it does not exist', async () => {
    const outPath = join(sandbox, 'nested', 'deep', 'navaids.json.gz');
    await writeOutput([sampleNavaid], '2026-04-16', outPath);

    const data = readOutput(outPath);
    expect(data.meta.recordCount).toBe(1);
  });

  it('handles an empty record set', async () => {
    const outPath = join(sandbox, 'navaids.json.gz');
    await writeOutput([], '2026-04-16', outPath);

    const data = readOutput(outPath);
    expect(data.meta.recordCount).toBe(0);
    expect(data.records).toEqual([]);
  });
});
