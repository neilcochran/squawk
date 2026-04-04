// Main entry point - orchestrates data loading, rendering, and event wiring.

import { map } from './shared.js';
import { buildLayerControls, initSearch } from './controls.js';
import * as airspace from './layers/airspace.js';
import * as airports from './layers/airports.js';
import * as navaids from './layers/navaids.js';
import * as fixes from './layers/fixes.js';
import * as airways from './layers/airways.js';
import * as procedures from './layers/procedures.js';

const layers = [airspace, airports, navaids, fixes, airways, procedures];

// ---- Render orchestration ----

function render() {
  for (const layer of layers) {
    layer.render();
  }
  updateStats();
}

function updateStats() {
  const parts = [];
  for (const layer of layers) {
    const stat = layer.getStats();
    if (stat) {
      parts.push(stat);
    }
  }
  document.getElementById('stats').textContent = parts.join(' | ') || 'No data loaded';
}

let renderTimer = null;

function scheduleRender() {
  if (renderTimer) {
    clearTimeout(renderTimer);
  }
  renderTimer = setTimeout(render, 50);
}

// Re-render viewport-dependent layers on zoom/pan.
map.on('moveend', scheduleRender);

// ---- Data loading ----

const DATA_LOADERS = {
  airspace: (data) => {
    airspace.features.push(...(data.features ?? []));
    console.log(`Loaded ${airspace.features.length} airspace features`);
    if (data.properties) {
      console.log('NASR cycle:', data.properties.nasrCycleDate);
    }
  },
  airports: (data) => {
    airports.records.push(...(data.records ?? []));
    console.log(`Loaded ${airports.records.length} airports`);
  },
  navaids: (data) => {
    navaids.records.push(...(data.records ?? []));
    console.log(`Loaded ${navaids.records.length} navaids`);
  },
  fixes: (data) => {
    fixes.records.push(...(data.records ?? []));
    console.log(`Loaded ${fixes.records.length} fixes`);
  },
  airways: (data) => {
    airways.records.push(...(data.records ?? []));
    console.log(`Loaded ${airways.records.length} airways`);
  },
  procedures: (data) => {
    procedures.records.push(...(data.records ?? []));
    console.log(`Loaded ${procedures.records.length} procedures`);
  },
};

async function init() {
  try {
    const configRes = await fetch('/config');
    const config = await configRes.json();

    buildLayerControls(config, render);
    initSearch(render);

    const fetches = [];
    for (const [name, enabled] of Object.entries(config.layers)) {
      if (!enabled) {
        continue;
      }
      const loader = DATA_LOADERS[name];
      if (loader) {
        fetches.push(
          fetch(`/data/${name}`)
            .then((r) => r.json())
            .then(loader),
        );
      }
    }
    await Promise.all(fetches);

    // Build filter controls before first render.
    for (const layer of layers) {
      layer.initFilters(render);
    }

    requestAnimationFrame(() => render());
  } catch (err) {
    document.getElementById('stats').textContent = 'Failed to load data: ' + err.message;
  }
}

init();
