import type { ReactElement, ReactNode } from 'react';
import { ModeSwitcher } from './mode-switcher.tsx';

/**
 * Props for the top-level app shell layout.
 */
export interface ShellLayoutProps {
  /** The active mode's content, rendered in the main content area. */
  children: ReactNode;
}

/**
 * Top-level app layout. Owns the shell chrome (brand, mode switcher) and renders
 * the active mode's content. The shell is mode-agnostic: it knows nothing about
 * any specific mode beyond what {@link ModeSwitcher} renders in the header.
 */
export function ShellLayout({ children }: ShellLayoutProps): ReactElement {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <span className="font-semibold tracking-tight text-slate-900">Squawk Atlas</span>
        <ModeSwitcher />
      </header>
      <main className="relative flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
