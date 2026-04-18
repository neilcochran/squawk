/**
 * @packageDocumentation
 * MCP tool module wrapping `@squawk/notams` ICAO-format and FAA domestic
 * NOTAM parsers.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { parseFaaNotam, parseNotam } from '@squawk/notams';
import { z } from 'zod';
import { runParser } from './tool-helpers.js';

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
