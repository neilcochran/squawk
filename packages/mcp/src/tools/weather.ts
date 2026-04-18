/**
 * @packageDocumentation
 * MCP tool module wrapping `@squawk/weather` parsing utilities and the live
 * `@squawk/weather/fetch` client for the Aviation Weather Center text API.
 *
 * Parsing tools accept user-pasted METAR/TAF/SIGMET/AIRMET/PIREP strings and
 * return the parsed objects. Fetch tools issue HTTP requests to the AWC API
 * and return both the parsed records and any per-record parse errors so the
 * model can surface partial failures.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { parseAirmet, parseMetar, parsePirep, parseSigmet, parseTaf } from '@squawk/weather';
import {
  fetchInternationalSigmets,
  fetchMetar,
  fetchPirep,
  fetchSigmets,
  fetchTaf,
  type FetchPirepOptions,
  type FetchSigmetsOptions,
  type FetchWeatherOptions,
  type PirepMinimumIntensity,
  type SigmetHazardFilter,
} from '@squawk/weather/fetch';
import { z } from 'zod';
import { runParser, summarizeParseErrors } from './tool-helpers.js';

/** Allowed values for the AWC SIGMET hazard filter. */
const SIGMET_HAZARD_VALUES = [
  'conv',
  'turb',
  'ice',
  'ifr',
] as const satisfies readonly SigmetHazardFilter[];

/** Allowed values for the AWC PIREP minimum intensity filter. */
const PIREP_INTENSITY_VALUES = [
  'lgt',
  'mod',
  'sev',
] as const satisfies readonly PirepMinimumIntensity[];

/**
 * Optional override for the Aviation Weather Center base URL. Read once at
 * module load from the `SQUAWK_AWC_BASE_URL` environment variable. When set,
 * every live `fetch_*` tool routes its request through the override - useful
 * for proxies, regional mirrors, and pointing tests at a local stub server.
 * Empty/whitespace values are treated as unset.
 */
const AWC_BASE_URL_OVERRIDE: string | undefined = (() => {
  const raw = process.env.SQUAWK_AWC_BASE_URL;
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
})();

/**
 * Returns a fresh {@link FetchWeatherOptions} object pre-populated with the
 * AWC base-URL override when one is configured. Each fetch tool spreads its
 * own options on top of the result.
 */
function baseFetchOptions(): FetchWeatherOptions {
  return AWC_BASE_URL_OVERRIDE !== undefined ? { baseUrl: AWC_BASE_URL_OVERRIDE } : {};
}

