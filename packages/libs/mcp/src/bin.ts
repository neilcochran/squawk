#!/usr/bin/env node
/**
 * @packageDocumentation
 * Stdio entrypoint for @squawk/mcp. Connects the server from
 * {@link createSquawkMcpServer} to a `StdioServerTransport` so the binary
 * behaves as an MCP server spawned by clients like Claude Desktop.
 *
 * All logs go to stderr; stdout is reserved for MCP protocol messages.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createSquawkMcpServer, PACKAGE_NAME, PACKAGE_VERSION } from './server.js';
import { TOOL_GROUP_NAMES, resolveToolGroupsFromEnv, type ToolGroupName } from './tool-groups.js';

/**
 * Logs the Node.js version this process is running on, the running build's
 * package version, which tool groups ended up registered, and warns when the
 * environment is missing capabilities the live weather fetch tools require.
 *
 * GUI MCP hosts (Claude Desktop, etc.) often launch child processes with a
 * different PATH than the user's interactive shell, so `node` may resolve to
 * an older binary than `which node` suggests. Surfacing the actual runtime
 * version and the running package version up front makes mismatches easy to
 * diagnose from the host's MCP log without bisecting tool failures. Naming the
 * disabled groups does the same for a mistyped tool-group variable, which
 * otherwise shows up only as tools the model never calls.
 *
 * @param enabledGroups - Tool groups the server is about to register.
 */
function logRuntimeDiagnostics(enabledGroups: readonly ToolGroupName[]): void {
  console.error(`[squawk-mcp] node ${process.version} on ${process.platform}/${process.arch}`);
  console.error(
    `[squawk-mcp] ${PACKAGE_NAME} v${PACKAGE_VERSION}, ` +
      `${enabledGroups.length}/${TOOL_GROUP_NAMES.length} tool groups registered`,
  );
  const disabled = TOOL_GROUP_NAMES.filter((name) => !enabledGroups.includes(name));
  if (disabled.length > 0) {
    console.error(`[squawk-mcp] disabled tool groups: ${disabled.join(', ')}`);
  }
  if (typeof fetch !== 'function') {
    console.error(
      '[squawk-mcp] WARNING: global fetch() is unavailable in this Node runtime. ' +
        'Live weather fetch_* tools will fail. Upgrade to Node >=22, or pin an ' +
        'absolute path to a modern node binary in your MCP host config.',
    );
  }
}

async function main(): Promise<void> {
  const resolution = resolveToolGroupsFromEnv(process.env);
  if (!resolution.ok) {
    console.error(`[squawk-mcp] configuration error: ${resolution.error}`);
    // eslint-disable-next-line n/no-process-exit -- serving a catalog the user did not ask for is worse than refusing to start; the host surfaces this line in its MCP log.
    process.exit(1);
  }
  logRuntimeDiagnostics(resolution.toolGroups);
  const server = createSquawkMcpServer({ toolGroups: resolution.toolGroups });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  console.error('[squawk-mcp] fatal error:', err);
  // eslint-disable-next-line n/no-process-exit -- a failed stdio connect can leave the transport holding stdin; exiting beats hanging the host that spawned us.
  process.exit(1);
});
