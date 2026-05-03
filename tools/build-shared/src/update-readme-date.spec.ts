import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, it, beforeEach, afterEach, expect, assert } from 'vitest';

import { updateReadmeDate } from './update-readme-date.js';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'update-readme-date-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('updateReadmeDate', () => {
  it('updates the NASR date in the parent directory README', async () => {
    const dataDir = join(tempDir, 'data');
    mkdirSync(dataDir);
    const readmePath = join(tempDir, 'README.md');
    writeFileSync(
      readmePath,
      '# Pkg\n\nThis is generated from the **2025-01-01** FAA NASR cycle.\n',
      'utf-8',
    );

    const outputPath = join(dataDir, 'records.json.gz');
    await updateReadmeDate(outputPath, '2026-04-16');

    const updated = readFileSync(readmePath, 'utf-8');
    assert(updated.includes('from the **2026-04-16** FAA NASR'));
    assert(!updated.includes('**2025-01-01**'));
  });

  it('matches the CIFP variant', async () => {
    const dataDir = join(tempDir, 'data');
    mkdirSync(dataDir);
    const readmePath = join(tempDir, 'README.md');
    writeFileSync(readmePath, 'Built from the **2025-01-01** FAA CIFP cycle.\n', 'utf-8');

    await updateReadmeDate(join(dataDir, 'f.json.gz'), '2026-04-16');

    const updated = readFileSync(readmePath, 'utf-8');
    assert(updated.includes('from the **2026-04-16** FAA CIFP'));
  });

  it('matches the ReleasableAircraft variant', async () => {
    const dataDir = join(tempDir, 'data');
    mkdirSync(dataDir);
    const readmePath = join(tempDir, 'README.md');
    writeFileSync(
      readmePath,
      'Sourced from the **2025-01-01** FAA ReleasableAircraft data.\n',
      'utf-8',
    );

    await updateReadmeDate(join(dataDir, 'f.json.gz'), '2026-04-16');

    const updated = readFileSync(readmePath, 'utf-8');
    assert(updated.includes('from the **2026-04-16** FAA ReleasableAircraft'));
  });

  it('leaves the README untouched when it does not contain the pattern', async () => {
    const dataDir = join(tempDir, 'data');
    mkdirSync(dataDir);
    const readmePath = join(tempDir, 'README.md');
    const original = '# Pkg\n\nNo date marker here.\n';
    writeFileSync(readmePath, original, 'utf-8');

    await updateReadmeDate(join(dataDir, 'f.json.gz'), '2026-04-16');

    expect(readFileSync(readmePath, 'utf-8')).toBe(original);
  });

  it('is a no-op when the README is missing', async () => {
    const dataDir = join(tempDir, 'data');
    mkdirSync(dataDir);
    await updateReadmeDate(join(dataDir, 'f.json.gz'), '2026-04-16');
  });

  it('only replaces the first matching occurrence', async () => {
    const dataDir = join(tempDir, 'data');
    mkdirSync(dataDir);
    const readmePath = join(tempDir, 'README.md');
    writeFileSync(
      readmePath,
      'A from the **2025-01-01** FAA NASR\n' + 'B from the **2025-02-02** FAA NASR\n',
      'utf-8',
    );

    await updateReadmeDate(join(dataDir, 'f.json.gz'), '2026-04-16');

    const updated = readFileSync(readmePath, 'utf-8');
    assert(updated.includes('A from the **2026-04-16** FAA NASR'));
    assert(updated.includes('B from the **2025-02-02** FAA NASR'));
  });
});
