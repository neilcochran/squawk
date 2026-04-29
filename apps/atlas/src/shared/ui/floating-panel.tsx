import type { HTMLAttributes, ReactElement } from 'react';
import { FLOATING_SURFACE_CLASSES } from '../styles/style-tokens.ts';

/**
 * Props for {@link FloatingPanel}.
 */
export interface FloatingPanelProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Extra Tailwind classes appended after the floating-surface base.
   * Use this to set `rounded-*`, `shadow-*`, padding, sizing, and any
   * positioning utilities the call site needs.
   */
  className?: string;
}

/**
 * Thin `<div>` wrapper that applies the standard floating-surface
 * border + background pair (light + dark) once so consumers do not
 * repeat the four-class cluster at every floating-element call site.
 *
 * Shape (rounded radius, shadow, padding, sizing) is intentionally
 * left to the consumer - the floating elements in atlas vary enough
 * (dropdown content uses `rounded-md shadow-lg`, the zoom-controls
 * stack uses `rounded-md shadow-md`, the chart-loading card uses
 * `rounded-lg shadow-md`, the inspector aside has responsive border
 * shapes) that baking a default in would force most call sites to
 * override.
 *
 * ```tsx
 * <FloatingPanel className="rounded-md p-1 shadow-lg">
 *   ...
 * </FloatingPanel>
 * ```
 */
export function FloatingPanel({ className = '', ...rest }: FloatingPanelProps): ReactElement {
  return <div className={`${FLOATING_SURFACE_CLASSES} ${className}`} {...rest} />;
}
