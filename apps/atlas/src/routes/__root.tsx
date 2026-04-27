import { createRootRoute, Outlet } from '@tanstack/react-router';
import { ShellLayout } from '../shell/shell-layout.tsx';

/**
 * Root route. Wraps every page in the {@link ShellLayout}.
 */
export const Route = createRootRoute({
  component: () => (
    <ShellLayout>
      <Outlet />
    </ShellLayout>
  ),
});
