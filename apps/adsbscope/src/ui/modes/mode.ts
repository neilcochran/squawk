import type { ScopeModeId } from '../../shared/protocol.js';
import { nextInCycle } from '../cycle.js';
import type { ScopeRenderer } from '../scope/renderer.js';
import type { ScopeTheme } from '../styles/theme.js';

/** One value a {@link ModeSetting} can take. */
export interface ModeSettingChoice {
  /** The value handed to the renderer. */
  value: string;
  /** What the choice's button shows, e.g. `On`. Read together with the setting's label. */
  label: string;
}

/**
 * Something about a view style the user can change while it is running,
 * declared as data. The HUD renders one control per setting - every choice
 * side by side, the selected one highlighted - and wires its hotkey without
 * knowing what the setting means; only the mode's own renderer
 * interprets the value. Adding a setting to a mode touches nothing outside
 * that mode's directory.
 */
export interface ModeSetting {
  /** Identifies the setting within its mode; the key its value is stored and delivered under. */
  id: string;
  /** Short name of what is being set, e.g. `Tags`. Shown in front of the choices, and names the control. */
  label: string;
  /** The `KeyboardEvent.key` that steps the setting to its next choice, lowercase. */
  hotkey: string;
  /** The values the setting cycles through, in order. The first is the default. */
  choices: readonly [ModeSettingChoice, ...ModeSettingChoice[]];
}

/** The current value of each of a mode's settings, keyed by {@link ModeSetting.id}. */
export type ModeSettingValues = Readonly<Record<string, string>>;

/**
 * One view style of the scope: how it paints, what it looks like, and what
 * the user can adjust. A mode is self-contained - everything specific to it
 * lives in its own directory under `modes/` - so adding a view style means
 * adding a directory and one entry in the registry, without touching the
 * canvas, the HUD, or the app.
 */
export interface ScopeModeDefinition {
  /** Stable identifier, as used by the `--mode` flag and the session config. */
  id: ScopeModeId;
  /** Human-readable name. */
  label: string;
  /** The mode's colors and type, for both its renderer and the HTML UI around it. */
  theme: ScopeTheme;
  /** What the user can adjust in this mode. Empty for a mode with nothing to adjust. */
  settings: readonly ModeSetting[];
  /** Creates a fresh renderer for this mode. Called once each time the mode is switched to. */
  createRenderer(): ScopeRenderer;
}

/**
 * Builds a mode's starting setting values: the first choice of each setting.
 *
 * @param mode - The mode.
 * @returns The default value of every setting, keyed by setting id.
 */
export function defaultSettingValues(mode: ScopeModeDefinition): ModeSettingValues {
  const values: Record<string, string> = {};
  for (const setting of mode.settings) {
    values[setting.id] = setting.choices[0].value;
  }
  return values;
}

/**
 * Finds the choice a setting currently has selected.
 *
 * @param setting - The setting.
 * @param values - The mode's current setting values.
 * @returns The selected choice, or the default choice if the stored value is missing or unknown.
 */
export function selectedChoice(setting: ModeSetting, values: ModeSettingValues): ModeSettingChoice {
  return (
    setting.choices.find((choice) => choice.value === values[setting.id]) ?? setting.choices[0]
  );
}

/**
 * Selects one of a setting's choices directly, as when its button is pressed.
 * A value that is not one of the setting's choices is ignored, so a stale or
 * mistyped value can never reach the renderer.
 *
 * @param setting - The setting to change.
 * @param values - The mode's current setting values.
 * @param value - The value of the choice to select.
 * @returns New setting values with that one setting changed, or `values` itself if `value` is not a choice.
 */
export function selectSetting(
  setting: ModeSetting,
  values: ModeSettingValues,
  value: string,
): ModeSettingValues {
  if (!setting.choices.some((choice) => choice.value === value)) {
    return values;
  }
  return { ...values, [setting.id]: value };
}

/**
 * Steps a setting to its next choice, wrapping from the last back to the
 * first, as when its hotkey is pressed.
 *
 * @param setting - The setting to step.
 * @param values - The mode's current setting values.
 * @returns New setting values with that one setting advanced.
 */
export function stepSetting(setting: ModeSetting, values: ModeSettingValues): ModeSettingValues {
  const next = nextInCycle(setting.choices, selectedChoice(setting, values));
  return { ...values, [setting.id]: next.value };
}
