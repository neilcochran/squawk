import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseNasrArgs } from './parse-nasr-args.js';

let sandbox: string;
let originalArgv: string[];
const originalLog = console.log;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'parse-nasr-args-'));
  originalArgv = process.argv;
  console.log = () => undefined;
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
  process.argv = originalArgv;
  console.log = originalLog;
});

describe('parseNasrArgs', () => {
  it('extracts the cycle date from the subscription directory name', () => {
    const subDir = join(sandbox, '28DaySubscription_Effective_2026-04-16');
    mkdirSync(subDir);

    process.argv = ['node', 'index.js', '--local', subDir];
    const result = parseNasrArgs({ defaultOutputPath: '/tmp/default.json.gz' });

    expect(result.subscriptionDir).toBe(subDir);
    expect(result.nasrCycleDate).toBe('2026-04-16');
    expect(result.outputPath).toBe('/tmp/default.json.gz');
    expect(typeof result.cleanup).toBe('function');
  });

  it('honors the --output override', () => {
    const subDir = join(sandbox, '28DaySubscription_Effective_2026-04-16');
    mkdirSync(subDir);

    const outPath = join(sandbox, 'custom.json.gz');
    process.argv = ['node', 'index.js', '--local', subDir, '--output', outPath];
    const result = parseNasrArgs({ defaultOutputPath: '/tmp/default.json.gz' });

    expect(result.outputPath).toBe(outPath);
  });

  it('throws when the directory does not match the cycle date pattern', () => {
    const subDir = join(sandbox, 'some-random-folder');
    mkdirSync(subDir);

    process.argv = ['node', 'index.js', '--local', subDir];
    expect(() => parseNasrArgs({ defaultOutputPath: '/tmp/d.json.gz' })).toThrow(
      /Cannot determine NASR cycle date/,
    );
  });
});
