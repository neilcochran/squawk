import { Fragment, useCallback, useState } from 'react';
import type { MouseEvent, PointerEvent, ReactElement } from 'react';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { AIRSPACE_CLASSES, AIRWAY_CATEGORIES, CHART_ROUTE_PATH, LAYER_IDS } from './url-state.ts';
import type { AirspaceClass, AirwayCategory, LayerId } from './url-state.ts';

const route = getRouteApi(CHART_ROUTE_PATH);

/** A single layer option rendered in the top-level dropdown menu. */
interface LayerOption {
  /** Stable id matching one of {@link LAYER_IDS}. */
  id: LayerId;
  /** User-visible label. */
  label: string;
}

/**
 * Top-level layer rows in display order. Order is independent of map z-stack
 * (which is controlled by JSX order in chart-mode) and of URL serialization
 * order (which follows {@link LAYER_IDS}).
 */
const LAYER_OPTIONS: readonly LayerOption[] = [
  { id: 'airports', label: 'Airports' },
  { id: 'navaids', label: 'Navaids' },
  { id: 'fixes', label: 'Fixes' },
  { id: 'airways', label: 'Airways' },
  { id: 'airspace', label: 'Airspace' },
];

/** Set of layer ids that have an inline-expandable sub-class list. */
const EXPANDABLE_LAYERS = new Set<LayerId>(['airways', 'airspace']);

/** A single airspace-class row rendered inside the airspace expansion. */
interface AirspaceClassOption {
  /** Stable id matching one of {@link AIRSPACE_CLASSES}. */
  id: AirspaceClass;
  /** User-visible label. */
  label: string;
}

/** Airspace-class rows in display order: classes first, then special-use, then ARTCC. */
const AIRSPACE_CLASS_OPTIONS: readonly AirspaceClassOption[] = [
  { id: 'CLASS_B', label: 'Class B' },
  { id: 'CLASS_C', label: 'Class C' },
  { id: 'CLASS_D', label: 'Class D' },
  { id: 'CLASS_E', label: 'Class E' },
  { id: 'MOA', label: 'MOA' },
  { id: 'RESTRICTED', label: 'Restricted' },
  { id: 'PROHIBITED', label: 'Prohibited' },
  { id: 'WARNING', label: 'Warning' },
  { id: 'ALERT', label: 'Alert' },
  { id: 'NSA', label: 'NSA' },
  { id: 'ARTCC', label: 'ARTCC' },
];

/** A single airway-category row rendered inside the airways expansion. */
interface AirwayCategoryOption {
  /** Stable id matching one of {@link AIRWAY_CATEGORIES}. */
  id: AirwayCategory;
  /** User-visible label. */
  label: string;
}

/** Airway-category rows in display order, low to high to oceanic-and-regional. */
const AIRWAY_CATEGORY_OPTIONS: readonly AirwayCategoryOption[] = [
  { id: 'LOW', label: 'Low altitude' },
  { id: 'HIGH', label: 'High altitude' },
  { id: 'OCEANIC', label: 'Oceanic & regional' },
];

/**
 * Layer-visibility dropdown for chart mode. Reads the active layer set and
 * sub-class sets from the URL and writes them back through `useNavigate` on
 * each toggle. Renders a "Layers" button in the top-right of the map area
 * with a Radix dropdown of layer rows.
 *
 * Rows for layers without sub-types are plain `CheckboxItem`s - the whole
 * row toggles the layer. Rows for layers with sub-types (airways, airspace)
 * are split-action: clicking anywhere on the row expands or collapses the
 * inline sub-list, while a small checkbox button on the left toggles the
 * parent without expanding. A subtle "X/Y" chip just before the chevron
 * shows the sub-list's enabled count vs total so users can see filtering
 * state without expanding. The menu stays open across multiple toggles so
 * users can flip several at once.
 */
