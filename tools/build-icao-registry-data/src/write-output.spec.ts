import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { AircraftRegistration } from '@squawk/icao-registry';
import { writeOutput } from './write-output.js';

let sandbox: string;
const originalLog = console.log;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'write-icao-'));
  console.log = () => undefined;
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
  console.log = originalLog;
});

function readOutput(path: string): {
  meta: { generatedAt: string; recordCount: number };
  records: AircraftRegistration[];
} {
  const compressed = readFileSync(path);
  const json = gunzipSync(compressed).toString('utf-8');
  return JSON.parse(json);
}

describe('writeOutput', () => {
  it('writes records as a flat array of full AircraftRegistration objects', async () => {
    const records: AircraftRegistration[] = [
      { icaoHex: 'A12345', registration: 'N123AB' },
      { icaoHex: 'B67890', registration: 'N456CD' },
    ];
    const outPath = join(sandbox, 'out.json.gz');

    await writeOutput(records, outPath);

    const data = readOutput(outPath);
    expect(data.meta.recordCount).toBe(2);
    expect(data.records).toEqual(records);
  });

  it('preserves all populated fields verbatim', async () => {
    const record: AircraftRegistration = {
      icaoHex: 'AABBCC',
      registration: 'N123AB',
      make: 'CESSNA',
      model: '172',
      operator: 'EXAMPLE LLC',
      aircraftType: 'fixedWingSingleEngine',
      engineType: 'reciprocating',
      yearManufactured: 2010,
    };
    const outPath = join(sandbox, 'out.json.gz');

    await writeOutput([record], outPath);

    const data = readOutput(outPath);
    expect(data.records[0]).toEqual(record);
  });

  it('omits missing optional fields from the serialized record', async () => {
    const records: AircraftRegistration[] = [{ icaoHex: 'ABCDEF', registration: 'N999ZZ' }];
    const outPath = join(sandbox, 'out.json.gz');

    await writeOutput(records, outPath);

    const data = readOutput(outPath);
    expect(Object.keys(data.records[0]!).sort()).toEqual(['icaoHex', 'registration']);
  });

  it('creates the parent directory if it does not exist', async () => {
    const records: AircraftRegistration[] = [{ icaoHex: 'A00001', registration: 'NZZZ' }];
    const outPath = join(sandbox, 'nested', 'deep', 'out.json.gz');

    await writeOutput(records, outPath);

    const data = readOutput(outPath);
    expect(data.meta.recordCount).toBe(1);
  });

  it('records meta.generatedAt in ISO 8601 format', async () => {
    const records: AircraftRegistration[] = [{ icaoHex: 'A00001', registration: 'NZZZ' }];
    const outPath = join(sandbox, 'out.json.gz');

    await writeOutput(records, outPath);

    const data = readOutput(outPath);
    expect(data.meta.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('deduplicates records with duplicate icaoHex (last write wins)', async () => {
    const records: AircraftRegistration[] = [
      { icaoHex: 'DUPE01', registration: 'FIRST' },
      { icaoHex: 'DUPE01', registration: 'SECOND' },
    ];
    const outPath = join(sandbox, 'out.json.gz');

    await writeOutput(records, outPath);

    const data = readOutput(outPath);
    expect(data.meta.recordCount).toBe(1);
    expect(data.records[0]?.registration).toBe('SECOND');
  });

  it('handles an empty record set', async () => {
    const outPath = join(sandbox, 'out.json.gz');
    await writeOutput([], outPath);

    const data = readOutput(outPath);
    expect(data.meta.recordCount).toBe(0);
    expect(data.records).toEqual([]);
  });
});
