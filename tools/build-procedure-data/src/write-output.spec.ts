import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { describe, it, beforeEach, afterEach, expect } from 'vitest';

import type { Procedure } from '@squawk/types';

import { writeOutput } from './write-output.js';

let sandbox: string;
const originalLog = console.log;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'write-procedure-'));
  console.log = () => undefined;
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
  console.log = originalLog;
});

function readOutput(path: string): {
  meta: {
    generatedAt: string;
    cifpCycleDate: string;
    recordCount: number;
    sidCount: number;
    starCount: number;
    iapCount: number;
    legCount: number;
  };
  records: Procedure[];
} {
  const compressed = readFileSync(path);
  const json = gunzipSync(compressed).toString('utf-8');
  return JSON.parse(json);
}

function makeProcedure(
  type: 'SID' | 'STAR' | 'IAP',
  legCounts: { common: number; transitions: number[]; missed?: number },
): Procedure {
  const proc: Procedure = {
    name: `TEST-${type}`,
    identifier: `T${type}`,
    type,
    airports: ['KJFK'],
    commonRoutes: [
      {
        airports: ['KJFK'],
        legs: Array.from({ length: legCounts.common }, () => ({
          pathTerminator: 'TF' as const,
        })),
      },
    ],
    transitions: legCounts.transitions.map((count, idx) => ({
      name: `TR${idx}`,
      legs: Array.from({ length: count }, () => ({ pathTerminator: 'TF' as const })),
    })),
  };
  if (legCounts.missed !== undefined && type === 'IAP') {
    proc.missedApproach = {
      legs: Array.from({ length: legCounts.missed }, () => ({ pathTerminator: 'TF' as const })),
    };
  }
  return proc;
}

describe('writeOutput', () => {
  it('writes procedures with type counts and total leg count in metadata', async () => {
    const procedures: Procedure[] = [
      makeProcedure('SID', { common: 2, transitions: [3, 4] }),
      makeProcedure('STAR', { common: 1, transitions: [] }),
      makeProcedure('IAP', { common: 5, transitions: [2], missed: 6 }),
    ];
    const outPath = join(sandbox, 'procedures.json.gz');
    await writeOutput(procedures, '2026-04-16', outPath);

    const data = readOutput(outPath);
    expect(data.meta.recordCount).toBe(3);
    expect(data.meta.sidCount).toBe(1);
    expect(data.meta.starCount).toBe(1);
    expect(data.meta.iapCount).toBe(1);
    // SID: 2 + 3 + 4 = 9; STAR: 1; IAP: 5 + 2 + 6 = 13. Total = 23.
    expect(data.meta.legCount).toBe(23);
    expect(data.meta.cifpCycleDate).toBe('2026-04-16');
  });

  it('records meta.generatedAt in ISO 8601 format', async () => {
    const outPath = join(sandbox, 'procedures.json.gz');
    await writeOutput(
      [makeProcedure('SID', { common: 1, transitions: [] })],
      '2026-04-16',
      outPath,
    );

    const data = readOutput(outPath);
    expect(data.meta.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('creates the parent directory if it does not exist', async () => {
    const outPath = join(sandbox, 'nested', 'deep', 'procedures.json.gz');
    await writeOutput(
      [makeProcedure('SID', { common: 1, transitions: [] })],
      '2026-04-16',
      outPath,
    );

    const data = readOutput(outPath);
    expect(data.meta.recordCount).toBe(1);
  });

  it('reports zero counts for an empty record set', async () => {
    const outPath = join(sandbox, 'procedures.json.gz');
    await writeOutput([], '2026-04-16', outPath);

    const data = readOutput(outPath);
    expect(data.meta.recordCount).toBe(0);
    expect(data.meta.sidCount).toBe(0);
    expect(data.meta.starCount).toBe(0);
    expect(data.meta.iapCount).toBe(0);
    expect(data.meta.legCount).toBe(0);
  });

  it('handles an IAP without missed approach (legs only from commonRoutes and transitions)', async () => {
    const procedures: Procedure[] = [makeProcedure('IAP', { common: 4, transitions: [3] })];
    const outPath = join(sandbox, 'procedures.json.gz');
    await writeOutput(procedures, '2026-04-16', outPath);

    const data = readOutput(outPath);
    expect(data.meta.legCount).toBe(7);
  });
});
