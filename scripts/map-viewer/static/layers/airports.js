import { map, canvasRenderer, state, MIN_ZOOM, buildTypeFilters } from '../shared.js';

export const COLORS = {
  AIRPORT: '#2d8a4e',
  HELIPORT: '#7c3aed',
  SEAPLANE_BASE: '#0891b2',
  GLIDERPORT: '#ca8a04',
  ULTRALIGHT: '#ea580c',
  BALLOONPORT: '#dc2626',
};

export const records = [];
export const activeTypes = new Set(Object.keys(COLORS));

let leafletLayer = null;

function buildPopup(apt) {
  let html = `<div class="popup-content">`;
  html += `<strong>Name:</strong> ${apt.nm}<br>`;
  html += `<strong>FAA ID:</strong> ${apt.id}`;
  if (apt.icao) {
    html += ` / <strong>ICAO:</strong> ${apt.icao}`;
  }
  html += `<br>`;
  html += `<strong>Type:</strong> ${apt.ft}<br>`;
  html += `<strong>City:</strong> ${apt.city}, ${apt.state}<br>`;
  if (apt.elev !== undefined) {
    html += `<strong>Elevation:</strong> ${apt.elev} ft MSL<br>`;
  }
  if (apt.twr) {
    html += `<strong>Tower:</strong> ${apt.twr}<br>`;
  }
  if (apt.fuel) {
    html += `<strong>Fuel:</strong> ${apt.fuel}<br>`;
  }

  if (apt.rwys && apt.rwys.length > 0) {
    html += `<strong>Runways:</strong><br>`;
    for (const rwy of apt.rwys) {
      html += `&nbsp;&nbsp;${rwy.id}`;
      if (rwy.len) {
        html += ` - ${rwy.len}x${rwy.w ?? '?'} ft`;
      }
      if (rwy.sfc) {
        html += ` (${rwy.sfc})`;
      }
      html += `<br>`;
    }
  }

  if (apt.freqs && apt.freqs.length > 0) {
    const shown = apt.freqs.slice(0, 8);
    html += `<strong>Frequencies:</strong><br>`;
    for (const f of shown) {
      html += `&nbsp;&nbsp;${f.f} MHz - ${f.u}`;
      if (f.s) {
        html += ` (${f.s})`;
      }
      html += `<br>`;
    }
    if (apt.freqs.length > 8) {
      html += `&nbsp;&nbsp;<em>...and ${apt.freqs.length - 8} more</em><br>`;
    }
  }

  html += `</div>`;
  return html;
}

export function filter(apt) {
  if (!activeTypes.has(apt.ft)) {
    return false;
  }
  if (state.searchTerm) {
    const name = (apt.nm ?? '').toLowerCase();
    const id = (apt.id ?? '').toLowerCase();
    const icao = (apt.icao ?? '').toLowerCase();
    const city = (apt.city ?? '').toLowerCase();
    if (
      !name.includes(state.searchTerm) &&
      !id.includes(state.searchTerm) &&
      !icao.includes(state.searchTerm) &&
      !city.includes(state.searchTerm)
    ) {
      return false;
    }
  }
  return true;
}

export function getVisible() {
  const bounds = map.getBounds();
  return records.filter((apt) => {
    if (!filter(apt)) {
      return false;
    }
    return bounds.contains([apt.lat, apt.lon]);
  });
}

export function render() {
  if (leafletLayer) {
    map.removeLayer(leafletLayer);
    leafletLayer = null;
  }
  if (!state.layerEnabled.airports || records.length === 0) {
    return;
  }

  const zoom = map.getZoom();
  if (!state.searchTerm && zoom < MIN_ZOOM.airports) {
    return;
  }

  const visible = getVisible();
  leafletLayer = L.layerGroup();

  for (const apt of visible) {
    const color = COLORS[apt.ft] ?? '#888888';
    const marker = L.circleMarker([apt.lat, apt.lon], {
      renderer: canvasRenderer,
      radius: zoom >= 10 ? 5 : 4,
      fillColor: color,
      color: '#ffffff',
      weight: 1.5,
      opacity: 1,
      fillOpacity: 0.9,
    });
    marker.bindPopup(buildPopup(apt), { maxWidth: 400 });
    leafletLayer.addLayer(marker);
  }
  leafletLayer.addTo(map);
}

export function initFilters(renderAll) {
  buildTypeFilters(
    'airportFilters',
    'airportTypeFilters',
    records,
    (a) => a.ft,
    (t) => COLORS[t] ?? '#888',
    activeTypes,
    renderAll,
  );
}

export function getStats() {
  if (!state.layerEnabled.airports || records.length === 0) {
    return null;
  }
  const zoom = map.getZoom();
  if (!state.searchTerm && zoom < MIN_ZOOM.airports) {
    return `Airports: zoom in (${records.length})`;
  }
  return `Airports: ${getVisible().length}`;
}
