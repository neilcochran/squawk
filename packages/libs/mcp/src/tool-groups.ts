/**
 * @packageDocumentation
 * Tool-group identity and configuration parsing for @squawk/mcp. Every domain
 * module under `src/tools/` is one toggleable group, so a client that only
 * needs part of the catalog can keep the rest out of its context window.
 *
 * This module owns the canonical group-name list and turns the server's
 * environment variables into the concrete set of groups to register.
 */

/**
 * Every toggleable tool group, in the order they are registered on the
 * server. Each name matches exactly one domain module filename under
 * `src/tools/`, so `airports` maps to `src/tools/airports.ts`.
 */
export const TOOL_GROUP_NAMES = [
  'geo',
  'flight-math',
  'airports',
  'airspace',
  'navaids',
  'fixes',
  'airways',
  'procedures',
  'icao-registry',
  'weather',
  'notams',
  'flightplan',
  'datasets',
] as const;

/** Name of a single toggleable tool group. */
export type ToolGroupName = (typeof TOOL_GROUP_NAMES)[number];

/**
 * Environment variable naming the only tool groups to register. Acts as an
 * allowlist: groups absent from the list are not registered, including groups
 * added by future releases.
 */
export const TOOL_ALLOWLIST_ENV_VAR = 'SQUAWK_MCP_TOOLS';

/**
 * Environment variable naming tool groups to skip. Acts as a denylist: every
 * group not listed is registered, including groups added by future releases.
 */
export const TOOL_DENYLIST_ENV_VAR = 'SQUAWK_MCP_DISABLE_TOOLS';

/**
 * Successful resolution of the tool-group configuration.
 */
export interface ToolGroupResolutionSuccess {
  /** Discriminant marking a successful resolution. */
  readonly ok: true;
  /** Groups to register, in {@link TOOL_GROUP_NAMES} order. Never empty. */
  readonly toolGroups: readonly ToolGroupName[];
}

/**
 * Failed resolution of the tool-group configuration, carrying a message ready
 * to print for the user.
 */
export interface ToolGroupResolutionFailure {
  /** Discriminant marking a failed resolution. */
  readonly ok: false;
  /** Human-readable explanation naming the offending value and the fix. */
  readonly error: string;
}

/** Outcome of resolving the tool-group environment variables. */
export type ToolGroupResolution = ToolGroupResolutionSuccess | ToolGroupResolutionFailure;

/**
 * Error thrown by `createSquawkMcpServer` when the tool-group configuration
 * cannot be honored. A server has no partial-success shape to return - an
 * unusable catalog is worse than a failed start, particularly for aviation
 * data - so the factory throws rather than silently registering the wrong
 * tools.
 */
export class ToolGroupConfigError extends Error {
  /**
   * Constructs a new configuration error.
   *
   * @param message - Human-readable explanation naming the offending value.
   */
  constructor(message: string) {
    super(message);
    this.name = 'ToolGroupConfigError';
  }
}

/** Comma-separated list of every valid group name, for error messages. */
const VALID_GROUPS_SUFFIX = `Valid groups: ${TOOL_GROUP_NAMES.join(', ')}.`;

/**
 * Returns `true` when an environment variable carries no usable value. Hosts
 * routinely pass empty strings for unset entries, so a blank value means
 * "not configured" rather than "configured to nothing".
 *
 * @param value - Raw environment variable value.
 * @returns `true` when the value is absent or whitespace-only.
 */
function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === '';
}

/**
 * Narrows an arbitrary string to a {@link ToolGroupName}.
 *
 * @param value - Candidate group name, already trimmed and lowercased.
 * @returns `true` when the value names a known group.
 */
function isToolGroupName(value: string): value is ToolGroupName {
  return TOOL_GROUP_NAMES.some((name) => name === value);
}

/**
 * Splits a comma-separated group list into normalized, deduplicated tokens.
 * Tokens are trimmed and lowercased so `Airports, WEATHER` resolves the same
 * way as `airports,weather`.
 *
 * @param value - Raw environment variable value.
 * @returns The distinct tokens, in the order they first appeared.
 */
function parseGroupList(value: string): string[] {
  const tokens = value
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token !== '');
  return [...new Set(tokens)];
}

/**
 * Validates parsed tokens against {@link TOOL_GROUP_NAMES}.
 *
 * @param tokens - Normalized tokens from {@link parseGroupList}.
 * @param envVar - Variable the tokens came from, named in the error message.
 * @returns The validated group names, or a failure describing the bad tokens.
 */
