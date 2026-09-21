import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

/**
 * The compiled entry point. These specs exercise the real CLI as a
 * subprocess, which is the only way to assert the exit status the shell
 * sees. `turbo.json` makes `test` depend on `build`, so it is always present
 * under `npm test`; running vitest directly without building first fails
 * here with an actionable message rather than skipping silently.
 */
const CLI = resolve(import.meta.dirname, '../dist/index.js');

function run(args: readonly string[]): { status: number | null; stderr: string } {
  const result = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf-8' });
  return { status: result.status, stderr: result.stderr };
}

describe('CLI exit status', () => {
  beforeAll(() => {
    if (!existsSync(CLI)) {
      throw new Error(
        `${CLI} is missing, so the CLI exit status cannot be checked. Build first: ` +
          `npx turbo run build --filter=@squawk/build-icao-registry-data`,
      );
    }
  });
  it('exits 1 with the reason and usage when an argument is unknown', () => {
    const { status, stderr } = run(['--bogus']);

    expect(status).toBe(1);
    expect(stderr).toMatch(/Unknown argument: --bogus/);
    expect(stderr).toMatch(/Usage:/);
  });

  it('exits 1 with usage when neither --fetch nor --local is given', () => {
    const { status, stderr } = run([]);

    expect(status).toBe(1);
    expect(stderr).toMatch(/either --fetch or --local <path> is required/);
    expect(stderr).toMatch(/Usage:/);
  });

  it('writes the whole message even though the process is ending', () => {
    const { stderr } = run(['--bogus']);

    expect(stderr.trimEnd().endsWith('.json.gz')).toBe(true);
  });
});
