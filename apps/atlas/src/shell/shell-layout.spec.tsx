import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { ShellLayout } from './shell-layout.tsx';

vi.mock('./mode-switcher.tsx', () => ({
  ModeSwitcher: (): ReactElement => <div data-testid="mode-switcher" />,
}));
vi.mock('./theme-switcher.tsx', () => ({
  ThemeSwitcher: (): ReactElement => <div data-testid="theme-switcher" />,
}));

describe('ShellLayout', () => {
  it('renders the brand, theme switcher, mode switcher, and the children', () => {
    render(
      <ShellLayout>
        <div data-testid="content">child content</div>
      </ShellLayout>,
    );
    expect(screen.getByText('Squawk Atlas')).toBeInTheDocument();
    expect(screen.getByTestId('theme-switcher')).toBeInTheDocument();
    expect(screen.getByTestId('mode-switcher')).toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('places content inside the main element so the chrome stays separate', () => {
    render(
      <ShellLayout>
        <div data-testid="content" />
      </ShellLayout>,
    );
    const content = screen.getByTestId('content');
    expect(content.closest('main')).not.toBeNull();
  });
});
