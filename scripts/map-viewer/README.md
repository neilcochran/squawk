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
npm start -- --airspace --airports

# Custom port (default: 3117)
npm start -- --port 8080
```

Then open `http://localhost:3117` in your browser.

The viewer reads built data files directly from `packages/*/data/` on disk. If a
data file has not been generated yet, that layer is automatically skipped.

## Layers

| Layer    | Flag         | Data source                                    | Rendering                         |
| -------- | ------------ | ---------------------------------------------- | --------------------------------- |
| Airspace | `--airspace` | `packages/airspace-data/data/airspace.geojson` | Colored polygons by airspace type |
| Airports | `--airports` | `packages/airport-data/data/airports.json.gz`  | Circle markers by facility type   |

## Features

- **Layer toggles** - enable/disable each data layer independently
- **Type filters** - filter by airspace type (Class B/C/D, MOA, restricted, etc.)
  or facility type (airport, heliport, seaplane base, etc.)
- **Search** - filter across all layers by name, identifier, ICAO code, or city
- **Popups** - click any feature for full details including runways, frequencies,
  altitude bounds, and schedule information
- **Performance** - uses Canvas rendering and viewport culling; airports appear at
  zoom level 7+ to keep the map responsive with 19k+ facilities

## Adding new layers

When a new data package is added to the monorepo (e.g. `@squawk/adsb-stream`):

1. Add a data file path constant and `LayerConfig` entry in `src/index.ts`
2. Add a CLI flag for the layer
3. Add a `/data/<name>` endpoint to serve the data
4. Add rendering and filter logic to `viewer.html`
