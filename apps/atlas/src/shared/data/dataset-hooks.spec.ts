import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock each `@squawk/*-data/browser` entry point with a deferred
// promise the test can resolve / reject on demand. Hoisted so the
// `vi.mock` factories can reach the same controllable shells the
// tests poke at runtime.
const { airportDeferred, airspaceDeferred, airwayDeferred, fixDeferred, navaidDeferred } =
  vi.hoisted(() => ({
    airportDeferred: createDeferredShell(),
    airspaceDeferred: createDeferredShell(),
    airwayDeferred: createDeferredShell(),
    fixDeferred: createDeferredShell(),
    navaidDeferred: createDeferredShell(),
  }));

interface DeferredShell {
  promise: Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  reset: () => void;
}

function createDeferredShell(): DeferredShell {
  const shell = { promise: Promise.resolve(undefined) } as DeferredShell;
  shell.reset = (): void => {
    shell.promise = new Promise<unknown>((resolveFn, rejectFn) => {
      shell.resolve = resolveFn;
      shell.reject = rejectFn;
    });
    // Suppress the unhandled-rejection warning when a test rejects
    // before any subscriber has attached. Vitest will still surface
    // failures via the assertions below.
    shell.promise.catch(() => undefined);
  };
  shell.reset();
  return shell;
}

vi.mock('@squawk/airport-data/browser', () => ({
  loadUsBundledAirports: () => airportDeferred.promise,
}));
vi.mock('@squawk/airspace-data/browser', () => ({
  loadUsBundledAirspace: () => airspaceDeferred.promise,
}));
vi.mock('@squawk/airway-data/browser', () => ({
  loadUsBundledAirways: () => airwayDeferred.promise,
}));
vi.mock('@squawk/fix-data/browser', () => ({
  loadUsBundledFixes: () => fixDeferred.promise,
}));
vi.mock('@squawk/navaid-data/browser', () => ({
  loadUsBundledNavaids: () => navaidDeferred.promise,
}));

interface HookCase {
  name: string;
  deferred: DeferredShell;
  importHook: () => Promise<{ hook: () => unknown; loader: () => Promise<unknown> }>;
}

const CASES: readonly HookCase[] = [
  {
    name: 'airport',
    deferred: airportDeferred,
    importHook: async () => {
      const m = await import('./airport-dataset.ts');
      return { hook: m.useAirportDataset, loader: m.loadAirportDataset };
    },
  },
  {
    name: 'airspace',
    deferred: airspaceDeferred,
    importHook: async () => {
      const m = await import('./airspace-dataset.ts');
      return { hook: m.useAirspaceDataset, loader: m.loadAirspaceDataset };
    },
  },
  {
    name: 'airway',
    deferred: airwayDeferred,
    importHook: async () => {
      const m = await import('./airway-dataset.ts');
      return { hook: m.useAirwayDataset, loader: m.loadAirwayDataset };
    },
  },
  {
    name: 'fix',
    deferred: fixDeferred,
    importHook: async () => {
      const m = await import('./fix-dataset.ts');
      return { hook: m.useFixDataset, loader: m.loadFixDataset };
    },
  },
  {
    name: 'navaid',
    deferred: navaidDeferred,
    importHook: async () => {
      const m = await import('./navaid-dataset.ts');
      return { hook: m.useNavaidDataset, loader: m.loadNavaidDataset };
    },
  },
];

// Each dataset hook caches its load promise at module scope. Reset
// the module registry between tests so the cached promise does not
// leak across tests and so a fresh `vi.mock`-backed loader is wired
// up each run.
beforeEach(() => {
  vi.resetModules();
  for (const c of CASES) {
    c.deferred.reset();
  }
});

afterEach(() => {
  for (const c of CASES) {
    c.deferred.reset();
  }
});

for (const c of CASES) {
  describe(`${c.name}-dataset`, () => {
    it('starts in the loading state', async () => {
      const { hook } = await c.importHook();
      const { result } = renderHook(() => hook());
      expect(result.current).toEqual({ status: 'loading' });
    });

    it('transitions to loaded when the underlying loader resolves', async () => {
      const { hook } = await c.importHook();
      const { result } = renderHook(() => hook());
      const dataset = { tag: c.name };
      c.deferred.resolve(dataset);
      await waitFor(() => {
        expect(result.current).toEqual({ status: 'loaded', dataset });
      });
    });

    it('transitions to error and wraps non-Error rejections', async () => {
      const { hook } = await c.importHook();
      const { result } = renderHook(() => hook());
      c.deferred.reject('non-error reason');
      await waitFor(() => {
        const state = result.current as { status: string; error?: Error };
        expect(state.status).toBe('error');
        expect(state.error).toBeInstanceOf(Error);
        expect(state.error?.message).toBe('non-error reason');
      });
    });

    it('passes Error rejections through unwrapped', async () => {
      const { hook } = await c.importHook();
      const { result } = renderHook(() => hook());
      const original = new Error('boom');
      c.deferred.reject(original);
      await waitFor(() => {
        const state = result.current as { status: string; error?: Error };
        expect(state.status).toBe('error');
        expect(state.error).toBe(original);
      });
    });

    it('memoizes the loader call across hook mounts', async () => {
      const { loader } = await c.importHook();
      const first = loader();
      const second = loader();
      expect(first).toBe(second);
    });

    it('does not update state after the consumer unmounts (cancelled flag prevents leaks)', async () => {
      const { hook } = await c.importHook();
      const { result, unmount } = renderHook(() => hook());
      unmount();
      c.deferred.resolve({ tag: c.name });
      // Allow the microtask queue to drain so any leak would have
      // landed by now.
      await Promise.resolve();
      await Promise.resolve();
      // Initial loading state survives because no setState fired
      // after the unmount; result is whatever was captured at unmount
      // time, which was the loading sentinel.
      expect(result.current).toEqual({ status: 'loading' });
    });

    it('does not update state on an error after the consumer unmounts', async () => {
      const { hook } = await c.importHook();
      const { result, unmount } = renderHook(() => hook());
      unmount();
      c.deferred.reject(new Error('after-unmount'));
      await Promise.resolve();
      await Promise.resolve();
      expect(result.current).toEqual({ status: 'loading' });
    });
  });
}
