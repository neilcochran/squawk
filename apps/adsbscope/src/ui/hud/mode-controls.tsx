import type { ReactElement } from 'react';

import type { ScopeModeId } from '../../shared/protocol.js';
import type { ModeSetting, ModeSettingValues, ScopeModeDefinition } from '../modes/mode.js';
import { selectedChoice } from '../modes/mode.js';

import styles from './control-group.module.css';
import { MODE_HOTKEY } from './hotkeys.js';
import { SegmentedControl } from './segmented-control.js';

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
}

/**
 * The view style selector, followed by one selector for each setting the
 * active style declares. Each shows all of its options with the current one
 * highlighted, so it is never in doubt which style or value is active and
 * which a press would select. It knows nothing about any particular setting:
 * a view style gains a control just by declaring one.
 */
export function ModeControls({
  modes,
  mode,
  settingValues,
  onSelectMode,
  onSelectSetting,
}: ModeControlsProps): ReactElement {
  return (
    <div className={styles.bottomLeft}>
      <SegmentedControl
        label="View style"
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
    </div>
  );
}
