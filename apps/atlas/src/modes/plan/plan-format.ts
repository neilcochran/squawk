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
