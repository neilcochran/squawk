import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { describe, it, beforeEach, afterEach, expect } from 'vitest';

import type { Airway } from '@squawk/types';

import { writeOutput } from './write-output.js';

let sandbox: string;
const originalLog = console.log;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'write-airway-'));
  console.log = () => undefined;
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
  console.log = originalLog;
});

function readOutput(path: string): {
  meta: {
    generatedAt: string;
    nasrCycleDate: string;
    recordCount: number;
    waypointCount: number;
  };
  records: Airway[];
} {
  const compressed = readFileSync(path);
  const json = gunzipSync(compressed).toString('utf-8');
  return JSON.parse(json);
}

const sampleAirway: Airway = {
  designation: 'V16',
  type: 'VICTOR',
  region: 'US',
  waypoints: [
    { name: 'BOSTON', identifier: 'BOS', waypointType: 'NAVAID', lat: 42.3573, lon: -70.9892 },
    { name: 'PROVIDENCE', identifier: 'PVD', waypointType: 'NAVAID', lat: 41.7237, lon: -71.4339 },
    { name: 'KENNEDY', identifier: 'JFK', waypointType: 'NAVAID', lat: 40.6398, lon: -73.7787 },
  ],
};

describe('writeOutput', () => {
  it('writes airways with waypointCount aggregated across records', async () => {
    const outPath = join(sandbox, 'airways.json.gz');
    await writeOutput([sampleAirway], '2026-04-16', outPath);

    const data = readOutput(outPath);
    expect(data.meta.recordCount).toBe(1);
    expect(data.meta.waypointCount).toBe(3);
    expect(data.meta.nasrCycleDate).toBe('2026-04-16');
  });

  it('records meta.generatedAt in ISO 8601 format', async () => {
    const outPath = join(sandbox, 'airways.json.gz');
    await writeOutput([sampleAirway], '2026-04-16', outPath);

    const data = readOutput(outPath);
    expect(data.meta.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('creates the parent directory if it does not exist', async () => {
    const outPath = join(sandbox, 'nested', 'deep', 'airways.json.gz');
    await writeOutput([sampleAirway], '2026-04-16', outPath);

    const data = readOutput(outPath);
    expect(data.meta.recordCount).toBe(1);
  });

  it('reports zero waypoints for an empty record set', async () => {
    const outPath = join(sandbox, 'airways.json.gz');
    await writeOutput([], '2026-04-16', outPath);

    const data = readOutput(outPath);
    expect(data.meta.recordCount).toBe(0);
    expect(data.meta.waypointCount).toBe(0);
  });
});
