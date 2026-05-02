import { describe, it, beforeEach, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveInput } from './resolve-input.js';

let sandbox: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'resolve-input-test-'));
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('resolveInput', () => {
  it('returns a directory path unchanged with a no-op cleanup', () => {
    const dir = join(sandbox, 'some-subscription-dir');
    mkdirSync(dir);

    const result = resolveInput(dir);
    assert.equal(result.subscriptionDir, dir);

    result.cleanup();
    assert.ok(existsSync(dir));
  });

  it('extracts a zip into a temp directory named after the zip basename', () => {
    const innerDir = join(sandbox, '28DaySubscription_Effective_2026-04-16');
    mkdirSync(innerDir);
    writeFileSync(join(innerDir, 'marker.txt'), 'hello', 'utf-8');

    const zipPath = join(sandbox, '28DaySubscription_Effective_2026-04-16.zip');
    execSync(`cd "${sandbox}" && zip -qr "${zipPath}" 28DaySubscription_Effective_2026-04-16`);

    const result = resolveInput(zipPath);

    assert.notEqual(result.subscriptionDir, zipPath);
    assert.ok(result.subscriptionDir.endsWith('28DaySubscription_Effective_2026-04-16'));
    assert.ok(existsSync(result.subscriptionDir));

    result.cleanup();
  });

  it('cleanup removes the extracted temp directory', () => {
    const innerDir = join(sandbox, 'payload');
    mkdirSync(innerDir);
    writeFileSync(join(innerDir, 'a.txt'), 'data', 'utf-8');

    const zipPath = join(sandbox, 'payload.zip');
    execSync(`cd "${sandbox}" && zip -qr "${zipPath}" payload`);

    const result = resolveInput(zipPath);
    assert.ok(existsSync(result.subscriptionDir));

    result.cleanup();
    assert.ok(!existsSync(result.subscriptionDir));
  });

  it('throws when passed a file that is not a zip or directory', () => {
    const bogus = join(sandbox, 'not-a-zip.txt');
    writeFileSync(bogus, 'nope', 'utf-8');

    assert.throws(() => resolveInput(bogus), /Expected a \.zip file or directory/);
  });

  it('throws when passed a missing path', () => {
    assert.throws(() => resolveInput(join(sandbox, 'does-not-exist')));
  });
});
