import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { DEFAULT_SCOPE_MODE_ID } from '../shared/protocol.js';

import { App } from './app.js';
import { SCOPE_MODES_BY_ID } from './modes/registry.js';
import { applyTheme } from './styles/theme.js';
import './styles/global.css';

// Applied before the first render so the loading notice is already themed. The scope
// re-applies the theme of whichever view style the session config asks for.
applyTheme(document.documentElement, SCOPE_MODES_BY_ID[DEFAULT_SCOPE_MODE_ID].theme);

const root = document.getElementById('root');
if (root !== null) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
