import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ChangeEvent, ReactElement } from 'react';

import { FOCUS_RING_CLASSES } from '../../shared/styles/style-tokens.ts';

import { formatDistanceNm, formatEteHrs } from './plan-format.ts';
import type { PlanRoute } from './plan-route.ts';

/**
 * Props for {@link PlanSummaryPanel}.
 */
export interface PlanSummaryPanelProps {
  /** The resolved route, or `undefined` when the route is empty or data is still loading. */
  route: PlanRoute | undefined;
  /** Current planning ground speed in knots, or `undefined` when unset. */
  groundSpeedKt: number | undefined;
  /** Called when the user edits the ground speed (`undefined` clears it). */
  onGroundSpeedChange: (groundSpeedKt: number | undefined) => void;
}

/**
 * Responsive container classes: a right-edge panel at the `md:` breakpoint and
 * a bottom sheet below it, mirroring the entity inspector so the two modes feel
 * consistent. No minimize / drag affordance in v1 - the panel is static.
 */
const PANEL_CLASSES =
  'absolute right-0 bottom-0 left-0 z-20 max-h-[50vh] overflow-y-auto border-t border-slate-200 bg-white shadow-lg md:top-0 md:left-auto md:max-h-none md:w-inspector md:border-t-0 md:border-l dark:border-slate-700 dark:bg-slate-900';

/**
 * Plan-mode panel summarizing the resolved route: total distance and ETE, a
 * ground-speed field that drives the ETE, the per-leg distance breakdown, and
 * any route tokens that did not resolve. Renders a hint when no route has been
 * entered yet. Publishes its rendered height as the sheet-occlusion custom
 * property so the map's zoom / tilt controls lift clear of the bottom sheet
 * on phones.
 */
export function PlanSummaryPanel({
  route,
  groundSpeedKt,
  onGroundSpeedChange,
}: PlanSummaryPanelProps): ReactElement {
  const handleGsChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const raw = event.target.value.trim();
    if (raw === '') {
      onGroundSpeedChange(undefined);
      return;
    }
    const parsed = Number(raw);
    onGroundSpeedChange(Number.isFinite(parsed) && parsed > 0 ? parsed : undefined);
  };

  // Measure the rendered panel so the mobile bottom sheet can publish how
  // much of the map it covers. Mirrors the entity inspector's measurement;
  // jsdom has no ResizeObserver, so the guard keeps specs on the zero path.
  const asideRef = useRef<HTMLElement>(null);
  const [asideHeightPx, setAsideHeightPx] = useState(0);
  useEffect(() => {
    const aside = asideRef.current;
    if (aside === null || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const measure = (): void => {
      setAsideHeightPx(aside.offsetHeight);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(aside);
    measure();
    return (): void => {
      observer.disconnect();
    };
  }, []);

  // Publish the sheet's live height as the occlusion custom property the
  // zoom / tilt controls read to lift above the bottom sheet. It is the same
  // property the entity inspector writes; the two never mount together, since
  // each belongs to one mode. The panel is always mounted in plan mode, so
  // there is no idle state to zero it - the unmount cleanup on a mode switch
  // removes it. Desktop ignores the value, as the controls reset to a fixed
  // offset at the md breakpoint. useLayoutEffect writes before paint so the
  // controls never lag a frame behind the sheet.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--atlas-inspector-occlusion', `${asideHeightPx}px`);
    return (): void => {
      root.style.removeProperty('--atlas-inspector-occlusion');
    };
  }, [asideHeightPx]);

  return (
    <aside ref={asideRef} className={PANEL_CLASSES} aria-label="Flight plan summary">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Flight plan</h2>
      </div>

      {route === undefined ? (
        <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
          Enter a route above to see its distance, legs, and estimated time enroute.
        </p>
      ) : (
        <div className="space-y-4 px-4 py-3">
          <dl className="flex items-baseline justify-between gap-4">
            <div>
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Total distance
              </dt>
              <dd className="text-lg font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                {formatDistanceNm(route.distance.totalDistanceNm)}
              </dd>
            </div>
            <div className="text-right">
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">ETE</dt>
              <dd className="text-lg font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                {route.distance.estimatedTimeEnrouteHrs !== undefined
                  ? formatEteHrs(route.distance.estimatedTimeEnrouteHrs)
                  : '-'}
              </dd>
            </div>
          </dl>

          <div>
            <label
              htmlFor="plan-ground-speed"
              className="block text-xs font-medium text-slate-500 dark:text-slate-400"
            >
              Ground speed (kt)
            </label>
            <input
              id="plan-ground-speed"
              type="number"
              inputMode="numeric"
              min={1}
              max={2000}
              value={groundSpeedKt ?? ''}
              onChange={handleGsChange}
              placeholder="e.g. 450"
              className={`mt-1 w-28 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 ${FOCUS_RING_CLASSES}`}
            />
          </div>

          {route.distance.legs.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                Legs
              </h3>
              <ol className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
                {route.distance.legs.map((leg, index) => (
                  <li
                    key={`${leg.from}-${leg.to}-${index}`}
                    className="flex items-baseline justify-between gap-3 py-1.5 text-sm"
                  >
                    <span className="truncate text-slate-700 dark:text-slate-200">
                      {`${leg.from} -> ${leg.to}`}
                    </span>
                    <span className="flex shrink-0 gap-3 tabular-nums">
                      <span className="text-slate-700 dark:text-slate-200">
                        {formatDistanceNm(leg.distanceNm)}
                      </span>
                      <span className="w-20 text-right text-slate-400 dark:text-slate-500">
                        {formatDistanceNm(leg.cumulativeDistanceNm)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No drawable legs - the route did not resolve to two or more points.
            </p>
          )}

          {route.distance.unresolvedElements.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-amber-600 uppercase dark:text-amber-500">
                Unresolved
              </h3>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {route.distance.unresolvedElements.map((element, index) => (
                  <li
                    key={`${element.raw}-${index}`}
                    className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  >
                    {element.raw}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </aside>
  );
}
