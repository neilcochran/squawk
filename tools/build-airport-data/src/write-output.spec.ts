import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { Airport } from '@squawk/types';
import { writeOutput } from './write-output.js';

let sandbox: string;
const originalLog = console.log;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'write-airport-'));
  console.log = () => undefined;
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
  console.log = originalLog;
});

function readOutput(path: string): {
  meta: { generatedAt: string; nasrCycleDate: string; recordCount: number };
  records: Airport[];
} {
  const compressed = readFileSync(path);
  const json = gunzipSync(compressed).toString('utf-8');
  return JSON.parse(json);
}

const sampleAirport: Airport = {
  faaId: 'JFK',
  icao: 'KJFK',
  name: 'JOHN F KENNEDY INTL',
  facilityType: 'AIRPORT',
  ownershipType: 'PUBLIC',
  useType: 'PUBLIC',
  status: 'OPEN',
  city: 'NEW YORK',
  state: 'NY',
  country: 'US',
  lat: 40.6398,
  lon: -73.7787,
  timezone: 'America/New_York',
  elevationFt: 13,
  runways: [],
  frequencies: [],
};

describe('writeOutput', () => {
  it('writes airports as a gzipped JSON file with cycle date metadata', async () => {
    const outPath = join(sandbox, 'airports.json.gz');
    await writeOutput([sampleAirport], '2026-04-16', outPath);

    const data = readOutput(outPath);
    expect(data.meta.recordCount).toBe(1);
    expect(data.meta.nasrCycleDate).toBe('2026-04-16');
    expect(data.records[0]?.faaId).toBe('JFK');
  });

  it('records meta.generatedAt in ISO 8601 format', async () => {
    const outPath = join(sandbox, 'airports.json.gz');
    await writeOutput([sampleAirport], '2026-04-16', outPath);

    const data = readOutput(outPath);
    expect(data.meta.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('creates the parent directory if it does not exist', async () => {
    const outPath = join(sandbox, 'nested', 'deep', 'airports.json.gz');
    await writeOutput([sampleAirport], '2026-04-16', outPath);

    const data = readOutput(outPath);
    expect(data.meta.recordCount).toBe(1);
  });

  it('handles an empty record set', async () => {
    const outPath = join(sandbox, 'airports.json.gz');
    await writeOutput([], '2026-04-16', outPath);

    const data = readOutput(outPath);
    expect(data.meta.recordCount).toBe(0);
    expect(data.records).toEqual([]);
  });
});
