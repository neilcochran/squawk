import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeSwitcher } from './theme-switcher.tsx';
import { ThemeProvider } from '../shared/styles/theme-provider.tsx';
import { THEME_STORAGE_KEY } from '../shared/styles/theme-context.ts';

// Radix DropdownMenu's open/close cycle drives off pointer events that
// jsdom does not fully simulate, and its internals (portal layout,
// keyboard handling, etc.) are third-party concerns we do not want to
// pin down. Mock the primitives so menu items render unconditionally
// and row clicks call the right handler. RadioItem renders as a
// `role="menuitemradio"` div whose click triggers the surrounding
// RadioGroup's `onValueChange`, mirroring the production behavior the
// switcher relies on.
vi.mock('@radix-ui/react-dropdown-menu', () => {
  function Root({ children }: { children: ReactNode }): ReactNode {
    return children;
  }
  function Trigger({
    children,
    className,
    'aria-label': ariaLabel,
    title,
  }: {
    children: ReactNode;
    className?: string;
    'aria-label'?: string;
    title?: string;
  }): ReactNode {
    return (
      <button type="button" className={className} aria-label={ariaLabel} title={title}>
        {children}
      </button>
    );
  }
  function Portal({ children }: { children: ReactNode }): ReactNode {
    return children;
  }
  function Content({ children }: { children: ReactNode }): ReactNode {
    return <div>{children}</div>;
  }
  function ItemIndicator({ children }: { children: ReactNode }): ReactNode {
    return <span>{children}</span>;
  }
  function RadioGroup({
    children,
    value,
    onValueChange,
  }: {
    children: ReactNode;
    value: string;
    onValueChange: (next: string) => void;
  }): ReactNode {
    return (
      <RadioGroupContext.Provider value={{ value, onValueChange }}>
        <div role="radiogroup" data-value={value}>
          {children}
        </div>
      </RadioGroupContext.Provider>
    );
  }
  function RadioItem({
    children,
    value,
    className,
  }: {
    children: ReactNode;
    value: string;
    className?: string;
  }): ReactNode {
    return (
      <RadioGroupContext.Consumer>
        {(ctx) => (
          <div
            role="menuitemradio"
            aria-checked={ctx?.value === value}
            tabIndex={0}
            className={className}
            onClick={() => ctx?.onValueChange(value)}
            onKeyDown={(event) => {
              if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault();
                ctx?.onValueChange(value);
              }
            }}
          >
            {children}
          </div>
        )}
      </RadioGroupContext.Consumer>
    );
  }
  return {
    Root,
    Trigger,
    Portal,
    Content,
    ItemIndicator,
    RadioGroup,
    RadioItem,
  };
});

// Lightweight context shim used by the mocked RadioGroup/RadioItem to
// thread the current value + change handler from the parent into the
// items, mirroring Radix's real implementation.
import { createContext } from 'react';
const RadioGroupContext = createContext<
  { value: string; onValueChange: (next: string) => void } | undefined
>(undefined);

describe('ThemeSwitcher', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('renders a menu of Light / Dark / System options', () => {
    render(
      <ThemeProvider>
        <ThemeSwitcher />
      </ThemeProvider>,
    );
    expect(screen.getByRole('menuitemradio', { name: /Light/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /Dark/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /System/ })).toBeInTheDocument();
  });

  it('selecting Dark persists the preference and applies the dark class', () => {
    render(
      <ThemeProvider>
        <ThemeSwitcher />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Dark/ }));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('selecting Light removes the dark class and writes the preference', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(
      <ThemeProvider>
        <ThemeSwitcher />
      </ThemeProvider>,
    );
    expect(document.documentElement).toHaveClass('dark');
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Light/ }));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('trigger label reflects the current preference, not the resolved theme', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'system');
    render(
      <ThemeProvider>
        <ThemeSwitcher />
      </ThemeProvider>,
    );
    expect(screen.getByRole('button', { name: /Theme: System/ })).toBeInTheDocument();
  });
});
