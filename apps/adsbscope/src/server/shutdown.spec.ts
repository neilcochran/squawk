import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installShutdownHandlers, SHUTDOWN_GRACE_MS, SHUTDOWN_SIGNALS } from './shutdown.js';
import type { ShutdownProcess } from './shutdown.js';

interface FakeProcess extends ShutdownProcess {
  exit: ReturnType<typeof vi.fn<(code: number) => void>>;
  signal(name: (typeof SHUTDOWN_SIGNALS)[number]): void;
}

function makeProcess(): FakeProcess {
  const listeners = new Map<string, () => void>();
  return {
    on(signal, listener): void {
      listeners.set(signal, listener);
    },
    exit: vi.fn<(code: number) => void>(),
    signal(name): void {
      listeners.get(name)?.();
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('installShutdownHandlers', () => {
  it('stops on either signal, sets a zero exit code, and does not force an exit', async () => {
    for (const signal of SHUTDOWN_SIGNALS) {
      const processRef = makeProcess();
      const stop = vi.fn(() => Promise.resolve());
      installShutdownHandlers({ stop, processRef });

      processRef.signal(signal);
      await vi.advanceTimersByTimeAsync(0);

      expect(stop).toHaveBeenCalledTimes(1);
      expect(processRef.exitCode).toBe(0);
      expect(processRef.exit).not.toHaveBeenCalled();
    }
  });

  it('forces the exit if the process has not ended within the grace period', async () => {
    const processRef = makeProcess();
    installShutdownHandlers({ stop: () => new Promise(() => undefined), processRef });

    processRef.signal('SIGINT');
    await vi.advanceTimersByTimeAsync(SHUTDOWN_GRACE_MS - 1);
    expect(processRef.exit).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(processRef.exit).toHaveBeenCalledWith(0);
  });

  it('honors a custom grace period', async () => {
    const processRef = makeProcess();
    installShutdownHandlers({
      stop: () => new Promise(() => undefined),
      processRef,
      graceMs: 50,
    });

    processRef.signal('SIGTERM');
    await vi.advanceTimersByTimeAsync(50);

    expect(processRef.exit).toHaveBeenCalledWith(0);
  });

  it('forces the exit immediately on a second signal, without stopping twice', async () => {
    const processRef = makeProcess();
    const stop = vi.fn(() => new Promise<void>(() => undefined));
    installShutdownHandlers({ stop, processRef });

    processRef.signal('SIGINT');
    processRef.signal('SIGTERM');

    expect(stop).toHaveBeenCalledTimes(1);
    expect(processRef.exit).toHaveBeenCalledWith(1);
  });

  it('sets a failing exit code when stopping fails', async () => {
    const processRef = makeProcess();
    installShutdownHandlers({ stop: () => Promise.reject(new Error('close failed')), processRef });

    processRef.signal('SIGINT');
    await vi.advanceTimersByTimeAsync(0);

    expect(processRef.exitCode).toBe(1);
  });
});
