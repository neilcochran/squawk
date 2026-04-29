import { Fragment, useCallback, useState } from 'react';
import type { ReactElement } from 'react';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MenuItemRow } from '../../shared/ui/menu-item-row.tsx';
import { FLOATING_SURFACE_CLASSES, FOCUS_RING_CLASSES } from '../../shared/styles/style-tokens.ts';
import {
  AIRSPACE_CLASSES,
  AIRWAY_CATEGORIES,
  CHART_ROUTE_PATH,
  LAYER_IDS,
  LAYER_MIN_ZOOM,
} from './url-state.ts';
import type { AirspaceClass, AirwayCategory, LayerId } from './url-state.ts';
import { ExpandableParentRow, SimpleParentRow, SubRow } from './layer-toggle-rows.tsx';
import { CheckIcon } from './layer-toggle-icons.tsx';
import { useAirspace3DAutoHidePreference } from './airspace-3d-preference.ts';

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
  const { layers, airspaceClasses, airwayCategories, zoom } = route.useSearch();
  const navigate = useNavigate({ from: CHART_ROUTE_PATH });
  const [expanded, setExpanded] = useState<ReadonlySet<LayerId>>(() => new Set());
  const [autoHidePreference, setAutoHidePreference] = useAirspace3DAutoHidePreference();

  // Toggle handler for the auto-hide setting row at the bottom of the
  // dropdown. The row is a binary checkbox - checked means the
  // preference is `'always'`, unchecked means `'never'`. The third
  // possible state (`'ask'`) is the initial default for users who have
  // not yet interacted with the dialog or this row; flipping the
  // checkbox once collapses it into one of the explicit values.
  const handleAutoHideChange = useCallback(
    (checked: boolean): void => {
      setAutoHidePreference(checked ? 'always' : 'never');
    },
    [setAutoHidePreference],
  );

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
      <DropdownMenu.Trigger
        className={`absolute top-3 right-3 z-10 rounded-md px-3 py-2.5 text-sm font-medium text-slate-700 shadow-md hover:bg-slate-50 ${FLOATING_SURFACE_CLASSES} ${FOCUS_RING_CLASSES} md:py-1.5 dark:text-slate-200 dark:hover:bg-slate-800`}
      >
        Layers
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className={`min-w-[14rem] rounded-md p-1 shadow-lg ${FLOATING_SURFACE_CLASSES}`}
        >
          {LAYER_OPTIONS.map((option) => {
            const isExpandable = EXPANDABLE_LAYERS.has(option.id);
            const parentChecked = layers.includes(option.id);
            // Resolve the layer's zoom-gating threshold from the central
            // table and pass it through only when the current map zoom is
            // below it. Above the threshold (or when the layer has no
            // entry) the hint is suppressed by passing undefined.
            const minZoom = LAYER_MIN_ZOOM[option.id];
            const hintMinZoom = minZoom !== undefined && zoom < minZoom ? minZoom : undefined;
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
                    hintMinZoom={hintMinZoom}
                  />
                ) : (
                  <SimpleParentRow
                    label={option.label}
                    checked={parentChecked}
                    onCheckedChange={(checked) => handleLayerChange(option.id, checked)}
                    hintMinZoom={hintMinZoom}
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
          {/*
            Settings row for the 3D auto-hide preference. Lives below
            the layer rows behind a separator so the visual hierarchy
            reads as "layers above, settings below". The checkbox is
            binary (always vs never); the initial `'ask'` default
            renders unchecked, and flipping the row collapses the
            preference into an explicit value.
          */}
          <DropdownMenu.Separator className="my-1 h-px bg-slate-200 dark:bg-slate-700" />
          <MenuItemRow
            checked={autoHidePreference === 'always'}
            onCheckedChange={handleAutoHideChange}
            onSelect={(event) => event.preventDefault()}
            className="px-2 py-2.5 md:py-1.5"
          >
            <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center">
              <DropdownMenu.ItemIndicator>
                <CheckIcon />
              </DropdownMenu.ItemIndicator>
            </span>
            <span className="flex-1">Auto-hide Class E, Warning, ARTCC in 3D</span>
          </MenuItemRow>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
