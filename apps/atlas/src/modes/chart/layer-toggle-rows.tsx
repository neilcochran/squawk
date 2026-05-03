import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { KeyboardEvent, MouseEvent, PointerEvent, ReactElement } from 'react';

import { MenuItemRow } from '../../shared/ui/menu-item-row.tsx';

import { SubCountChip, ZoomGatedHint } from './layer-toggle-chips.tsx';
import { CheckIcon, ChevronRightIcon } from './layer-toggle-icons.tsx';

/** Props for {@link SimpleParentRow}. */
export interface SimpleParentRowProps {
  /** Visible label. */
  label: string;
  /** Whether the layer is currently enabled. */
  checked: boolean;
  /** Called with the new checked state when the row is toggled. */
  onCheckedChange: (checked: boolean) => void;
  /**
   * Minimum zoom at which this layer paints, when the current map zoom is
   * below it. Drives the inline "appears at z N+" hint so a user toggling
   * the layer on at low zoom understands why nothing has appeared. Absent
   * means no hint (either the layer has no zoom gating, or the user is
   * already above the threshold).
   */
  hintMinZoom: number | undefined;
}

/**
 * Row for a layer without sub-types. The whole row is the click target -
 * Radix `CheckboxItem` semantics, identical to today's behavior for the
 * three non-expandable layers.
 */
export function SimpleParentRow({
  label,
  checked,
  onCheckedChange,
  hintMinZoom,
}: SimpleParentRowProps): ReactElement {
  return (
    <MenuItemRow
      checked={checked}
      onCheckedChange={onCheckedChange}
      onSelect={(event) => event.preventDefault()}
      className="px-2 py-2.5 md:py-1.5"
    >
      <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center">
        <DropdownMenu.ItemIndicator>
          <CheckIcon />
        </DropdownMenu.ItemIndicator>
      </span>
      <span className="flex-1">{label}</span>
      {hintMinZoom !== undefined ? <ZoomGatedHint minZoom={hintMinZoom} /> : null}
    </MenuItemRow>
  );
}

/** Props for {@link ExpandableParentRow}. */
export interface ExpandableParentRowProps {
  /** Visible label. */
  label: string;
  /** Whether the parent layer is currently enabled. */
  checked: boolean;
  /** Called with the new checked state when the parent checkbox is toggled. */
  onCheckedChange: (checked: boolean) => void;
  /** Whether the inline sub-list is currently expanded. */
  expanded: boolean;
  /** Called when the user clicks anywhere on the row outside the checkbox. */
  onToggleExpanded: () => void;
  /** Number of sub-classes / categories currently enabled, for the chip. */
  enabledCount: number;
  /** Total sub-classes / categories available, for the chip. */
  totalCount: number;
  /**
   * Minimum zoom at which this layer paints, when the current map zoom is
   * below it. Drives the inline "appears at z N+" hint so a user toggling
   * the layer on at low zoom understands why nothing has appeared. Absent
   * means no hint (either the layer has no zoom gating, or the user is
   * already above the threshold).
   */
  hintMinZoom: number | undefined;
}

/**
 * Row for a layer with sub-types. Unified click semantics: the row itself
 * is a Radix `CheckboxItem` whose `onCheckedChange` toggles the parent
 * layer (identical to {@link SimpleParentRow}), and a dedicated chevron
 * button at the right toggles the inline expansion. Stopping pointer
 * propagation on the chevron prevents the parent CheckboxItem from also
 * firing its `onCheckedChange` from the same click. Keyboard users
 * navigate to the row with arrow keys; ArrowRight expands and ArrowLeft
 * collapses, mirroring the standard tree-style menu pattern. The chevron
 * button is intentionally non-tabbable (`tabIndex=-1`) so the keyboard
 * focus chain remains the menu items, not their internal sub-controls.
 */
