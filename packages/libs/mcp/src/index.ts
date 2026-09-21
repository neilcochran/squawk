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
 *
 * Pass `toolGroups` to register only part of the catalog:
 *
 * ```typescript
 * const server = createSquawkMcpServer({ toolGroups: ['airports', 'navaids', 'geo'] });
 * ```
 */

export { createSquawkMcpServer } from './server.js';
export { TOOL_GROUP_NAMES, ToolGroupConfigError } from './tool-groups.js';

export type { CreateSquawkMcpServerOptions } from './server.js';
export type { ToolGroupName } from './tool-groups.js';
