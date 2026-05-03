import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { ReactElement } from 'react';

import { useTheme } from '../shared/styles/theme-context.ts';
import type { ThemePreference } from '../shared/styles/theme-context.ts';

/**
 * One row in the theme-preference dropdown menu.
 */
interface ThemeOption {
  /** Stored preference value this row writes to context + localStorage. */
  id: ThemePreference;
  /** Visible label rendered in the menu row. */
  label: string;
  /**
   * Tiny secondary line shown beneath the label, describing what the
   * option actually does (e.g. "Match my OS"). Omitted to keep a row
   * compact when the label alone is unambiguous.
   */
  description?: string;
}

/**
 * Theme rows in display order. `'system'` lands last because it is the
 * "let the OS decide" escape hatch and most users will reach for an
 * explicit choice; presenting Light first keeps the menu's primary
 * affordance the most common pick.
 */
const THEME_OPTIONS: readonly ThemeOption[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System', description: 'Match my OS' },
];

/**
 * Theme-preference dropdown rendered in the shell header. The trigger
 * shows whichever icon (sun / moon / monitor) reflects the user's
 * current preference - not the resolved theme - so a user on `'system'`
 * sees a monitor glyph instead of the sun/moon their OS is currently
 * resolving to. This keeps the affordance honest: clicking the trigger
 * does not change the *appearance* of the icon, just opens the menu
 * where the user can switch.
 */
export function ThemeSwitcher(): ReactElement {
  const { preference, setPreference } = useTheme();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Theme: ${labelFor(preference)} (click to change)`}
        title="Change theme"
        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 md:h-7 md:w-7 dark:text-slate-300 dark:hover:bg-slate-800 dark:focus-visible:ring-slate-500"
      >
        <ThemeTriggerIcon preference={preference} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="min-w-[10rem] rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <DropdownMenu.RadioGroup
            value={preference}
            onValueChange={(value: string): void => {
              if (value === 'light' || value === 'dark' || value === 'system') {
                setPreference(value);
              }
            }}
          >
            {THEME_OPTIONS.map((option) => (
              <DropdownMenu.RadioItem
                key={option.id}
                value={option.id}
                className="flex cursor-default items-center gap-2 rounded px-2 py-2.5 text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-100 md:py-1.5 dark:text-slate-200 dark:data-[highlighted]:bg-slate-800"
              >
                <span
                  aria-hidden="true"
                  className="inline-flex h-4 w-4 items-center justify-center"
                >
                  <DropdownMenu.ItemIndicator>
                    <CheckIcon />
                  </DropdownMenu.ItemIndicator>
                </span>
                <span className="flex flex-col">
                  <span>{option.label}</span>
                  {option.description !== undefined ? (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/**
 * Looks up the visible label for a preference, used in the trigger's
 * accessible name so screen readers announce the current state.
 */
function labelFor(preference: ThemePreference): string {
  const match = THEME_OPTIONS.find((option) => option.id === preference);
  return match?.label ?? 'System';
}

/**
 * Trigger glyph that mirrors the current preference: sun for Light,
 * moon for Dark, monitor for System. Shows the user's stored choice
 * rather than the resolved theme so a user on `'system'` always sees
 * the monitor glyph (and is not surprised when clicking the trigger
 * does not toggle to the inverse appearance).
 */
function ThemeTriggerIcon({ preference }: { preference: ThemePreference }): ReactElement {
  if (preference === 'light') {
    return <SunIcon />;
  }
  if (preference === 'dark') {
    return <MoonIcon />;
  }
  return <MonitorIcon />;
}

/** Sun glyph rendered for the Light preference. */
function SunIcon(): ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5V3M8 13V14.5M3.5 3.5L4.5 4.5M11.5 11.5L12.5 12.5M1.5 8H3M13 8H14.5M3.5 12.5L4.5 11.5M11.5 4.5L12.5 3.5" />
    </svg>
  );
}

/** Moon glyph rendered for the Dark preference. */
function MoonIcon(): ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13.5 9.5C12.7 11.6 10.7 13 8.5 13C5.5 13 3 10.5 3 7.5C3 5.3 4.4 3.3 6.5 2.5C6.2 3.3 6 4.1 6 5C6 8 8.5 10.5 11.5 10.5C12.4 10.5 13.2 10.3 14 10C13.9 9.8 13.7 9.6 13.5 9.5Z" />
    </svg>
  );
}

/** Monitor glyph rendered for the System preference. */
function MonitorIcon(): ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="12" height="8" rx="1" />
      <path d="M5 13.5H11M8 11V13.5" />
    </svg>
  );
}

/** Inline checkmark glyph rendered inside the Radix `ItemIndicator`. */
function CheckIcon(): ReactElement {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 6.5L4.5 9L10 3.5" />
    </svg>
  );
}
