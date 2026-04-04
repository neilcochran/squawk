// Shared state, map instance, and utilities used by all layer modules.

// ---- Leaflet map and renderer ----
export const canvasRenderer = L.canvas({ padding: 0.5 });
export const map = L.map('map', { preferCanvas: true }).setView([39.5, -98.35], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 18,
}).addTo(map);

// ---- Zoom thresholds ----
export const MIN_ZOOM = {
  airports: 7,
  navaids: 6,
  fixes: 9,
  airways: 6,
  procedures: 7,
};

// ---- Shared mutable state ----
export const state = {
  searchTerm: '',
  layerEnabled: {
    airspace: true,
    airports: true,
    navaids: true,
    fixes: true,
    airways: true,
    procedures: true,
  },
};

// ---- Helpers ----

/**
 * Returns true if any waypoint in the array falls within the given bounds.
 */
export function anyPointInBounds(waypoints, bounds) {
  for (const wp of waypoints) {
    if (bounds.contains([wp.lat, wp.lon])) {
      return true;
    }
  }
  return false;
}

/**
 * Formats an airspace altitude bound for display.
 */
export function formatAltitude(bound) {
  if (!bound) {
    return '?';
  }
  if (bound.reference === 'SFC') {
    return 'SFC';
  }
  if (bound.valueFt === 99999) {
    return 'UNL';
  }
  if (bound.valueFt >= 18000 && bound.reference === 'MSL') {
    return 'FL' + bound.valueFt / 100;
  }
  return bound.valueFt + ' ' + bound.reference;
}

/**
 * Builds a set of checkbox filter controls for a given data layer.
 * Counts occurrences of each type, builds checkboxes with color swatches,
 * and wires up change handlers to toggle types in the activeSet.
 */
export function buildTypeFilters(
  sectionId,
  containerId,
  items,
  getType,
  getColor,
  activeSet,
  renderFn,
) {
  const section = document.getElementById(sectionId);
  const container = document.getElementById(containerId);
  if (items.length === 0) {
    return;
  }

  section.classList.remove('section-hidden');
  const counts = {};
  for (const item of items) {
    const t = getType(item);
    counts[t] = (counts[t] ?? 0) + 1;
  }
  container.innerHTML = '';

  // Ensure activeSet has all discovered types.
  for (const type of Object.keys(counts)) {
    activeSet.add(type);
  }

  for (const [type, count] of Object.entries(counts).sort()) {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true;
    cb.addEventListener('change', () => {
      if (cb.checked) {
        activeSet.add(type);
      } else {
        activeSet.delete(type);
      }
      renderFn();
    });
    const color = getColor(type);
    label.appendChild(cb);
    label.appendChild(document.createTextNode(`${type} (${count}) `));
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = color;
    label.appendChild(swatch);
    container.appendChild(label);
  }
}
