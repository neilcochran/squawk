import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app.js';
import { DEFAULT_SCOPE_MODE } from './modes/registry.js';
import { applyTheme } from './styles/theme.js';
import './styles/global.css';

// Applied before the first render so the loading notice is already themed.
applyTheme(document.documentElement, DEFAULT_SCOPE_MODE.theme);

const root = document.getElementById('root');
if (root !== null) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
