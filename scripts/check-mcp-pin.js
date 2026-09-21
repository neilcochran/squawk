#!/usr/bin/env node

/**
 * CI check: verifies that the pinned-version snippet in
 * `packages/libs/mcp/README.md` (under "Picking an install version")
 * matches the version of `@squawk/mcp` that will publish from the
 * current state of the repo. Uses changesets' release planner to
 * project the version forward through any pending `.changeset/*.md`
 * entries (including transitive bumps applied by
 * `updateInternalDependencies` when an mcp dependency bumps).
 *
 * Works correctly across all three lifecycle states: feature PRs with
 * pending changesets that bump mcp directly or transitively, the
 * Version Packages PR (no pending changesets, package.json already
 * reflects the bump), and main post-publish. Exits 0 on match, 1 on
 * drift.
 *
 * Usage: node scripts/check-mcp-pin.js
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import getReleasePlan from '@changesets/get-release-plan';

const root = resolve(import.meta.dirname, '..');
const mcpPackagePath = resolve(root, 'packages/libs/mcp/package.json');
const mcpReadmePath = resolve(root, 'packages/libs/mcp/README.md');

const PICKING_HEADING = '### Picking an install version';
const NEXT_HEADING_PATTERN = /\n###\s/;
const PINNED_VERSION_PATTERN = /@squawk\/mcp@(\d+\.\d+\.\d+)/;

/**
 * Compares the README's pinned version against the version mcp will publish.
 *
 * @returns The exit code: 0 when they match, 1 on drift or a malformed README.
 */
async function main() {
  const readme = readFileSync(mcpReadmePath, 'utf-8');
  const sectionStart = readme.indexOf(PICKING_HEADING);
  if (sectionStart === -1) {
    console.error(
      `check-mcp-pin: could not find "${PICKING_HEADING}" section in packages/libs/mcp/README.md.`,
    );
    return 1;
  }
  const sectionTail = readme.slice(sectionStart + PICKING_HEADING.length);
  const nextHeadingMatch = sectionTail.match(NEXT_HEADING_PATTERN);
  const section = nextHeadingMatch ? sectionTail.slice(0, nextHeadingMatch.index) : sectionTail;
  const pinMatch = section.match(PINNED_VERSION_PATTERN);
  if (!pinMatch) {
    console.error(
      `check-mcp-pin: could not find a pinned \`@squawk/mcp@<version>\` snippet under "${PICKING_HEADING}".`,
    );
    return 1;
  }
  const pinnedVersion = pinMatch[1];

  const mcpPkg = JSON.parse(readFileSync(mcpPackagePath, 'utf-8'));
  const currentVersion = mcpPkg.version;

  const releasePlan = await getReleasePlan(root);
  const mcpRelease = releasePlan.releases.find((r) => r.name === '@squawk/mcp');
  const projectedVersion = mcpRelease ? mcpRelease.newVersion : currentVersion;
  const bumpType = mcpRelease ? mcpRelease.type : null;

  if (pinnedVersion === projectedVersion) {
    const source = bumpType == null ? 'current' : 'projected';
    console.log(
      `check-mcp-pin: OK. README pins @squawk/mcp@${pinnedVersion}, matching ${source} version.`,
    );
    return 0;
  }

  const reason =
    bumpType == null
      ? `current @squawk/mcp version is ${currentVersion}`
      : `pending changesets project @squawk/mcp will bump from ${currentVersion} to ${projectedVersion} (${bumpType})`;
  console.error(
    `check-mcp-pin: README pins @squawk/mcp@${pinnedVersion} but ${reason}.\n` +
      `Update the snippet under "${PICKING_HEADING}" in packages/libs/mcp/README.md to @squawk/mcp@${projectedVersion}.`,
  );
  return 1;
}

process.exitCode = await main();
