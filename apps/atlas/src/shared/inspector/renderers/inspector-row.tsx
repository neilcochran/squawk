import type { ReactElement, ReactNode } from 'react';

import { FOCUS_RING_CLASSES } from '../../styles/style-tokens.ts';

/**
 * Props for {@link InspectorRow}.
 */
export interface InspectorRowProps {
  /** Left-column label (e.g. "Elevation"). */
  label: string;
  /** Right-column value. May be a string, number, or richer JSX. */
  children: ReactNode;
  /**
   * Optional pointer-enter handler. The airway renderer uses this so
   * hovering a per-leg row brightens that segment on the map.
   * Renderers that leave it unset get a static row.
   */
  onPointerEnter?: () => void;
  /** Optional pointer-leave handler that pairs with {@link onPointerEnter}. */
  onPointerLeave?: () => void;
  /**
   * Optional handler that makes the label a button selecting the entity
   * it names, as the fix panel does for a navaid association. The whole
   * row is the click target, while the button keeps the label as its
   * accessible name and takes keyboard focus.
   */
  onLabelSelect?: () => void;
}

/**
 * Single label + value row inside a per-type inspector panel. Used as the
 * shared building block for every renderer's definition-list layout. Skips
 * rendering when `children` is `null` or `undefined` so callers can pass
 * optional fields directly without a guard at every site.
 *
 * When `onPointerEnter` or `onLabelSelect` is supplied the row paints
 * with a subtle hover tint so the user reads it as interactive - hovering
 * drives a downstream effect (e.g. brightening the matching airway leg on
 * the map) or clicking selects what the label names. A selectable row
 * also grows to a 44px touch target below the `md:` breakpoint. Static
 * rows keep the flat layout.
 */
export function InspectorRow({
  label,
  children,
  onPointerEnter,
  onPointerLeave,
  onLabelSelect,
}: InspectorRowProps): ReactElement | null {
  if (children === null || children === undefined) {
    return null;
  }
  const selectable = onLabelSelect !== undefined;
  const interactive = onPointerEnter !== undefined || selectable;
  return (
    <div
      className={`flex justify-between gap-3 py-1.5 text-sm ${
        interactive ? 'rounded transition-colors hover:bg-slate-100 dark:hover:bg-slate-800' : ''
      } ${selectable ? 'relative min-h-11 items-center md:min-h-0' : ''}`}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <dt className="shrink-0 text-slate-500 dark:text-slate-400">
        {selectable ? (
          <button
            type="button"
            onClick={onLabelSelect}
            className={`font-medium text-indigo-600 after:absolute after:inset-0 hover:underline dark:text-indigo-400 ${FOCUS_RING_CLASSES}`}
          >
            {label}
          </button>
        ) : (
          label
        )}
      </dt>
      <dd className="text-right text-slate-900 dark:text-slate-100">{children}</dd>
    </div>
  );
}

/**
 * Props for {@link InspectorSection}.
 */
export interface InspectorSectionProps {
  /** Section heading shown in small caps above the rows. */
  title: string;
  /** Section body, typically one or more {@link InspectorRow} children. */
  children: ReactNode;
  /**
   * Optional pointer-enter handler. The airspace renderer uses this so
   * hovering a per-feature section brightens just that polygon on the
   * map. Other renderers leave it unset; the section behaves as static
   * content.
   */
  onPointerEnter?: () => void;
  /** Optional pointer-leave handler that pairs with {@link onPointerEnter}. */
  onPointerLeave?: () => void;
}

/**
 * A grouped set of inspector rows under a small-caps heading. Renderers
 * that mix several logical groupings (e.g. an airport's "Location" and
 * "Runways") use one section per group so the visual structure of the
 * panel matches the data structure.
 *
 * When `onPointerEnter` is supplied (the airspace renderer's per-feature
 * sections), the section paints with a subtle amber hover tint and a
 * left-edge accent so the user reads it as interactive - hovering
 * brightens the matching polygon on the map. Sections without a hover
 * handler stay flat (the airport / navaid / fix panels' static sections).
 */
export function InspectorSection({
  title,
  children,
  onPointerEnter,
  onPointerLeave,
}: InspectorSectionProps): ReactElement {
  const interactive = onPointerEnter !== undefined;
  return (
    <section
      className={
        interactive
          ? 'group relative border-b border-slate-100 px-4 py-3 transition-colors last:border-b-0 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800'
          : 'border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-800'
      }
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {interactive ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-indigo-500 opacity-0 transition-opacity group-hover:opacity-100 dark:bg-indigo-400"
        />
      ) : null}
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        {title}
      </h3>
      <dl>{children}</dl>
    </section>
  );
}
