import { useEffect, useState } from 'react';

import type { ScopeConfig } from '../../shared/protocol.js';

/** The state of loading the session config: in flight, loaded, or failed. */
export type ScopeConfigState =
  | {
      /** The config has been requested and has not arrived yet. */
      status: 'loading';
    }
  | {
      /** The config arrived and is usable. */
      status: 'loaded';
      /** The session config. */
      config: ScopeConfig;
    }
  | {
      /** The request failed, or the response was not a usable config. */
      status: 'error';
    };

/**
 * Loads the session config once for the life of the component.
 *
 * @param loadConfig - Loads the config, resolving undefined on any failure. Must be stable across renders, or the load restarts.
 * @returns The load state, to be switched on by `status`.
 */
export function useScopeConfig(
  loadConfig: () => Promise<ScopeConfig | undefined>,
): ScopeConfigState {
  const [state, setState] = useState<ScopeConfigState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void loadConfig().then((config) => {
      if (!cancelled) {
        setState(config === undefined ? { status: 'error' } : { status: 'loaded', config });
      }
    });
    return (): void => {
      cancelled = true;
    };
  }, [loadConfig]);

  return state;
}
