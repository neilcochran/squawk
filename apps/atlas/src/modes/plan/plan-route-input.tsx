import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';

import { FOCUS_RING_CLASSES } from '../../shared/styles/style-tokens.ts';
import { FloatingPanel } from '../../shared/ui/floating-panel.tsx';

/**
 * Props for {@link PlanRouteInput}.
 */
export interface PlanRouteInputProps {
  /** Current route string from URL state. */
  value: string;
  /** Called with the normalized route string when the user commits (Enter / blur). */
  onCommit: (route: string) => void;
}

/**
 * Normalizes a typed route string into the canonical form stored in the URL:
 * trimmed, internal whitespace collapsed to single spaces, and upper-cased.
 * Route identifiers are conventionally uppercase and the resolvers match
 * case-insensitively, so this keeps the shareable URL clean without changing
 * what resolves.
 */
function normalizeRoute(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Floating route-string input anchored to the top-left of the map. Holds the
 * in-progress text in local state and commits the normalized value to the URL
 * on Enter or blur, so an in-flight edit does not rewrite the URL on every
 * keystroke. Resyncs to the incoming `value` when the URL route changes from
 * elsewhere (share-link load, mode reset).
 */
export function PlanRouteInput({ value, onCommit }: PlanRouteInputProps): ReactElement {
  const [draft, setDraft] = useState(value);
  // Resync the draft when the URL route changes from outside this input.
  // setState-during-render via a previous-value sentinel avoids an effect
  // round-trip (the React-sanctioned reset-from-prop pattern).
  const [previousValue, setPreviousValue] = useState(value);
  if (previousValue !== value) {
    setPreviousValue(value);
    setDraft(value);
  }

  const commit = (): void => {
    const normalized = normalizeRoute(draft);
    if (normalized !== value) {
      onCommit(normalized);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    commit();
  };

  // At `md:` the summary panel is always open on the right, so the width is
  // capped against its live (user-resizable) width plus the 0.5rem inset on
  // each side, rather than letting a fixed 34rem run underneath it, down to a
  // 16rem floor that keeps the field usable.
  return (
    <form
      onSubmit={handleSubmit}
      className="absolute top-2 right-2 left-2 z-10 md:right-auto md:w-[34rem] md:max-w-[max(16rem,calc(100%_-_var(--atlas-side-panel-open-width)_-_1rem))]"
    >
      <FloatingPanel className="rounded-md p-1 shadow-lg">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          placeholder="Enter a route, e.g. KLAX DCT LAX J60 SAX DCT KJFK"
          aria-label="Flight plan route"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className={`w-full rounded bg-transparent px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 md:py-1.5 dark:text-slate-100 dark:placeholder:text-slate-500 ${FOCUS_RING_CLASSES}`}
        />
      </FloatingPanel>
    </form>
  );
}
