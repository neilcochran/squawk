import { useCallback } from 'react';
import type { ReactElement } from 'react';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { CHART_ROUTE_PATH } from '../../modes/chart/url-state.ts';
import { useResolvedEntity } from './entity-resolver.ts';
import type { ResolvedEntity, ResolvedEntityState } from './entity-resolver.ts';
import { AirportPanel } from './renderers/airport-panel.tsx';
import { AirspacePanel } from './renderers/airspace-panel.tsx';
import { AirwayPanel } from './renderers/airway-panel.tsx';
import { FixPanel } from './renderers/fix-panel.tsx';
import { NavaidPanel } from './renderers/navaid-panel.tsx';

const route = getRouteApi(CHART_ROUTE_PATH);

/**
 * Right-side inspector panel that shows details for the entity referenced
 * by the URL `selected` search param. Renders nothing when no entity is
 * selected; renders a slim loading or not-found header when the URL points
 * at an unloaded or stale id; otherwise dispatches to a per-type renderer.
 *
 * The panel is positioned `absolute` along the right edge of the chart
 * area (`top-0 right-0 bottom-0 w-[360px]`). It overlaps the layer-toggle
 * dropdown when both are open; the close affordance is the X in the
 * panel header. Click-on-empty-map dismissal lands in step 18b alongside
 * the click-to-select handler; for now the only way to clear the panel
 * is the X (or removing `?selected=` from the URL by hand).
 *
 * Must be rendered inside the chart route's component tree so
 * `getRouteApi(CHART_ROUTE_PATH)` resolves (the panel reads + writes the
 * `selected` search param).
 */
export function EntityInspector(): ReactElement | null {
  const { selected } = route.useSearch();
  const navigate = useNavigate({ from: CHART_ROUTE_PATH });
  const state = useResolvedEntity(selected);

  const handleClose = useCallback((): void => {
    void navigate({
      search: (prev) => ({ ...prev, selected: undefined }),
      replace: true,
    });
  }, [navigate]);

  if (state.status === 'idle') {
    return null;
  }

  return (
    <aside
      className="absolute top-0 right-0 bottom-0 z-20 w-[360px] overflow-y-auto border-l border-slate-200 bg-white shadow-lg"
      aria-label="Entity inspector"
    >
      <InspectorHeader state={state} onClose={handleClose} />
      <InspectorBody state={state} />
    </aside>
  );
}

/**
 * Sticky header at the top of the panel showing a one-line summary (entity
 * type + identifier or status) and a close button.
 */
function InspectorHeader({
  state,
  onClose,
}: {
  state: ResolvedEntityState;
  onClose: () => void;
}): ReactElement {
  return (
    <header className="sticky top-0 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <HeaderText state={state} />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close inspector"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        <CloseIcon />
      </button>
    </header>
  );
}

/**
 * Renders the left-side text inside the inspector header. Branches on the
 * resolution state so the loading / not-found cases get their own labelling
 * without dropping the user out of the panel entirely.
 */
function HeaderText({ state }: { state: ResolvedEntityState }): ReactElement | null {
  if (state.status === 'idle') {
    return null;
  }
  if (state.status === 'loading') {
    return (
      <div>
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
          {state.ref.type}
        </p>
        <h2 className="text-base font-semibold text-slate-900">{state.ref.id}</h2>
        <p className="mt-1 text-xs text-slate-500">Loading dataset...</p>
      </div>
    );
  }
  if (state.status === 'not-found') {
    return (
      <div>
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
          {state.ref.type}
        </p>
        <h2 className="text-base font-semibold text-slate-900">{state.ref.id}</h2>
        <p className="mt-1 text-xs text-rose-600">No matching record</p>
      </div>
    );
  }
  return <ResolvedHeaderText entity={state.entity} />;
}

/**
 * Header text for a successfully resolved entity. Each kind picks the most
 * informative one-or-two-line label its dataset can produce.
 */
function ResolvedHeaderText({ entity }: { entity: ResolvedEntity }): ReactElement {
  switch (entity.kind) {
    case 'airport':
      return (
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Airport</p>
          <h2 className="text-base font-semibold text-slate-900">
            {entity.record.faaId}
            {entity.record.icao !== undefined ? (
              <span className="ml-2 text-sm font-normal text-slate-500">{entity.record.icao}</span>
            ) : null}
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">{entity.record.name}</p>
        </div>
      );
    case 'navaid':
      return (
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            {entity.record.type}
          </p>
          <h2 className="text-base font-semibold text-slate-900">{entity.record.identifier}</h2>
          <p className="mt-0.5 text-xs text-slate-600">{entity.record.name}</p>
        </div>
      );
    case 'fix':
      return (
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Fix</p>
          <h2 className="text-base font-semibold text-slate-900">{entity.record.identifier}</h2>
        </div>
      );
    case 'airway':
      return (
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            {entity.record.type} airway
          </p>
          <h2 className="text-base font-semibold text-slate-900">{entity.record.designation}</h2>
        </div>
      );
    case 'airspace':
      return (
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            {entity.airspaceType.replace(/_/g, ' ')}
          </p>
          <h2 className="text-base font-semibold text-slate-900">{entity.identifier}</h2>
          <p className="mt-0.5 text-xs text-slate-600">
            {entity.features.length} feature{entity.features.length === 1 ? '' : 's'}
          </p>
        </div>
      );
  }
}

/**
 * Body of the inspector panel below the header. For loading / not-found
 * states the body is empty (the header carries the status); for resolved
 * entities, dispatches to a per-type renderer.
 */
function InspectorBody({ state }: { state: ResolvedEntityState }): ReactElement | null {
  if (state.status !== 'resolved') {
    return null;
  }
  const entity = state.entity;
  switch (entity.kind) {
    case 'airport':
      return <AirportPanel record={entity.record} />;
    case 'navaid':
      return <NavaidPanel record={entity.record} />;
    case 'fix':
      return <FixPanel record={entity.record} />;
    case 'airway':
      return <AirwayPanel record={entity.record} />;
    case 'airspace':
      return <AirspacePanel features={entity.features} />;
  }
}

/** Inline X glyph for the inspector close button. */
function CloseIcon(): ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" />
    </svg>
  );
}
