import type { ReactElement, ReactNode } from 'react';

import styles from './control-button.module.css';

/** Props for {@link ControlButton}. */
export interface ControlButtonProps {
  /** Accessible name. Should contain the visible text, so speech input can target the button by what it shows. */
  label: string;
  /** `square` for a single glyph, `text` for a word or two. */
  shape: 'square' | 'text';
  /** Called when the button is pressed. */
  onPress: () => void;
  /** Whether the button is inert. Defaults to false. */
  disabled?: boolean;
  /**
   * For a button that represents one option of a choice: whether it is the
   * option currently selected. Leave undefined for a plain action button.
   */
  pressed?: boolean;
  /** Tooltip, e.g. naming the hotkey that does the same thing. */
  hint?: string;
  /** The visible content. */
  children: ReactNode;
}

/**
 * The scope's one button style: a full-size touch target on small screens,
 * compact on larger ones, themed from the active view style. Every on-screen
 * control is one of these, so they size, theme, and focus alike.
 */
export function ControlButton({
  label,
  shape,
  onPress,
  disabled = false,
  pressed,
  hint,
  children,
}: ControlButtonProps): ReactElement {
  return (
    <button
      type="button"
      className={shape === 'square' ? styles.square : styles.text}
      aria-label={label}
      aria-pressed={pressed}
      title={hint}
      disabled={disabled}
      onClick={onPress}
    >
      {children}
    </button>
  );
}
