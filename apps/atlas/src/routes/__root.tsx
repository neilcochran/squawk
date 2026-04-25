import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { ShellLayout } from '../shell/shell-layout.tsx';

/**
 * Root route. Wraps every page in the {@link ShellLayout} and (only in dev)
 * mounts the TanStack Router devtools panel.
 */
export const Route = createRootRoute({
  component: () => (
    <>
      <ShellLayout>
        <Outlet />
      </ShellLayout>
      {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
    </>
  ),
});
