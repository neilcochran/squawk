import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, it, beforeEach, afterEach, expect } from 'vitest';

import { parseNasrArgs } from './parse-nasr-args.js';
import type { NasrArgs, NasrArgsError } from './parse-nasr-args.js';

let sandbox: string;
const originalLog = console.log;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'parse-nasr-args-'));
  console.log = () => undefined;
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
  console.log = originalLog;
});

function expectArgs(result: NasrArgs | NasrArgsError): NasrArgs {
  if ('message' in result) {
    throw new Error(`expected parsed arguments, got: ${result.message}`);
  }
  return result;
}

function expectError(result: NasrArgs | NasrArgsError): NasrArgsError {
  if (!('message' in result)) {
    throw new Error(`expected an error, got arguments for ${result.subscriptionDir}`);
  }
  return result;
}

describe('parseNasrArgs', () => {
  it('extracts the cycle date from the subscription directory name', () => {
    const subDir = join(sandbox, '28DaySubscription_Effective_2026-04-16');
    mkdirSync(subDir);

    const result = expectArgs(
      parseNasrArgs({ defaultOutputPath: '/tmp/default.json.gz', argv: ['--local', subDir] }),
    );

    expect(result.subscriptionDir).toBe(subDir);
    expect(result.nasrCycleDate).toBe('2026-04-16');
    expect(result.outputPath).toBe('/tmp/default.json.gz');
    expect(typeof result.cleanup).toBe('function');
  });

  it('honors the --output override', () => {
    const subDir = join(sandbox, '28DaySubscription_Effective_2026-04-16');
    mkdirSync(subDir);

    const outPath = join(sandbox, 'custom.json.gz');
    const result = expectArgs(
      parseNasrArgs({
        defaultOutputPath: '/tmp/default.json.gz',
        argv: ['--local', subDir, '--output', outPath],
      }),
    );

    expect(result.outputPath).toBe(outPath);
  });

  it('throws when the directory does not match the cycle date pattern', () => {
    const subDir = join(sandbox, 'some-random-folder');
    mkdirSync(subDir);

    expect(() =>
      parseNasrArgs({ defaultOutputPath: '/tmp/d.json.gz', argv: ['--local', subDir] }),
    ).toThrow(/Cannot determine NASR cycle date/);
  });

  it('reports an unknown argument with usage instead of ending the process', () => {
    const result = expectError(
      parseNasrArgs({ defaultOutputPath: '/tmp/d.json.gz', argv: ['--bogus', 'value'] }),
    );

    expect(result.message).toMatch(/Unknown argument: --bogus/);
    expect(result.message).toMatch(/Usage:/);
  });

  it('reports a missing --local with usage instead of ending the process', () => {
    const result = expectError(parseNasrArgs({ defaultOutputPath: '/tmp/d.json.gz', argv: [] }));

    expect(result.message).toMatch(/--local <path> is required/);
    expect(result.message).toMatch(/Usage:/);
  });

  it('reports --local without a path as an unknown argument', () => {
    const result = expectError(
      parseNasrArgs({ defaultOutputPath: '/tmp/d.json.gz', argv: ['--local'] }),
    );

    expect(result.message).toMatch(/Unknown argument: --local/);
  });

  it('shows the default output path in the usage text', () => {
    const result = expectError(
      parseNasrArgs({ defaultOutputPath: '/tmp/shown-here.json.gz', argv: ['--bogus'] }),
    );

    expect(result.message).toContain('/tmp/shown-here.json.gz');
  });

  it('puts the reason before the usage it explains', () => {
    const result = expectError(
      parseNasrArgs({ defaultOutputPath: '/tmp/d.json.gz', argv: ['--bogus'] }),
    );

    expect(result.message.startsWith('Unknown argument: --bogus')).toBe(true);
    expect(result.message.indexOf('Unknown argument')).toBeLessThan(
      result.message.indexOf('Usage:'),
    );
  });
});
