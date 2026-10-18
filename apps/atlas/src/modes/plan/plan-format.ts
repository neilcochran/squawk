import type { PlanLegStatus } from './layers/plan-route-features.ts';
import type { PlanRouteIssue } from './plan-route.ts';

/**
 * Pure display formatters for the plan-mode summary panel. Kept in a `.ts`
 * sibling so they unit-test without a render harness.
 */

/**
 * Formats a nautical-mile distance for display, rounded to the nearest whole
 * mile with thousands separators (e.g. `1234.6` -> `"1,235 nm"`).
 */
export function formatDistanceNm(distanceNm: number): string {
  return `${Math.round(distanceNm).toLocaleString('en-US')} nm`;
}

/**
 * Formats an estimated time enroute given in hours as `H:MM` (e.g. `1.5` ->
 * `"1:30"`). Rounds to the nearest minute and rolls a full 60 minutes up into
 * the hour so `0.999` reads as `"1:00"` rather than `"0:60"`.
 */
export function formatEteHrs(eteHrs: number): string {
  const totalMinutes = Math.round(eteHrs * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}

/**
 * One line naming what makes the route invalid as filed:
 * `"J60 is not defined between JOT and DJB"` for a published airway gap,
 * `"J108 from TCS to GINGR is unusable"` for a segment the FAA marks
 * unusable, and `"STAR AALLE4 does not serve the arrival airport KBOS"` (or
 * the departure airport, for a SID) for a procedure filed at an airport it
 * does not serve.
 */
export function formatRouteIssue(issue: PlanRouteIssue): string {
  switch (issue.kind) {
    case 'gap':
      return `${issue.airway} is not defined between ${issue.from} and ${issue.to}`;
    case 'unusable':
      return `${issue.airway} from ${issue.from} to ${issue.to} is unusable`;
    case 'airportMismatch':
      return `${issue.procedureType} ${issue.procedure} does not serve the ${issue.procedureType === 'SID' ? 'departure' : 'arrival'} airport ${issue.airport}`;
  }
}

/**
 * Short tag for a leg in the summary panel's breakdown that makes the route
 * invalid as filed: `"gap"`, `"unusable"`, or `"wrong airport"` for a leg
 * along or into a procedure filed at an airport it does not serve.
 */
export function formatLegStatus(status: Exclude<PlanLegStatus, 'valid'>): string {
  switch (status) {
    case 'gap':
      return 'gap';
    case 'unusable':
      return 'unusable';
    case 'airportMismatch':
      return 'wrong airport';
  }
}

/**
 * Tooltip for a leg's tag in the summary panel's breakdown, saying why the
 * leg makes the route invalid as filed.
 */
export function describeLegStatus(status: Exclude<PlanLegStatus, 'valid'>): string {
  switch (status) {
    case 'gap':
      return 'The airway is not defined between these points: it crosses a published gap.';
    case 'unusable':
      return 'The FAA marks this airway segment unusable.';
    case 'airportMismatch':
      return 'This SID or STAR does not serve the airport it is filed at.';
  }
}
