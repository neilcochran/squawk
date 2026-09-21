import { describe, it, expect, assert } from 'vitest';

import {
  TOOL_ALLOWLIST_ENV_VAR,
  TOOL_DENYLIST_ENV_VAR,
  TOOL_GROUP_NAMES,
  ToolGroupConfigError,
  normalizeToolGroups,
  resolveToolGroupsFromEnv,
} from './tool-groups.js';

describe('TOOL_GROUP_NAMES', () => {
  it('has no duplicate entries', () => {
    expect(new Set(TOOL_GROUP_NAMES).size).toBe(TOOL_GROUP_NAMES.length);
  });
});

describe('resolveToolGroupsFromEnv', () => {
  it('enables every group when neither variable is set', () => {
    const resolution = resolveToolGroupsFromEnv({});
    assert(resolution.ok);
    expect(resolution.toolGroups).toEqual([...TOOL_GROUP_NAMES]);
  });

  it('treats a blank value as unset', () => {
    const resolution = resolveToolGroupsFromEnv({ [TOOL_ALLOWLIST_ENV_VAR]: '   ' });
    assert(resolution.ok);
    expect(resolution.toolGroups).toEqual([...TOOL_GROUP_NAMES]);
  });

  it('registers only the allowlisted groups', () => {
    const resolution = resolveToolGroupsFromEnv({ [TOOL_ALLOWLIST_ENV_VAR]: 'airports,geo' });
    assert(resolution.ok);
    expect(resolution.toolGroups).toEqual(['geo', 'airports']);
  });

  it('drops the denylisted groups and keeps the rest', () => {
    const resolution = resolveToolGroupsFromEnv({
      [TOOL_DENYLIST_ENV_VAR]: 'weather,notams',
    });
    assert(resolution.ok);
    expect(resolution.toolGroups).not.toContain('weather');
    expect(resolution.toolGroups).not.toContain('notams');
    expect(resolution.toolGroups.length).toBe(TOOL_GROUP_NAMES.length - 2);
  });

  it('returns groups in registration order regardless of the order given', () => {
    const resolution = resolveToolGroupsFromEnv({
      [TOOL_ALLOWLIST_ENV_VAR]: 'datasets,airports,geo',
    });
    assert(resolution.ok);
    expect(resolution.toolGroups).toEqual(['geo', 'airports', 'datasets']);
  });

  it('ignores surrounding whitespace and letter case', () => {
    const resolution = resolveToolGroupsFromEnv({
      [TOOL_ALLOWLIST_ENV_VAR]: '  Airports , FLIGHT-MATH  ',
    });
    assert(resolution.ok);
    expect(resolution.toolGroups).toEqual(['flight-math', 'airports']);
  });

  it('deduplicates repeated group names', () => {
    const resolution = resolveToolGroupsFromEnv({
      [TOOL_ALLOWLIST_ENV_VAR]: 'geo,geo,airports',
    });
    assert(resolution.ok);
    expect(resolution.toolGroups).toEqual(['geo', 'airports']);
  });

  it('rejects setting both variables at once', () => {
    const resolution = resolveToolGroupsFromEnv({
      [TOOL_ALLOWLIST_ENV_VAR]: 'geo',
      [TOOL_DENYLIST_ENV_VAR]: 'weather',
    });
    assert(!resolution.ok);
    expect(resolution.error).toMatch(/mutually exclusive/);
  });

  it('rejects an unknown group name and lists the valid ones', () => {
    const resolution = resolveToolGroupsFromEnv({ [TOOL_ALLOWLIST_ENV_VAR]: 'airport' });
    assert(!resolution.ok);
    expect(resolution.error).toMatch(/unknown tool group: airport/);
    expect(resolution.error).toMatch(/Valid groups: /);
  });

  it('names every unknown group when several are wrong', () => {
    const resolution = resolveToolGroupsFromEnv({
      [TOOL_ALLOWLIST_ENV_VAR]: 'geo,cfr-14,taxiways',
    });
    assert(!resolution.ok);
    expect(resolution.error).toMatch(/unknown tool groups: cfr-14, taxiways/);
  });

  it('rejects a value that names no groups at all', () => {
    const resolution = resolveToolGroupsFromEnv({ [TOOL_ALLOWLIST_ENV_VAR]: ',,,' });
    assert(!resolution.ok);
    expect(resolution.error).toMatch(/names no tool groups/);
  });

  it('rejects a denylist that would leave the server with no tools', () => {
    const resolution = resolveToolGroupsFromEnv({
      [TOOL_DENYLIST_ENV_VAR]: TOOL_GROUP_NAMES.join(','),
    });
    assert(!resolution.ok);
    expect(resolution.error).toMatch(/disables every tool group/);
  });
});

describe('normalizeToolGroups', () => {
  it('returns the requested groups in registration order', () => {
    expect(normalizeToolGroups(['datasets', 'geo'])).toEqual(['geo', 'datasets']);
  });

  it('deduplicates repeated entries', () => {
    expect(normalizeToolGroups(['geo', 'geo'])).toEqual(['geo']);
  });

  it('throws on an empty list', () => {
    expect(() => normalizeToolGroups([])).toThrow(ToolGroupConfigError);
  });
});
