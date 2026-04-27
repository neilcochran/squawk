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
import {
  createSquawkMcpServer,
  PACKAGE_NAME,
  PACKAGE_VERSION,
  TOOL_MODULE_COUNT,
} from './server.js';

/**
 * Logs the Node.js version this process is running on, the running build's
 * package version, the tool-module count, and warns when the environment is
 * missing capabilities the live weather fetch tools require.
 *
 * GUI MCP hosts (Claude Desktop, etc.) often launch child processes with a
 * different PATH than the user's interactive shell, so `node` may resolve to
 * an older binary than `which node` suggests. Surfacing the actual runtime
 * version and the running package version up front makes mismatches easy to
 * diagnose from the host's MCP log without bisecting tool failures.
 */
function logRuntimeDiagnostics(): void {
  console.error(`[squawk-mcp] node ${process.version} on ${process.platform}/${process.arch}`);
  console.error(
    `[squawk-mcp] ${PACKAGE_NAME} v${PACKAGE_VERSION}, ${TOOL_MODULE_COUNT} tool modules registered`,
  );
  if (typeof fetch !== 'function') {
    console.error(
      '[squawk-mcp] WARNING: global fetch() is unavailable in this Node runtime. ' +
        'Live weather fetch_* tools will fail. Upgrade to Node >=22, or pin an ' +
        'absolute path to a modern node binary in your MCP host config.',
    );
  }
}

async function main(): Promise<void> {
  logRuntimeDiagnostics();
  const server = createSquawkMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  console.error('[squawk-mcp] fatal error:', err);
  process.exit(1);
});
