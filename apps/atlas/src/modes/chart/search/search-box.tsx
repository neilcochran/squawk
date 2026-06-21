import { useMap } from '@vis.gl/react-maplibre';
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';

import {
  fitFeatureBoundsWithInspectorOffset,
  getMapInstance,
  panToFeatureWithInspectorOffset,
} from '../../../shared/inspector/use-chip-hover-pan.ts';
import {
  FLOATING_SURFACE_CLASSES,
  FOCUS_RING_CLASSES,
} from '../../../shared/styles/style-tokens.ts';

import type { ChartSearchResult, SearchFeatureKind } from './search-features.ts';
import { SearchFilterMenu } from './search-filter-menu.tsx';
import { splitByMatchRanges } from './search-highlight.ts';
import { useChartSearch } from './use-chart-search.ts';

/**
 * Zoom level a chosen point result (airport, navaid, or fix) eases to when the
 * current view is more zoomed out than this. Applied as a floor via `Math.max`,
 * so selecting a result from the CONUS overview zooms in to a useful level while
 * a user already zoomed in closer is left where they are. High enough to clear
 * the navaid (z5) and fix (z7) layer-visibility gates so the chosen feature
 * actually renders.
 */
const POINT_RESULT_ZOOM = 10;

/**
 * Short uppercase badge text shown in the leading column of each result
 * row so the user can tell at a glance what kind of feature the row is.
 * Mirrors the human-readable labels the disambiguation popover uses.
 */
function kindBadgeLabel(kind: SearchFeatureKind): string {
  switch (kind) {
    case 'airport':
      return 'Airport';
    case 'navaid':
      return 'Navaid';
    case 'fix':
      return 'Fix';
    case 'airway':
      return 'Airway';
    case 'airspace':
      return 'Airspace';
  }
}

/**
 * Secondary, muted line for a result row. When the matched field is not the
 * primary label (e.g. an airport matched on its city while the row leads with
 * the FAA id), the label is the useful context to show; otherwise fall back to
 * the result's own sublabel (e.g. an airport or navaid name). Returns undefined
 * when there is nothing extra worth showing.
 */
function secondaryText(result: ChartSearchResult): string | undefined {
  if (result.label !== result.matchedText) {
    return result.label;
  }
  return result.sublabel;
}

/**
 * Props for {@link SearchBox}.
 */
export interface SearchBoxProps {
  /**
   * Called with the chosen result when the user activates a row (click or
   * Enter). The caller owns the URL effects of selection - writing the
   * `selected` param and revealing any hidden owning layer - plus any
   * transient-state resets. The search box itself eases the camera to frame the
   * result (zooming in on point features, fitting the bounds of extent features)
   * and clears its query so the dropdown collapses.
   */
  onSelectResult: (result: ChartSearchResult) => void;
}

/**
 * Floating chart-feature search box anchored to the top-left of the map area.
 *
 * Holds the in-progress query in component state (transient interaction text,
 * not URL state) and runs the live, score-ranked search via
 * {@link useChartSearch}, which reads the Layers-menu and search-filter state
 * from the URL. Results render in a listbox dropdown that updates as the user
 * types; each row shows a feature-kind badge, the matched text with the
 * matched characters emphasized, and a muted secondary line for context.
 *
 * The input is an ARIA combobox driving an `aria-activedescendant` listbox:
 * ArrowUp / ArrowDown move the active row, Enter selects it, and Escape clears
 * the query. Hovering a row makes it the active row so mouse and keyboard share
 * one highlight. Selecting a row eases the camera to frame the result (a zoom
 * floor for point features, a fit-bounds for extent features), calls
 * {@link SearchBoxProps.onSelectResult}, and clears the query, collapsing the
 * dropdown.
 */
