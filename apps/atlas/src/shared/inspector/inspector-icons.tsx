import type { ReactElement } from 'react';

/**
 * Inline X glyph for the inspector close button. Rendered at 14x14 with
 * `currentColor` so the surrounding button drives the visible color
 * via Tailwind text utilities.
 */
export function CloseIcon(): ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" />
    </svg>
  );
}

/** Crosshair / target icon used by the recenter button. */
export function RecenterIcon(): ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="3" />
      <path d="M7 1V3M7 11V13M1 7H3M11 7H13" />
    </svg>
  );
}

/**
 * Caret-style chevron used in the sibling-chip disclosure header.
 * Rotates 180 degrees via a CSS transform when `expanded` is true so
 * the same SVG path serves both states; the surrounding button owns
 * the `aria-expanded` attribute that announces the change.
 */
export function ChevronDownIcon({ expanded }: { expanded: boolean }): ReactElement {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={expanded ? 'rotate-180' : ''}
      aria-hidden="true"
    >
      <path d="M3 5L7 9L11 5" />
    </svg>
  );
}

/**
 * Stacked-layers icon used as a hint next to the sibling-chip
 * disclosure heading. Suggests "switch between layered features".
 */
export function StackedLayersIcon(): ReactElement {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 1.5L12.5 4.25L7 7L1.5 4.25L7 1.5ZM1.5 7L7 9.75L12.5 7M1.5 9.75L7 12.5L12.5 9.75" />
    </svg>
  );
}
