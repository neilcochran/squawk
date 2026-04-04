// Layer toggle controls and search input handling.

import { state } from './shared.js';

const LAYER_NAMES = {
  airspace: 'Airspace',
  airports: 'Airports',
  navaids: 'Navaids',
  fixes: 'Fixes',
  airways: 'Airways',
  procedures: 'Procedures',
};

/**
 * Builds the main layer on/off checkboxes from the server config.
 */
export function buildLayerControls(config, renderAll) {
  const container = document.getElementById('layerControls');

  for (const [name, enabled] of Object.entries(config.layers)) {
    if (!enabled) {
      continue;
    }
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true;
    cb.addEventListener('change', () => {
      state.layerEnabled[name] = cb.checked;
      renderAll();
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(LAYER_NAMES[name] ?? name));
    container.appendChild(label);
  }
}

/**
 * Wires up the search input with a debounced handler.
 */
export function initSearch(renderAll) {
  let searchTimer = null;
  document.getElementById('search').addEventListener('input', (e) => {
    if (searchTimer) {
      clearTimeout(searchTimer);
    }
    searchTimer = setTimeout(() => {
      state.searchTerm = e.target.value.toLowerCase().trim();
      renderAll();
    }, 200);
  });
}
