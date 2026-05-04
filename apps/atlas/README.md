# Squawk Atlas

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE.md)

The official Squawk viewer - a chart-first web app for browsing aeronautical data, built on the [@squawk/\*](https://github.com/neilcochran/squawk) packages.

> [!NOTE]
> Atlas is functional but not polished. Chart mode is the first mode and currently the only one shipped. Rough edges remain (the basemap is hosted on Protomaps' public dev bucket, some camera artifacts are unsmoothed at high pitch, mobile copy is still being tuned).

## Chart mode

An interactive aeronautical map of the US. The data comes from the bundled `@squawk/*-data` packages via their `/browser` async loaders.

**Layers** (each independently toggleable):

- **Airports** - all FAA NASR airports.
- **Navaids** - VOR / DME / TACAN / NDB. Appears at zoom 5+.
- **Fixes** - waypoints. Appears at zoom 7+ (sub-pixel below).
- **Airways** - low altitude (V / RNAV-T), high altitude (J / RNAV-Q), and oceanic + regional (Atlantic, Bahama, Pacific, Puerto Rico, plus the Alaska colored airways). Each category individually toggleable.
- **Airspace** - Class B, C, D, E (collapsing the underlying E2-E7 strata into the user-facing concept), MOA, Restricted, Prohibited, Warning, Alert, NSA, and ARTCC. Each class individually toggleable. ARTCC is off by default at the CONUS view since its sectors dominate every other tint.

**3D airspace** extrusion paints when the camera is tilted. An auto-hide dialog prompts to drop tilt-incompatible airspace classes back to 2D when the user pitches up, since stratified classes (MOA, ARTCC) extrude into a visually-noisy stack.

**Click-to-inspect** any feature. When a click lands on multiple stacked features (e.g. an airway intersection or two close VORs at the same pixel), a disambiguation popover lets the user pick. The bbox query radius scales with zoom so dense fix / navaid clusters near the cursor surface in the popover at high zoom, while CONUS-zoom clicks stay near-strict.

**Entity inspector** opens on selection - right-side panel on desktop, bottom sheet on mobile. Per-type renderers cover airport, navaid, fix, airway, and airspace. An "Also here" chip strip lets the user switch between stacked features without re-clicking the map. Hovering a chip pans the camera so the picked feature stays visible behind the inspector.

**URL-driven state** - map view (lat/lon/zoom/pitch), active layer set, airspace classes, airway categories, and the selected entity all live in the URL. Stale share-links with unknown values fall back to defaults rather than erroring.

**Theme switcher** - light, dark, or follow OS, persisted in `localStorage`.

## Architecture

Atlas is structured as a shell + per-mode component tree. The shell handles app-level chrome (header, mode switcher, theme switcher); each mode under `src/modes/<name>/` owns its layers, URL state schema, and inspector wiring. Modes are loosely coupled - adding one means adding a new directory under `src/modes/`, a new TanStack Router file under `src/routes/`, and an entry in the shell's mode switcher.

Cross-mode reusable code (data loaders, shared map primitives, the inspector, UI primitives, style tokens) lives under `src/shared/`. The detailed app-specific conventions (pure-helper extraction, tiny pub/sub buses for cross-tree side effects, mobile-first responsive rules, etc.) are in the [Atlas at a glance](../../ARCHITECTURE.md#atlas-at-a-glance) section of ARCHITECTURE.md.

Data flows through the data packages' `/browser` entries, which use `fetch` + `DecompressionStream('gzip')` to load the gzipped snapshots asynchronously. Each dataset is wrapped in a module-level cached promise so N components subscribing to it trigger one fetch.

## Stack

- React 19 + Vite 8
- TanStack Router with file-based routes and zod-validated URL search params
- Tailwind CSS v4
- MapLibre GL via `@vis.gl/react-maplibre`
- Protomaps + PMTiles for basemap tiles
- Radix UI primitives (dropdown menus)
- Vitest + jsdom + `@testing-library/react`

## Local development

```sh
npm install
npm run dev
```

## Scripts

| Script                  | Description                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| `npm run dev`           | Start the Vite dev server.                                        |
| `npm run build`         | Type-check the project and produce a production build in `dist/`. |
| `npm run test`          | Run the Vitest suite once.                                        |
| `npm run test:coverage` | Run Vitest with V8 coverage.                                      |
| `npm run lint`          | Lint with ESLint.                                                 |
| `npm run format`        | Format files with Prettier.                                       |
| `npm run format:check`  | Verify formatting without writing changes.                        |

## License

[MIT](../../LICENSE.md)
