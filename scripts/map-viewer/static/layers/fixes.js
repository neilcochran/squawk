import { map, canvasRenderer, state, MIN_ZOOM, buildTypeFilters } from '../shared.js';

export const COLOR = '#6b7280';

export const records = [];
export const activeUseCodes = new Set();

let leafletLayer = null;

function buildPopup(fix) {
  let html = `<div class="popup-content">`;
  html += `<strong>ID:</strong> ${fix.id}<br>`;
  html += `<strong>Use Code:</strong> ${fix.uc}<br>`;
  html += `<strong>State:</strong> ${fix.st ?? 'N/A'}<br>`;
  if (fix.icao) {
    html += `<strong>ICAO:</strong> ${fix.icao}<br>`;
  }
  html += `<strong>Lat/Lon:</strong> ${fix.lat.toFixed(4)}, ${fix.lon.toFixed(4)}<br>`;
  if (fix.mra !== undefined) {
    html += `<strong>MRA:</strong> ${fix.mra} ft<br>`;
  }
  if (fix.cht && fix.cht.length > 0) {
    html += `<strong>Charts:</strong> ${fix.cht.join(', ')}<br>`;
  }
  if (fix.nav && fix.nav.length > 0) {
    html += `<strong>Navaids:</strong><br>`;
    for (const n of fix.nav) {
      html += `&nbsp;&nbsp;${n.nid} (${n.ntp}) - ${n.brg.toFixed(0)} / ${n.dst.toFixed(1)} NM<br>`;
    }
  }
  html += `</div>`;
  return html;
}

export function filter(fix) {
  if (!activeUseCodes.has(fix.uc)) {
    return false;
  }
  if (state.searchTerm) {
    const id = (fix.id ?? '').toLowerCase();
    if (!id.includes(state.searchTerm)) {
      return false;
    }
  }
  return true;
}

export function getVisible() {
  const bounds = map.getBounds();
  return records.filter((fix) => {
    if (!filter(fix)) {
      return false;
    }
    return bounds.contains([fix.lat, fix.lon]);
  });
}

export function render() {
  if (leafletLayer) {
    map.removeLayer(leafletLayer);
    leafletLayer = null;
  }
  if (!state.layerEnabled.fixes || records.length === 0) {
    return;
  }

  const zoom = map.getZoom();
  if (!state.searchTerm && zoom < MIN_ZOOM.fixes) {
    return;
  }

  const visible = getVisible();
  leafletLayer = L.layerGroup();

  for (const fix of visible) {
    const marker = L.circleMarker([fix.lat, fix.lon], {
      renderer: canvasRenderer,
      radius: zoom >= 12 ? 4 : 3,
      fillColor: COLOR,
      color: '#ffffff',
      weight: 1,
      opacity: 0.8,
      fillOpacity: 0.7,
    });
    marker.bindPopup(buildPopup(fix), { maxWidth: 400 });
    leafletLayer.addLayer(marker);
  }
  leafletLayer.addTo(map);
}

export function initFilters(renderAll) {
  buildTypeFilters(
    'fixFilters',
    'fixTypeFilters',
    records,
    (f) => f.uc,
    () => COLOR,
    activeUseCodes,
    renderAll,
  );
}

export function getStats() {
  if (!state.layerEnabled.fixes || records.length === 0) {
    return null;
  }
  const zoom = map.getZoom();
  if (!state.searchTerm && zoom < MIN_ZOOM.fixes) {
    return `Fixes: zoom in (${records.length})`;
  }
  return `Fixes: ${getVisible().length}`;
}
