import type { ReactElement } from 'react';

import { MapControlButton } from '../ui/map-control-button.tsx';

import type { ResolvedEntity, ResolvedEntityState } from './entity-resolver.ts';
import { CloseIcon, RecenterIcon } from './inspector-icons.tsx';

/**
 * Props for {@link InspectorHeader}.
 */
export interface InspectorHeaderProps {
  /** Resolution state of the selected entity. */
  state: ResolvedEntityState;
  /** Called when the user clicks the close button. */
  onClose: () => void;
  /**
   * Called when the user clicks the recenter button. Optional - only
   * supplied for resolved-entity states (loading and not-found have
   * nothing to recenter on, so the button is hidden).
   */
  onRecenter?: () => void;
}

/**
 * Sticky header at the top of the inspector panel. Shows a one-line
 * summary on the left (entity type + identifier or status), and on
 * the right a recenter button (when applicable) and a close button.
 * The recenter button is only rendered when an `onRecenter` handler
 * is supplied, which the inspector ties to the resolved-entity state.
 */
export function InspectorHeader({
  state,
  onClose,
  onRecenter,
}: InspectorHeaderProps): ReactElement {
  return (
    <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
      <HeaderText state={state} />
      <div className="flex shrink-0 items-center gap-1">
        {onRecenter === undefined ? null : (
          <MapControlButton
            onClick={onRecenter}
            aria-label="Recenter on this feature"
            title="Recenter on this feature"
          >
            <RecenterIcon />
          </MapControlButton>
        )}
        <MapControlButton onClick={onClose} aria-label="Close inspector">
          <CloseIcon />
        </MapControlButton>
      </div>
    </header>
  );
}

/**
 * Renders the left-side text inside the inspector header. Branches on
 * the resolution state so the loading / not-found cases get their own
 * labelling without dropping the user out of the panel entirely.
 */
function HeaderText({ state }: { state: ResolvedEntityState }): ReactElement | null {
  if (state.status === 'idle') {
    return null;
  }
  if (state.status === 'loading') {
    return (
      <div>
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
          {state.ref.type}
        </p>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {state.ref.id}
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Loading dataset...</p>
      </div>
    );
  }
  if (state.status === 'not-found') {
    return (
      <div>
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
          {state.ref.type}
        </p>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {state.ref.id}
        </h2>
        <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">No matching record</p>
      </div>
    );
  }
  return <ResolvedHeaderText entity={state.entity} />;
}

/**
 * Header text for a successfully resolved entity. Each kind picks the
 * most informative one-or-two-line label its dataset can produce.
 */
function ResolvedHeaderText({ entity }: { entity: ResolvedEntity }): ReactElement {
  switch (entity.kind) {
    case 'airport':
      return (
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
            Airport
          </p>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {entity.record.faaId}
            {entity.record.icao !== undefined ? (
              <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
                {entity.record.icao}
              </span>
            ) : null}
          </h2>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{entity.record.name}</p>
        </div>
      );
    case 'navaid':
      return (
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
            {entity.record.type}
          </p>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {entity.record.identifier}
          </h2>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{entity.record.name}</p>
        </div>
      );
    case 'fix':
      return (
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
            Fix
          </p>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {entity.record.identifier}
          </h2>
        </div>
      );
    case 'airway':
      return (
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
            {entity.record.type} airway
          </p>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {entity.record.designation}
          </h2>
        </div>
      );
    case 'airspace':
      return (
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
            {entity.airspaceType.replace(/_/g, ' ')}
          </p>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {entity.identifier}
          </h2>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            {entity.features.length} feature{entity.features.length === 1 ? '' : 's'}
          </p>
        </div>
      );
  }
}
