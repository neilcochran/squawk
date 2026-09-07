#!/usr/bin/env node

/**
 * CI check: verifies that every publishable workspace has a built `dist/`
 * directory containing at least one JavaScript file.
 *
 * This is the last line of defence against publishing an empty package.
 * The Publish workflow builds in an unprivileged job and hands `dist/` to
 * the privileged publish job as an uploaded artifact, and that job never
 * builds anything itself. A publishable workspace missing from the artifact
 * therefore reaches `changeset publish` with no build output at all:
 * `files: ["dist"]` matches nothing and the tarball ships as just
 * `package.json` plus `README.md` - installable, but with no code in it.
 *
 * Run this after `npm run build` in the build job (catches a missing or
 * failed build) and again after the artifact is unpacked in the publish job
 * (catches artifact plumbing that does not cover a workspace).
 *
 * A workspace is publishable when its `package.json` does not set
 * `private: true`. Exits 0 when every publishable workspace has JS output,
 * 1 otherwise.
 *
 * `--list` instead prints each publishable workspace's dist directory, one
 * repo-root-relative path per line, which is what the build job feeds to
 * `tar` when bundling the artifact. Private workspaces never appear in that
 * list, so build output for something like `apps/atlas` cannot end up in a
 * release artifact.
 *
 * Usage: node scripts/check-publishable-dist.js [--list]
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Expands a single `workspaces` entry from the root `package.json` into
 * absolute workspace directories. Supports the two forms this repo uses: a
 * literal path (`tools/build-shared`) and a single trailing wildcard
 * (`packages/libs/*`). Any other pattern is rejected rather than silently
 * skipped, since a skipped workspace is exactly the failure this check
 * exists to prevent.
 *
 * @param {string} pattern - A workspaces glob or literal path.
 * @returns {string[]} Absolute paths to the matched workspace directories.
 */
function expandWorkspacePattern(pattern) {
  if (!pattern.includes('*')) {
    return [resolve(root, pattern)];
  }
  if (!pattern.endsWith('/*') || pattern.slice(0, -2).includes('*')) {
    console.error(
      `check-publishable-dist: unsupported workspaces pattern "${pattern}". ` +
        `Only literal paths and a single trailing "/*" are handled; ` +
        `extend expandWorkspacePattern() to cover it.`,
    );
    process.exit(1);
  }
  const parent = resolve(root, pattern.slice(0, -2));
  return readdirSync(parent, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(parent, entry.name));
}

/**
 * Determines whether a directory tree contains at least one `.js` file.
 *
 * @param {string} dir - Absolute path to the directory to search.
 * @returns {boolean} True when a `.js` file exists anywhere beneath `dir`.
 */
function containsJsFile(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (containsJsFile(entryPath)) {
        return true;
      }
    } else if (entry.name.endsWith('.js')) {
      return true;
    }
  }
  return false;
}

const rootPkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));
const workspaceDirs = rootPkg.workspaces.flatMap(expandWorkspacePattern);

/** Names of publishable workspaces whose `dist/` is missing or has no JS. */
const failures = [];
/** Count of publishable workspaces that passed, for the success summary. */
let checked = 0;

/** Publishable workspaces, as `{ name, dir, workspacePath }`. */
const publishable = [];

for (const workspaceDir of workspaceDirs) {
  const pkgPath = join(workspaceDir, 'package.json');
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  } catch {
    continue;
  }
  if (pkg.private === true) {
    continue;
  }
  publishable.push({
    name: pkg.name,
    dir: workspaceDir,
    workspacePath: relative(root, workspaceDir).split(sep).join('/'),
  });
}

// `--list` prints the dist directories the Publish workflow should collect, so
// the artifact is built from workspace metadata rather than directory globs.
// Private workspaces (apps/atlas) are excluded by construction, and a new
// publishable workspace anywhere is picked up with no workflow change.
if (process.argv.includes('--list')) {
  for (const { workspacePath } of publishable) {
    console.log(`${workspacePath}/dist`);
  }
  process.exit(0);
}

for (const { name, dir, workspacePath } of publishable) {
  const distDir = join(dir, 'dist');
  let reason;
  try {
    if (!statSync(distDir).isDirectory()) {
      reason = 'dist exists but is not a directory';
    } else if (!containsJsFile(distDir)) {
      reason = 'dist contains no .js files';
    }
  } catch {
    reason = 'dist is missing';
  }

  if (reason) {
    failures.push(`  ${name} (${workspacePath}) - ${reason}`);
  } else {
    checked += 1;
  }
}

if (failures.length > 0) {
  console.error(
    `check-publishable-dist: ${failures.length} publishable workspace(s) have no build output:\n` +
      `${failures.join('\n')}\n\n` +
      `Publishing now would ship empty tarballs. If the build succeeded, check that the\n` +
      `dist artifact upload/download paths in .github/workflows/publish.yml cover every\n` +
      `directory above.`,
  );
  process.exit(1);
}

console.log(`check-publishable-dist: ${checked} publishable workspaces have build output.`);
