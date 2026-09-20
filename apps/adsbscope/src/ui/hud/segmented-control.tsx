import type { ReactElement } from 'react';

import { ControlButton } from './control-button.js';
import styles from './segmented-control.module.css';

/** One option of a {@link SegmentedControl}. */
export interface SegmentOption<Value extends string> {
  /** The value reported when this option is chosen. */
  value: Value;
  /** What the option's button shows. */
  label: string;
}

/** Props for {@link SegmentedControl}. */
export interface SegmentedControlProps<Value extends string> {
  /** What is being chosen, e.g. `View style`. Names the group, and prefixes each option's accessible name. */
  label: string;
  /** Short visible caption in front of the options, for a control whose options do not explain themselves (`Off` / `On`). Omit when they do. */
  caption?: string;
  /** The options, in order. */
  options: readonly SegmentOption<Value>[];
  /** The value of the option currently selected. */
  selectedValue: Value;
  /** Called with an option's value when it is chosen. */
  onSelect: (value: Value) => void;
  /** Tooltip shown on every option, e.g. naming the hotkey that cycles through them. */
  hint?: string;
}

/**
 * A choice shown as a row of buttons, one per option, with the selected one
 * highlighted. Unlike a single toggle button - whose label can be read either
 * as the current state or as what pressing it will do - this shows both at
 * once: which option is active, and which others can be chosen.
 */
export function SegmentedControl<Value extends string>({
  label,
  caption,
  options,
  selectedValue,
  onSelect,
  hint,
}: SegmentedControlProps<Value>): ReactElement {
  return (
    <div className={styles.segmentedControl} role="group" aria-label={label}>
      {caption !== undefined && <span className={styles.caption}>{caption}</span>}
      {options.map((option) => (
        <ControlButton
          key={option.value}
          label={`${label}: ${option.label}`}
          shape="text"
          pressed={option.value === selectedValue}
          {...(hint !== undefined && { hint })}
          onPress={() => onSelect(option.value)}
        >
          {option.label}
        </ControlButton>
      ))}
    </div>
  );
}
