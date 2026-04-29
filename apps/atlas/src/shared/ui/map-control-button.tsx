import type { ButtonHTMLAttributes, ReactElement } from 'react';
import { FOCUS_RING_CLASSES } from '../styles/style-tokens.ts';

/**
 * Base classes shared by every map-control button: 44x44 touch target
 * on mobile, 28x28 on desktop, centered content, slate text with hover
 * + focus + dark-mode variants. Defines the standard appearance; call
 * sites pass extra classes (e.g. `disabled:` styling, custom desktop
 * size, alternate hover wash) via the `className` prop.
 */
const MAP_CONTROL_BUTTON_CLASSES = `flex h-11 w-11 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 ${FOCUS_RING_CLASSES} md:h-7 md:w-7 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100`;

/**
 * Props for {@link MapControlButton}.
 */
export interface MapControlButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Extra Tailwind classes appended after the base map-control button
   * styles. Use this for `disabled:` variants, alternate sizing, or
   * negative-margin nudges.
   */
  className?: string;
}

/**
 * Standalone control button used in the floating chart chrome -
 * inspector header (close, recenter), layer-toggle row chevron, etc.
 * Defaults to `type="button"` so it never accidentally submits a
 * surrounding form (the dropdown menu's row checkboxes are a different
 * primitive, see {@link MenuItemRow}).
 *
 * Sized for a 44px touch target on mobile (WCAG recommendation) and
 * compact 28px on desktop. The hover wash mirrors the layer-toggle's
 * row highlight so multiple chrome elements next to each other read as
 * the same UI vocabulary.
 *
 * The zoom-controls stack uses a separate, in-stack styling (no
 * individual rounded corners, larger 32px desktop, disabled states) -
 * stays inline there to keep the disabled-cursor and at-bound logic
 * legible alongside the button JSX.
 */
export function MapControlButton({
  className = '',
  type,
  ...rest
}: MapControlButtonProps): ReactElement {
  return (
    <button
      type={type ?? 'button'}
      className={`${MAP_CONTROL_BUTTON_CLASSES} ${className}`}
      {...rest}
    />
  );
}
