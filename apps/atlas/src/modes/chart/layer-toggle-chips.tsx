import type { ReactElement } from 'react';

/**
 * Props for {@link SubCountChip}.
 */
export interface SubCountChipProps {
  /** Number of sub-classes currently enabled. */
  enabled: number;
  /** Total sub-classes available. */
  total: number;
  /** When true, render in a dimmed style (used when the parent layer is off). */
  dimmed: boolean;
}

/**
 * Compact "X/Y" indicator showing how many sub-classes a parent layer has
 * enabled out of the total. Helps users see at a glance whether a layer's
 * sub-list has been filtered without having to expand it.
 */
export function SubCountChip({ enabled, total, dimmed }: SubCountChipProps): ReactElement {
  const baseClasses =
    'inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums';
  // Enabled: filled dark badge so the count reads as a live indicator.
  // Dimmed: outline-only with very light text so the chip clearly recedes
  // when the parent layer is off (and thus the count is informational, not
  // representing visible features).
  const colorClasses = dimmed
    ? 'border border-slate-200 bg-transparent text-slate-400 dark:border-slate-700 dark:text-slate-500'
    : 'bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900';
  return (
    <span
      className={`${baseClasses} ${colorClasses}`}
      aria-label={`${enabled} of ${total} enabled`}
    >
      {enabled}/{total}
    </span>
  );
}

/**
 * Props for {@link ZoomGatedHint}.
 */
export interface ZoomGatedHintProps {
  /** Minimum zoom at which the gated layer paints. */
  minZoom: number;
}

/**
 * Inline "Zoom N+" indicator shown next to a layer row when the current
 * map zoom is below the layer's `minzoom`. Tells the user the layer is
 * on (or would be on) but is not painting yet because the camera is too
 * far out. Reads the same threshold as the MapLibre `Layer` so the
 * advertised number always matches the real cutoff. The `Zoom` prefix
 * spells out the unit so the chip pairs cleanly with the current-zoom
 * readout in the bottom-left zoom controls (also a numeric value).
 */
export function ZoomGatedHint({ minZoom }: ZoomGatedHintProps): ReactElement {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-sm border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
      aria-label={`Appears at zoom ${minZoom} and above`}
    >
      Zoom {minZoom}+
    </span>
  );
}
