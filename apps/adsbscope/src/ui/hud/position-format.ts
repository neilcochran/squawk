import type { PolarPoint } from '../../shared/protocol.js';
import { formatCompassLabel, FULL_CIRCLE_DEG } from '../scope/furniture.js';

/**
 * Formats a heading or bearing the way the compass rose labels one: rounded
 * to three digits, with north as `360`.
 *
 * @param headingDeg - The heading or bearing in degrees.
 * @returns The three-digit label, e.g. `047`.
 */
export function formatHeading(headingDeg: number): string {
  return formatCompassLabel(Math.round(headingDeg) % FULL_CIRCLE_DEG);
}

/**
 * Formats a bearing in degrees true, saying so, since the scope also shows
 * magnetic headings.
 *
 * @param bearingDeg - The bearing in degrees true.
 * @returns The bearing, e.g. `047 true`.
 */
export function formatTrueBearing(bearingDeg: number): string {
  return `${formatHeading(bearingDeg)} true`;
}

/**
 * Formats a position relative to the receiver as its bearing and range, the
 * way the inspect panel and the pointer readout both write one.
 *
 * @param position - The position.
 * @returns The bearing and range, e.g. `047 true, 12.3 nm`.
 */
export function formatPolarPosition(position: PolarPoint): string {
  return `${formatTrueBearing(position.trueBearingDeg)}, ${position.rangeNm.toFixed(1)} nm`;
}
