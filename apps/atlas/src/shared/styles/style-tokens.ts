/**
 * Atlas-wide Tailwind class tokens for groupings of utilities that
 * appear in three or more places. Each constant is a plain string
 * concatenated into a `className` at the call site.
 *
 * Tailwind's official guidance for utility-class duplication is to
 * extract a React component when reuse is in JSX (see `floating-panel.tsx`
 * and `map-control-button.tsx`). These string constants cover the
 * cases that do not warrant a full component - either the surrounding
 * markup varies too much to share, or the consumer has its own opinion
 * about the wrapping element.
 *
 * Add a token here when the same utility cluster appears in 3+ files
 * AND a wrapper component would force unwanted indirection. One-off
 * usage stays inline.
 */

/**
 * Standard focus-visible ring used on every interactive control that
 * sits on a contrasting surface (white / slate-900). Pair with
 * `focus:outline-none` so the browser default outline does not fight
 * the ring.
 */
export const FOCUS_RING_CLASSES =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:focus-visible:ring-slate-500';

/**
 * Inset variant of {@link FOCUS_RING_CLASSES}. Used when the focused
 * control is flush with a panel edge (no gap between the ring and the
 * surrounding border) - the inset modifier draws the ring inside the
 * element so it does not bleed past the panel's border-radius.
 */
export const FOCUS_RING_INSET_CLASSES =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400 dark:focus-visible:ring-slate-500';

/**
 * Border + background utility cluster shared by every floating surface
 * (panels, popovers, dropdown content, status cards). Does NOT include
 * `rounded-*`, `shadow-*`, padding, or sizing - those vary enough per
 * surface that bundling them in would force every consumer to override
 * something. Compose with shape utilities at the call site, or use the
 * {@link FloatingPanel} component.
 */
export const FLOATING_SURFACE_CLASSES =
  'border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900';
