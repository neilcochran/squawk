/**
 * Flight planning calculations: fuel burn estimation, endurance, range,
 * point-of-no-return (PNR), and equal-time-point (ETP). Classic E6B
 * computations where the consumer provides ground speed as input.
 */

import type { PlanningPoint } from './types/planning.js';

/**
 * Computes the fuel required for a flight leg given distance, ground speed,
 * and fuel burn rate.
 *
 * The result is in the same unit as `fuelBurnPerHr` (gallons, liters, pounds,
 * etc.) - the function is unit-agnostic for fuel quantity.
 *
 * @param distanceNm - Leg distance in nautical miles.
 * @param groundSpeedKt - Ground speed in knots.
 * @param fuelBurnPerHr - Fuel burn rate per hour (in any consistent unit).
 * @returns Fuel required for the leg (same unit as `fuelBurnPerHr`).
 */
export function fuelRequired(
  distanceNm: number,
  groundSpeedKt: number,
  fuelBurnPerHr: number,
): number {
  const timeHrs = distanceNm / groundSpeedKt;
  return timeHrs * fuelBurnPerHr;
}

/**
 * Computes the endurance (time aloft) given available fuel and burn rate.
 *
 * @param fuelAvailable - Fuel on board (in any consistent unit).
 * @param fuelBurnPerHr - Fuel burn rate per hour (same unit as `fuelAvailable`).
 * @returns Endurance in hours.
 */
export function endurance(fuelAvailable: number, fuelBurnPerHr: number): number {
  return fuelAvailable / fuelBurnPerHr;
}

/**
 * Computes the maximum distance the aircraft can fly on available fuel at a
 * given ground speed and burn rate.
 *
 * @param fuelAvailable - Fuel on board (in any consistent unit).
 * @param fuelBurnPerHr - Fuel burn rate per hour (same unit as `fuelAvailable`).
 * @param groundSpeedKt - Ground speed in knots.
 * @returns Maximum range in nautical miles.
 */
export function enduranceDistanceNm(
  fuelAvailable: number,
  fuelBurnPerHr: number,
  groundSpeedKt: number,
): number {
  return endurance(fuelAvailable, fuelBurnPerHr) * groundSpeedKt;
}

/**
 * Computes the point of no return (PNR), also called the point of safe return
 * (PSR). This is the farthest distance from departure beyond which the aircraft
 * cannot return to the departure point with the fuel remaining.
 *
 * Two separate ground speed parameters allow the consumer to account for wind:
 * outbound ground speed may differ from the return ground speed due to
 * headwind/tailwind components.
 *
 * @param fuelAvailable - Fuel on board (in any consistent unit).
 * @param fuelBurnPerHr - Fuel burn rate per hour (same unit as `fuelAvailable`).
 * @param groundSpeedOutKt - Ground speed on the outbound leg in knots.
 * @param groundSpeedBackKt - Ground speed on the return leg in knots.
 * @returns The PNR as a {@link PlanningPoint} (distance and time from departure).
 */
export function pointOfNoReturn(
  fuelAvailable: number,
  fuelBurnPerHr: number,
  groundSpeedOutKt: number,
  groundSpeedBackKt: number,
): PlanningPoint {
  const enduranceHrs = endurance(fuelAvailable, fuelBurnPerHr);
  const distanceNm =
    enduranceHrs *
    ((groundSpeedOutKt * groundSpeedBackKt) / (groundSpeedOutKt + groundSpeedBackKt));
  const timeHrs = distanceNm / groundSpeedOutKt;
  return { distanceNm, timeHrs };
}

/**
 * Computes the equal-time-point (ETP), also called the critical point (CP).
 * This is the point along a route where it takes the same time to continue to
 * the destination as it does to return to the departure point.
 *
 * Two separate ground speed parameters allow the consumer to account for wind:
 * the ground speed continuing to the destination may differ from the return
 * ground speed.
 *
 * @param totalDistanceNm - Total route distance in nautical miles.
 * @param groundSpeedOutKt - Ground speed continuing toward the destination in knots.
 * @param groundSpeedBackKt - Ground speed returning toward the departure in knots.
 * @returns The ETP as a {@link PlanningPoint} (distance and time from departure).
 */
export function equalTimePoint(
  totalDistanceNm: number,
  groundSpeedOutKt: number,
  groundSpeedBackKt: number,
): PlanningPoint {
  const distanceNm = totalDistanceNm * (groundSpeedBackKt / (groundSpeedOutKt + groundSpeedBackKt));
  const timeHrs = distanceNm / groundSpeedOutKt;
  return { distanceNm, timeHrs };
}
