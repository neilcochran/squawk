import type { ReactElement } from 'react';

import type { ScopeConfig } from '../shared/protocol.js';

import { Notice } from './chrome/notice.js';
import { fetchScopeConfig } from './data/scope-config.js';
import { useScopeConfig } from './data/use-scope-config.js';
import { DEFAULT_SCOPE_MODE } from './modes/registry.js';
import { ScopeView } from './scope-view.js';

/** Props for {@link App}. */
export interface AppProps {
  /** Loads the session config. Injectable for tests; defaults to fetching it from the scope server. Must be stable across renders. */
  loadConfig?: () => Promise<ScopeConfig | undefined>;
}

/** The scope UI's root: loads the session config, then shows the scope, or a notice while it loads or if it cannot. */
export function App({ loadConfig = fetchScopeConfig }: AppProps): ReactElement {
  const configState = useScopeConfig(loadConfig);

  switch (configState.status) {
    case 'loading':
      return <Notice kind="status">Loading scope...</Notice>;
    case 'error':
      return <Notice kind="alert">Could not load the scope configuration from the server.</Notice>;
    case 'loaded':
      return <ScopeView config={configState.config} mode={DEFAULT_SCOPE_MODE} />;
  }
}