/**
 * Registers weather parsing and live-fetch tools on the given MCP server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export function registerWeatherTools(server: McpServer): void {
  // ---------------------------------------------------------------------------
  // Parsers
  // ---------------------------------------------------------------------------

  server.registerTool(
    'parse_metar',
    {
      title: 'Parse a METAR or SPECI report',
      description:
        'Parses a raw METAR or SPECI observation string into a structured object including wind, visibility, RVR, weather phenomena, sky condition, temperature, dewpoint, altimeter, remarks, and a derived flight category (VFR/MVFR/IFR/LIFR).',
      inputSchema: {
        raw: z.string().min(1).describe('Raw METAR or SPECI report text.'),
      },
    },
    ({ raw }) => runParser(raw, parseMetar, 'metar'),
  );

  server.registerTool(
    'parse_taf',
    {
      title: 'Parse a TAF forecast',
      description:
        'Parses a raw TAF (Terminal Aerodrome Forecast) string into a structured object with the validity period and ordered forecast change groups (FM, BECMG, TEMPO, PROB).',
      inputSchema: {
        raw: z.string().min(1).describe('Raw TAF report text.'),
      },
    },
    ({ raw }) => runParser(raw, parseTaf, 'taf'),
  );

  server.registerTool(
    'parse_sigmet',
    {
      title: 'Parse a SIGMET bulletin',
      description:
        'Parses a raw SIGMET (Significant Meteorological Information) bulletin in either US domestic or international ICAO format, returning a structured object with the FIR/area, hazard type, validity period, geometry, and movement.',
      inputSchema: {
        raw: z.string().min(1).describe('Raw SIGMET bulletin text.'),
      },
    },
    ({ raw }) => runParser(raw, parseSigmet, 'sigmet'),
  );

  server.registerTool(
    'parse_airmet',
    {
      title: 'Parse an AIRMET bulletin',
      description:
        "Parses a raw AIRMET (Airmen's Meteorological Information) bulletin into a structured object with the issuing center, validity period, hazard type, and area.",
      inputSchema: {
        raw: z.string().min(1).describe('Raw AIRMET bulletin text.'),
      },
    },
    ({ raw }) => runParser(raw, parseAirmet, 'airmet'),
  );

  server.registerTool(
    'parse_pirep',
    {
      title: 'Parse a PIREP report',
      description:
        'Parses a raw PIREP (Pilot Report) string into a structured object with location, time, aircraft type, altitude, sky cover, weather, turbulence, icing, and remarks.',
      inputSchema: {
        raw: z.string().min(1).describe('Raw PIREP report text.'),
      },
    },
    ({ raw }) => runParser(raw, parsePirep, 'pirep'),
  );

  // ---------------------------------------------------------------------------
  // Fetch (Aviation Weather Center text API)
  // ---------------------------------------------------------------------------

  server.registerTool(
    'fetch_metar',
    {
      title: 'Fetch live METARs from the Aviation Weather Center',
      description:
        "Fetches current METARs for one or more stations from the Aviation Weather Center text API and parses each record. Returns both the parsed METARs and any per-record parse errors. Use the parsed METAR's flightCategory field to summarize conditions.",
      inputSchema: {
        stations: z
          .array(z.string().min(1))
          .min(1)
          .describe(
            'One or more ICAO station identifiers (e.g. ["KJFK", "KLAX"]). The AWC API joins these with commas in a single request.',
          ),
      },
    },
    async ({ stations }) => {
      const { metars, parseErrors } = await fetchMetar(stations, baseFetchOptions());
      const payload = { metars, parseErrors: summarizeParseErrors(parseErrors) };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    },
  );

  server.registerTool(
    'fetch_taf',
    {
      title: 'Fetch live TAFs from the Aviation Weather Center',
      description:
        'Fetches current TAFs for one or more stations from the Aviation Weather Center text API and parses each record. Returns both the parsed TAFs and any per-record parse errors.',
      inputSchema: {
        stations: z
          .array(z.string().min(1))
          .min(1)
          .describe('One or more ICAO station identifiers (e.g. ["KJFK", "KLAX"]).'),
      },
    },
    async ({ stations }) => {
      const { tafs, parseErrors } = await fetchTaf(stations, baseFetchOptions());
      const payload = { tafs, parseErrors: summarizeParseErrors(parseErrors) };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    },
  );

  server.registerTool(
    'fetch_pirep',
    {
      title: 'Fetch live PIREPs from the Aviation Weather Center',
      description:
        'Fetches recent PIREPs centered on a single 4-letter ICAO station (e.g. "KDEN") from the Aviation Weather Center text API. Returns the parsed PIREPs and any per-record parse errors.',
      inputSchema: {
        station: z
          .string()
          .min(4)
          .max(4)
          .describe(
            '4-letter ICAO station identifier used as the search center (the API rejects shorter forms).',
          ),
        radiusNm: z
          .number()
          .positive()
          .optional()
          .describe('Optional search radius in nautical miles around the center station.'),
        ageHours: z
          .number()
          .positive()
          .optional()
          .describe('Optional hours back to search for reports.'),
        levelHundredsFt: z
          .number()
          .positive()
          .optional()
          .describe(
            'Optional altitude in hundreds of feet; the AWC API widens +/-3000 ft around this value.',
          ),
        minimumIntensity: z
          .enum(PIREP_INTENSITY_VALUES)
          .optional()
          .describe(
            'Optional minimum report intensity ("lgt" = light, "mod" = moderate, "sev" = severe).',
          ),
      },
    },
    async ({ station, radiusNm, ageHours, levelHundredsFt, minimumIntensity }) => {
      const options: FetchPirepOptions = baseFetchOptions();
      if (radiusNm !== undefined) {
        options.distance = radiusNm;
      }
      if (ageHours !== undefined) {
        options.age = ageHours;
      }
      if (levelHundredsFt !== undefined) {
        options.level = levelHundredsFt;
      }
      if (minimumIntensity !== undefined) {
        options.inten = minimumIntensity;
      }
      const { pireps, parseErrors } = await fetchPirep(station, options);
      const payload = { pireps, parseErrors: summarizeParseErrors(parseErrors) };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    },
  );

  server.registerTool(
    'fetch_sigmets',
    {
      title: 'Fetch active US (CONUS) SIGMETs',
      description:
        'Fetches all currently active US domestic SIGMETs from the Aviation Weather Center. The endpoint is not station-filtered; it returns the full active set. Optionally restrict to a single hazard type.',
      inputSchema: {
        hazard: z
          .enum(SIGMET_HAZARD_VALUES)
          .optional()
          .describe(
            'Optional hazard filter: "conv" (convective), "turb" (turbulence), "ice" (icing), or "ifr" (IFR conditions).',
          ),
      },
    },
    async ({ hazard }) => {
      const options: FetchSigmetsOptions = baseFetchOptions();
      if (hazard !== undefined) {
        options.hazard = hazard;
      }
      const { sigmets, parseErrors } = await fetchSigmets(options);
      const payload = { sigmets, parseErrors: summarizeParseErrors(parseErrors) };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    },
  );

  server.registerTool(
    'fetch_international_sigmets',
    {
      title: 'Fetch active international (ICAO-format) SIGMETs',
      description:
        'Fetches all currently active international SIGMETs (ICAO format) from the Aviation Weather Center. Excludes US domestic SIGMETs - use fetch_sigmets for those.',
      inputSchema: {},
    },
    async () => {
      const { sigmets, parseErrors } = await fetchInternationalSigmets(baseFetchOptions());
      const payload = { sigmets, parseErrors: summarizeParseErrors(parseErrors) };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    },
  );
}