export function ExpandableParentRow({
  label,
  checked,
  onCheckedChange,
  expanded,
  onToggleExpanded,
  enabledCount,
  totalCount,
  hintMinZoom,
}: ExpandableParentRowProps): ReactElement {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowRight' && !expanded) {
      event.preventDefault();
      onToggleExpanded();
    } else if (event.key === 'ArrowLeft' && expanded) {
      event.preventDefault();
      onToggleExpanded();
    }
  };
  return (
    <MenuItemRow
      checked={checked}
      onCheckedChange={onCheckedChange}
      onSelect={(event) => event.preventDefault()}
      onKeyDown={handleKeyDown}
      className="px-2 py-2.5 md:py-1.5"
    >
      <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center">
        <DropdownMenu.ItemIndicator>
          <CheckIcon />
        </DropdownMenu.ItemIndicator>
      </span>
      <span className="flex-1">{label}</span>
      {hintMinZoom !== undefined ? <ZoomGatedHint minZoom={hintMinZoom} /> : null}
      <SubCountChip enabled={enabledCount} total={totalCount} dimmed={!checked} />
      <ExpandToggleButton label={label} expanded={expanded} onToggleExpanded={onToggleExpanded} />
    </MenuItemRow>
  );
}

/** Props for {@link ExpandToggleButton}. */
interface ExpandToggleButtonProps {
  /** Layer label, used for the accessible name. */
  label: string;
  /** Whether the inline sub-list is currently expanded. */
  expanded: boolean;
  /** Called when the chevron is clicked. */
  onToggleExpanded: () => void;
}

/**
 * Dedicated chevron button rendered inside an {@link ExpandableParentRow}
 * to toggle the inline sub-list expansion. Stops pointer + click
 * propagation so its click does NOT also flip the parent CheckboxItem's
 * checked state (which would toggle the layer at the same time as
 * expanding). Sized at 44px on mobile (touch target) and 28px on desktop;
 * `tabIndex=-1` keeps it out of the keyboard focus chain so arrow-key
 * menu navigation lands on the row, not separately on the chevron.
 *
 * Uses a hand-rolled button rather than the shared {@link MapControlButton}
 * because this control needs the negative right margin (`-mr-1`) to align
 * with the row's padding, and stops pointer events on the row's parent
 * - both row-specific concerns that do not generalize to other map
 * controls.
 */
function ExpandToggleButton({
  label,
  expanded,
  onToggleExpanded,
}: ExpandToggleButtonProps): ReactElement {
  const stopPointer = (event: PointerEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
  };
  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    event.preventDefault();
    onToggleExpanded();
  };
  return (
    <button
      type="button"
      aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label} sub-list`}
      aria-expanded={expanded}
      tabIndex={-1}
      onClick={handleClick}
      onPointerDown={stopPointer}
      onPointerUp={stopPointer}
      className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-200 hover:text-slate-700 md:h-7 md:w-7 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
    >
      <ChevronRightIcon expanded={expanded} />
    </button>
  );
}

/** Props for {@link SubRow}. */
export interface SubRowProps {
  /** Visible label (shown to the right of the checkbox indicator). */
  label: string;
  /** Whether this sub-class / category is currently enabled. */
  checked: boolean;
  /** Called with the new checked state when the user toggles the row. */
  onCheckedChange: (checked: boolean) => void;
}

/**
 * Indented sub-row rendered directly under an expanded parent layer. Same
 * Radix CheckboxItem semantics as {@link SimpleParentRow} but with extra
 * left padding so the visual hierarchy reads as nested.
 */
export function SubRow({ label, checked, onCheckedChange }: SubRowProps): ReactElement {
  return (
    <MenuItemRow
      checked={checked}
      onCheckedChange={onCheckedChange}
      onSelect={(event) => event.preventDefault()}
      className="py-2.5 pr-2 pl-8 md:py-1.5"
    >
      <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center">
        <DropdownMenu.ItemIndicator>
          <CheckIcon />
        </DropdownMenu.ItemIndicator>
      </span>
      <span>{label}</span>
    </MenuItemRow>
  );
}
