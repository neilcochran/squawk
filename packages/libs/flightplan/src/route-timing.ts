/**
 * Wind-corrected route timing for parsed flight plan routes. Layers per-leg
 * wind triangle solutions over the great-circle legs produced by the
 * `route-distance` module: each leg's true course drives a heading, wind
 * correction angle, and ground speed, which in turn yield estimated time
 * enroute and optional fuel burn.
 *
 * Winds are supplied by the caller through a {@link WindProvider}, keeping this
 * module independent of any particular weather source. A `@squawk/weather`
 * winds-aloft forecast sampled at a chosen cruise altitude is one way to
 * satisfy the provider.
 */

import { planning, wind } from '@squawk/flight-math';
import type { WindVector } from '@squawk/flight-math';
import { greatCircle } from '@squawk/geo';

import type { ParsedRoute, RouteElement } from './resolver.js';
import { computeRouteDistance } from './route-distance.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Resolves the wind at a geographic point for route timing. Returns the wind
 * vector to apply, or `undefined` when no wind data is available (or the wind
 * is light and variable), in which case the leg is timed as if calm.
 *
 * The provider takes only a position; bake the sampling altitude into the
 * closure so this module stays altitude-agnostic.
 *
 * @param lat - Latitude of the sample point in decimal degrees, positive north.
 * @param lon - Longitude of the sample point in decimal degrees, positive east.
 * @returns The wind vector to apply at the point, or `undefined` for calm.
 */
export type WindProvider = (lat: number, lon: number) => WindVector | undefined;

/**
 * Options controlling a {@link computeRouteTiming} computation.
 */
export interface RouteTimingOptions {
  /** True airspeed in knots flown on every leg. */
  trueAirspeedKt: number;
  /**
   * Supplies the wind at each leg's midpoint. Omit to time every leg as calm
   * (ground speed equals true airspeed).
   */
  windProvider?: WindProvider;
  /**
   * Fuel burn rate per hour (any consistent unit). When provided, per-leg and
   * total fuel are computed; the result fuel fields stay `undefined` otherwise.
   */
  fuelBurnPerHr?: number;
  /**
   * Fuel on board (same unit as `fuelBurnPerHr`). When provided together with
   * `fuelBurnPerHr`, the result reports endurance and whether fuel is
   * sufficient for the total estimated time enroute.
   */
  fuelAvailable?: number;
}

/**
 * A single route leg with its wind-corrected timing solution.
 */
export interface RouteTimingLeg {
  /** Identifier or raw token of the starting point. */
  from: string;
  /** Identifier or raw token of the ending point. */
  to: string;
  /** Latitude of the starting point in decimal degrees, positive north. */
  fromLat: number;
  /** Longitude of the starting point in decimal degrees, positive east. */
  fromLon: number;
  /** Latitude of the ending point in decimal degrees, positive north. */
  toLat: number;
  /** Longitude of the ending point in decimal degrees, positive east. */
  toLon: number;
  /** Great-circle distance of this leg in nautical miles. */
  distanceNm: number;
  /** Cumulative distance from the route start through the end of this leg in nautical miles. */
  cumulativeDistanceNm: number;
  /** Initial great-circle true course for the leg in degrees (0-360). */
  trueCourseDeg: number;
  /** True heading to fly to hold the course given the wind, in degrees (0-360). */
  trueHeadingDeg: number;
  /** Wind correction angle in degrees. Positive means crab right, negative means crab left. */
  windCorrectionAngleDeg: number;
  /** Ground speed in knots after wind correction. */
  groundSpeedKt: number;
  /** Wind applied to the leg, or `undefined` when the leg was timed as calm. */
  wind: WindVector | undefined;
  /** Estimated time enroute for the leg in hours, or `undefined` if ground speed is not positive. */
  eteHrs: number | undefined;
  /**
   * Cumulative estimated time enroute from the route start through this leg in
   * hours. `undefined` once any preceding leg could not be timed.
   */
  cumulativeEteHrs: number | undefined;
  /**
   * Fuel required for the leg (same unit as `fuelBurnPerHr`), or `undefined`
   * when no burn rate was given or the leg could not be timed.
   */
  fuelRequired: number | undefined;
}

/**
 * Result of computing wind-corrected timing across a parsed flight plan route.
 */