export function SearchBox({ onSelectResult }: SearchBoxProps): ReactElement {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useChartSearch(query);
  const [prevResults, setPrevResults] = useState(results);
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // The search box renders inside the chart-mode `<MapProvider>`, so it can
  // reach the live MapLibre instance to ease the camera to a chosen result.
  const map = useMap();
  const mapRef = map.current ?? map.default;

  const open = focused && query.trim().length > 0;
  const activeIndexClamped = results.length === 0 ? 0 : Math.min(activeIndex, results.length - 1);
  const activeDescendant =
    open && results.length > 0 ? `${listboxId}-option-${activeIndexClamped}` : undefined;

  // A fresh result set means a fresh best match: reset the active row to the
  // top so Enter selects the strongest match for the latest keystroke. React
  // recommends adjusting state during render (rather than in a syncing effect)
  // when the new value derives from a prior render's value. `results` is a
  // memoized array, so its identity only changes when the query or filters
  // change - never on an unrelated re-render such as an arrow-key move.
  if (results !== prevResults) {
    setPrevResults(results);
    setActiveIndex(0);
  }

  // Keep the keyboard-selected row scrolled into view as the user arrows
  // through a list taller than the dropdown. Guarded for jsdom, which does
  // not implement scrollIntoView.
  useEffect((): void => {
    if (!open) {
      return;
    }
    const node = listRef.current?.children[activeIndexClamped];
    if (node instanceof HTMLElement && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndexClamped, open]);

  function commit(result: ChartSearchResult): void {
    // Frame the result before the caller commits the URL, mirroring the
    // inspector's chip-commit ordering. Point features (airport, navaid, fix)
    // ease to a zoom floor so a pick from the CONUS overview lands close enough
    // to be useful; extent features (airways, airspace) fit their whole bounding
    // box. Both read geometry from the result itself, so framing works even
    // while the caller reveals and mounts a previously hidden layer.
    const mapInstance = getMapInstance(mapRef);
    if (mapInstance !== undefined) {
      if (result.kind === 'airway' || result.kind === 'airspace') {
        fitFeatureBoundsWithInspectorOffset(result.bbox, mapInstance);
      } else {
        panToFeatureWithInspectorOffset(
          result.center,
          mapInstance,
          Math.max(mapInstance.getZoom(), POINT_RESULT_ZOOM),
        );
      }
    }
    onSelectResult(result);
    setQuery('');
    setActiveIndex(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Escape') {
      if (query.length > 0) {
        event.preventDefault();
        setQuery('');
        setActiveIndex(0);
      }
      return;
    }
    if (!open || results.length === 0) {
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex(Math.min(activeIndexClamped + 1, results.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex(Math.max(activeIndexClamped - 1, 0));
        break;
      case 'Enter': {
        const result = results[activeIndexClamped];
        if (result !== undefined) {
          event.preventDefault();
          commit(result);
        }
        break;
      }
    }
  }

  return (
    <div className="absolute top-3 left-3 z-10 w-96 max-w-[calc(100vw-6rem)]">
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400 dark:text-slate-500"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="6" cy="6" r="4.5" />
            <path d="M9.5 9.5L13 13" />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeDescendant}
          aria-autocomplete="list"
          aria-label="Search chart features"
          autoComplete="off"
          spellCheck={false}
          placeholder="Search"
          value={query}
          onChange={(event): void => setQuery(event.target.value)}
          onFocus={(): void => setFocused(true)}
          onBlur={(): void => setFocused(false)}
          onKeyDown={handleKeyDown}
          className={`w-full rounded-md py-2.5 pr-16 pl-9 text-sm text-slate-700 shadow-md placeholder:text-slate-400 ${FLOATING_SURFACE_CLASSES} ${FOCUS_RING_CLASSES} md:py-1.5 dark:text-slate-200 dark:placeholder:text-slate-500`}
        />
        {query.length > 0 ? (
          <button
            type="button"
            aria-label="Clear search"
            onMouseDown={(event): void => event.preventDefault()}
            onClick={(): void => {
              setQuery('');
              setActiveIndex(0);
              inputRef.current?.focus();
            }}
            className={`absolute top-1/2 right-9 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:text-slate-700 ${FOCUS_RING_CLASSES} dark:text-slate-500 dark:hover:text-slate-200`}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M3 3L9 9M9 3L3 9" />
            </svg>
          </button>
        ) : null}
        <SearchFilterMenu />
      </div>
      {open ? (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Search results"
          // Keep the input focused when the user presses on a row so the
          // click registers as a selection rather than a blur that closes the
          // dropdown before onClick fires.
          onMouseDown={(event): void => event.preventDefault()}
          className={`mt-1 max-h-[min(60vh,24rem)] overflow-y-auto rounded-md shadow-lg ${FLOATING_SURFACE_CLASSES}`}
        >
          {results.length === 0 ? (
            <li
              role="presentation"
              className="px-3 py-2.5 text-sm text-slate-500 md:py-2 dark:text-slate-400"
            >
              No matches found
            </li>
          ) : (
            results.map((result, index) => {
              const isActive = index === activeIndexClamped;
              const segments = splitByMatchRanges(result.matchedText, result.ranges);
              const secondary = secondaryText(result);
              return (
                // Keyboard activation lives on the combobox input via
                // aria-activedescendant (the ARIA listbox pattern); the options
                // are not focusable, so a per-row key handler would be dead code.
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                <li
                  key={`${result.selection}-${index}`}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={isActive}
                  onClick={(): void => commit(result)}
                  onMouseEnter={(): void => setActiveIndex(index)}
                  className={`flex cursor-pointer items-baseline gap-2 px-3 py-3 text-sm md:py-1.5 ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <span className="w-16 shrink-0 text-[10px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                    {kindBadgeLabel(result.kind)}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">
                      {segments.map((segment, segmentIndex) =>
                        segment.matched ? (
                          <mark
                            key={segmentIndex}
                            className="bg-transparent font-semibold text-indigo-700 dark:text-indigo-300"
                          >
                            {segment.text}
                          </mark>
                        ) : (
                          <span key={segmentIndex}>{segment.text}</span>
                        ),
                      )}
                    </span>
                    {secondary !== undefined ? (
                      <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {secondary}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
