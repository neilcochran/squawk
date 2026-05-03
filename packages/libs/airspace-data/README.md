<h1><img src="../../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/airspace-data</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/airspace-data)](https://www.npmjs.com/package/@squawk/airspace-data) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Pre-processed GeoJSON snapshot of US airspace geometry from the **2026-04-16** FAA NASR
cycle. Data only - no query logic, no dependency on
`@squawk/airspace`.

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Coverage

- Class B, C, D, and E controlled airspace (E2 through E7 subtypes)
- Special Use Airspace: MOAs, restricted, prohibited, warning, alert, and national security areas
- ARTCC (Air Route Traffic Control Center) lateral boundaries for all
  US-controlled centers, published per stratum (LOW/HIGH/UTA, plus oceanic
  CTA/FIR where applicable)

## Usage

```typescript
import { usBundledAirspace } from '@squawk/airspace-data';

// Inspect metadata
console.log(usBundledAirspace.properties.nasrCycleDate); // YYYY-MM-DD
console.log(usBundledAirspace.properties.featureCount);

// Use with @squawk/airspace for zero-config airspace queries
import { createAirspaceResolver } from '@squawk/airspace';

const resolver = createAirspaceResolver({ data: usBundledAirspace });
```

Consumers who have their own data pipeline can use `@squawk/airspace` alone and
pass any compatible GeoJSON dataset at initialization.

## Browser / SPA usage

For browsers, edge runtimes (Cloudflare Workers, Deno Deploy), and any other
environment without `node:fs`, import the async loader from the `/browser`
subpath. It fetches and decompresses the bundled `.gz` using Web Streams
(`DecompressionStream`) and the global `fetch`.

```typescript
import { loadUsBundledAirspace } from '@squawk/airspace-data/browser';
import { createAirspaceResolver } from '@squawk/airspace';

const dataset = await loadUsBundledAirspace();
const resolver = createAirspaceResolver({ data: dataset });
```

The default URL is resolved relative to this module's `import.meta.url`,
which works under any modern ESM bundler when the package is installed
normally.

To host the asset on your own CDN, to use a bundler-resolved (hashed)
asset URL, or to override the URL for any other reason, pass an explicit
`url`:

```typescript
import { loadUsBundledAirspace } from '@squawk/airspace-data/browser';

const dataset = await loadUsBundledAirspace({
  url: 'https://your-cdn.example/airspace.geojson.gz',
});
```

The loader also accepts a custom `fetch` implementation, which is useful in
tests or in edge environments that need a configured fetcher.

## Data format

The export is a GeoJSON `FeatureCollection`. Each feature's geometry is a Polygon
representing one airspace boundary. Feature properties include:

| Property              | Type                 | Description                                                                                                 |
| --------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------- |
| `type`                | string               | Airspace type (CLASS_B, CLASS_C, CLASS_D, CLASS_E2-E7, MOA, RESTRICTED, ARTCC, etc.)                        |
| `name`                | string               | Human-readable name                                                                                         |
| `identifier`          | string               | NASR designator, airport identifier, or 3-letter ARTCC code                                                 |
| `floor`               | AltitudeBound        | Lower vertical bound                                                                                        |
| `ceiling`             | AltitudeBound        | Upper vertical bound                                                                                        |
| `state`               | string or null       | Two-letter US state abbreviation                                                                            |
| `controllingFacility` | string or null       | Controlling ARTCC or facility (null for ARTCC features)                                                     |
| `scheduleDescription` | string or null       | Operating schedule text                                                                                     |
| `artccStratum`        | ArtccStratum or null | For ARTCC features, the stratum (`LOW`, `HIGH`, `UTA`, `CTA`, `FIR`, `CTA/FIR`); `null` for all other types |

`AltitudeBound` is `{ valueFt: number, reference: 'MSL' | 'AGL' | 'SFC' }`.

## Data source

All geometry and metadata is derived from the [FAA National Airspace System Resource
(NASR)](https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/) 28-day subscription, which is public domain. Class B/C/D/E
boundaries come from the NASR ESRI Shapefile, SUA boundaries from the AIXM
5.0 XML files, and ARTCC boundaries from the `ARB_BASE.csv` and
`ARB_SEG.csv` tables in the NASR CSV distribution. The build pipeline that
produces this dataset lives in [tools/build-airspace-data](https://github.com/neilcochran/squawk/tree/main/tools/build-airspace-data).
