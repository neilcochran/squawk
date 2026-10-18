import { useRef, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';

import { FOCUS_RING_CLASSES } from '../../shared/styles/style-tokens.ts';

import { resolveGroundSpeedInput } from './plan-ground-speed.ts';
import { PLAN_MAX_GROUND_SPEED_KT, PLAN_MIN_GROUND_SPEED_KT } from './url-state.ts';

/**
 * Props for {@link PlanGroundSpeedInput}.
 */
export interface PlanGroundSpeedInputProps {
  /** Current planning ground speed in knots from URL state, or `undefined` when unset. */
  value: number | undefined;
  /** Called with the speed to store when the user commits (Enter / blur); `undefined` clears it. */
  onCommit: (groundSpeedKt: number | undefined) => void;
}

/** The field text for a ground speed: the number, or blank when unset. */
function toDraft(groundSpeedKt: number | undefined): string {
  return groundSpeedKt === undefined ? '' : String(groundSpeedKt);
}

/**
 * Ground-speed field in the flight plan summary. Like the route input, it
 * holds the in-progress text locally and commits on Enter or blur, so typing
 * `450` writes one value to the URL rather than `4`, `45` and `450`. What it
 * commits comes from {@link resolveGroundSpeedInput}: a value outside the
 * range the URL accepts is clamped to it, and the field then shows the
 * clamped number, so the bound is visible instead of the input appearing to
 * be rejected. The form opts out of native constraint validation for the same
 * reason - the browser would otherwise refuse the Enter press with its own
 * bubble instead of letting the clamp apply. Resyncs to the incoming `value`
 * when the URL changes from elsewhere.
 */
export function PlanGroundSpeedInput({ value, onCommit }: PlanGroundSpeedInputProps): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(() => toDraft(value));
  // Resync the draft when the URL speed changes from outside this field.
  // setState-during-render via a previous-value sentinel avoids an effect
  // round-trip (the React-sanctioned reset-from-prop pattern).
  const [previousValue, setPreviousValue] = useState(value);
  if (previousValue !== value) {
    setPreviousValue(value);
    setDraft(toDraft(value));
  }

  const commit = (): void => {
    // A number input reports unparseable text (possible in some browsers) as
    // an empty value, which would read as "clear"; treat it as a typo instead.
    const next =
      inputRef.current?.validity.badInput === true ? value : resolveGroundSpeedInput(draft, value);
    setDraft(toDraft(next));
    if (next !== value) {
      onCommit(next);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    commit();
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label
        htmlFor="plan-ground-speed"
        className="block text-xs font-medium text-slate-500 dark:text-slate-400"
      >
        Ground speed (kt)
      </label>
      <input
        ref={inputRef}
        id="plan-ground-speed"
        type="number"
        inputMode="numeric"
        min={PLAN_MIN_GROUND_SPEED_KT}
        max={PLAN_MAX_GROUND_SPEED_KT}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        placeholder="e.g. 450"
        className={`mt-1 w-28 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 ${FOCUS_RING_CLASSES}`}
      />
    </form>
  );
}
