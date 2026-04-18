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
import { createSquawkMcpServer } from './server.js';

async function main(): Promise<void> {
  const server = createSquawkMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  console.error('[squawk-mcp] fatal error:', err);
  process.exit(1);
});
