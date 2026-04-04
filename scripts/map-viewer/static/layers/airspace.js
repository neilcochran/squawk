import { map, canvasRenderer, state, formatAltitude, buildTypeFilters } from '../shared.js';

export const COLORS = {
  CLASS_B: '#0066cc',
  CLASS_C: '#9933cc',
  CLASS_D: '#3399ff',
  MOA: '#cc6600',
  RESTRICTED: '#cc0000',
  PROHIBITED: '#990000',
  WARNING: '#cc9900',
  ALERT: '#ff6600',
  NSA: '#666666',
};

export const features = [];
export const activeTypes = new Set(Object.keys(COLORS));

let leafletLayer = null;

function getStyle(feature) {
  const type = feature.properties?.type ?? 'UNKNOWN';
  const color = COLORS[type] ?? '#888888';
  return {
    color: color,
    weight: 1.5,
    opacity: 0.8,
    fillColor: color,
    fillOpacity: 0.15,
  };
}

function buildPopup(feature) {
  const p = feature.properties ?? {};
  const coords = feature.geometry?.coordinates?.[0] ?? [];
  return `
    <div class="popup-content">
      <strong>Type:</strong> ${p.type}<br>
      <strong>Name:</strong> ${p.name}<br>
      <strong>ID:</strong> ${p.identifier}<br>
      <strong>Floor:</strong> ${formatAltitude(p.floor)}<br>
      <strong>Ceiling:</strong> ${formatAltitude(p.ceiling)}<br>
      <strong>State:</strong> ${p.state ?? 'N/A'}<br>
      <strong>Facility:</strong> ${p.controllingFacility ?? 'N/A'}<br>
      <strong>Coords:</strong> ${coords.length} points<br>
      ${p.scheduleDescription ? '<strong>Schedule:</strong> ' + p.scheduleDescription.substring(0, 200) : ''}
    </div>
  `;
}

function onEachFeature(feature, layer) {
  layer.bindPopup(buildPopup(feature), { maxWidth: 350 });
}

export function filter(feature) {
  const type = feature.properties?.type ?? '';
  if (!activeTypes.has(type)) {
    return false;
  }
  if (state.searchTerm) {
    const name = (feature.properties?.name ?? '').toLowerCase();
    const id = (feature.properties?.identifier ?? '').toLowerCase();
    if (!name.includes(state.searchTerm) && !id.includes(state.searchTerm)) {
      return false;
    }
  }
  return true;
}

export function render() {
  if (leafletLayer) {
    map.removeLayer(leafletLayer);
    leafletLayer = null;
  }
  if (!state.layerEnabled.airspace || features.length === 0) {
    return;
  }

  leafletLayer = L.geoJSON(features, {
    style: getStyle,
    onEachFeature: onEachFeature,
    filter: filter,
    renderer: canvasRenderer,
  }).addTo(map);
}

export function initFilters(renderAll) {
  buildTypeFilters(
    'airspaceFilters',
    'airspaceTypeFilters',
    features,
    (f) => f.properties?.type ?? 'UNKNOWN',
    (t) => COLORS[t] ?? '#888',
    activeTypes,
    renderAll,
  );
}

export function getStats() {
  if (!state.layerEnabled.airspace || features.length === 0) {
    return null;
  }
  const visible = features.filter(filter).length;
  return `Airspace: ${visible}/${features.length}`;
}
