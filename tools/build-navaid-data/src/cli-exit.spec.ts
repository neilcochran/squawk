import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The compiled entry point. `turbo.json` makes `test` depend on `build`, so
 * this exists under `npm test`; a bare `vitest run` inside the package may
 * not have built it yet, and the suite skips rather than failing on that.
 */
const CLI = resolve(import.meta.dirname, '../dist/index.js');
const built = existsSync(CLI);

function run(args: readonly string[]): { status: number | null; stderr: string } {
  const result = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf-8' });
  return { status: result.status, stderr: result.stderr };
}

describe('CLI exit status', () => {
  it.skipIf(!built)('exits 1 with the reason and usage when an argument is unknown', () => {
    const { status, stderr } = run(['--bogus']);

    expect(status).toBe(1);
    expect(stderr).toMatch(/Unknown argument: --bogus/);
    expect(stderr).toMatch(/Usage:/);
  });

  it.skipIf(!built)('exits 1 with usage when --local is missing', () => {
    const { status, stderr } = run([]);

    expect(status).toBe(1);
    expect(stderr).toMatch(/--local <path> is required/);
    expect(stderr).toMatch(/Usage:/);
  });

  it.skipIf(!built)('writes the whole message even though the process is ending', () => {
    const { stderr } = run(['--bogus']);

    expect(stderr.trimEnd().endsWith('.json.gz')).toBe(true);
  });
});