function validateGroupList(
  tokens: readonly string[],
  envVar: string,
): { ok: true; groups: ToolGroupName[] } | ToolGroupResolutionFailure {
  if (tokens.length === 0) {
    return {
      ok: false,
      error: `${envVar} names no tool groups. Remove it to use the default, or list at least one group. ${VALID_GROUPS_SUFFIX}`,
    };
  }
  const unknown = tokens.filter((token) => !isToolGroupName(token));
  if (unknown.length > 0) {
    return {
      ok: false,
      error: `${envVar} names unknown tool ${unknown.length === 1 ? 'group' : 'groups'}: ${unknown.join(', ')}. ${VALID_GROUPS_SUFFIX}`,
    };
  }
  return { ok: true, groups: tokens.filter(isToolGroupName) };
}

/**
 * Resolves which tool groups to register from the process environment.
 *
 * With neither variable set, every group is enabled, matching the behavior of
 * a server that predates this configuration. {@link TOOL_ALLOWLIST_ENV_VAR}
 * and {@link TOOL_DENYLIST_ENV_VAR} are mutually exclusive: setting both is an
 * error rather than a precedence rule, so the resolved catalog is always
 * readable straight off the configuration.
 *
 * ```typescript
 * const resolution = resolveToolGroupsFromEnv({ SQUAWK_MCP_TOOLS: 'airports,geo' });
 * if (resolution.ok) {
 *   console.log(resolution.toolGroups); // ['geo', 'airports']
 * }
 * ```
 *
 * @param env - Environment to read, normally `process.env`.
 * @returns The resolved groups, or a failure carrying a printable message.
 */
export function resolveToolGroupsFromEnv(
  env: Record<string, string | undefined>,
): ToolGroupResolution {
  const rawAllowlist = env[TOOL_ALLOWLIST_ENV_VAR];
  const rawDenylist = env[TOOL_DENYLIST_ENV_VAR];
  const hasAllowlist = !isBlank(rawAllowlist);
  const hasDenylist = !isBlank(rawDenylist);

  if (hasAllowlist && hasDenylist) {
    return {
      ok: false,
      error: `${TOOL_ALLOWLIST_ENV_VAR} and ${TOOL_DENYLIST_ENV_VAR} are mutually exclusive. Set one or the other, not both.`,
    };
  }

  if (hasAllowlist && rawAllowlist !== undefined) {
    const validated = validateGroupList(parseGroupList(rawAllowlist), TOOL_ALLOWLIST_ENV_VAR);
    if (!validated.ok) {
      return validated;
    }
    const allowed = new Set<ToolGroupName>(validated.groups);
    return { ok: true, toolGroups: TOOL_GROUP_NAMES.filter((name) => allowed.has(name)) };
  }

  if (hasDenylist && rawDenylist !== undefined) {
    const validated = validateGroupList(parseGroupList(rawDenylist), TOOL_DENYLIST_ENV_VAR);
    if (!validated.ok) {
      return validated;
    }
    const denied = new Set<ToolGroupName>(validated.groups);
    const remaining = TOOL_GROUP_NAMES.filter((name) => !denied.has(name));
    if (remaining.length === 0) {
      return {
        ok: false,
        error: `${TOOL_DENYLIST_ENV_VAR} disables every tool group, leaving the server with no tools to offer.`,
      };
    }
    return { ok: true, toolGroups: remaining };
  }

  return { ok: true, toolGroups: TOOL_GROUP_NAMES };
}

/**
 * Validates an explicitly supplied group list and returns it in registration
 * order. Unlike {@link resolveToolGroupsFromEnv}, a bad value here is a
 * programmer error rather than user misconfiguration, so it throws.
 *
 * @param toolGroups - Group names supplied by the caller.
 * @returns The distinct groups in {@link TOOL_GROUP_NAMES} order.
 * @throws {ToolGroupConfigError} when a name is unknown or the list is empty.
 */
export function normalizeToolGroups(
  toolGroups: readonly ToolGroupName[],
): readonly ToolGroupName[] {
  const validated = validateGroupList(
    [...new Set(toolGroups.map((group) => group.trim().toLowerCase()))],
    'toolGroups',
  );
  if (!validated.ok) {
    throw new ToolGroupConfigError(validated.error);
  }
  const requested = new Set<ToolGroupName>(validated.groups);
  return TOOL_GROUP_NAMES.filter((name) => requested.has(name));
}