export interface RouteTimingResult {
  /** Ordered legs with their wind-corrected timing. */
  legs: RouteTimingLeg[];
  /** Total great-circle route distance in nautical miles. */
  totalDistanceNm: number;
  /**
   * Total estimated time enroute in hours, or `undefined` if any leg could not
   * be timed (ground speed not positive).
   */
  totalEteHrs: number | undefined;
  /**
   * Total fuel required across all legs (same unit as `fuelBurnPerHr`), or
   * `undefined` when no burn rate was given or any leg could not be timed.
   */
  totalFuelRequired: number | undefined;
  /**
   * Endurance in hours from `fuelAvailable` and `fuelBurnPerHr`, or `undefined`
   * when either input was omitted.
   */
  enduranceHrs: number | undefined;
  /**
   * Whether endurance covers the total estimated time enroute, or `undefined`
   * when endurance or total ETE could not be computed.
   */
  fuelSufficient: boolean | undefined;
  /**
   * Route elements of type `unresolved` that could not contribute coordinates,
   * passed through from the distance computation.
   */
  unresolvedElements: RouteElement[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Computes wind-corrected per-leg timing for a parsed flight plan route.
 *
 * Reuses {@link computeRouteDistance} for the leg geometry, then for each leg
 * derives the initial true course, samples the wind at the leg midpoint via the
 * optional {@link WindProvider}, and solves the wind triangle for heading, wind
 * correction angle, and ground speed. Estimated time enroute is leg distance
 * divided by ground speed, and fuel (when a burn rate is given) follows from
 * the same ground speed.
 *
 * When the provider returns `undefined` for a leg, that leg is timed as calm:
 * heading equals course, wind correction angle is zero, and ground speed equals
 * true airspeed.
 *
 * Ground speed comes from {@link solveWindTriangle} as a magnitude, so it is
 * never negative. A leg is left untimed (`eteHrs` `undefined`) only when ground
 * speed is not positive, which occurs at the boundary where a pure headwind
 * equals true airspeed. A headwind exceeding true airspeed still yields a
 * positive magnitude and inherits the clamping behavior documented on
 * {@link solveWindTriangle}; such legs are not separately flagged here. A single
 * untimed leg makes `totalEteHrs` (and `totalFuelRequired`, when fuel is
 * requested) `undefined`.
 *
 * ```typescript
 * import { createFlightplanResolver, computeRouteTiming } from '@squawk/flightplan';
 *
 * const resolver = createFlightplanResolver({ airports, navaids, fixes, airways });
 * const route = resolver.parse('KJFK DCT MERIT J60 MARTN DCT KLAX');
 * const result = computeRouteTiming(route, {
 *   trueAirspeedKt: 450,
 *   windProvider: (lat, lon) => ({ directionDeg: 270, speedKt: 80 }),
 *   fuelBurnPerHr: 600,
 * });
 * console.log(result.totalEteHrs, result.totalFuelRequired);
 * ```
 *
 * @param route - A parsed route from {@link FlightplanResolver.parse}.
 * @param options - True airspeed, optional wind provider, and optional fuel inputs.
 * @returns Per-leg wind-corrected timing with route totals.
 */
export function computeRouteTiming(
  route: ParsedRoute,
  options: RouteTimingOptions,
): RouteTimingResult {
  const { trueAirspeedKt, windProvider, fuelBurnPerHr, fuelAvailable } = options;
  const { legs: distanceLegs, totalDistanceNm, unresolvedElements } = computeRouteDistance(route);

  const legs: RouteTimingLeg[] = [];
  let cumulativeEteHrs: number | undefined = 0;
  let totalFuelRequired: number | undefined = fuelBurnPerHr !== undefined ? 0 : undefined;

  for (const leg of distanceLegs) {
    const trueCourseDeg = greatCircle.bearing(leg.fromLat, leg.fromLon, leg.toLat, leg.toLon);
    const mid = greatCircle.midpoint(leg.fromLat, leg.fromLon, leg.toLat, leg.toLon);
    const legWind = windProvider?.(mid.lat, mid.lon);

    const triangle =
      legWind !== undefined
        ? wind.solveWindTriangle(
            trueAirspeedKt,
            trueCourseDeg,
            legWind.directionDeg,
            legWind.speedKt,
          )
        : {
            trueHeadingDeg: trueCourseDeg,
            windCorrectionAngleDeg: 0,
            groundSpeedKt: trueAirspeedKt,
          };

    const eteHrs = triangle.groundSpeedKt > 0 ? leg.distanceNm / triangle.groundSpeedKt : undefined;

    if (eteHrs === undefined || cumulativeEteHrs === undefined) {
      cumulativeEteHrs = undefined;
    } else {
      cumulativeEteHrs += eteHrs;
    }

    const fuelRequired =
      fuelBurnPerHr !== undefined && eteHrs !== undefined
        ? planning.fuelRequired(leg.distanceNm, triangle.groundSpeedKt, fuelBurnPerHr)
        : undefined;

    if (fuelBurnPerHr !== undefined) {
      if (fuelRequired === undefined || totalFuelRequired === undefined) {
        totalFuelRequired = undefined;
      } else {
        totalFuelRequired += fuelRequired;
      }
    }

    legs.push({
      from: leg.from,
      to: leg.to,
      fromLat: leg.fromLat,
      fromLon: leg.fromLon,
      toLat: leg.toLat,
      toLon: leg.toLon,
      distanceNm: leg.distanceNm,
      cumulativeDistanceNm: leg.cumulativeDistanceNm,
      trueCourseDeg,
      trueHeadingDeg: triangle.trueHeadingDeg,
      windCorrectionAngleDeg: triangle.windCorrectionAngleDeg,
      groundSpeedKt: triangle.groundSpeedKt,
      wind: legWind,
      eteHrs,
      cumulativeEteHrs,
      fuelRequired,
    });
  }

  const totalEteHrs = legs.length > 0 ? legs[legs.length - 1]!.cumulativeEteHrs : 0;

  const enduranceHrs =
    fuelAvailable !== undefined && fuelBurnPerHr !== undefined
      ? planning.endurance(fuelAvailable, fuelBurnPerHr)
      : undefined;
  const fuelSufficient =
    enduranceHrs !== undefined && totalEteHrs !== undefined
      ? enduranceHrs >= totalEteHrs
      : undefined;

  return {
    legs,
    totalDistanceNm,
    totalEteHrs,
    totalFuelRequired,
    enduranceHrs,
    fuelSufficient,
    unresolvedElements,
  };
}
