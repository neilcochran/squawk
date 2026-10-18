import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactElement, RefObject } from 'react';

import { InspectorGrabHandle } from '../../shared/inspector/inspector-grab-handle.tsx';
import { computeSheetOcclusionPx } from '../../shared/inspector/inspector-sheet.ts';
import { useSheetMinimizeDrag } from '../../shared/inspector/use-sheet-minimize-drag.ts';
import { useIsDesktopLayout } from '../../shared/styles/use-is-desktop-layout.ts';
import { SidePanelResizeHandle } from '../../shared/ui/side-panel-resize-handle.tsx';
import { useSidePanelWidth } from '../../shared/ui/use-side-panel-width.ts';

import { planLegStatus } from './layers/plan-route-features.ts';
import {
  formatDistanceNm,
  formatEteHrs,
  describeLegStatus,
  formatLegStatus,
  formatRouteIssue,
} from './plan-format.ts';
import { PlanGroundSpeedInput } from './plan-ground-speed-input.tsx';
import type { PlanRoute } from './plan-route.ts';

/**
 * Props for {@link PlanSummaryPanel}.
 */
export interface PlanSummaryPanelProps {
  /** The resolved route, or `undefined` when the route is empty or data is still loading. */
  route: PlanRoute | undefined;
  /** Whether the URL carries a route that cannot be resolved until the data finishes loading. */
  loading: boolean;
  /** Current planning ground speed in knots, or `undefined` when unset. */
  groundSpeedKt: number | undefined;
  /** Called when the user commits a ground speed (`undefined` clears it). */
  onGroundSpeedChange: (groundSpeedKt: number | undefined) => void;
  /** Ref to attach to the panel element, so the route framing can read the sheet's height. */
  sheetRef?: RefObject<HTMLElement | null>;
}

/**
 * Inline style for the bottom sheet. Extends {@link CSSProperties} with the
 * two custom properties the sheet transform reads, so the custom-property
 * keys type-check without a cast.
 */
interface SheetStyle extends CSSProperties {
  /** Measured height of the always-visible peek region (handle + header). */
  '--peek-h': string;
  /** Resolved vertical translate: live drag pixels, committed calc, or zero. */
  '--sheet-ty': string;
}

/**
 * Responsive container classes: a right-edge panel at the `md:` breakpoint and
 * a bottom sheet below it, mirroring the entity inspector so the two modes feel
 * consistent. The desktop panel is as wide as `--atlas-side-panel-width`, which
 * the user drags; the bottom sheet slides by `--sheet-ty`, which the grab
 * handle drives, and the slide is pinned to zero at `md:`.
 */
const PANEL_CLASSES =
  'absolute right-0 bottom-0 left-0 z-20 max-h-[50vh] translate-y-[var(--sheet-ty)] overflow-y-auto rounded-t-xl border-t border-slate-200 bg-white shadow-lg md:top-0 md:left-auto md:max-h-none md:w-(--atlas-side-panel-width) md:translate-y-0 md:rounded-none md:border-t-0 md:border-l dark:border-slate-700 dark:bg-slate-900';

/** localStorage key for the desktop flight plan panel's user-chosen width. */
const PANEL_WIDTH_STORAGE_KEY = 'atlas:plan:summary-width:v1';

/**
 * Plan-mode panel summarizing the resolved route: a warning when the route is
 * not valid as filed (it crosses an airway gap or an unusable airway segment,
 * or files a SID or STAR at an airport it does not serve), total distance and
 * ETE, a ground-speed field that drives the ETE, the per-leg distance
 * breakdown with the offending legs tagged, and any route tokens that did not
 * resolve. Renders a hint when no route has been entered yet, and a loading
 * line instead when the URL carries a route the data has not arrived to
 * resolve (a share link opened cold). On desktop the user can drag the
 * panel's left edge to widen it when leg labels truncate, and the width is
 * kept per browser.
 *
 * Below `md:` the panel is a bottom sheet that stays hidden until the URL
 * carries a route, so an empty plan leaves the whole map visible; the route
 * input's placeholder already says what to do. Once shown, the sheet has the
 * entity inspector's grab handle: drag down (or tap) to minimize it to its
 * header, up to restore it. Committing a different route restores it, since a
 * new route is an explicit "show me this". Minimizing is a bottom-sheet
 * gesture only - the desktop panel has no control to undo it - so a phone
 * rotated past the breakpoint while minimized gets the full panel. The sheet
 * publishes its live occlusion as the custom property the zoom / tilt
 * controls read, following it through hiding, minimizing and dragging.
 */
