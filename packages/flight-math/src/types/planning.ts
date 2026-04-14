/**
 * Planning-related type definitions for fuel burn, point-of-no-return,
 * and equal-time-point calculations.
 */

/**
 * A computed point along a route, expressed as both a distance and time
 * from the departure point. Returned by {@link planning.pointOfNoReturn}
 * and {@link planning.equalTimePoint}.
 */
export interface PlanningPoint {
  /** Distance from departure in nautical miles. */
  distanceNm: number;
  /** Time from departure in hours. */
  timeHrs: number;
}
