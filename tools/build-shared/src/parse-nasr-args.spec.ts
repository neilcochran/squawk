import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

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

  it('exits with usage when an unknown argument is provided', () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((_code?: string | number | null): never => {
        throw new Error('process.exit called');
      });
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      process.argv = ['node', 'index.js', '--bogus', 'value'];
      expect(() => parseNasrArgs({ defaultOutputPath: '/tmp/d.json.gz' })).toThrow(
        /process\.exit called/,
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
      const stderrCalls = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
      expect(stderrCalls).toMatch(/Unknown argument/);
      expect(stderrCalls).toMatch(/Usage:/);
    } finally {
      exitSpy.mockRestore();
      stderrSpy.mockRestore();
    }
  });

  it('exits with usage when --local is missing', () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((_code?: string | number | null): never => {
        throw new Error('process.exit called');
      });
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      process.argv = ['node', 'index.js'];
      expect(() => parseNasrArgs({ defaultOutputPath: '/tmp/d.json.gz' })).toThrow(
        /process\.exit called/,
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
      const stderrCalls = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
      expect(stderrCalls).toMatch(/--local <path> is required/);
    } finally {
      exitSpy.mockRestore();
      stderrSpy.mockRestore();
    }
  });
});
