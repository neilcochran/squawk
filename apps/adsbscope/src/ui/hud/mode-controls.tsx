import type { ReactElement } from 'react';

import type { ScopeModeId } from '../../shared/protocol.js';
import type { ModeSetting, ModeSettingValues, ScopeModeDefinition } from '../modes/mode.js';
import { selectedChoice } from '../modes/mode.js';

import { ControlButton } from './control-button.js';
import styles from './control-group.module.css';
import { HIDE_CONTROLS_LABEL, SHOW_CONTROLS_LABEL } from './controls-visibility.js';
import { CLEAR_HOTKEY, CONTROLS_HOTKEY, MEASURE_HOTKEY, MODE_HOTKEY } from './hotkeys.js';
import { SegmentedControl } from './segmented-control.js';

/** Visible caption of the view style selector. Short, so that it fits the caption column every selector shares. */
export const VIEW_STYLE_CAPTION = 'View';

/** Accessible name and text of the range/bearing line button while there is no line. */
export const MEASURE_LABEL = 'Measure';

/** Accessible name and text of the range/bearing line button while a line is armed or drawn. */
export const STOP_MEASURING_LABEL = 'Stop measuring';

/** Props for {@link ModeControls}. */
export interface ModeControlsProps {
  /** Every view style on offer, in order. */
  modes: readonly ScopeModeDefinition[];
  /** The active view style. */
  mode: ScopeModeDefinition;
  /** The current value of each of the active mode's settings. */
  settingValues: ModeSettingValues;
  /** Called with a view style's id when it is chosen. */
  onSelectMode: (modeId: ScopeModeId) => void;
  /** Called with a setting and the value chosen for it. */
  onSelectSetting: (setting: ModeSetting, value: string) => void;
  /** Whether the selectors are showing. Hidden, only the button that shows them again is left. */
  expanded: boolean;
  /** Called when the user asks to hide or show the selectors. */
  onToggleExpanded: () => void;
  /** Whether a range/bearing line is armed or drawn, which decides whether the measure button starts one or clears it. */
  measuring: boolean;
  /** Called when the user asks to start a range/bearing line, or to clear the one there is. */
  onToggleMeasure: () => void;
}

/**
 * The view style selector, followed by one selector for each setting the
 * active style declares. Each shows all of its options with the current one
 * highlighted, so it is never in doubt which style or value is active and
 * which a press would select. It knows nothing about any particular setting:
 * a view style gains a control just by declaring one. Under the selectors
 * sit the range/bearing line button, so the line can be started without a
 * keyboard, and the button that hides the selectors.
 */
export function ModeControls({
  modes,
  mode,
  settingValues,
  onSelectMode,
  onSelectSetting,
  expanded,
  onToggleExpanded,
  measuring,
  onToggleMeasure,
}: ModeControlsProps): ReactElement {
  const toggleLabel = expanded ? HIDE_CONTROLS_LABEL : SHOW_CONTROLS_LABEL;
  const toggle = (
    <ControlButton
      label={toggleLabel}
      shape="text"
      expanded={expanded}
      hint={`${CONTROLS_HOTKEY.toUpperCase()} hides and shows the controls`}
      onPress={onToggleExpanded}
    >
      {toggleLabel}
    </ControlButton>
  );
  if (!expanded) {
    return <div className={styles.bottomLeft}>{toggle}</div>;
  }
  const measureLabel = measuring ? STOP_MEASURING_LABEL : MEASURE_LABEL;
  return (
    <div className={styles.bottomLeft}>
      <SegmentedControl
        label="View style"
        caption={VIEW_STYLE_CAPTION}
        options={modes.map((candidate) => ({ value: candidate.id, label: candidate.label }))}
        selectedValue={mode.id}
        hint={`${MODE_HOTKEY.toUpperCase()} switches view style`}
        onSelect={onSelectMode}
      />
      {mode.settings.map((setting) => (
        <SegmentedControl
          key={setting.id}
          label={setting.label}
          caption={setting.label}
          options={setting.choices}
          selectedValue={selectedChoice(setting, settingValues).value}
          hint={`${setting.hotkey.toUpperCase()} changes ${setting.label.toLowerCase()}`}
          onSelect={(value) => onSelectSetting(setting, value)}
        />
      ))}
      <div className={styles.underOptions}>
        <ControlButton
          label={measureLabel}
          shape="text"
          hint={`${MEASURE_HOTKEY.toUpperCase()} starts a range/bearing line; ${CLEAR_HOTKEY} clears it`}
          onPress={onToggleMeasure}
        >
          {measureLabel}
        </ControlButton>
        {toggle}
      </div>
    </div>
  );
}
