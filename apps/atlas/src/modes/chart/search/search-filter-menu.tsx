import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { Fragment, useCallback, useState } from 'react';
import type { ReactElement } from 'react';

import {
  FLOATING_SURFACE_CLASSES,
  FOCUS_RING_CLASSES,
} from '../../../shared/styles/style-tokens.ts';
import { MenuItemRow } from '../../../shared/ui/menu-item-row.tsx';
import {
  AIRSPACE_CLASS_OPTIONS,
  AIRWAY_CATEGORY_OPTIONS,
  EXPANDABLE_LAYERS,
  LAYER_OPTIONS,
} from '../layer-toggle/layer-options.ts';
import { CheckIcon } from '../layer-toggle/layer-toggle-icons.tsx';
import {
  ExpandableParentRow,
  SimpleParentRow,
  SubRow,
} from '../layer-toggle/layer-toggle-rows.tsx';
import { AIRSPACE_CLASSES, AIRWAY_CATEGORIES, CHART_ROUTE_PATH, LAYER_IDS } from '../url-state.ts';
import type { AirspaceClass, AirwayCategory, LayerId } from '../url-state.ts';

const route = getRouteApi(CHART_ROUTE_PATH);

/**
 * Funnel icon for the filter trigger button. Outline-only so it reads as a
 * control affordance rather than a filled glyph, matching the hairline search
 * and clear icons it sits alongside inside the search box.
 */
function FunnelIcon(): ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5 22 3" />
    </svg>
  );
}

/**
 * Search-scope filter dropdown whose trigger sits inside the chart search box,
 * anchored to the input's right edge. Mirrors
 * the Layers menu's feature-type and sub-class rows, but writes the search
 * filter URL fields (`searchLayers`, `searchAirspaceClasses`,
 * `searchAirwayCategories`) instead of the Layers-menu fields - this is the
 * user's "what to search" intent, independent of what the map currently draws.
 * {@link useChartSearch} reads those fields back, so toggling a row re-runs the
 * live search without this component threading any state through.
 *
 * A master "include hidden features" toggle at the top writes
 * `searchIncludeHidden`; when off, the search corpus is intersected with what
 * the Layers menu draws. Rows whose feature type is hidden on the map are
 * dimmed while that toggle is off, signalling the row currently has no effect,
 * yet they stay toggleable so the user's intent persists for when the layer is
 * shown or hidden results are included. A dot on the funnel marks any non-
 * default filter state so the user can tell at a glance that search is scoped.
 */
