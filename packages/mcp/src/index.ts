/**
 * @packageDocumentation
 * @squawk/mcp - Model Context Protocol server exposing squawk's aviation
 * libraries (geo, airports, airspace, weather, flightplan, and more) as
 * tools for LLM clients like Claude Desktop, Cursor, and other MCP hosts.
 *
 * Run via the CLI:
 *
 * ```sh
 * npx @squawk/mcp
 * ```
 *
 * Or embed the server programmatically in another MCP host:
 *
 * ```typescript
 * import { createSquawkMcpServer } from '@squawk/mcp';
 * import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
 *
 * const server = createSquawkMcpServer();
 * await server.connect(new StdioServerTransport());
 * ```
 */

export { createSquawkMcpServer } from './server.js';
