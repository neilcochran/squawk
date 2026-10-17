<h1><img src="../../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/airspace-data</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/airspace-data)](https://www.npmjs.com/package/@squawk/airspace-data) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Pre-processed GeoJSON snapshot of US airspace geometry from the **2026-10-29** FAA NASR
cycle. Data only - no query logic, no dependency on
`@squawk/airspace`.

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Coverage

- Class A, one feature per domestic ARTCC: 18,000 ft MSL to FL600 over the
  contiguous states, Alaska, and Puerto Rico and their adjacent offshore
  airspace, none over Hawaii (see [Data source](#data-source))
- Class B, C, D, and E controlled airspace (E2 through E7 subtypes)
- Special Use Airspace: MOAs, restricted, prohibited, warning, alert, and national security areas
- ARTCC (Air Route Traffic Control Center) lateral boundaries for all
  US-controlled centers, published per stratum (LOW/HIGH/UTA, plus oceanic
  CTA/FIR where applicable)
- One feature per published volume or part: each Class B ring, each Special
  Use Airspace area with its own altitude block (a base area plus any
  additional areas), and each detached part of a Class E area
- Polygon rings oriented per RFC 7946 (exterior counterclockwise, holes
  clockwise), with arcs traced along the great circle

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
import { createAirspaceResolver } from '@squawk/airspace/browser';

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

## Reading the metadata without loading the data

Importing the package decompresses and parses the whole airspace snapshot. When all
you need is the data's vintage - to show which cycle you are serving, or to decide
whether to refresh - import the `/meta` subpath instead. It is a plain constant with
no file access, so it costs nothing and works the same in Node and the browser.

```typescript
import { usBundledAirspaceProperties } from '@squawk/airspace-data/meta';

console.log(usBundledAirspaceProperties.nasrCycleDate); // YYYY-MM-DD
console.log(usBundledAirspaceProperties.featureCount);
```

The values are identical to `usBundledAirspace.properties`; the difference is only
that reading them this way does not pull the records into memory.

## Data format

The export is a GeoJSON `FeatureCollection`. Each feature's geometry is a Polygon
representing one airspace boundary. Feature properties include:

| Property              | Type                 | Description                                                                                                                                                    |
| --------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                | string               | Airspace type (CLASS_B, CLASS_C, CLASS_D, CLASS_E2-E7, MOA, RESTRICTED, ARTCC, etc.)                                                                           |
| `name`                | string               | Human-readable name                                                                                                                                            |
| `identifier`          | string               | Airport identifier (Class B/C/D/E2-E4), NASR designator (SUA), or 3-letter center code (ARTCC); empty where NASR publishes none (most Class E5/E6/E7, Class A) |
| `floor`               | AltitudeBound        | Lower vertical bound                                                                                                                                           |
| `ceiling`             | AltitudeBound        | Upper vertical bound                                                                                                                                           |
| `state`               | string or null       | Two-letter US state abbreviation                                                                                                                               |
| `controllingFacility` | string or null       | Controlling ARTCC of a Special Use Airspace feature, where published; null for Class B/C/D/E, Class A and ARTCC features                                       |
| `scheduleDescription` | string or null       | Operating schedule text                                                                                                                                        |
| `artccStratum`        | ArtccStratum or null | For ARTCC features, the stratum (`LOW`, `HIGH`, `UTA`, `CTA`, `FIR`, `CTA/FIR`); `null` for all other types                                                    |
| `exclusions`          | AirspaceVolume[]     | Volumes carved out of the feature (Special Use Airspace only); absent when none                                                                                |

`AltitudeBound` is `{ valueFt: number, reference: 'MSL' | 'AGL' | 'SFC', inclusive?: boolean }`.
`inclusive: false` marks a bound that excludes its own value, as published for the
Special Use Airspace designated "to but not including FL 180" and as the build sets
for Class E ceilings beneath Class A; a bound without the flag includes its value. A
`ceiling` of `{ valueFt: 99999, reference: 'MSL' }` is a sentinel for an upper limit
the FAA leaves undefined or unlimited.

Special Use Airspace that the FAA publishes with volumes carved out of it carries
them as `exclusions`, a list of `{ floor, ceiling, boundary }` volumes: within an
exclusion's boundary, between its floor and ceiling, the airspace does not apply.
A-211 Dothan excludes the Class D areas of three airports below their ceilings;
R-5601F Fort Sill excludes the airspace below 5,500 ft MSL over part of its area.
Most exclusions cover only part of the feature's height, which is why they are
separate volumes rather than holes in the polygon. `@squawk/airspace` applies them
in `query()`.

## Data source

All geometry and metadata is derived from the [FAA National Airspace System Resource
(NASR)](https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/) 28-day subscription, which is public domain. Class B/C/D/E
boundaries come from the NASR ESRI Shapefile, SUA boundaries from the AIXM
5.0 XML files, and ARTCC boundaries from the `ARB_BASE.csv` and
`ARB_SEG.csv` tables in the NASR CSV distribution. The build pipeline that
produces this dataset lives in [tools/build-airspace-data](https://github.com/neilcochran/squawk/tree/main/tools/build-airspace-data).

Class A is the one feature the FAA does not publish as geometry. 14 CFR 71.33
states it as a rule - 18,000 ft MSL to FL600 over the contiguous states, Alaska,
and Puerto Rico, their coastal waters, and the designated offshore areas within
domestic radar coverage - and the HIGH stratum of each domestic center traces
that lateral extent, so the build emits one `CLASS_A` feature per HIGH stratum
shape (and one from San Juan's single combined stratum) with that vertical block.
Each is named `CLASS A` with an empty `identifier`. Honolulu and the oceanic
centers publish no HIGH stratum and get none, matching the regulation. Two
carve-outs are not applied: the Alaska Peninsula west of 160 W, which ZAN's
stratum covers, and the airspace within 1,500 ft of the surface, which only
matters over terrain above 16,500 ft.

Class E ceilings beneath Class A are the one attribute the build resolves rather
than copies. NASR leaves the upper limit of nearly every Class E area undefined,
because 14 CFR 71.71 ends those areas at the overlying controlled airspace rather
than at a number. Where a Class E area overlaps a Class A feature, the build sets
its ceiling to 18,000 ft MSL marked exclusive, the altitude at which Class A begins; where it does not
(Hawaii, and beyond the lateral extent of Class A) the ceiling stays the 99,999
sentinel, and a Class E area with a published ceiling keeps it. Special Use
Airspace with an undefined ceiling is left alone, since restricted and warning
areas genuinely extend through Class A.

## Coverage limits and known issues

- Boundary coordinates are rounded to 5 decimal places (about 1 m), which keeps the polygons small while staying well inside the precision of the published boundaries. The same point can differ in its last places between squawk datasets (a navaid in the navaid data and as an airway waypoint, for example), so compare positions across datasets with a tolerance.
- Special Use Airspace exclusions are published on the feature rather than cut
  out of its polygon, because 214 of the 233 carve-outs cover only part of the
  feature's height. A consumer that draws or tests the polygon alone sees the
  full footprint; apply `exclusions` (as `@squawk/airspace` does) to honour
  them.
- The two `LYNDEN CLASS D` features and the `SAULT STE MARIE CLASS D` and
  `CLASS E4` features have an empty `identifier`. They are the United States
  portions of the Abbotsford, Boundary Bay and Sault Ste Marie (Ontario)
  control zones, which the FAA designates under the nearest US town and NASR
  publishes without an airport identifier.
- The FAA derives the endpoints of a Special Use Airspace arc separately from
  the published corner coordinates, so an arc end commonly misses the adjoining
  corner by a few tenths of a nautical mile. The build joins an arc end to a
  corner within a nautical mile of it; six areas keep a crossing of a few
  hundred metres where the published corners themselves overlap an edge, and
  the Illinois Class E5 ring crosses itself twice in the same way.
- Two Special Use Airspace files in the current cycle publish no surface
  geometry and are not included.
- One ceiling sits above the 99,999 ft sentinel: `R-2535B SAN NICOLAS ISLAND`
  is designated from the surface to 100,000 ft MSL, so its ceiling is the
  published 100,000 rather than the undefined-ceiling sentinel. Treat any
  ceiling of 99,999 as undefined and anything else, including this one, as a
  published value.