export function SearchFilterMenu(): ReactElement {
  const {
    layers,
    airspaceClasses,
    airwayCategories,
    searchLayers,
    searchAirspaceClasses,
    searchAirwayCategories,
    searchIncludeHidden,
  } = route.useSearch();
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

  const handleIncludeHiddenChange = useCallback(
    (checked: boolean): void => {
      void navigate({
        search: (prev) => ({ ...prev, searchIncludeHidden: checked }),
        replace: true,
      });
    },
    [navigate],
  );

  const handleSearchLayerChange = useCallback(
    (id: LayerId, checked: boolean): void => {
      const enabled = new Set<LayerId>(searchLayers);
      if (checked) {
        enabled.add(id);
      } else {
        enabled.delete(id);
      }
      const nextLayers = LAYER_IDS.filter((layerId) => enabled.has(layerId));

      // Re-checking the parent of an expandable layer whose sub-array was
      // emptied (which auto-unchecked the parent) refills the sub-array to all
      // so the layer is actually searchable again. A preserved non-empty
      // sub-array is left untouched.
      let nextAirspaceClasses: readonly AirspaceClass[] = searchAirspaceClasses;
      if (checked && id === 'airspace' && searchAirspaceClasses.length === 0) {
        nextAirspaceClasses = [...AIRSPACE_CLASSES];
      }
      let nextAirwayCategories: readonly AirwayCategory[] = searchAirwayCategories;
      if (checked && id === 'airways' && searchAirwayCategories.length === 0) {
        nextAirwayCategories = [...AIRWAY_CATEGORIES];
      }

      void navigate({
        search: (prev) => ({
          ...prev,
          searchLayers: nextLayers,
          searchAirspaceClasses: [...nextAirspaceClasses],
          searchAirwayCategories: [...nextAirwayCategories],
        }),
        replace: true,
      });
    },
    [searchLayers, searchAirspaceClasses, searchAirwayCategories, navigate],
  );

  const handleSearchAirspaceClassChange = useCallback(
    (id: AirspaceClass, checked: boolean): void => {
      const enabled = new Set<AirspaceClass>(searchAirspaceClasses);
      if (checked) {
        enabled.add(id);
      } else {
        enabled.delete(id);
      }
      const nextSub = AIRSPACE_CLASSES.filter((classId) => enabled.has(classId));

      // Couple parent membership with sub-array non-emptiness so the parent
      // checkbox always matches whether anything airspace is searchable:
      //   sub becomes empty + parent on -> auto-uncheck parent
      //   sub becomes non-empty (was empty) + parent off -> auto-check parent
      const parentCurrentlyOn = searchLayers.includes('airspace');
      let nextLayers: readonly LayerId[] = searchLayers;
      if (nextSub.length === 0 && parentCurrentlyOn) {
        nextLayers = searchLayers.filter((layerId) => layerId !== 'airspace');
      } else if (searchAirspaceClasses.length === 0 && nextSub.length > 0 && !parentCurrentlyOn) {
        nextLayers = LAYER_IDS.filter(
          (layerId) => searchLayers.includes(layerId) || layerId === 'airspace',
        );
      }

      void navigate({
        search: (prev) => ({
          ...prev,
          searchAirspaceClasses: nextSub,
          searchLayers: [...nextLayers],
        }),
        replace: true,
      });
    },
    [searchAirspaceClasses, searchLayers, navigate],
  );

  const handleSearchAirwayCategoryChange = useCallback(
    (id: AirwayCategory, checked: boolean): void => {
      const enabled = new Set<AirwayCategory>(searchAirwayCategories);
      if (checked) {
        enabled.add(id);
      } else {
        enabled.delete(id);
      }
      const nextSub = AIRWAY_CATEGORIES.filter((catId) => enabled.has(catId));

      const parentCurrentlyOn = searchLayers.includes('airways');
      let nextLayers: readonly LayerId[] = searchLayers;
      if (nextSub.length === 0 && parentCurrentlyOn) {
        nextLayers = searchLayers.filter((layerId) => layerId !== 'airways');
      } else if (searchAirwayCategories.length === 0 && nextSub.length > 0 && !parentCurrentlyOn) {
        nextLayers = LAYER_IDS.filter(
          (layerId) => searchLayers.includes(layerId) || layerId === 'airways',
        );
      }

      void navigate({
        search: (prev) => ({
          ...prev,
          searchAirwayCategories: nextSub,
          searchLayers: [...nextLayers],
        }),
        replace: true,
      });
    },
    [searchAirwayCategories, searchLayers, navigate],
  );

  // What the Layers menu currently draws, used to dim rows that have no effect
  // while hidden results are excluded. Mirrors computeLayerVisibility: a layer
  // draws nothing when it is off, and an expandable layer draws nothing when no
  // sub-class remains selected.
  const airwaysParentOn = layers.includes('airways');
  const airspaceParentOn = layers.includes('airspace');
  const drawnByLayer: Record<LayerId, boolean> = {
    airports: layers.includes('airports'),
    navaids: layers.includes('navaids'),
    fixes: layers.includes('fixes'),
    airways: airwaysParentOn && airwayCategories.length > 0,
    airspace: airspaceParentOn && airspaceClasses.length > 0,
  };

  // A non-default filter state lights the funnel dot: a narrowed feature set in
  // any of the three sub-filters, or include-hidden flipped on.
  const hasActiveFilter =
    searchIncludeHidden ||
    searchLayers.length < LAYER_IDS.length ||
    searchAirspaceClasses.length < AIRSPACE_CLASSES.length ||
    searchAirwayCategories.length < AIRWAY_CATEGORIES.length;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={hasActiveFilter ? 'Search filters (filters applied)' : 'Search filters'}
        className={`absolute top-1/2 right-1.5 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:text-slate-700 ${FOCUS_RING_CLASSES} dark:text-slate-500 dark:hover:text-slate-200`}
      >
        <span className="flex h-5 w-5 items-center justify-center">
          <FunnelIcon />
        </span>
        {hasActiveFilter ? (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400"
          />
        ) : null}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className={`z-40 min-w-[14rem] rounded-md p-1 shadow-lg ${FLOATING_SURFACE_CLASSES}`}
        >
          {/*
            Master include-hidden toggle. Sits above the per-type rows behind a
            separator so the hierarchy reads as "scope switch above, the feature
            rows it relaxes below". Flipping it on un-dims every row at once.
          */}
          <MenuItemRow
            checked={searchIncludeHidden}
            onCheckedChange={handleIncludeHiddenChange}
            onSelect={(event) => event.preventDefault()}
            className="px-2 py-2.5 md:py-1.5"
          >
            <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center">
              <DropdownMenu.ItemIndicator>
                <CheckIcon />
              </DropdownMenu.ItemIndicator>
            </span>
            <span className="flex-1">Include hidden features</span>
          </MenuItemRow>
          <DropdownMenu.Separator className="my-1 h-px bg-slate-200 dark:bg-slate-700" />
          {LAYER_OPTIONS.map((option) => {
            const isExpandable = EXPANDABLE_LAYERS.has(option.id);
            const parentChecked = searchLayers.includes(option.id);
            const parentDimmed = !searchIncludeHidden && !drawnByLayer[option.id];
            return (
              <Fragment key={option.id}>
                {isExpandable ? (
                  <ExpandableParentRow
                    label={option.label}
                    checked={parentChecked}
                    onCheckedChange={(checked) => handleSearchLayerChange(option.id, checked)}
                    expanded={expanded.has(option.id)}
                    onToggleExpanded={() => toggleExpanded(option.id)}
                    enabledCount={
                      option.id === 'airways'
                        ? searchAirwayCategories.length
                        : searchAirspaceClasses.length
                    }
                    totalCount={
                      option.id === 'airways' ? AIRWAY_CATEGORIES.length : AIRSPACE_CLASSES.length
                    }
                    hintMinZoom={undefined}
                    dimmed={parentDimmed}
                  />
                ) : (
                  <SimpleParentRow
                    label={option.label}
                    checked={parentChecked}
                    onCheckedChange={(checked) => handleSearchLayerChange(option.id, checked)}
                    hintMinZoom={undefined}
                    dimmed={parentDimmed}
                  />
                )}
                {option.id === 'airways' && expanded.has('airways')
                  ? AIRWAY_CATEGORY_OPTIONS.map((category) => (
                      <SubRow
                        key={category.id}
                        label={category.label}
                        checked={searchAirwayCategories.includes(category.id)}
                        onCheckedChange={(c) => handleSearchAirwayCategoryChange(category.id, c)}
                        dimmed={
                          !searchIncludeHidden &&
                          !(airwaysParentOn && airwayCategories.includes(category.id))
                        }
                      />
                    ))
                  : null}
                {option.id === 'airspace' && expanded.has('airspace')
                  ? AIRSPACE_CLASS_OPTIONS.map((cls) => (
                      <SubRow
                        key={cls.id}
                        label={cls.label}
                        checked={searchAirspaceClasses.includes(cls.id)}
                        onCheckedChange={(c) => handleSearchAirspaceClassChange(cls.id, c)}
                        dimmed={
                          !searchIncludeHidden &&
                          !(airspaceParentOn && airspaceClasses.includes(cls.id))
                        }
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
