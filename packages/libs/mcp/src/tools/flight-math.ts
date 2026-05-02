/**
 * @packageDocumentation
 * MCP tool module wrapping `@squawk/flight-math` E6B-style flight computer
 * calculations. Each tool corresponds to a single function from one of the
 * package's namespaces (atmosphere, airspeed, wind, descent, navigation,
 * turn, glide, solar, magnetic, planning).
 *
 * Trivially-simple operations (single multiplications, divisions, or
 * trig calls) are intentionally not exposed as tools - LLMs handle those
 * accurately on their own. The selected tools cover the cases where the
 * underlying implementation embeds a non-trivial constant, formula, or
 * lookup (the WMM2025 spherical harmonics, the NOAA solar algorithm,
 * compressible-flow pitot equations, holding-pattern sector logic, and
 * so on).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  airspeed,
  atmosphere,
  descent,
  glide,
  magnetic,
  navigation,
  planning,
  solar,
  turn,
  wind,
} from '@squawk/flight-math';
import type { MagneticFieldOptions } from '@squawk/flight-math';
import { z } from 'zod';
import { extractErrorMessage } from './tool-helpers.js';

/** Reusable zod fragment describing a latitude input. */
const latFragment = z
  .number()
  .min(-90)
  .max(90)
  .describe('Latitude in decimal degrees (WGS84, positive north).');

/** Reusable zod fragment describing a longitude input. */
const lonFragment = z
  .number()
  .min(-180)
  .max(180)
  .describe('Longitude in decimal degrees (WGS84, positive east).');

/** Reusable zod fragment describing an ISO 8601 UTC datetime input. */
const isoDateFragment = z
  .string()
  .min(1)
  .describe('UTC datetime as an ISO 8601 string (e.g. "2026-04-18T12:00:00Z").');

/**
 * Parses an ISO 8601 string into a Date and validates the result. Throws when
 * the string cannot be parsed so callers can surface the failure as an MCP
 * error result.
 *
 * @param iso - ISO 8601 datetime string.
 * @returns The parsed Date.
 */
