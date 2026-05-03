import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { ComponentPropsWithoutRef, ReactElement } from 'react';

/**
 * Base classes for a Radix dropdown-menu checkbox item rendered in the
 * layer-toggle. Encodes the per-row appearance (alignment, gap,
 * highlight tint, mobile-vs-desktop padding) once so the three row
 * variants (simple-parent, expandable-parent, sub-row) do not each
 * carry their own copy.
 *
 * Padding is intentionally NOT in the base because the variants differ
 * meaningfully (parent rows use `px-2`, sub-rows use `pl-8 pr-2` for
 * the indent). Each consumer passes its own padding via `className`.
 */
const MENU_ITEM_ROW_CLASSES =
  'flex cursor-default items-center gap-2 rounded text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-100 dark:text-slate-200 dark:data-[highlighted]:bg-slate-800';

/**
 * Props for {@link MenuItemRow}. Inherits everything from Radix's
 * `DropdownMenu.CheckboxItem` so callers can pass `checked`,
 * `onCheckedChange`, `onSelect`, `onKeyDown`, etc. directly.
 */
export type MenuItemRowProps = ComponentPropsWithoutRef<typeof DropdownMenu.CheckboxItem>;

/**
 * Wraps `DropdownMenu.CheckboxItem` with the standard layer-toggle row
 * appearance - mobile-friendly height, hover/highlight tint, dark mode
 * variants. Padding is supplied per-variant via `className`:
 *
 * ```tsx
 * <MenuItemRow className="px-2 py-2.5 md:py-1.5" checked={...} onCheckedChange={...}>
 *   <CheckIcon />
 *   <span>Label</span>
 * </MenuItemRow>
 * ```
 */
export function MenuItemRow({ className = '', ...rest }: MenuItemRowProps): ReactElement {
  return (
    <DropdownMenu.CheckboxItem className={`${MENU_ITEM_ROW_CLASSES} ${className}`} {...rest} />
  );
}
