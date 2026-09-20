import type { ReactElement } from 'react';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';

import type { ScopeConfig, ScopeModeId, ScopeVideoMap } from '../shared/protocol.js';

import { useScopeStream } from './data/use-scope-stream.js';
import { useVideoMap } from './data/use-video-map.js';
import { fetchVideoMap } from './data/video-map.js';
import { resolveHotkey } from './hud/hotkeys.js';
import type { KeyPress } from './hud/hotkeys.js';
import { ModeControls } from './hud/mode-controls.js';
import { RangeControls } from './hud/range-controls.js';
import { StatusBar } from './hud/status-bar.js';
import { TabList } from './hud/tab-list.js';
import { useHotkeys } from './hud/use-hotkeys.js';
import { defaultSettingValues, selectSetting, stepSetting } from './modes/mode.js';
import type { ModeSetting, ModeSettingValues } from './modes/mode.js';
import { nextScopeMode, SCOPE_MODES, SCOPE_MODES_BY_ID } from './modes/registry.js';
import { stepRange } from './scope/range.js';
import type { RangeDirection } from './scope/range.js';
import { ScopeCanvas } from './scope/scope-canvas.js';
import styles from './scope-view.module.css';
import { applyTheme } from './styles/theme.js';

/** Props for {@link ScopeView}. */
export interface ScopeViewProps {
  /** The session config, which supplies the view style and range to start in. */
  config: ScopeConfig;
  /** Loads the video map for a range. Injectable for tests; defaults to fetching it from the scope server. Must be stable across renders. */
  loadVideoMap?: (rangeNm: number) => Promise<ScopeVideoMap | undefined>;
}

/**
 * Every mode's settings at their defaults. Each mode keeps its own values, so
 * they survive switching away and back. Typed as a complete record, so a new
 * mode id that is not given its defaults here fails to compile.
 */
function initialSettingValues(): Record<ScopeModeId, ModeSettingValues> {
  return {
    digital: defaultSettingValues(SCOPE_MODES_BY_ID.digital),
    analog: defaultSettingValues(SCOPE_MODES_BY_ID.analog),
  };
}

/**
 * The working scope: the canvas in the active view style, with the status
 * readout and the on-screen controls over it. Owns everything the user can
 * change while running - the view style, that style's settings, and the range
 * - along with the live snapshot stream and the video map for the current
 * range. Every change is reachable both from
 * an on-screen control, which selects an option directly, and from a hotkey,
 * which steps to the next one.
 */
export function ScopeView({ config, loadVideoMap = fetchVideoMap }: ScopeViewProps): ReactElement {
  const [modeId, setModeId] = useState<ScopeModeId>(config.mode);
  const [rangeNm, setRangeNm] = useState(config.rangeNm);
  const [settingValuesByMode, setSettingValuesByMode] = useState(initialSettingValues);
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
      setSettingValuesByMode((current) => ({
        ...current,
        [modeId]: selectSetting(setting, current[modeId], value),
      }));
    },
    [modeId],
  );

  const handleStepSetting = useCallback(
    (setting: ModeSetting): void => {
      setSettingValuesByMode((current) => ({
        ...current,
        [modeId]: stepSetting(setting, current[modeId]),
      }));
    },
    [modeId],
  );

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
        case undefined:
          break;
      }
    },
    [mode, handleStepRange, handleNextMode, handleStepSetting],
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
      />
      <StatusBar
        config={config}
        streamState={stream.state}
        snapshot={stream.snapshot}
        rangeNm={rangeNm}
      />
      <TabList snapshot={stream.snapshot} />
      <ModeControls
        modes={SCOPE_MODES}
        mode={mode}
        settingValues={settingValues}
        onSelectMode={setModeId}
        onSelectSetting={handleSelectSetting}
      />
      <RangeControls rangeNm={rangeNm} onStep={handleStepRange} />
    </div>
  );
}
