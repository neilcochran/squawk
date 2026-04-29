import type { ReactElement, ReactNode } from 'react';
import { ModeSwitcher } from './mode-switcher.tsx';
import { ThemeSwitcher } from './theme-switcher.tsx';

/**
 * Props for the top-level app shell layout.
 */
export interface ShellLayoutProps {
  /** The active mode's content, rendered in the main content area. */
  children: ReactNode;
}

/**
 * Top-level app layout. Owns the shell chrome (brand, theme switcher,
 * mode switcher) and renders the active mode's content. The shell is
 * mode-agnostic: it knows nothing about any specific mode beyond what
 * {@link ModeSwitcher} renders in the header. {@link ThemeSwitcher} is
 * shell-level so it sits above every mode regardless of which page is
 * active.
 */
export function ShellLayout({ children }: ShellLayoutProps): ReactElement {
  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-950">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
        <span className="font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Squawk Atlas
        </span>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <ModeSwitcher />
        </div>
      </header>
      <main className="relative flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
