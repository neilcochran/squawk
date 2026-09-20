import type { PolarPoint } from '../../../shared/protocol.js';
import { FULL_CIRCLE_DEG } from '../../scope/furniture.js';

/** A target's return, painted where the beam crossed it, fading from the moment it was painted. */
export interface Blip {
  /** ICAO hex of the aircraft that produced the return. */
  icaoHex: string;
  /** Where the aircraft was when the beam crossed it. Polar, so the blip re-projects correctly if the range changes while it fades. */
  position: PolarPoint;
  /** Frame time, in ms, at which the blip was painted. */
  paintedAtMs: number;
  /** True if the aircraft was in an emergency when the beam crossed it: the return is drawn bloomed. */
  isEmergency: boolean;
}

/**
 * How long a blip takes to fade to half brightness, as a fraction of the
 * antenna's rotation period. Tying it to the period keeps the look the same
 * at any rotation rate: a target's previous return is still faintly visible
 * when the beam comes round to repaint it.
 */
export const BLIP_HALF_LIFE_ROTATIONS = 0.45;

/** Brightness below which a blip is no longer worth drawing and is dropped. */
export const MIN_BLIP_ALPHA = 0.04;

/**
 * Computes how far the beam turns over an interval. An interval longer than
 * a full rotation (a backgrounded tab resuming, a debugger pause) is capped
 * at one full turn: everything gets painted once, rather than the beam
 * spinning to catch up.
 *
 * @param elapsedMs - Time since the previous frame.
 * @param periodMs - Time the antenna takes to rotate once.
 * @returns Degrees turned, from 0 to a full circle.
 */
export function sweepAdvanceDeg(elapsedMs: number, periodMs: number): number {
  if (elapsedMs <= 0 || periodMs <= 0) {
    return 0;
  }
  return Math.min(FULL_CIRCLE_DEG, (elapsedMs / periodMs) * FULL_CIRCLE_DEG);
}

/**
 * Normalizes an angle into the 0-360 range.
 *
 * @param angleDeg - Any angle in degrees.
 * @returns The equivalent angle in `[0, 360)`.
 */
export function normalizeDeg(angleDeg: number): number {
  return ((angleDeg % FULL_CIRCLE_DEG) + FULL_CIRCLE_DEG) % FULL_CIRCLE_DEG;
}

/**
 * Decides whether the beam crossed a bearing while turning clockwise from
 * `fromDeg` through `advanceDeg`. The start is exclusive and the end
 * inclusive, so consecutive frames never paint the same target twice or skip
 * one that sits exactly on a frame boundary.
 *
 * @param trueBearingDeg - Bearing of the target from the receiver.
 * @param fromDeg - Beam angle at the start of the interval.
 * @param advanceDeg - Degrees the beam turned during the interval.
 * @returns True if the beam swept over the bearing.
 */
export function isBearingSwept(
  trueBearingDeg: number,
  fromDeg: number,
  advanceDeg: number,
): boolean {
  if (advanceDeg <= 0) {
    return false;
  }
  if (advanceDeg >= FULL_CIRCLE_DEG) {
    return true;
  }
  const offsetDeg = normalizeDeg(trueBearingDeg - fromDeg);
  const clockwiseDeg = offsetDeg === 0 ? FULL_CIRCLE_DEG : offsetDeg;
  return clockwiseDeg <= advanceDeg;
}

/**
 * Computes a blip's brightness from its age: an exponential decay with a
 * half-life of {@link BLIP_HALF_LIFE_ROTATIONS} rotations, like the
 * long-persistence phosphor of a PPI tube.
 *
 * Brightness is derived from age every frame rather than by fading the
 * canvas, because repeatedly blending a low-alpha fill into 8-bit pixels
 * never quite reaches black and leaves permanent ghost trails.
 *
 * @param ageMs - Time since the blip was painted.
 * @param periodMs - Time the antenna takes to rotate once.
 * @returns Brightness from 1 (just painted) toward 0.
 */
export function blipAlpha(ageMs: number, periodMs: number): number {
  if (ageMs <= 0) {
    return 1;
  }
  return 0.5 ** (ageMs / (periodMs * BLIP_HALF_LIFE_ROTATIONS));
}

/**
 * Drops the blips that have faded out.
 *
 * @param blips - The current blips.
 * @param nowMs - The current frame time.
 * @param periodMs - Time the antenna takes to rotate once.
 * @returns The blips still bright enough to draw.
 */
export function pruneBlips(blips: readonly Blip[], nowMs: number, periodMs: number): Blip[] {
  return blips.filter((blip) => blipAlpha(nowMs - blip.paintedAtMs, periodMs) >= MIN_BLIP_ALPHA);
}
