import type { ReactElement } from 'react';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';

import type { ScopeConfig } from '../shared/protocol.js';

import { RangeControls } from './chrome/range-controls.js';
import { StatusBar } from './chrome/status-bar.js';
import { useRangeKeys } from './chrome/use-range-keys.js';
import { useScopeStream } from './data/use-scope-stream.js';
import type { ScopeModeDefinition } from './modes/mode.js';
import { stepRange } from './scope/range.js';
import type { RangeDirection } from './scope/range.js';
import { ScopeCanvas } from './scope/scope-canvas.js';
import styles from './scope-view.module.css';
import { applyTheme } from './styles/theme.js';

/** Props for {@link ScopeView}. */
export interface ScopeViewProps {
  /** The session config. */
  config: ScopeConfig;
  /** The view style to show. */
  mode: ScopeModeDefinition;
}

/**
 * The working scope: the canvas in the given view style, with the status
 * readout and range controls over it. Owns the live snapshot stream and the
 * selected range, which starts at the configured range and is stepped by the
 * on-screen buttons or the range keys.
 */
export function ScopeView({ config, mode }: ScopeViewProps): ReactElement {
  const [rangeNm, setRangeNm] = useState(config.rangeNm);
  const stream = useScopeStream();
  const renderer = useMemo(() => mode.createRenderer(), [mode]);

  useLayoutEffect(() => {
    applyTheme(document.documentElement, mode.theme);
  }, [mode]);

  const handleStep = useCallback((direction: RangeDirection): void => {
    setRangeNm((current) => stepRange(current, direction));
  }, []);
  useRangeKeys(handleStep);

  return (
    <div className={styles.scopeView}>
      <ScopeCanvas renderer={renderer} rangeNm={rangeNm} snapshot={stream.snapshot} />
      <StatusBar
        config={config}
        streamState={stream.state}
        snapshot={stream.snapshot}
        rangeNm={rangeNm}
      />
      <RangeControls rangeNm={rangeNm} onStep={handleStep} />
    </div>
  );
}
