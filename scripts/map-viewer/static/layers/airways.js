import {
  map,
  canvasRenderer,
  state,
  MIN_ZOOM,
  anyPointInBounds,
  buildTypeFilters,
} from '../shared.js';

export const COLORS = {
  VICTOR: '#2563eb',
  JET: '#dc2626',
  RNAV_Q: '#16a34a',
  RNAV_T: '#0d9488',
  GREEN: '#15803d',
  RED: '#b91c1c',
  AMBER: '#d97706',
  BLUE: '#1d4ed8',
  ATLANTIC: '#0369a1',
  BAHAMA: '#0e7490',
  PACIFIC: '#0c4a6e',
  PUERTO_RICO: '#6d28d9',
};

export const records = [];
export const activeTypes = new Set(Object.keys(COLORS));

let leafletLayer = null;

function buildPopup(awy) {
  let html = `<div class="popup-content">`;
  html += `<strong>Desig:</strong> ${awy.des}<br>`;
  html += `<strong>Type:</strong> ${awy.tp}<br>`;
  html += `<strong>Region:</strong> ${awy.rg}<br>`;
  html += `<strong>Waypoints:</strong> ${awy.wps.length}<br>`;
  const shown = awy.wps.slice(0, 10);
  html += `<strong>Route:</strong> ${shown.map((w) => w.id || w.nm).join(' - ')}`;
  if (awy.wps.length > 10) {
    html += ` ... (+${awy.wps.length - 10} more)`;
  }
  html += `<br></div>`;
  return html;
}

export function filter(awy) {
  if (!activeTypes.has(awy.tp)) {
    return false;
  }
  if (state.searchTerm) {
    const des = (awy.des ?? '').toLowerCase();
    if (!des.includes(state.searchTerm)) {
      return false;
    }
  }
  return true;
}

export function getVisible() {
  const bounds = map.getBounds();
  return records.filter((awy) => {
    if (!filter(awy)) {
      return false;
    }
    return anyPointInBounds(awy.wps, bounds);
  });
}

export function render() {
  if (leafletLayer) {
    map.removeLayer(leafletLayer);
    leafletLayer = null;
  }
  if (!state.layerEnabled.airways || records.length === 0) {
    return;
  }

  const zoom = map.getZoom();
  if (!state.searchTerm && zoom < MIN_ZOOM.airways) {
    return;
  }

  const visible = getVisible();
  leafletLayer = L.layerGroup();

  for (const awy of visible) {
    const color = COLORS[awy.tp] ?? '#888888';
    const latlngs = awy.wps.map((wp) => [wp.lat, wp.lon]);
    if (latlngs.length < 2) {
      continue;
    }

    const polyline = L.polyline(latlngs, {
      renderer: canvasRenderer,
      color: color,
      weight: zoom >= 9 ? 2.5 : 1.5,
      opacity: 0.7,
    });
    polyline.bindPopup(buildPopup(awy), { maxWidth: 400 });
    leafletLayer.addLayer(polyline);
  }
  leafletLayer.addTo(map);
}

export function initFilters(renderAll) {
  buildTypeFilters(
    'airwayFilters',
    'airwayTypeFilters',
    records,
    (a) => a.tp,
    (t) => COLORS[t] ?? '#888',
    activeTypes,
    renderAll,
  );
}

export function getStats() {
  if (!state.layerEnabled.airways || records.length === 0) {
    return null;
  }
  const zoom = map.getZoom();
  if (!state.searchTerm && zoom < MIN_ZOOM.airways) {
    return `Airways: zoom in (${records.length})`;
  }
  return `Airways: ${getVisible().length}`;
}
