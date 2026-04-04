import { map, canvasRenderer, state, MIN_ZOOM, buildTypeFilters } from '../shared.js';

export const COLORS = {
  VOR: '#e63946',
  VORTAC: '#d62828',
  'VOR/DME': '#f77f00',
  NDB: '#4a7c59',
  'NDB/DME': '#588157',
  TACAN: '#7209b7',
  DME: '#3a86ff',
  VOT: '#888888',
};

export const records = [];
export const activeTypes = new Set(Object.keys(COLORS));

let leafletLayer = null;

function buildPopup(nav) {
  let html = `<div class="popup-content">`;
  html += `<strong>ID:</strong> ${nav.id}<br>`;
  html += `<strong>Name:</strong> ${nav.nm}<br>`;
  html += `<strong>Type:</strong> ${nav.tp}<br>`;
  html += `<strong>Status:</strong> ${nav.st}<br>`;
  if (nav.fmhz !== undefined) {
    html += `<strong>Freq:</strong> ${nav.fmhz} MHz<br>`;
  }
  if (nav.fkhz !== undefined) {
    html += `<strong>Freq:</strong> ${nav.fkhz} kHz<br>`;
  }
  if (nav.ch) {
    html += `<strong>Channel:</strong> ${nav.ch}<br>`;
  }
  if (nav.elev !== undefined) {
    html += `<strong>Elevation:</strong> ${nav.elev} ft<br>`;
  }
  html += `<strong>State:</strong> ${nav.state ?? 'N/A'}<br>`;
  if (nav.cls) {
    html += `<strong>Class:</strong> ${nav.cls}<br>`;
  }
  if (nav.hrs) {
    html += `<strong>Hours:</strong> ${nav.hrs}<br>`;
  }
  html += `<strong>Lat/Lon:</strong> ${nav.lat.toFixed(4)}, ${nav.lon.toFixed(4)}<br>`;
  html += `</div>`;
  return html;
}

export function filter(nav) {
  if (!activeTypes.has(nav.tp)) {
    return false;
  }
  if (state.searchTerm) {
    const id = (nav.id ?? '').toLowerCase();
    const name = (nav.nm ?? '').toLowerCase();
    if (!id.includes(state.searchTerm) && !name.includes(state.searchTerm)) {
      return false;
    }
  }
  return true;
}

export function getVisible() {
  const bounds = map.getBounds();
  return records.filter((nav) => {
    if (!filter(nav)) {
      return false;
    }
    return bounds.contains([nav.lat, nav.lon]);
  });
}

export function render() {
  if (leafletLayer) {
    map.removeLayer(leafletLayer);
    leafletLayer = null;
  }
  if (!state.layerEnabled.navaids || records.length === 0) {
    return;
  }

  const zoom = map.getZoom();
  if (!state.searchTerm && zoom < MIN_ZOOM.navaids) {
    return;
  }

  const visible = getVisible();
  leafletLayer = L.layerGroup();

  for (const nav of visible) {
    const color = COLORS[nav.tp] ?? '#888888';
    const marker = L.circleMarker([nav.lat, nav.lon], {
      renderer: canvasRenderer,
      radius: zoom >= 10 ? 7 : zoom >= 8 ? 6 : 5,
      fillColor: color,
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9,
    });
    marker.bindPopup(buildPopup(nav), { maxWidth: 400 });
    leafletLayer.addLayer(marker);
  }
  leafletLayer.addTo(map);
}

export function initFilters(renderAll) {
  buildTypeFilters(
    'navaidFilters',
    'navaidTypeFilters',
    records,
    (n) => n.tp,
    (t) => COLORS[t] ?? '#888',
    activeTypes,
    renderAll,
  );
}

export function getStats() {
  if (!state.layerEnabled.navaids || records.length === 0) {
    return null;
  }
  const zoom = map.getZoom();
  if (!state.searchTerm && zoom < MIN_ZOOM.navaids) {
    return `Navaids: zoom in (${records.length})`;
  }
  return `Navaids: ${getVisible().length}`;
}
