import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { useCanHover } from '../styles/use-can-hover.ts';
import { CHIP_GROUP_LABELS } from './chip-builders.ts';
import type { Chip } from './chip-builders.ts';
import { ENTITY_TYPES } from './entity.ts';
import type { EntityType } from './entity.ts';
import { ChevronDownIcon, StackedLayersIcon } from './inspector-icons.tsx';

/**
 * Props for {@link SiblingChips}.
 */
export interface SiblingChipsProps {
  /** Pre-built chip list, sorted and disambiguated by `chip-builders.ts`. */
  chips: readonly Chip[];
  /** Called when the user picks a chip to make it the new selection. */
  onSelect: (selection: string) => void;
  /**
   * Called when a chip is hover-entered or focused (with the chip's
   * selection) and when it is hover-left or blurred (with `undefined`).
   * Used by chart-mode to temporarily highlight that chip's feature on
   * the map so the user can confirm which entity a chip refers to
   * before clicking.
   */
  onHover: (selection: string | undefined) => void;
}

/**
 * Collapsible disclosure rendered below the inspector header when the
 * most recent click pulled in alternative features (same-pixel hits
 * plus bbox-overlap airspaces). Collapsed by default - the popover is
 * the primary disambiguation surface, and the chip disclosure is the
 * "other things in this area" follow-up. Click the header to expand;
 * inside, chips are grouped by feature type (Airports, Navaids, Fixes,
 * Airways, Airspace) so a click into a busy area is readable instead
 * of an unsorted wall of buttons.
 *
 * Each chip is a `<button>` so it is keyboard-focusable. On devices
 * with a real hover gesture (mouse / trackpad) chip hover and keyboard
 * focus call `onHover` so chart-mode can preview the highlight on the
 * map before the user commits with a click. On `(hover: none)` devices
 * (touch-only phones / tablets) the mouse-event preview is gated off
 * to avoid synthesized-event flicker on tap; focus events still drive
 * `onHover` so a connected keyboard or screen reader keeps the same
 * affordance.
 */
export function SiblingChips({ chips, onSelect, onHover }: SiblingChipsProps): ReactElement {
  const canHover = useCanHover();
  const [expanded, setExpanded] = useState(false);
  // Group chips by entity type, in canonical ENTITY_TYPES order, and
  // drop empty groups. The result is recomputed only when the chip
  // list changes (chip clicks rebuild it from a new selection).
  const groups = useMemo<readonly { type: EntityType; chips: readonly Chip[] }[]>(() => {
    const byType = new Map<EntityType, Chip[]>();
    for (const chip of chips) {
      const bucket = byType.get(chip.type);
      if (bucket === undefined) {
        byType.set(chip.type, [chip]);
      } else {
        bucket.push(chip);
      }
    }
    return ENTITY_TYPES.flatMap((type) => {
      const bucket = byType.get(type);
      return bucket === undefined || bucket.length === 0 ? [] : [{ type, chips: bucket }];
    });
  }, [chips]);

  const headerText =
    chips.length === 1 ? '1 other feature here' : `${chips.length} other features here`;

  return (
    <div className="border-y-2 border-indigo-200 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/40">
      <button
        type="button"
        onClick={(): void => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-1.5 px-4 py-3 text-left text-xs font-semibold tracking-wide text-indigo-700 uppercase hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 md:py-2 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
      >
        <StackedLayersIcon />
        <span className="flex-1">{headerText}</span>
        <ChevronDownIcon expanded={expanded} />
      </button>
      {expanded ? (
        <div className="flex flex-col gap-2 px-4 pt-1 pb-3">
          {groups.map((group) => (
            <div key={group.type}>
              <p className="mb-1 text-[10px] font-semibold tracking-wider text-indigo-600/80 uppercase dark:text-indigo-300/80">
                {CHIP_GROUP_LABELS[group.type]}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {group.chips.map((chip) => (
                  <button
                    key={chip.selection}
                    type="button"
                    onClick={(): void => onSelect(chip.selection)}
                    {...(canHover && {
                      onMouseEnter: (): void => onHover(chip.selection),
                      onMouseLeave: (): void => onHover(undefined),
                    })}
                    onFocus={(): void => onHover(chip.selection)}
                    onBlur={(): void => onHover(undefined)}
                    className="rounded-full border border-indigo-300 bg-white px-3 py-2 text-xs font-medium text-indigo-700 shadow-sm hover:border-indigo-400 hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 md:px-2.5 md:py-1 dark:border-indigo-700 dark:bg-slate-900 dark:text-indigo-300 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/50"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
