/**
 * @packageDocumentation
 * MCP tool module wrapping `@squawk/notams` ICAO-format and FAA domestic
 * NOTAM parsers.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { parseFaaNotam, parseNotam } from '@squawk/notams';
import { z } from 'zod';

/**
 * Wraps a synchronous parser invocation. On success returns a structured tool
 * result containing the parsed record; on failure returns an MCP error result
 * (`isError: true`) with the parser message verbatim.
 */
function runParser<T>(
  raw: string,
  parser: (raw: string) => T,
  resultKey: string,
): {
  /** Standard MCP content blocks. */
  content: { type: 'text'; text: string }[];
  /** Structured payload exposed to the client. */
  structuredContent: Record<string, T | null>;
  /** Set when the parser threw. */
  isError?: boolean;
} {
  try {
    const parsed = parser(raw);
    return {
      content: [{ type: 'text', text: JSON.stringify(parsed, null, 2) }],
      structuredContent: { [resultKey]: parsed },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `Parse failed: ${message}` }],
      structuredContent: { [resultKey]: null },
      isError: true,
    };
  }
}

/**
 * Registers NOTAM parsing tools on the given MCP server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export function registerNotamTools(server: McpServer): void {
  server.registerTool(
    'parse_icao_notam',
    {
      title: 'Parse an ICAO-format NOTAM',
      description:
        'Parses a raw ICAO-format NOTAM string into a structured object including the action (NEW/REPLACE/CANCEL), Q-line qualifier (FIR, NOTAM code, traffic, purpose, scope, altitude bounds, coordinates/radius), location codes, effective period, schedule, free-text description, and altitude limits.',
      inputSchema: {
        raw: z.string().min(1).describe('Raw ICAO-format NOTAM string.'),
      },
    },
    ({ raw }) => runParser(raw, parseNotam, 'notam'),
  );

  server.registerTool(
    'parse_faa_notam',
    {
      title: 'Parse an FAA domestic NOTAM',
      description:
        'Parses a raw FAA domestic (legacy) format NOTAM string into a structured object with the location, classification, keyword (RWY/TWY/NAV/AIRSPACE/etc.), text body, and effective period (including PERM/EST/UFN modifiers).',
      inputSchema: {
        raw: z.string().min(1).describe('Raw FAA domestic NOTAM string.'),
      },
    },
    ({ raw }) => runParser(raw, parseFaaNotam, 'notam'),
  );
}
