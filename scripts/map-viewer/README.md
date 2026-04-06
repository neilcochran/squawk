# map-viewer

Internal dev tool that serves an interactive Leaflet map for visualizing data from
Squawk data packages. Not published to npm.

## Usage

```bash
# Build the script first
npm run build

# Launch with all available layers (default)
npm start

# Launch with specific layers only
npm start -- --airspace
npm start -- --airports
npm start -- --navaids --airways
npm start -- --airspace --airports --navaids --fixes --airways --procedures

# Custom port (default: 3117)
npm start -- --port 8080
```

Then open `http://localhost:3117` in your browser.

The viewer reads built data files directly from `packages/*/data/` on disk. If a
data file has not been generated yet, that layer is automatically skipped.

## Layers

| Layer      | Flag           | Data source                              | Rendering                                    |
| ---------- | -------------- | ---------------------------------------- | -------------------------------------------- |
| Airspace   | `--airspace`   | `airspace-data/data/airspace.geojson`    | Colored polygons by airspace type            |
| Airports   | `--airports`   | `airport-data/data/airports.json.gz`     | Circle markers by facility type (zoom 7+)    |
| Navaids    | `--navaids`    | `navaid-data/data/navaids.json.gz`       | Circle markers by navaid type (zoom 6+)      |
| Fixes      | `--fixes`      | `fix-data/data/fixes.json.gz`            | Small dots (zoom 9+)                         |
| Airways    | `--airways`    | `airway-data/data/airways.json.gz`       | Colored polylines by airway type (zoom 6+)   |
| Procedures | `--procedures` | `procedure-data/data/procedures.json.gz` | Colored polylines by SID/STAR type (zoom 7+) |

## Features

- **Layer toggles** - enable/disable each data layer independently
- **Type filters** - filter by airspace type (Class B/C/D/E, MOA, restricted, etc.),
  facility type, navaid type, fix use code, airway type, or procedure type (SID/STAR)
- **Search** - filter across all layers by name, identifier, ICAO code, designation, or city
- **Popups** - click any feature for full details including runways, frequencies,
  altitude bounds, waypoint routes, transitions, and schedule information
- **Performance** - uses Canvas rendering, viewport culling, and zoom-gated display
  to keep the map responsive with 90k+ combined features

## File structure

```text
scripts/map-viewer/
  src/index.ts           Server: layer registry, data caching, static file serving
  viewer.html            HTML shell with CSS and DOM structure
  static/
    viewer.js            Main entry: data loading, render loop, event wiring
    shared.js            Map instance, canvas renderer, shared state, helpers
    controls.js          Layer toggle checkboxes and search input
    layers/
      airspace.js        Airspace polygons (Class B/C/D/E, MOA, SUA)
      airports.js        Airport circle markers by facility type
      navaids.js         Navaid circle markers by type (VOR, NDB, TACAN, etc.)
      fixes.js           Fix/waypoint dots by use code
      airways.js         Airway polylines by type (Victor, Jet, RNAV)
      procedures.js      SID/STAR polylines with transition dashes
```

Each layer module is self-contained with its own colors, filter, render, popup, and
stats logic. Adding a new layer means adding a file in `static/layers/`, a
`LayerDefinition` entry in `src/index.ts`, the filter section HTML in `viewer.html`,
and importing/registering the module in `static/viewer.js`.
