import type { PolarPoint, ScopeSnapshot, ScopeTarget } from '../../shared/protocol.js';

import { formatHeading, formatTrueBearing } from './position-format.js';
import type { ScopePick } from './selection.js';

/**
 * One end of a range/bearing line: an aircraft, which the end follows as it
 * moves, or a fixed point on the scope, which stays put.
 */
export type MeasureAnchor =
  | {
      /** The end follows an aircraft. */
      kind: 'target';
      /** The aircraft's ICAO hex, resolved against each snapshot. */
      icaoHex: string;
    }
  | {
      /** The end is a fixed point. */
      kind: 'point';
      /** Where it is, relative to the receiver. */
      position: PolarPoint;
    };

/**
 * A range/bearing line as the user builds it: armed and waiting for its first
 * end, holding one end and waiting for the second, or complete.
 */
export type Measurement =
  | {
      /** Armed; the next pick on the scope is the first end. */
      phase: 'awaitingFirst';
    }
  | {
      /** One end taken; the next pick is the second. */
      phase: 'awaitingSecond';
      /** The first end. */
      from: MeasureAnchor;
    }
  | {
      /** Both ends taken. */
      phase: 'complete';
      /** The first end. */
      from: MeasureAnchor;
      /** The second end. */
      to: MeasureAnchor;
    };

/** A range/bearing line resolved to two positions, with what it measures between them. */
export interface MeasuredLine {
  /** The first end. */
  from: PolarPoint;
  /** The second end. */
  to: PolarPoint;
  /** Bearing from the first end to the second, in degrees true, from 0 up to but excluding 360. */
  trueBearingDeg: number;
  /** Distance between the ends in nautical miles. */
  distanceNm: number;
}

/** What the readout says while a range/bearing line is armed and has nothing to measure yet. */
export const MEASURE_PROMPTS: Readonly<Record<'awaitingFirst' | 'awaitingSecond', string>> = {
  awaitingFirst: 'measure: pick the first point',
  awaitingSecond: 'measure: pick the second point',
};

/**
 * Starts a range/bearing line. If an aircraft with a position is selected the
 * line starts from it, as a controller measures from the aircraft under the
 * cursor, and only the far end is waited for; otherwise both ends are.
 *
 * @param selectedTarget - The selected aircraft, if any.
 * @returns The new, armed measurement.
 */
export function startMeasurement(selectedTarget: ScopeTarget | undefined): Measurement {
  if (selectedTarget?.position === undefined) {
    return { phase: 'awaitingFirst' };
  }
  return { phase: 'awaitingSecond', from: { kind: 'target', icaoHex: selectedTarget.icaoHex } };
}

/**
 * Turns a pick on the scope into an end of a line: the aircraft picked, so
 * the end follows it, or else the point where the pick landed.
 *
 * @param pick - What a click or tap on the scope landed on.
 * @returns The anchor.
 */
export function anchorOf(pick: ScopePick): MeasureAnchor {
  return pick.icaoHex === undefined
    ? { kind: 'point', position: pick.position }
    : { kind: 'target', icaoHex: pick.icaoHex };
}

/**
 * Gives an armed measurement its next end. A complete measurement is left
 * as it is: starting another means clearing it first.
 *
 * @param measurement - The measurement so far.
 * @param anchor - The end to add.
 * @returns The measurement with that end taken.
 */
export function anchorMeasurement(measurement: Measurement, anchor: MeasureAnchor): Measurement {
  switch (measurement.phase) {
    case 'awaitingFirst':
      return { phase: 'awaitingSecond', from: anchor };
    case 'awaitingSecond':
      return { phase: 'complete', from: measurement.from, to: anchor };
    case 'complete':
      return measurement;
  }
}

/**
 * Finds where an end of a line is right now.
 *
 * @param anchor - The end.
 * @param snapshot - The most recent snapshot, or undefined before the first one arrives.
 * @returns Its position, or undefined for an aircraft that is not tracked or has no position.
 */
export function resolveAnchor(
  anchor: MeasureAnchor,
  snapshot: ScopeSnapshot | undefined,
): PolarPoint | undefined {
  if (anchor.kind === 'point') {
    return anchor.position;
  }
  return snapshot?.targets.find((target) => target.icaoHex === anchor.icaoHex)?.position;
}

