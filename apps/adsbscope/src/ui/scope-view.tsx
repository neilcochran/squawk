import type { ReactElement } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';

import type {
  ScopeAircraftDetails,
  ScopeConfig,
  ScopeModeId,
  ScopeVideoMap,
} from '../shared/protocol.js';

import { fetchAircraftDetails } from './data/aircraft-details.js';
import { formatUrlSearch, parseUrlState } from './data/url-state.js';
import { useAircraftDetails } from './data/use-aircraft-details.js';
import { useScopeStream } from './data/use-scope-stream.js';
import { useVideoMap } from './data/use-video-map.js';
import { fetchVideoMap } from './data/video-map.js';
import { startsWithControlsShowing } from './hud/controls-visibility.js';
import { EmergencyList } from './hud/emergency-list.js';
import { resolveHotkey } from './hud/hotkeys.js';
import type { KeyPress } from './hud/hotkeys.js';
import { InspectPanel } from './hud/inspect-panel.js';
import { ModeControls } from './hud/mode-controls.js';
import { RangeControls } from './hud/range-controls.js';
import { StatusBar } from './hud/status-bar.js';
import { TabList } from './hud/tab-list.js';
import { useHotkeys } from './hud/use-hotkeys.js';
import { defaultSettingValuesByMode, withModeSettingValues } from './modes/mode-settings.js';
import { selectSetting, stepSetting } from './modes/mode.js';
import type { ModeSetting } from './modes/mode.js';
import { nextScopeMode, SCOPE_MODES, SCOPE_MODES_BY_ID } from './modes/registry.js';
import { stepRange } from './scope/range.js';
import type { RangeDirection } from './scope/range.js';
import { ScopeCanvas } from './scope/scope-canvas.js';
import { findSelectedTarget, stepSelection } from './scope/selection.js';
import type { SelectionDirection } from './scope/selection.js';
import styles from './scope-view.module.css';
import { applyTheme } from './styles/theme.js';

/** Props for {@link ScopeView}. */
export interface ScopeViewProps {
  /** The session config, which supplies the view style and range to start in. */
  config: ScopeConfig;
  /** Loads the video map for a range. Injectable for tests; defaults to fetching it from the scope server. Must be stable across renders. */
  loadVideoMap?: (rangeNm: number) => Promise<ScopeVideoMap | undefined>;
  /** Loads what the registry records about an aircraft. Injectable for tests; defaults to fetching it from the scope server. Must be stable across renders. */
  loadAircraftDetails?: (icaoHex: string) => Promise<ScopeAircraftDetails | undefined>;
}

function initialControlsShowing(): boolean {
  return startsWithControlsShowing(
    typeof window.matchMedia === 'function' ? (query) => window.matchMedia(query) : undefined,
  );
}

/**
 * The working scope: the canvas in the active view style, with the status
 * readout and the on-screen controls over it. Owns everything the user can
 * change while running - the view style, that style's settings, and the range
 * - along with the selection, the live snapshot stream, and the video map for
 * the current range. The view style, range, and selection are mirrored in the
 * URL, so a view can be bookmarked, and are read back from it on load.
 *
 * The selection always names an aircraft that is being tracked: one that a
 * snapshot no longer contains - or that a bookmarked URL named long ago - is
 * dropped, and with it the URL parameter, rather than left claiming a
 * selection that is not there. Every change is reachable both from
 * an on-screen control, which selects an option directly, and from a hotkey,
 * which steps to the next one.
 */