export function LayerToggle(): ReactElement {
  const { layers, airspaceClasses, airwayCategories } = route.useSearch();
  const navigate = useNavigate({ from: CHART_ROUTE_PATH });
  const [expanded, setExpanded] = useState<ReadonlySet<LayerId>>(() => new Set());

  const toggleExpanded = useCallback((id: LayerId): void => {
    setExpanded((prev) => {
      const next = new Set<LayerId>(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleLayerChange = useCallback(
    (id: LayerId, checked: boolean): void => {
      const enabled = new Set<LayerId>(layers);
      if (checked) {
        enabled.add(id);
      } else {
        enabled.delete(id);
      }
      const nextLayers = LAYER_IDS.filter((layerId) => enabled.has(layerId));

      // When the user re-checks the parent of an expandable layer whose
      // sub-array has been emptied (so the parent had been auto-unchecked),
      // refill the sub-array to all so the layer actually has visible
      // features. If the sub-array is non-empty (preserved fine-grained
      // state), leave it alone.
      let nextAirspaceClasses: readonly AirspaceClass[] = airspaceClasses;
      if (checked && id === 'airspace' && airspaceClasses.length === 0) {
        nextAirspaceClasses = [...AIRSPACE_CLASSES];
      }
      let nextAirwayCategories: readonly AirwayCategory[] = airwayCategories;
      if (checked && id === 'airways' && airwayCategories.length === 0) {
        nextAirwayCategories = [...AIRWAY_CATEGORIES];
      }

      void navigate({
        search: (prev) => ({
          ...prev,
          layers: nextLayers,
          airspaceClasses: [...nextAirspaceClasses],
          airwayCategories: [...nextAirwayCategories],
        }),
        replace: true,
      });
    },
    [layers, airspaceClasses, airwayCategories, navigate],
  );

  const handleAirspaceClassChange = useCallback(
    (id: AirspaceClass, checked: boolean): void => {
      const enabled = new Set<AirspaceClass>(airspaceClasses);
      if (checked) {
        enabled.add(id);
      } else {
        enabled.delete(id);
      }
      const nextSub = AIRSPACE_CLASSES.filter((classId) => enabled.has(classId));

      // Couple parent visibility with sub-array non-emptiness so the parent
      // checkbox always matches what the user can actually see:
      //   sub becomes empty + parent on -> auto-uncheck parent
      //   sub becomes non-empty (was empty) + parent off -> auto-check parent
      // Other transitions leave the parent toggle alone, so an explicit
      // "parent off with non-empty sub preserved" remains stable as the
      // user fiddles with sub-rows.
      const parentCurrentlyOn = layers.includes('airspace');
      let nextLayers: readonly LayerId[] = layers;
      if (nextSub.length === 0 && parentCurrentlyOn) {
        nextLayers = layers.filter((layerId) => layerId !== 'airspace');
      } else if (airspaceClasses.length === 0 && nextSub.length > 0 && !parentCurrentlyOn) {
        nextLayers = LAYER_IDS.filter(
          (layerId) => layers.includes(layerId) || layerId === 'airspace',
        );
      }

      void navigate({
        search: (prev) => ({
          ...prev,
          airspaceClasses: nextSub,
          layers: [...nextLayers],
        }),
        replace: true,
      });
    },
    [airspaceClasses, layers, navigate],
  );

  const handleAirwayCategoryChange = useCallback(
    (id: AirwayCategory, checked: boolean): void => {
      const enabled = new Set<AirwayCategory>(airwayCategories);
      if (checked) {
        enabled.add(id);
      } else {
        enabled.delete(id);
      }
      const nextSub = AIRWAY_CATEGORIES.filter((catId) => enabled.has(catId));

      const parentCurrentlyOn = layers.includes('airways');
      let nextLayers: readonly LayerId[] = layers;
      if (nextSub.length === 0 && parentCurrentlyOn) {
        nextLayers = layers.filter((layerId) => layerId !== 'airways');
      } else if (airwayCategories.length === 0 && nextSub.length > 0 && !parentCurrentlyOn) {
        nextLayers = LAYER_IDS.filter(
          (layerId) => layers.includes(layerId) || layerId === 'airways',
        );
      }

      void navigate({
        search: (prev) => ({
          ...prev,
          airwayCategories: nextSub,
          layers: [...nextLayers],
        }),
        replace: true,
      });
    },
    [airwayCategories, layers, navigate],
  );

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="absolute right-3 top-3 z-10 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-md hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">
        Layers
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="min-w-[14rem] rounded-md border border-slate-200 bg-white p-1 shadow-lg"
        >
          {LAYER_OPTIONS.map((option) => {
            const isExpandable = EXPANDABLE_LAYERS.has(option.id);
            const parentChecked = layers.includes(option.id);
            return (
              <Fragment key={option.id}>
                {isExpandable ? (
                  <ExpandableParentRow
                    label={option.label}
                    checked={parentChecked}
                    onCheckedChange={(checked) => handleLayerChange(option.id, checked)}
                    expanded={expanded.has(option.id)}
                    onToggleExpanded={() => toggleExpanded(option.id)}
                    enabledCount={
                      option.id === 'airways' ? airwayCategories.length : airspaceClasses.length
                    }
                    totalCount={
                      option.id === 'airways' ? AIRWAY_CATEGORIES.length : AIRSPACE_CLASSES.length
                    }
                  />
                ) : (
                  <SimpleParentRow
                    label={option.label}
                    checked={parentChecked}
                    onCheckedChange={(checked) => handleLayerChange(option.id, checked)}
                  />
                )}
                {option.id === 'airways' && expanded.has('airways')
                  ? AIRWAY_CATEGORY_OPTIONS.map((category) => (
                      <SubRow
                        key={category.id}
                        label={category.label}
                        checked={airwayCategories.includes(category.id)}
                        onCheckedChange={(c) => handleAirwayCategoryChange(category.id, c)}
                      />
                    ))
                  : null}
                {option.id === 'airspace' && expanded.has('airspace')
                  ? AIRSPACE_CLASS_OPTIONS.map((cls) => (
                      <SubRow
                        key={cls.id}
                        label={cls.label}
                        checked={airspaceClasses.includes(cls.id)}
                        onCheckedChange={(c) => handleAirspaceClassChange(cls.id, c)}
                      />
                    ))
                  : null}
              </Fragment>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Props for {@link SimpleParentRow}. */
interface SimpleParentRowProps {
  /** Visible label. */
  label: string;
  /** Whether the layer is currently enabled. */
  checked: boolean;
  /** Called with the new checked state when the row is toggled. */
  onCheckedChange: (checked: boolean) => void;
}

/**
 * Row for a layer without sub-types. The whole row is the click target -
 * Radix `CheckboxItem` semantics, identical to today's behavior for the
 * three non-expandable layers.
 */
function SimpleParentRow({ label, checked, onCheckedChange }: SimpleParentRowProps): ReactElement {
  return (
    <DropdownMenu.CheckboxItem
      checked={checked}
      onCheckedChange={onCheckedChange}
      onSelect={(event) => event.preventDefault()}
      className="flex cursor-default items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-100"
    >
      <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center">
        <DropdownMenu.ItemIndicator>
          <CheckIcon />
        </DropdownMenu.ItemIndicator>
      </span>
      <span className="flex-1">{label}</span>
    </DropdownMenu.CheckboxItem>
  );
}

/** Props for {@link ExpandableParentRow}. */
interface ExpandableParentRowProps {
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
}

/**
 * Row for a layer with sub-types. Split-action layout: the row itself is a
 * Radix `Item` whose `onSelect` toggles the inline expansion, and a small
 * checkbox button at the left toggles the parent layer independently. The
 * checkbox stops pointer + click propagation so toggling it does not also
 * expand the row. Renders a "X/Y" chip and a chevron at the right.
 */
function ExpandableParentRow({
  label,
  checked,
  onCheckedChange,
  expanded,
  onToggleExpanded,
  enabledCount,
  totalCount,
}: ExpandableParentRowProps): ReactElement {
  return (
    <DropdownMenu.Item
      onSelect={(event) => {
        event.preventDefault();
        onToggleExpanded();
      }}
      className="flex cursor-default items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-100"
    >
      <ParentCheckbox label={label} checked={checked} onCheckedChange={onCheckedChange} />
      <span className="flex-1">{label}</span>
      <SubCountChip enabled={enabledCount} total={totalCount} dimmed={!checked} />
      <ChevronIcon expanded={expanded} />
    </DropdownMenu.Item>
  );
}

/** Props for {@link ParentCheckbox}. */
interface ParentCheckboxProps {
  /** Layer label, used for the accessible name. */
  label: string;
  /** Whether the parent layer is currently enabled. */
  checked: boolean;
  /** Called with the new checked state when the checkbox is toggled. */
  onCheckedChange: (checked: boolean) => void;
}

/**
 * Small checkbox button used inside an {@link ExpandableParentRow}. Stops
 * pointer + click propagation so its click does not also fire the row's
 * `onSelect`. Renders the same checkmark glyph as the simple parent rows
 * inside a slot of the same width, so all parent rows align vertically.
 */
function ParentCheckbox({ label, checked, onCheckedChange }: ParentCheckboxProps): ReactElement {
  const stopPointer = (event: PointerEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
  };
  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    event.preventDefault();
    onCheckedChange(!checked);
  };
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={`Toggle ${label} layer`}
      tabIndex={-1}
      onClick={handleClick}
      onPointerDown={stopPointer}
      onPointerUp={stopPointer}
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:border-slate-400"
    >
      {checked ? <CheckIcon /> : null}
    </button>
  );
}

/** Props for {@link SubRow}. */
interface SubRowProps {
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
function SubRow({ label, checked, onCheckedChange }: SubRowProps): ReactElement {
  return (
    <DropdownMenu.CheckboxItem
      checked={checked}
      onCheckedChange={onCheckedChange}
      onSelect={(event) => event.preventDefault()}
      className="flex cursor-default items-center gap-2 rounded py-1.5 pl-8 pr-2 text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-100"
    >
      <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center">
        <DropdownMenu.ItemIndicator>
          <CheckIcon />
        </DropdownMenu.ItemIndicator>
      </span>
      <span>{label}</span>
    </DropdownMenu.CheckboxItem>
  );
}

/** Props for {@link SubCountChip}. */
interface SubCountChipProps {
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
function SubCountChip({ enabled, total, dimmed }: SubCountChipProps): ReactElement {
  const baseClasses =
    'inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums';
  // Enabled: filled dark badge so the count reads as a live indicator.
  // Dimmed: outline-only with very light text so the chip clearly recedes
  // when the parent layer is off (and thus the count is informational, not
  // representing visible features).
  const colorClasses = dimmed
    ? 'border border-slate-200 bg-transparent text-slate-400'
    : 'bg-slate-700 text-white';
  return (
    <span
      className={`${baseClasses} ${colorClasses}`}
      aria-label={`${enabled} of ${total} enabled`}
    >
      {enabled}/{total}
    </span>
  );
}

/** Inline checkmark glyph rendered inside the parent checkbox or Radix `ItemIndicator`. */
function CheckIcon(): ReactElement {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 6.5L4.5 9L10 3.5" />
    </svg>
  );
}

/**
 * Inline chevron glyph for expandable parent rows. A single right-pointing
 * caret that rotates 90 degrees when the row is expanded so the same icon
 * reads as "open down" while expanded and "open right" while collapsed.
 */
function ChevronIcon({ expanded }: { expanded: boolean }): ReactElement {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={
        expanded
          ? 'rotate-90 text-slate-500 transition-transform'
          : 'text-slate-500 transition-transform'
      }
    >
      <path d="M3.5 2L7 5L3.5 8" />
    </svg>
  );
}
