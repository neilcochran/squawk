import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
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
  records: Record<string, Record<string, unknown>>;
} {
  const compressed = readFileSync(path);
  const json = gunzipSync(compressed).toString('utf-8');
  return JSON.parse(json);
}

describe('writeOutput', () => {
  it('indexes records by uppercase icaoHex key', async () => {
    const records: AircraftRegistration[] = [
      { icaoHex: 'A12345', registration: 'N123AB' },
      { icaoHex: 'B67890', registration: 'N456CD' },
    ];
    const outPath = join(sandbox, 'out.json.gz');

    await writeOutput(records, outPath);

    const data = readOutput(outPath);
    assert.equal(data.meta.recordCount, 2);
    assert.ok(data.records['A12345']);
    assert.ok(data.records['B67890']);
    assert.equal(data.records['A12345']?.r, 'N123AB');
    assert.equal(data.records['B67890']?.r, 'N456CD');
  });

  it('includes only populated optional fields using short keys', async () => {
    const records: AircraftRegistration[] = [
      {
        icaoHex: 'AABBCC',
        registration: 'N123AB',
        make: 'CESSNA',
        model: '172',
        operator: 'EXAMPLE LLC',
        aircraftType: 'fixedWingSingleEngine',
        engineType: 'reciprocating',
        yearManufactured: 2010,
      },
    ];
    const outPath = join(sandbox, 'out.json.gz');

    await writeOutput(records, outPath);

    const data = readOutput(outPath);
    assert.deepEqual(data.records['AABBCC'], {
      r: 'N123AB',
      mk: 'CESSNA',
      md: '172',
      op: 'EXAMPLE LLC',
      at: 'fixedWingSingleEngine',
      et: 'reciprocating',
      yr: 2010,
    });
  });

  it('omits missing optional fields entirely', async () => {
    const records: AircraftRegistration[] = [{ icaoHex: 'ABCDEF', registration: 'N999ZZ' }];
    const outPath = join(sandbox, 'out.json.gz');

    await writeOutput(records, outPath);

    const data = readOutput(outPath);
    assert.deepEqual(Object.keys(data.records['ABCDEF']!).sort(), ['r']);
  });

  it('creates the parent directory if it does not exist', async () => {
    const records: AircraftRegistration[] = [{ icaoHex: 'A00001', registration: 'NZZZ' }];
    const outPath = join(sandbox, 'nested', 'deep', 'out.json.gz');

    await writeOutput(records, outPath);

    const data = readOutput(outPath);
    assert.equal(data.meta.recordCount, 1);
  });

  it('records meta.generatedAt in ISO 8601 format', async () => {
    const records: AircraftRegistration[] = [{ icaoHex: 'A00001', registration: 'NZZZ' }];
    const outPath = join(sandbox, 'out.json.gz');

    await writeOutput(records, outPath);

    const data = readOutput(outPath);
    assert.match(data.meta.generatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('deduplicates records with duplicate icaoHex (last write wins)', async () => {
    const records: AircraftRegistration[] = [
      { icaoHex: 'DUPE01', registration: 'FIRST' },
      { icaoHex: 'DUPE01', registration: 'SECOND' },
    ];
    const outPath = join(sandbox, 'out.json.gz');

    await writeOutput(records, outPath);

    const data = readOutput(outPath);
    assert.equal(data.meta.recordCount, 1);
    assert.equal(data.records['DUPE01']?.r, 'SECOND');
  });

  it('handles an empty record set', async () => {
    const outPath = join(sandbox, 'out.json.gz');
    await writeOutput([], outPath);

    const data = readOutput(outPath);
    assert.equal(data.meta.recordCount, 0);
    assert.deepEqual(data.records, {});
  });
});
