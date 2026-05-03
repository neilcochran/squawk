import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ReactElement } from 'react';

import { FLOATING_SURFACE_CLASSES, FOCUS_RING_CLASSES } from '../../shared/styles/style-tokens.ts';

/**
 * Outcome the user picks in the auto-hide dialog. Carries both the
 * action and the "remember this choice" flag so the chart-mode
 * orchestrator can update the persisted preference in one branch.
 */
export interface Airspace3DDialogChoice {
  /** `'accept'` to apply the auto-hide; `'decline'` to leave layer state alone for this tilt-in. */
  action: 'accept' | 'decline';
  /**
   * Whether the user checked "Remember my choice". When `true`, the
   * orchestrator persists the action into the auto-hide preference so
   * future tilt-ins skip the dialog. When `false`, the preference
   * stays at `'ask'` and the dialog will re-open on the next tilt-in.
   */
  remember: boolean;
}

/** Props for {@link Airspace3DAutoHideDialog}. */
export interface Airspace3DAutoHideDialogProps {
  /** Called when the user picks "Hide them" or "Keep them visible". The dialog has no other dismissal path. */
  onResolve: (choice: Airspace3DDialogChoice) => void;
}

/**
 * Modal dialog rendered when the user enters 3D view (pitch transitions
 * from 0 to a positive value) while the auto-hide preference is set to
 * `'ask'` and at least one blanket airspace class is currently visible.
 * Lets the user choose whether to hide Class E, Warning, and ARTCC for
 * the duration of the tilt session, with an optional "remember this
 * choice" checkbox that persists the decision into the auto-hide
 * preference so future tilt-ins skip the dialog.
 *
 * Strictly modal: the dialog blocks every other interaction until the
 * user picks an option. There is no backdrop-click dismiss, no Escape
 * key dismiss, and the auto-hide hook in `chart-mode.tsx` ignores
 * pitch transitions while the dialog is open, so tilting back to plan
 * view does not silently close it.
 *
 * Accessibility: ARIA `role="dialog"` + `aria-modal="true"` so screen
 * readers treat it as modal, `aria-labelledby` ties the dialog to its
 * title, and the primary button is auto-focused on mount. Focus trap
 * is intentionally omitted for the v1 - the dialog has only three
 * interactive controls (two action buttons + the "remember" checkbox)
 * and the wrapper's `fixed inset-0 z-50` positioning blocks pointer
 * events from reaching the map controls underneath.
 */
export function Airspace3DAutoHideDialog({
  onResolve,
}: Airspace3DAutoHideDialogProps): ReactElement {
  const titleId = useId();
  const descriptionId = useId();
  const [remember, setRemember] = useState<boolean>(false);
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);

  // Focus the primary action on mount so keyboard users land on the
  // most-likely-intended button. The dialog has only three
  // interactive controls so a full focus trap is unnecessary; tabbing
  // beyond the last control lands on the address bar / browser
  // chrome, which is the expected fallback.
  useEffect((): void => {
    primaryButtonRef.current?.focus();
  }, []);

  const handleAccept = useCallback((): void => {
    onResolve({ action: 'accept', remember });
  }, [onResolve, remember]);

  const handleDecline = useCallback((): void => {
    onResolve({ action: 'decline', remember });
  }, [onResolve, remember]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/*
        Backdrop. Non-interactive (`aria-hidden`, no click handler) so
        clicking it does nothing - the dialog is strictly modal and
        only resolves via the action buttons. Visually dims the map
        and intercepts pointer events that would otherwise reach the
        layer toggle / zoom-controls / map gestures underneath.
      */}
      <div aria-hidden="true" className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
      {/*
        The dialog body is a sibling of the backdrop button (both
        children of the flex wrapper above), so clicks inside the
        dialog don't bubble through the backdrop and no
        `stopPropagation` is needed. Pointer ordering is provided by
        the `relative` positioning - the dialog stacks above the
        absolutely-positioned backdrop in the same DOM container.
      */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={`relative w-full max-w-md rounded-lg p-6 shadow-xl ${FLOATING_SURFACE_CLASSES}`}
      >
        <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Hide blanket airspace in 3D view?
        </h2>
        <p id={descriptionId} className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Class E, Warning, and ARTCC airspace cover wide swaths of the map and read as a uniform
          ceiling when tilted. Hiding them while in 3D gives a clearer view of terminal and
          special-use airspace structure. You can re-enable any of them from the Layers menu at any
          time.
        </p>
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className={`h-4 w-4 rounded border-slate-300 text-sky-600 dark:border-slate-600 dark:bg-slate-800 ${FOCUS_RING_CLASSES}`}
          />
          Remember my choice
        </label>
        <div className="mt-6 flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <button
            type="button"
            onClick={handleDecline}
            className={`rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 ${FOCUS_RING_CLASSES}`}
          >
            Keep them visible
          </button>
          <button
            ref={primaryButtonRef}
            type="button"
            onClick={handleAccept}
            className={`rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400 ${FOCUS_RING_CLASSES}`}
          >
            Hide them
          </button>
        </div>
      </div>
    </div>
  );
}
