import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { FeatureCollection } from 'geojson';
import type { AirspaceFeature } from '@squawk/types';
import { writeOutput } from './write-output.js';

let sandbox: string;
const originalLog = console.log;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'write-airspace-'));
  console.log = () => undefined;
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
  console.log = originalLog;
});

function readOutput(path: string): FeatureCollection & {
  properties: { nasrCycleDate: string; generatedAt: string; featureCount: number };
} {
  const compressed = readFileSync(path);
  const json = gunzipSync(compressed).toString('utf-8');
  return JSON.parse(json);
}

const sampleFeature: AirspaceFeature = {
  type: 'CLASS_B',
  name: 'JFK',
  identifier: 'JFK',
  floor: { valueFt: 0, reference: 'SFC' },
  ceiling: { valueFt: 7000, reference: 'MSL' },
  boundary: {
    type: 'Polygon',
    coordinates: [
      [
        [-73.123456789, 40.123456789],
        [-73.223456789, 40.123456789],
        [-73.223456789, 40.223456789],
        [-73.123456789, 40.223456789],
        [-73.123456789, 40.123456789],
      ],
    ],
  },
  state: 'NY',
  controllingFacility: 'NY TRACON',
  scheduleDescription: null,
  artccStratum: null,
};

describe('writeOutput', () => {
  it('writes a GeoJSON FeatureCollection with cycle date in top-level properties', async () => {
    const outPath = join(sandbox, 'airspace.geojson.gz');
    await writeOutput([sampleFeature], outPath, '2026-04-16');

    const data = readOutput(outPath);
    expect(data.type).toBe('FeatureCollection');
    expect(data.properties.nasrCycleDate).toBe('2026-04-16');
    expect(data.properties.featureCount).toBe(1);
    expect(data.features.length).toBe(1);
  });

  it('rounds coordinates to 5 decimal places (~1.1 m precision)', async () => {
    const outPath = join(sandbox, 'airspace.geojson.gz');
    await writeOutput([sampleFeature], outPath, '2026-04-16');

    const data = readOutput(outPath);
    const geom = data.features[0]?.geometry;
    if (geom?.type !== 'Polygon') {
      throw new Error('expected a Polygon geometry');
    }
    const firstCoord = geom.coordinates[0]?.[0];
    if (firstCoord === undefined) {
      throw new Error('expected at least one coordinate pair');
    }
    expect(firstCoord[0]).toBe(-73.12346);
    expect(firstCoord[1]).toBe(40.12346);
  });

  it('records meta.generatedAt in ISO 8601 format', async () => {
    const outPath = join(sandbox, 'airspace.geojson.gz');
    await writeOutput([sampleFeature], outPath, '2026-04-16');

    const data = readOutput(outPath);
    expect(data.properties.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('creates the parent directory if it does not exist', async () => {
    const outPath = join(sandbox, 'nested', 'deep', 'airspace.geojson.gz');
    await writeOutput([sampleFeature], outPath, '2026-04-16');

    const data = readOutput(outPath);
    expect(data.properties.featureCount).toBe(1);
  });

  it('handles an empty feature set', async () => {
    const outPath = join(sandbox, 'airspace.geojson.gz');
    await writeOutput([], outPath, '2026-04-16');

    const data = readOutput(outPath);
    expect(data.properties.featureCount).toBe(0);
    expect(data.features).toEqual([]);
  });
});
