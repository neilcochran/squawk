import type { ReactElement, ReactNode } from 'react';

/**
 * Props for {@link InspectorRow}.
 */
export interface InspectorRowProps {
  /** Left-column label (e.g. "Elevation"). */
  label: string;
  /** Right-column value. May be a string, number, or richer JSX. */
  children: ReactNode;
}

/**
 * Single label + value row inside a per-type inspector panel. Used as the
 * shared building block for every renderer's definition-list layout. Skips
 * rendering when `children` is `null` or `undefined` so callers can pass
 * optional fields directly without a guard at every site.
 */
export function InspectorRow({ label, children }: InspectorRowProps): ReactElement | null {
  if (children === null || children === undefined) {
    return null;
  }
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="text-right text-slate-900">{children}</dd>
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
          ? 'group relative border-b border-slate-100 px-4 py-3 transition-colors last:border-b-0 hover:bg-slate-100'
          : 'border-b border-slate-100 px-4 py-3 last:border-b-0'
      }
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {interactive ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-indigo-500 opacity-0 transition-opacity group-hover:opacity-100"
        />
      ) : null}
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</h3>
      <dl>{children}</dl>
    </section>
  );
}