function anchorsOf(measurement: Measurement): MeasureAnchor[] {
  switch (measurement.phase) {
    case 'awaitingFirst':
      return [];
    case 'awaitingSecond':
      return [measurement.from];
    case 'complete':
      return [measurement.from, measurement.to];
  }
}

/**
 * Whether every aircraft a measurement is anchored to is still tracked with a
 * position. A line whose end has gone is dropped, as a selection is, rather
 * than left hanging from an aircraft that is not there. Before the first
 * snapshot nothing is known, so nothing is dropped.
 *
 * @param measurement - The measurement.
 * @param snapshot - The most recent snapshot, or undefined before the first one arrives.
 * @returns True if the measurement can still be drawn.
 */
export function isMeasurementLive(
  measurement: Measurement,
  snapshot: ScopeSnapshot | undefined,
): boolean {
  return (
    snapshot === undefined ||
    anchorsOf(measurement).every((anchor) => resolveAnchor(anchor, snapshot) !== undefined)
  );
}

/**
 * Measures the bearing and distance from one position to another on the
 * scope's own plane - the flat picture the scope draws, as a ruler laid on
 * the screen would - rather than on the earth. The browser carries no
 * geodesy by design, and at the ranges the scope runs at the two differ by
 * well under a percent.
 *
 * @param from - The position measured from.
 * @param to - The position measured to.
 * @returns The bearing from `from` to `to` in degrees true, and the distance in nautical miles.
 */
export function measureBetween(
  from: PolarPoint,
  to: PolarPoint,
): Pick<MeasuredLine, 'trueBearingDeg' | 'distanceNm'> {
  const eastNm =
    to.rangeNm * Math.sin((to.trueBearingDeg * Math.PI) / 180) -
    from.rangeNm * Math.sin((from.trueBearingDeg * Math.PI) / 180);
  const northNm =
    to.rangeNm * Math.cos((to.trueBearingDeg * Math.PI) / 180) -
    from.rangeNm * Math.cos((from.trueBearingDeg * Math.PI) / 180);
  const bearingDeg = (Math.atan2(eastNm, northNm) * 180) / Math.PI;
  return {
    trueBearingDeg: (bearingDeg + 360) % 360,
    distanceNm: Math.hypot(eastNm, northNm),
  };
}

/**
 * Resolves a measurement to the line to draw and read out. A complete line
 * runs between its two ends, wherever they are now; one still waiting for
 * its second end runs from the first end to the pointer, so the readout can
 * be read before the second end is picked. There is nothing to draw before
 * the first end, or while an end cannot be placed.
 *
 * @param measurement - The measurement, if any.
 * @param snapshot - The most recent snapshot, or undefined before the first one arrives.
 * @param cursor - Where the pointer is over the scope, if it is.
 * @returns The line, or undefined if there is none to draw.
 */
export function resolveMeasurement(
  measurement: Measurement | undefined,
  snapshot: ScopeSnapshot | undefined,
  cursor: PolarPoint | undefined,
): MeasuredLine | undefined {
  if (measurement === undefined || measurement.phase === 'awaitingFirst') {
    return undefined;
  }
  const from = resolveAnchor(measurement.from, snapshot);
  const to = measurement.phase === 'complete' ? resolveAnchor(measurement.to, snapshot) : cursor;
  if (from === undefined || to === undefined) {
    return undefined;
  }
  return { from, to, ...measureBetween(from, to) };
}

/**
 * Formats the label drawn beside a line on the scope: bearing and distance,
 * compactly, as a real scope writes them.
 *
 * @param line - The line.
 * @returns The label, e.g. `047/12.3`.
 */
export function formatMeasureLabel(line: MeasuredLine): string {
  return `${formatHeading(line.trueBearingDeg)}/${line.distanceNm.toFixed(1)}`;
}

/**
 * Formats the readout's line about a measurement: what it measures once
 * there is a line, and otherwise what it is waiting for.
 *
 * @param measurement - The measurement, if any.
 * @param line - The measurement resolved to a line, if it could be.
 * @returns The readout text, or undefined when there is no measurement.
 */
export function formatMeasureReadout(
  measurement: Measurement | undefined,
  line: MeasuredLine | undefined,
): string | undefined {
  if (measurement === undefined) {
    return undefined;
  }
  if (line !== undefined) {
    return `measure ${formatTrueBearing(line.trueBearingDeg)}, ${line.distanceNm.toFixed(1)} nm`;
  }
  return measurement.phase === 'complete' ? undefined : MEASURE_PROMPTS[measurement.phase];
}
