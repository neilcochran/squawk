/** How long a shutdown may take to let the process end on its own before it is forced. */
export const SHUTDOWN_GRACE_MS = 3000;

/** The signals that ask the scope to shut down. */
export const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'] as const;

/** The slice of `process` that {@link installShutdownHandlers} needs, so specs can pass a fake. */
export interface ShutdownProcess {
  /** Registers a signal listener. */
  on(signal: (typeof SHUTDOWN_SIGNALS)[number], listener: () => void): unknown;
  /** The code the process will exit with when it ends on its own. */
  exitCode?: number | string | null | undefined;
  /** Ends the process immediately. */
  exit(code: number): void;
}

/** Options for {@link installShutdownHandlers}. */
export interface ShutdownOptions {
  /** Stops whatever is running. Resolves once it has shut down. */
  stop(): Promise<void>;
  /** The process to listen on and, as a last resort, exit. */
  processRef: ShutdownProcess;
  /** How long to wait for a clean end before forcing one. Defaults to {@link SHUTDOWN_GRACE_MS}. */
  graceMs?: number;
}

/**
 * Shuts the scope down cleanly on SIGINT or SIGTERM. The first signal stops
 * everything and sets a zero exit code, after which the process should end
 * on its own because nothing is left holding the event loop open.
 *
 * A forced `exit()` remains as a backstop, on an unreferenced timer so it
 * never itself delays a clean end: if a handle is leaked somewhere - here or
 * in a dependency - Ctrl+C must still end the process rather than hang it. A
 * second signal during shutdown forces the exit immediately, the way an
 * impatient second Ctrl+C is expected to work.
 *
 * @param options - What to stop, the process to act on, and the grace period.
 */
export function installShutdownHandlers(options: ShutdownOptions): void {
  const { stop, processRef } = options;
  const graceMs = options.graceMs ?? SHUTDOWN_GRACE_MS;
  let shuttingDown = false;

  function handleSignal(): void {
    if (shuttingDown) {
      processRef.exit(1);
      return;
    }
    shuttingDown = true;
    processRef.exitCode = 0;
    setTimeout(() => processRef.exit(0), graceMs).unref();
    void stop().catch(() => {
      processRef.exitCode = 1;
    });
  }

  for (const signal of SHUTDOWN_SIGNALS) {
    processRef.on(signal, handleSignal);
  }
}
