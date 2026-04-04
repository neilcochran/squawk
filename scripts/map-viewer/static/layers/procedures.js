import {
  map,
  canvasRenderer,
  state,
  MIN_ZOOM,
  anyPointInBounds,
  buildTypeFilters,
} from '../shared.js';

export const COLORS = {
  SID: '#7c3aed',
  STAR: '#ea580c',
};

export const records = [];
export const activeTypes = new Set(Object.keys(COLORS));

let leafletLayer = null;

function buildPopup(proc) {
  let html = `<div class="popup-content">`;
  html += `<strong>Name:</strong> ${proc.nm}<br>`;
  html += `<strong>Code:</strong> ${proc.cc}<br>`;
  html += `<strong>Type:</strong> ${proc.tp}<br>`;
  html += `<strong>Airports:</strong> ${proc.apt.join(', ')}<br>`;
  if (proc.tr && proc.tr.length > 0) {
    html += `<strong>Transitions:</strong> ${proc.tr.map((t) => t.nm).join(', ')}<br>`;
  }
  if (proc.cr && proc.cr.length > 0) {
    const totalWps = proc.cr.reduce((sum, cr) => sum + cr.wps.length, 0);
    html += `<strong>Common Routes:</strong> ${proc.cr.length} (${totalWps} wps)<br>`;
  }
  html += `</div>`;
  return html;
}

export function filter(proc) {
  if (!activeTypes.has(proc.tp)) {
    return false;
  }
  if (state.searchTerm) {
    const name = (proc.nm ?? '').toLowerCase();
    const code = (proc.cc ?? '').toLowerCase();
    const apts = proc.apt.join(' ').toLowerCase();
    if (
      !name.includes(state.searchTerm) &&
      !code.includes(state.searchTerm) &&
      !apts.includes(state.searchTerm)
    ) {
      return false;
    }
  }
  return true;
}

function procedureInBounds(proc, bounds) {
  for (const cr of proc.cr ?? []) {
    if (anyPointInBounds(cr.wps, bounds)) {
      return true;
    }
  }
  for (const tr of proc.tr ?? []) {
    if (anyPointInBounds(tr.wps, bounds)) {
      return true;
    }
  }
  return false;
}

export function getVisible() {
  const bounds = map.getBounds();
  return records.filter((proc) => {
    if (!filter(proc)) {
      return false;
    }
    return procedureInBounds(proc, bounds);
  });
}

export function render() {
  if (leafletLayer) {
    map.removeLayer(leafletLayer);
    leafletLayer = null;
  }
  if (!state.layerEnabled.procedures || records.length === 0) {
    return;
  }

  const zoom = map.getZoom();
  if (!state.searchTerm && zoom < MIN_ZOOM.procedures) {
    return;
  }

  const visible = getVisible();
  leafletLayer = L.layerGroup();

  for (const proc of visible) {
    const color = COLORS[proc.tp] ?? '#888888';
    const popupHtml = buildPopup(proc);

    for (const cr of proc.cr ?? []) {
      const latlngs = cr.wps.map((wp) => [wp.lat, wp.lon]);
      if (latlngs.length < 2) {
        continue;
      }
      const polyline = L.polyline(latlngs, {
        renderer: canvasRenderer,
        color: color,
        weight: zoom >= 9 ? 2.5 : 2,
        opacity: 0.8,
      });
      polyline.bindPopup(popupHtml, { maxWidth: 400 });
      leafletLayer.addLayer(polyline);
    }

    for (const tr of proc.tr ?? []) {
      const latlngs = tr.wps.map((wp) => [wp.lat, wp.lon]);
      if (latlngs.length < 2) {
        continue;
      }
      const polyline = L.polyline(latlngs, {
        renderer: canvasRenderer,
        color: color,
        weight: zoom >= 9 ? 2 : 1.5,
        opacity: 0.5,
        dashArray: '6 4',
      });
      polyline.bindPopup(popupHtml, { maxWidth: 400 });
      leafletLayer.addLayer(polyline);
    }
  }
  leafletLayer.addTo(map);
}

export function initFilters(renderAll) {
  buildTypeFilters(
    'procedureFilters',
    'procedureTypeFilters',
    records,
    (p) => p.tp,
    (t) => COLORS[t] ?? '#888',
    activeTypes,
    renderAll,
  );
}

export function getStats() {
  if (!state.layerEnabled.procedures || records.length === 0) {
    return null;
  }
  const zoom = map.getZoom();
  if (!state.searchTerm && zoom < MIN_ZOOM.procedures) {
    return `Procedures: zoom in (${records.length})`;
  }
  return `Procedures: ${getVisible().length}`;
}
