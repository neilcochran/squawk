import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseCliArgs } from './cli-args.js';
import type { CliArgs, CliArgsError } from './cli-args.js';

const DEFAULT_OUTPUT = '/tmp/procedures.json.gz';

function expectArgs(result: CliArgs | CliArgsError): CliArgs {
  if ('message' in result) {
    throw new Error(`expected parsed arguments, got: ${result.message}`);
  }
  return result;
}

function expectError(result: CliArgs | CliArgsError): CliArgsError {
  if (!('message' in result)) {
    throw new Error(`expected an error, got mode ${result.mode}`);
  }
  return result;
}

describe('parseCliArgs', () => {
  it('parses --cifp-fetch with the default output path', () => {
    const result = expectArgs(parseCliArgs(['--cifp-fetch'], DEFAULT_OUTPUT));

    expect(result.mode).toBe('fetch');
    expect(result.outputPath).toBe(DEFAULT_OUTPUT);
  });

  it('parses --cifp-local and resolves the path to an absolute one', () => {
    const result = expectArgs(parseCliArgs(['--cifp-local', 'CIFP.zip'], DEFAULT_OUTPUT));

    if (result.mode !== 'local') {
      throw new Error(`expected local mode, got ${result.mode}`);
    }
    expect(result.localPath).toBe(resolve('CIFP.zip'));
  });

  it('honors --output and resolves it', () => {
    const result = expectArgs(
      parseCliArgs(['--cifp-fetch', '--output', 'out.json.gz'], DEFAULT_OUTPUT),
    );

    expect(result.outputPath).toBe(resolve('out.json.gz'));
  });

  it('lets a later mode flag win', () => {
    const result = expectArgs(
      parseCliArgs(['--cifp-local', 'a.zip', '--cifp-fetch'], DEFAULT_OUTPUT),
    );

    expect(result.mode).toBe('fetch');
  });

  it('reports an unknown argument with usage instead of ending the process', () => {
    const result = expectError(parseCliArgs(['--bogus'], DEFAULT_OUTPUT));

    expect(result.message).toMatch(/Unknown argument: --bogus/);
    expect(result.message).toMatch(/Usage:/);
  });

  it('reports a missing mode with usage', () => {
    const result = expectError(parseCliArgs([], DEFAULT_OUTPUT));

    expect(result.message).toMatch(/either --cifp-fetch or --cifp-local <path> is required/);
    expect(result.message).toMatch(/Usage:/);
  });

  it('reports --cifp-local without a path as an unknown argument', () => {
    const result = expectError(parseCliArgs(['--cifp-local'], DEFAULT_OUTPUT));

    expect(result.message).toMatch(/Unknown argument: --cifp-local/);
  });

  it('reports --output without a path as an unknown argument', () => {
    const result = expectError(parseCliArgs(['--cifp-fetch', '--output'], DEFAULT_OUTPUT));

    expect(result.message).toMatch(/Unknown argument: --output/);
  });

  it('shows the default output path in the usage text', () => {
    const result = expectError(parseCliArgs(['--bogus'], DEFAULT_OUTPUT));

    expect(result.message).toContain(DEFAULT_OUTPUT);
  });

  it('puts the reason before the usage it explains', () => {
    const result = expectError(parseCliArgs(['--bogus'], DEFAULT_OUTPUT));

    expect(result.message.startsWith('Unknown argument: --bogus')).toBe(true);
    expect(result.message.indexOf('Unknown argument')).toBeLessThan(
      result.message.indexOf('Usage:'),
    );
  });
});