export function ScopeView({
  config,
  loadVideoMap = fetchVideoMap,
  loadAircraftDetails = fetchAircraftDetails,
}: ScopeViewProps): ReactElement {
  const [urlState] = useState(() => parseUrlState(window.location.search));
  const [modeId, setModeId] = useState<ScopeModeId>(urlState.modeId ?? config.mode);
  const [rangeNm, setRangeNm] = useState(urlState.rangeNm ?? config.rangeNm);
  const [settingValuesByMode, setSettingValuesByMode] = useState(defaultSettingValuesByMode);
  const [selectedIcaoHex, setSelectedIcaoHex] = useState(urlState.selectedIcaoHex);
  const [controlsShowing, setControlsShowing] = useState(initialControlsShowing);
  const stream = useScopeStream();
  const videoMap = useVideoMap(rangeNm, loadVideoMap);

  const mode = SCOPE_MODES_BY_ID[modeId];
  const settingValues = settingValuesByMode[modeId];
  const renderer = useMemo(() => mode.createRenderer(), [mode]);

  useLayoutEffect(() => {
    applyTheme(document.documentElement, mode.theme);
  }, [mode]);

  const handleStepRange = useCallback((direction: RangeDirection): void => {
    setRangeNm((current) => stepRange(current, direction));
  }, []);

  const handleNextMode = useCallback((): void => {
    setModeId((current) => nextScopeMode(current).id);
  }, []);

  const handleSelectSetting = useCallback(
    (setting: ModeSetting, value: string): void => {
      setSettingValuesByMode((current) =>
        withModeSettingValues(current, modeId, selectSetting(setting, current[modeId], value)),
      );
    },
    [modeId],
  );

  const handleStepSetting = useCallback(
    (setting: ModeSetting): void => {
      setSettingValuesByMode((current) =>
        withModeSettingValues(current, modeId, stepSetting(setting, current[modeId])),
      );
    },
    [modeId],
  );

  const { snapshot } = stream;
  const selectedTarget = findSelectedTarget(snapshot, selectedIcaoHex);
  // Adjusting state while rendering, rather than in an effect, drops a selection that a snapshot
  // has just invalidated before anything is drawn or written to the URL with it.
  if (snapshot !== undefined && selectedIcaoHex !== undefined && selectedTarget === undefined) {
    setSelectedIcaoHex(undefined);
  }
  const aircraftDetails = useAircraftDetails(selectedIcaoHex, loadAircraftDetails);

  useEffect(() => {
    const search = formatUrlSearch(
      { modeId, rangeNm, selectedIcaoHex },
      { modeId: config.mode, rangeNm: config.rangeNm },
    );
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${search}`);
  }, [modeId, rangeNm, selectedIcaoHex, config.mode, config.rangeNm]);

  const handleStepSelection = useCallback(
    (direction: SelectionDirection): void => {
      setSelectedIcaoHex((current) => stepSelection(snapshot, current, direction));
    },
    [snapshot],
  );

  const handleDeselect = useCallback((): void => {
    setSelectedIcaoHex(undefined);
  }, []);

  const handleToggleControls = useCallback((): void => {
    setControlsShowing((current) => !current);
  }, []);

  const handleKeyPress = useCallback(
    (press: KeyPress): void => {
      const action = resolveHotkey(press, mode);
      switch (action?.type) {
        case 'range':
          handleStepRange(action.direction);
          break;
        case 'nextMode':
          handleNextMode();
          break;
        case 'setting':
          handleStepSetting(action.setting);
          break;
        case 'select':
          handleStepSelection(action.direction);
          break;
        case 'deselect':
          handleDeselect();
          break;
        case 'toggleControls':
          handleToggleControls();
          break;
        case undefined:
          break;
      }
    },
    [
      mode,
      handleStepRange,
      handleNextMode,
      handleStepSetting,
      handleStepSelection,
      handleDeselect,
      handleToggleControls,
    ],
  );
  useHotkeys(handleKeyPress);

  return (
    <div className={styles.scopeView}>
      <ScopeCanvas
        renderer={renderer}
        rangeNm={rangeNm}
        snapshot={stream.snapshot}
        videoMap={videoMap}
        settings={settingValues}
        selectedIcaoHex={selectedIcaoHex}
        extent={mode.extent}
        onSelect={setSelectedIcaoHex}
      />
      <StatusBar
        config={config}
        streamState={stream.state}
        snapshot={stream.snapshot}
        rangeNm={rangeNm}
      />
      <TabList snapshot={stream.snapshot} />
      <EmergencyList snapshot={stream.snapshot} />
      <InspectPanel
        target={selectedTarget}
        now={snapshot?.at ?? 0}
        details={aircraftDetails}
        onDeselect={handleDeselect}
      />
      <ModeControls
        modes={SCOPE_MODES}
        mode={mode}
        settingValues={settingValues}
        onSelectMode={setModeId}
        onSelectSetting={handleSelectSetting}
        expanded={controlsShowing}
        onToggleExpanded={handleToggleControls}
      />
      <RangeControls rangeNm={rangeNm} onStep={handleStepRange} />
    </div>
  );
}