function parseIsoDate(iso: string): Date {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ISO 8601 datetime: "${iso}"`);
  }
  return date;
}

/**
 * Builds a {@link MagneticFieldOptions} object from the optional altitude and
 * ISO datetime arguments shared across the magnetic tools. Returns either the
 * options or a parse-error message when the date string cannot be interpreted.
 *
 * @param altitudeFt - Optional altitude in feet MSL.
 * @param dateUtc - Optional ISO 8601 UTC date string.
 * @returns A discriminated union: `ok=true` with the options, or `ok=false`
 *          with the parser message.
 */
function buildMagneticOptions(
  altitudeFt: number | undefined,
  dateUtc: string | undefined,
): { ok: true; options: MagneticFieldOptions } | { ok: false; message: string } {
  let date: Date | undefined;
  if (dateUtc !== undefined) {
    try {
      date = parseIsoDate(dateUtc);
    } catch (err) {
      return { ok: false, message: extractErrorMessage(err) };
    }
  }
  const options: MagneticFieldOptions = {
    ...(altitudeFt !== undefined ? { altitudeFt } : {}),
    ...(date !== undefined ? { date } : {}),
  };
  return { ok: true, options };
}

/**
 * Registers flight-math computation tools on the given MCP server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export function registerFlightMathTools(server: McpServer): void {
  // ---------------------------------------------------------------------------
  // Atmosphere
  // ---------------------------------------------------------------------------

  server.registerTool(
    'compute_density_altitude',
    {
      title: 'Compute density altitude from field observations',
      description:
        'Computes density altitude from field elevation, altimeter setting (inHg), and outside air temperature (Celsius). Uses the ISA model to derive pressure altitude from the altimeter setting, then applies the temperature correction.',
      inputSchema: {
        fieldElevationFt: z.number().describe('Field elevation in feet MSL.'),
        altimeterSettingInHg: z
          .number()
          .positive()
          .describe('Altimeter setting (QNH) in inches of mercury.'),
        oatCelsius: z.number().describe('Outside air temperature in degrees Celsius.'),
      },
    },
    ({ fieldElevationFt, altimeterSettingInHg, oatCelsius }) => {
      const densityAltitudeFt = atmosphere.densityAltitude(
        fieldElevationFt,
        altimeterSettingInHg,
        oatCelsius,
      );
      return {
        content: [{ type: 'text', text: `${densityAltitudeFt.toFixed(0)} ft` }],
        structuredContent: { densityAltitudeFt },
      };
    },
  );

  server.registerTool(
    'compute_true_altitude',
    {
      title: 'Compute true altitude from indicated altitude',
      description:
        'Computes true altitude from indicated altitude, altimeter setting (inHg), and outside air temperature (Celsius). When stationElevationFt is provided, the temperature correction is applied only to the altitude above the station; otherwise it scales the entire indicated altitude (the standard E6B method).',
      inputSchema: {
        indicatedAltitudeFt: z
          .number()
          .describe('Indicated altitude in feet (altimeter set to QNH).'),
        altimeterSettingInHg: z
          .number()
          .positive()
          .describe('Altimeter setting (QNH) in inches of mercury.'),
        oatCelsius: z.number().describe('Outside air temperature in degrees Celsius.'),
        stationElevationFt: z
          .number()
          .optional()
          .describe('Optional elevation of the altimeter-setting station in feet MSL.'),
      },
    },
    ({ indicatedAltitudeFt, altimeterSettingInHg, oatCelsius, stationElevationFt }) => {
      const trueAltitudeFt = atmosphere.trueAltitude(
        indicatedAltitudeFt,
        altimeterSettingInHg,
        oatCelsius,
        stationElevationFt,
      );
      return {
        content: [{ type: 'text', text: `${trueAltitudeFt.toFixed(0)} ft` }],
        structuredContent: { trueAltitudeFt },
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Airspeed
  // ---------------------------------------------------------------------------

  server.registerTool(
    'compute_calibrated_airspeed_from_true_airspeed',
    {
      title: 'Compute CAS from TAS',
      description:
        'Converts true airspeed (TAS) to calibrated airspeed (CAS) using the full compressible-flow pitot-static equations (ICAO standard). Valid for subsonic flight (Mach < 1.0). When OAT is omitted, ISA standard temperature at the given pressure altitude is used.',
      inputSchema: {
        trueAirspeedKt: z.number().positive().describe('True airspeed in knots.'),
        pressureAltitudeFt: z.number().describe('Pressure altitude in feet.'),
        oatCelsius: z
          .number()
          .optional()
          .describe(
            'Optional outside air temperature in degrees Celsius (defaults to ISA standard).',
          ),
      },
    },
    ({ trueAirspeedKt, pressureAltitudeFt, oatCelsius }) => {
      const calibratedAirspeedKt = airspeed.calibratedAirspeedFromTrueAirspeed(
        trueAirspeedKt,
        pressureAltitudeFt,
        oatCelsius,
      );
      return {
        content: [{ type: 'text', text: `${calibratedAirspeedKt.toFixed(1)} kt CAS` }],
        structuredContent: { calibratedAirspeedKt },
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Wind
  // ---------------------------------------------------------------------------

  server.registerTool(
    'solve_wind_triangle',
    {
      title: 'Solve the wind triangle for heading and groundspeed',
      description:
        'Solves the forward wind triangle: given true airspeed, true course, wind direction (FROM, true), and wind speed, computes the true heading to fly, the wind correction angle (positive = crab right), and the resulting groundspeed.',
      inputSchema: {
        trueAirspeedKt: z.number().positive().describe('True airspeed in knots.'),
        trueCourseDeg: z
          .number()
          .min(0)
          .max(360)
          .describe('Desired ground track (true course) in degrees true (0-360).'),
        windDirectionDeg: z
          .number()
          .min(0)
          .max(360)
          .describe('Direction the wind is blowing FROM in degrees true (0-360).'),
        windSpeedKt: z.number().min(0).describe('Wind speed in knots.'),
      },
    },
    ({ trueAirspeedKt, trueCourseDeg, windDirectionDeg, windSpeedKt }) => {
      const { trueHeadingDeg, windCorrectionAngleDeg, groundSpeedKt } = wind.solveWindTriangle(
        trueAirspeedKt,
        trueCourseDeg,
        windDirectionDeg,
        windSpeedKt,
      );
      return {
        content: [
          {
            type: 'text',
            text: `Heading ${trueHeadingDeg.toFixed(1)} deg true, WCA ${windCorrectionAngleDeg.toFixed(1)} deg, GS ${groundSpeedKt.toFixed(1)} kt`,
          },
        ],
        structuredContent: { trueHeadingDeg, windCorrectionAngleDeg, groundSpeedKt },
      };
    },
  );

  server.registerTool(
    'compute_headwind_crosswind',
    {
      title: 'Resolve wind into headwind and crosswind components',
      description:
        'Resolves a wind into headwind (positive = headwind, negative = tailwind) and crosswind (positive = right, negative = left) components relative to a heading or runway orientation.',
      inputSchema: {
        windDirectionDeg: z
          .number()
          .min(0)
          .max(360)
          .describe('Direction the wind is blowing FROM in degrees true (0-360).'),
        windSpeedKt: z.number().min(0).describe('Wind speed in knots.'),
        headingDeg: z
          .number()
          .min(0)
          .max(360)
          .describe('Aircraft or runway heading in degrees (0-360).'),
      },
    },
    ({ windDirectionDeg, windSpeedKt, headingDeg }) => {
      const { headwindKt, crosswindKt } = wind.headwindCrosswind(
        windDirectionDeg,
        windSpeedKt,
        headingDeg,
      );
      return {
        content: [
          {
            type: 'text',
            text: `Headwind ${headwindKt.toFixed(1)} kt, crosswind ${crosswindKt.toFixed(1)} kt`,
          },
        ],
        structuredContent: { headwindKt, crosswindKt },
      };
    },
  );

  server.registerTool(
    'find_wind_from_track',
    {
      title: 'Derive wind from observed ground track',
      description:
        'Reverse wind triangle: given the observed groundspeed, true airspeed, true heading, and true ground track, computes the wind direction (FROM) and speed that explains the difference.',
      inputSchema: {
        groundSpeedKt: z.number().positive().describe('Observed groundspeed in knots.'),
        trueAirspeedKt: z.number().positive().describe('True airspeed in knots.'),
        trueHeadingDeg: z.number().min(0).max(360).describe('True heading in degrees (0-360).'),
        trueTrackDeg: z.number().min(0).max(360).describe('True ground track in degrees (0-360).'),
      },
    },
    ({ groundSpeedKt, trueAirspeedKt, trueHeadingDeg, trueTrackDeg }) => {
      const { directionDeg, speedKt } = wind.findWind(
        groundSpeedKt,
        trueAirspeedKt,
        trueHeadingDeg,
        trueTrackDeg,
      );
      return {
        content: [
          {
            type: 'text',
            text: `Wind from ${directionDeg.toFixed(0)} deg at ${speedKt.toFixed(1)} kt`,
          },
        ],
        structuredContent: { directionDeg, speedKt },
      };
    },
  );

  server.registerTool(
    'compute_crosswind_component',
    {
      title: 'Compute absolute crosswind component for a runway',
      description:
        "Returns the absolute crosswind component in knots for comparison against an aircraft's maximum demonstrated crosswind limit.",
      inputSchema: {
        windDirectionDeg: z
          .number()
          .min(0)
          .max(360)
          .describe('Direction the wind is blowing FROM in degrees true (0-360).'),
        windSpeedKt: z.number().min(0).describe('Wind speed in knots.'),
        runwayHeadingDeg: z.number().min(0).max(360).describe('Runway heading in degrees (0-360).'),
      },
    },
    ({ windDirectionDeg, windSpeedKt, runwayHeadingDeg }) => {
      const crosswindKt = wind.crosswindComponent(windDirectionDeg, windSpeedKt, runwayHeadingDeg);
      return {
        content: [{ type: 'text', text: `${crosswindKt.toFixed(1)} kt` }],
        structuredContent: { crosswindKt },
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Descent / climb planning
  // ---------------------------------------------------------------------------

  server.registerTool(
    'compute_top_of_descent_distance',
    {
      title: 'Compute top-of-descent distance from glidepath angle',
      description:
        'Computes the horizontal distance from the target at which to begin a descent given a desired flight-path angle (e.g. 3 degrees for a standard ILS glidepath).',
      inputSchema: {
        currentAltitudeFt: z.number().describe('Current altitude in feet MSL.'),
        targetAltitudeFt: z.number().describe('Target altitude in feet MSL.'),
        descentAngleDeg: z.number().positive().describe('Desired descent angle in degrees.'),
      },
    },
    ({ currentAltitudeFt, targetAltitudeFt, descentAngleDeg }) => {
      const distanceNm = descent.topOfDescent(currentAltitudeFt, targetAltitudeFt, descentAngleDeg);
      return {
        content: [{ type: 'text', text: `${distanceNm.toFixed(1)} nm` }],
        structuredContent: { distanceNm },
      };
    },
  );

  server.registerTool(
    'compute_top_of_descent_distance_from_rate',
    {
      title: 'Compute top-of-descent distance from descent rate',
      description:
        'Computes the horizontal distance from the target at which to begin a descent given a desired descent rate (feet per minute) and groundspeed.',
      inputSchema: {
        currentAltitudeFt: z.number().describe('Current altitude in feet MSL.'),
        targetAltitudeFt: z.number().describe('Target altitude in feet MSL.'),
        descentRateFtPerMin: z
          .number()
          .positive()
          .describe('Desired descent rate in feet per minute.'),
        groundSpeedKt: z.number().positive().describe('Groundspeed in knots.'),
      },
    },
    ({ currentAltitudeFt, targetAltitudeFt, descentRateFtPerMin, groundSpeedKt }) => {
      const distanceNm = descent.topOfDescentFromRate(
        currentAltitudeFt,
        targetAltitudeFt,
        descentRateFtPerMin,
        groundSpeedKt,
      );
      return {
        content: [{ type: 'text', text: `${distanceNm.toFixed(1)} nm` }],
        structuredContent: { distanceNm },
      };
    },
  );

  server.registerTool(
    'compute_required_descent_rate',
    {
      title: 'Compute required descent rate',
      description:
        'Computes the descent rate (feet per minute) required to lose a given amount of altitude over a given distance at a given groundspeed.',
      inputSchema: {
        distanceNm: z.number().positive().describe('Distance to the target in nautical miles.'),
        currentAltitudeFt: z.number().describe('Current altitude in feet MSL.'),
        targetAltitudeFt: z.number().describe('Target altitude in feet MSL.'),
        groundSpeedKt: z.number().positive().describe('Groundspeed in knots.'),
      },
    },
    ({ distanceNm, currentAltitudeFt, targetAltitudeFt, groundSpeedKt }) => {
      const descentRateFtPerMin = descent.requiredDescentRate(
        distanceNm,
        currentAltitudeFt,
        targetAltitudeFt,
        groundSpeedKt,
      );
      return {
        content: [{ type: 'text', text: `${descentRateFtPerMin.toFixed(0)} ft/min` }],
        structuredContent: { descentRateFtPerMin },
      };
    },
  );

  server.registerTool(
    'compute_required_climb_rate',
    {
      title: 'Compute required climb rate',
      description:
        'Computes the climb rate (feet per minute) required to gain a given amount of altitude over a given distance at a given groundspeed.',
      inputSchema: {
        distanceNm: z
          .number()
          .positive()
          .describe('Distance available for climb in nautical miles.'),
        currentAltitudeFt: z.number().describe('Current altitude in feet MSL.'),
        targetAltitudeFt: z.number().describe('Target altitude in feet MSL.'),
        groundSpeedKt: z.number().positive().describe('Groundspeed in knots.'),
      },
    },
    ({ distanceNm, currentAltitudeFt, targetAltitudeFt, groundSpeedKt }) => {
      const climbRateFtPerMin = descent.requiredClimbRate(
        distanceNm,
        currentAltitudeFt,
        targetAltitudeFt,
        groundSpeedKt,
      );
      return {
        content: [{ type: 'text', text: `${climbRateFtPerMin.toFixed(0)} ft/min` }],
        structuredContent: { climbRateFtPerMin },
      };
    },
  );

  server.registerTool(
    'compute_visual_descent_point',
    {
      title: 'Compute Visual Descent Point distance',
      description:
        'Computes the Visual Descent Point (VDP) distance from the runway threshold for a non-precision approach, given a desired glidepath angle (typically 3.0 degrees) and threshold-crossing height in feet.',
      inputSchema: {
        glidepathAngleDeg: z
          .number()
          .positive()
          .describe('Desired glidepath angle in degrees (typically 3.0).'),
        thresholdCrossingHeightFt: z
          .number()
          .positive()
          .describe('Height above the threshold at the VDP start (feet AGL).'),
      },
    },
    ({ glidepathAngleDeg, thresholdCrossingHeightFt }) => {
      const distanceNm = descent.visualDescentPoint(glidepathAngleDeg, thresholdCrossingHeightFt);
      return {
        content: [{ type: 'text', text: `${distanceNm.toFixed(2)} nm` }],
        structuredContent: { distanceNm },
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  server.registerTool(
    'recommend_holding_pattern_entry',
    {
      title: 'Recommend a holding pattern entry',
      description:
        "Recommends the holding pattern entry type (direct, teardrop, or parallel) per the AIM 5-3-8 sectors, given the inbound course to the holding fix and the aircraft's heading or bearing to the fix. Defaults to right-turn holds; pass rightTurns=false for a left-turn hold.",
      inputSchema: {
        inboundCourseDeg: z
          .number()
          .min(0)
          .max(360)
          .describe('Inbound course to the holding fix in degrees (0-360).'),
        headingToFixDeg: z
          .number()
          .min(0)
          .max(360)
          .describe('Aircraft heading or bearing to the fix in degrees (0-360).'),
        rightTurns: z
          .boolean()
          .optional()
          .describe('True for a right-turn hold (default), false for left-turn.'),
      },
    },
    ({ inboundCourseDeg, headingToFixDeg, rightTurns }) => {
      const entryType = navigation.holdingPatternEntry(
        inboundCourseDeg,
        headingToFixDeg,
        rightTurns,
      );
      return {
        content: [{ type: 'text', text: entryType }],
        structuredContent: { entryType },
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Turn dynamics
  // ---------------------------------------------------------------------------

  server.registerTool(
    'compute_standard_rate_bank_angle',
    {
      title: 'Compute standard-rate bank angle',
      description:
        'Computes the bank angle (degrees) required for a standard rate turn (3 degrees per second) at a given true airspeed.',
      inputSchema: {
        trueAirspeedKt: z.number().positive().describe('True airspeed in knots.'),
      },
    },
    ({ trueAirspeedKt }) => {
      const bankAngleDeg = turn.standardRateBankAngle(trueAirspeedKt);
      return {
        content: [{ type: 'text', text: `${bankAngleDeg.toFixed(1)} deg` }],
        structuredContent: { bankAngleDeg },
      };
    },
  );

  server.registerTool(
    'compute_turn_radius',
    {
      title: 'Compute turn radius',
      description:
        'Computes the turn radius in nautical miles for a coordinated turn at a given true airspeed and bank angle.',
      inputSchema: {
        trueAirspeedKt: z.number().positive().describe('True airspeed in knots.'),
        bankAngleDeg: z.number().positive().max(89).describe('Bank angle in degrees.'),
      },
    },
    ({ trueAirspeedKt, bankAngleDeg }) => {
      const turnRadiusNm = turn.turnRadius(trueAirspeedKt, bankAngleDeg);
      return {
        content: [{ type: 'text', text: `${turnRadiusNm.toFixed(2)} nm` }],
        structuredContent: { turnRadiusNm },
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Glide
  // ---------------------------------------------------------------------------

  server.registerTool(
    'compute_glide_distance_with_wind',
    {
      title: 'Compute glide distance with wind correction',
      description:
        'Computes the maximum glide distance (nautical miles) from a given altitude AGL and glide ratio, scaled by the ratio of groundspeed to true airspeed during the glide. A positive headwind reduces the result; a negative value (tailwind) extends it.',
      inputSchema: {
        altitudeAglFt: z.number().positive().describe('Altitude above ground level in feet.'),
        glideRatio: z.number().positive().describe('Aircraft glide ratio (e.g. 10 for 10:1).'),
        bestGlideTasKt: z
          .number()
          .positive()
          .describe('True airspeed at best glide speed in knots.'),
        headwindKt: z
          .number()
          .describe('Headwind component in knots (positive = headwind, negative = tailwind).'),
      },
    },
    ({ altitudeAglFt, glideRatio, bestGlideTasKt, headwindKt }) => {
      const glideDistanceNm = glide.glideDistanceWithWind(
        altitudeAglFt,
        glideRatio,
        bestGlideTasKt,
        headwindKt,
      );
      return {
        content: [{ type: 'text', text: `${glideDistanceNm.toFixed(1)} nm` }],
        structuredContent: { glideDistanceNm },
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Solar (sunrise/sunset and day/night)
  // ---------------------------------------------------------------------------

  server.registerTool(
    'compute_solar_times',
    {
      title: 'Compute sunrise, sunset, and civil twilight times',
      description:
        'Computes sunrise, sunset, and civil twilight times in UTC for a given geographic position and date. Uses the NOAA solar algorithm; accurate to within roughly one minute for dates between 1901 and 2099. In polar regions, missing events are omitted from the result.',
      inputSchema: {
        lat: latFragment,
        lon: lonFragment,
        dateUtc: isoDateFragment,
      },
    },
    ({ lat, lon, dateUtc }) => {
      let date: Date;
      try {
        date = parseIsoDate(dateUtc);
      } catch (err) {
        const message = extractErrorMessage(err);
        return {
          content: [{ type: 'text', text: message }],
          structuredContent: { times: null },
          isError: true,
        };
      }
      const times = solar.computeSolarTimes(lat, lon, date);
      const payload = {
        sunrise: times.sunrise?.toISOString() ?? null,
        sunset: times.sunset?.toISOString() ?? null,
        civilTwilightBegin: times.civilTwilightBegin?.toISOString() ?? null,
        civilTwilightEnd: times.civilTwilightEnd?.toISOString() ?? null,
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: { times: payload },
      };
    },
  );

  server.registerTool(
    'is_daytime',
    {
      title: 'Determine whether a UTC instant is daytime per FAR 1.1',
      description:
        'Returns true if the given UTC instant at the given position falls within civil twilight (the FAR 1.1 definition of daytime: between the beginning of morning civil twilight and the end of evening civil twilight). In polar regions where civil twilight does not occur, returns true if the sun is continuously above the civil twilight angle for the day, false otherwise.',
      inputSchema: {
        lat: latFragment,
        lon: lonFragment,
        dateTimeUtc: isoDateFragment,
      },
    },
    ({ lat, lon, dateTimeUtc }) => {
      let date: Date;
      try {
        date = parseIsoDate(dateTimeUtc);
      } catch (err) {
        const message = extractErrorMessage(err);
        return {
          content: [{ type: 'text', text: message }],
          structuredContent: { isDaytime: null },
          isError: true,
        };
      }
      const result = solar.isDaytime(lat, lon, date);
      return {
        content: [{ type: 'text', text: result ? 'daytime' : 'nighttime' }],
        structuredContent: { isDaytime: result },
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Magnetic (WMM2025)
  // ---------------------------------------------------------------------------

  server.registerTool(
    'compute_magnetic_declination',
    {
      title: 'Compute magnetic declination (WMM2025)',
      description:
        'Computes magnetic declination (the angle between true and magnetic north) at a geographic position using the World Magnetic Model 2025. Positive values mean magnetic north is east of true north; negative means west. The model is valid from 2025.0 through 2030.0.',
      inputSchema: {
        lat: latFragment,
        lon: lonFragment,
        altitudeFt: z.number().optional().describe('Optional altitude in feet MSL (default 0).'),
        dateUtc: z
          .string()
          .optional()
          .describe('Optional ISO 8601 UTC date for the lookup. Defaults to the current date.'),
      },
    },
    ({ lat, lon, altitudeFt, dateUtc }) => {
      const built = buildMagneticOptions(altitudeFt, dateUtc);
      if (!built.ok) {
        return {
          content: [{ type: 'text', text: built.message }],
          structuredContent: { declinationDeg: null },
          isError: true,
        };
      }
      const declinationDeg = magnetic.magneticDeclination(lat, lon, built.options);
      return {
        content: [{ type: 'text', text: `${declinationDeg.toFixed(2)} deg` }],
        structuredContent: { declinationDeg },
      };
    },
  );

  server.registerTool(
    'convert_true_to_magnetic_bearing',
    {
      title: 'Convert true bearing to magnetic',
      description:
        'Converts a true bearing or heading to magnetic by subtracting the WMM2025 magnetic declination at the given position. The result is normalized to [0, 360).',
      inputSchema: {
        trueBearingDeg: z.number().describe('True bearing or heading in degrees.'),
        lat: latFragment,
        lon: lonFragment,
        altitudeFt: z.number().optional().describe('Optional altitude in feet MSL (default 0).'),
        dateUtc: z
          .string()
          .optional()
          .describe('Optional ISO 8601 UTC date for the lookup. Defaults to the current date.'),
      },
    },
    ({ trueBearingDeg, lat, lon, altitudeFt, dateUtc }) => {
      const built = buildMagneticOptions(altitudeFt, dateUtc);
      if (!built.ok) {
        return {
          content: [{ type: 'text', text: built.message }],
          structuredContent: { magneticBearingDeg: null },
          isError: true,
        };
      }
      const magneticBearingDeg = magnetic.trueToMagnetic(trueBearingDeg, lat, lon, built.options);
      return {
        content: [{ type: 'text', text: `${magneticBearingDeg.toFixed(1)} deg magnetic` }],
        structuredContent: { magneticBearingDeg },
      };
    },
  );

  server.registerTool(
    'convert_magnetic_to_true_bearing',
    {
      title: 'Convert magnetic bearing to true',
      description:
        'Converts a magnetic bearing or heading to true by adding the WMM2025 magnetic declination at the given position. The result is normalized to [0, 360).',
      inputSchema: {
        magneticBearingDeg: z.number().describe('Magnetic bearing or heading in degrees.'),
        lat: latFragment,
        lon: lonFragment,
        altitudeFt: z.number().optional().describe('Optional altitude in feet MSL (default 0).'),
        dateUtc: z
          .string()
          .optional()
          .describe('Optional ISO 8601 UTC date for the lookup. Defaults to the current date.'),
      },
    },
    ({ magneticBearingDeg, lat, lon, altitudeFt, dateUtc }) => {
      const built = buildMagneticOptions(altitudeFt, dateUtc);
      if (!built.ok) {
        return {
          content: [{ type: 'text', text: built.message }],
          structuredContent: { trueBearingDeg: null },
          isError: true,
        };
      }
      const trueBearingDeg = magnetic.magneticToTrue(magneticBearingDeg, lat, lon, built.options);
      return {
        content: [{ type: 'text', text: `${trueBearingDeg.toFixed(1)} deg true` }],
        structuredContent: { trueBearingDeg },
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Planning (fuel, PNR, ETP)
  // ---------------------------------------------------------------------------

  server.registerTool(
    'compute_fuel_required',
    {
      title: 'Compute fuel required for a leg',
      description:
        'Computes the fuel required for a flight leg given distance, groundspeed, and fuel burn rate. The result is in the same unit as fuelBurnPerHr (gallons, liters, pounds, etc.) - the function is unit-agnostic for fuel quantity.',
      inputSchema: {
        distanceNm: z.number().positive().describe('Leg distance in nautical miles.'),
        groundSpeedKt: z.number().positive().describe('Groundspeed in knots.'),
        fuelBurnPerHr: z
          .number()
          .positive()
          .describe('Fuel burn rate per hour (any consistent unit: gph, lph, pph, etc.).'),
      },
    },
    ({ distanceNm, groundSpeedKt, fuelBurnPerHr }) => {
      const fuelRequired = planning.fuelRequired(distanceNm, groundSpeedKt, fuelBurnPerHr);
      return {
        content: [{ type: 'text', text: fuelRequired.toFixed(2) }],
        structuredContent: { fuelRequired },
      };
    },
  );

  server.registerTool(
    'compute_point_of_no_return',
    {
      title: 'Compute point of no return (PNR)',
      description:
        'Computes the point of no return: the farthest distance from departure beyond which the aircraft cannot return with the fuel remaining. Accepts separate outbound and return groundspeeds so the consumer can account for wind. Fuel quantity units are arbitrary as long as fuelAvailable and fuelBurnPerHr share the same unit.',
      inputSchema: {
        fuelAvailable: z.number().positive().describe('Fuel on board (any consistent unit).'),
        fuelBurnPerHr: z
          .number()
          .positive()
          .describe('Fuel burn rate per hour (same unit as fuelAvailable).'),
        groundSpeedOutKt: z.number().positive().describe('Outbound groundspeed in knots.'),
        groundSpeedBackKt: z.number().positive().describe('Return groundspeed in knots.'),
      },
    },
    ({ fuelAvailable, fuelBurnPerHr, groundSpeedOutKt, groundSpeedBackKt }) => {
      const { distanceNm, timeHrs } = planning.pointOfNoReturn(
        fuelAvailable,
        fuelBurnPerHr,
        groundSpeedOutKt,
        groundSpeedBackKt,
      );
      return {
        content: [
          {
            type: 'text',
            text: `${distanceNm.toFixed(1)} nm at ${timeHrs.toFixed(2)} hrs`,
          },
        ],
        structuredContent: { distanceNm, timeHrs },
      };
    },
  );

  server.registerTool(
    'compute_equal_time_point',
    {
      title: 'Compute equal-time point (ETP)',
      description:
        'Computes the equal-time point: the point along a route where it takes the same time to continue to the destination as to return to the departure point. Accepts separate continuing and returning groundspeeds so the consumer can account for wind.',
      inputSchema: {
        totalDistanceNm: z.number().positive().describe('Total route distance in nautical miles.'),
        groundSpeedOutKt: z
          .number()
          .positive()
          .describe('Groundspeed continuing toward the destination in knots.'),
        groundSpeedBackKt: z
          .number()
          .positive()
          .describe('Groundspeed returning toward the departure in knots.'),
      },
    },
    ({ totalDistanceNm, groundSpeedOutKt, groundSpeedBackKt }) => {
      const { distanceNm, timeHrs } = planning.equalTimePoint(
        totalDistanceNm,
        groundSpeedOutKt,
        groundSpeedBackKt,
      );
      return {
        content: [
          {
            type: 'text',
            text: `${distanceNm.toFixed(1)} nm at ${timeHrs.toFixed(2)} hrs`,
          },
        ],
        structuredContent: { distanceNm, timeHrs },
      };
    },
  );
}
