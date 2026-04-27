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
}

/**
 * A grouped set of inspector rows under a small-caps heading. Renderers
 * that mix several logical groupings (e.g. an airport's "Location" and
 * "Runways") use one section per group so the visual structure of the
 * panel matches the data structure.
 */
export function InspectorSection({ title, children }: InspectorSectionProps): ReactElement {
  return (
    <section className="border-b border-slate-100 px-4 py-3 last:border-b-0">
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</h3>
      <dl>{children}</dl>
    </section>
  );
}