export function PlanSummaryPanel({
  route,
  loading,
  groundSpeedKt,
  onGroundSpeedChange,
  sheetRef,
}: PlanSummaryPanelProps): ReactElement {
  const isDesktopLayout = useIsDesktopLayout();
  // Whether there is a route to summarize: one resolved, or one in the URL
  // waiting on the data. The bottom sheet only shows while this holds.
  const hasRoute = route !== undefined || loading;

  // Transient minimize state, forgotten on refresh (it is not in the URL).
  const [minimized, setMinimized] = useState(false);
  // A different route string restores the sheet. Keyed on the raw route
  // rather than the route object, which is rebuilt on every ground-speed
  // edit. setState-during-render is the React-sanctioned way to reset state
  // from a changed value without an effect.
  const routeKey = route?.parsed.raw;
  const [previousRouteKey, setPreviousRouteKey] = useState(routeKey);
  if (previousRouteKey !== routeKey) {
    setPreviousRouteKey(routeKey);
    if (minimized) {
      setMinimized(false);
    }
  }
  const sheetMinimized = minimized && !isDesktopLayout;

  // Refs feed the drag hook the element heights it needs to size the
  // sheet's slide range; the measured heights also drive the occlusion and
  // the committed-minimized translate. Mirrors the entity inspector; jsdom
  // has no ResizeObserver, so the guard keeps specs on the zero path. The
  // caller's ref, when given, doubles as the panel's own.
  const internalAsideRef = useRef<HTMLElement>(null);
  const asideRef = sheetRef ?? internalAsideRef;
  const peekRef = useRef<HTMLDivElement>(null);
  const [asideHeightPx, setAsideHeightPx] = useState(0);
  const [peekHeightPx, setPeekHeightPx] = useState(0);
  useEffect(() => {
    const aside = asideRef.current;
    const peek = peekRef.current;
    if (aside === null || peek === null || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const measure = (): void => {
      setAsideHeightPx(aside.offsetHeight);
      setPeekHeightPx(peek.offsetHeight);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(aside);
    observer.observe(peek);
    measure();
    return (): void => {
      observer.disconnect();
    };
  }, [asideRef]);

  const {
    dragOffsetPx,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleClick: handleGrabHandleClick,
  } = useSheetMinimizeDrag({
    minimized: sheetMinimized,
    onMinimizedChange: setMinimized,
    asideRef,
    peekRef,
  });

  // Publish the sheet's live occlusion and the matching transition timing
  // so the zoom / tilt controls lift to stay above it. They are the same
  // properties the entity inspector writes; the two never mount together,
  // since each belongs to one mode. Desktop ignores them, as the controls
  // reset to a fixed offset at the md breakpoint. useLayoutEffect writes
  // before paint so the controls never lag a frame behind the sheet.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const occlusionPx = computeSheetOcclusionPx({
      active: hasRoute,
      dragOffsetPx,
      minimized: sheetMinimized,
      sheetHeightPx: asideHeightPx,
      peekHeightPx,
    });
    root.style.setProperty('--atlas-inspector-occlusion', `${occlusionPx}px`);
    root.style.setProperty('--atlas-inspector-anim', dragOffsetPx === undefined ? '200ms' : '0ms');
    return (): void => {
      root.style.removeProperty('--atlas-inspector-occlusion');
      root.style.removeProperty('--atlas-inspector-anim');
    };
  }, [hasRoute, dragOffsetPx, sheetMinimized, asideHeightPx, peekHeightPx]);

  const panelWidth = useSidePanelWidth(PANEL_WIDTH_STORAGE_KEY);

  // While a drag is live the sheet follows the finger 1:1, so the translate
  // is the live pixel offset and the snap transition is suppressed; on
  // release the offset clears and the sheet animates to its committed slot.
  const sheetStyle: SheetStyle = {
    '--peek-h': `${peekHeightPx}px`,
    '--sheet-ty':
      dragOffsetPx !== undefined
        ? `${dragOffsetPx}px`
        : sheetMinimized
          ? 'calc(100% - var(--peek-h))'
          : '0px',
  };
  const sheetTransitionClasses =
    dragOffsetPx === undefined
      ? 'transition-transform duration-200 ease-out motion-reduce:transition-none'
      : '';
  const hiddenClasses = hasRoute ? '' : 'hidden md:block';

  return (
    <>
      <aside
        ref={asideRef}
        style={sheetStyle}
        className={`${PANEL_CLASSES} ${sheetTransitionClasses} ${hiddenClasses}`}
        aria-label="Flight plan summary"
      >
        <div ref={peekRef} className="sticky top-0 z-10 bg-white dark:bg-slate-900">
          <InspectorGrabHandle
            minimized={sheetMinimized}
            label="flight plan"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onClick={handleGrabHandleClick}
          />
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Flight plan
            </h2>
          </div>
        </div>

        <div inert={sheetMinimized}>
          {route === undefined ? (
            <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
              {loading
                ? 'Loading aeronautical data to resolve this route...'
                : 'Enter a route above to see its distance, legs, and estimated time enroute.'}
            </p>
          ) : (
            <div className="space-y-4 px-4 py-3">
              {route.issues.length > 0 ? (
                <div
                  role="status"
                  className="rounded border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950"
                >
                  <h3 className="text-xs font-semibold tracking-wide text-amber-700 uppercase dark:text-amber-400">
                    Not valid as filed
                  </h3>
                  <ul className="mt-1 space-y-0.5 text-sm text-amber-900 dark:text-amber-200">
                    {route.issues.map((issue, index) => (
                      <li key={`${issue.kind}-${index}`}>{formatRouteIssue(issue)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

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

              <PlanGroundSpeedInput value={groundSpeedKt} onCommit={onGroundSpeedChange} />

              {route.distance.legs.length > 0 ? (
                <div>
                  <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                    Legs
                  </h3>
                  <ol className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
                    {route.distance.legs.map((leg, index) => {
                      const status = planLegStatus(leg);
                      return (
                        <li
                          key={`${leg.from}-${leg.to}-${index}`}
                          className="flex items-baseline justify-between gap-3 py-1.5 text-sm"
                        >
                          <span className="flex min-w-0 items-baseline gap-1.5">
                            <span
                              title={`${leg.from} -> ${leg.to}`}
                              className={`truncate ${status === 'valid' ? 'text-slate-700 dark:text-slate-200' : 'text-amber-700 dark:text-amber-400'}`}
                            >
                              {`${leg.from} -> ${leg.to}`}
                            </span>
                            {status !== 'valid' ? (
                              <span
                                title={describeLegStatus(status)}
                                className="shrink-0 rounded bg-amber-100 px-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              >
                                {formatLegStatus(status)}
                              </span>
                            ) : null}
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
                      );
                    })}
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
        </div>
      </aside>
      <SidePanelResizeHandle width={panelWidth} label="Resize flight plan panel" />
    </>
  );
}
