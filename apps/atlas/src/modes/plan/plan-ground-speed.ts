import { PLAN_MAX_GROUND_SPEED_KT, PLAN_MIN_GROUND_SPEED_KT } from './url-state.ts';

/**
 * Resolves what the ground-speed field commits from the text it holds: a
 * blank field clears the speed, a number is clamped to the range the URL
 * accepts (so `5000` commits `2000` rather than being silently dropped by the
 * schema), and anything that is not a positive number keeps the current
 * speed, so a typo reverts instead of wiping the ETE.
 *
 * @param raw - The field's text.
 * @param currentKt - The ground speed currently in the URL, in knots.
 * @returns The ground speed to commit in knots, or `undefined` to clear it.
 */
export function resolveGroundSpeedInput(
  raw: string,
  currentKt: number | undefined,
): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return undefined;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return currentKt;
  }
  return Math.min(PLAN_MAX_GROUND_SPEED_KT, Math.max(PLAN_MIN_GROUND_SPEED_KT, parsed));
}
