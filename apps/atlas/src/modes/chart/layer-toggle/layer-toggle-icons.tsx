import type { ReactElement } from 'react';

/**
 * Inline checkmark glyph rendered inside a parent row checkbox or a
 * Radix `ItemIndicator`. 12x12 with `currentColor` so the surrounding
 * row drives the visible color via Tailwind text utilities.
 */
export function CheckIcon(): ReactElement {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 6.5L4.5 9L10 3.5" />
    </svg>
  );
}

/**
 * Inline chevron glyph for expandable parent rows. A single
 * right-pointing caret that rotates 90 degrees when the row is
 * expanded so the same icon reads as "open down" while expanded and
 * "open right" while collapsed.
 */
export function ChevronRightIcon({ expanded }: { expanded: boolean }): ReactElement {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={
        expanded
          ? 'rotate-90 text-slate-500 transition-transform dark:text-slate-400'
          : 'text-slate-500 transition-transform dark:text-slate-400'
      }
    >
      <path d="M3.5 2L7 5L3.5 8" />
    </svg>
  );
}
