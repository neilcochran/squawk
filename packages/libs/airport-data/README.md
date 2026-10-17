<h1><img src="../../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/airport-data</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/airport-data)](https://www.npmjs.com/package/@squawk/airport-data) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Pre-processed snapshot of airport data from the **2026-10-29** FAA NASR
cycle. Data only - no query logic, no dependency on
`@squawk/airports`.

**[Documentation](https://neilcochran.github.io/squawk/modules/_squawk_airport-data.html)**

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Coverage

- All open aviation facilities the FAA publishes: US airports, heliports, seaplane bases, gliderports, ultralight, and balloonports, plus selected Canadian, Mexican, Caribbean, and Pacific facilities that participate in US operations
- Runway dimensions, surface, condition, lighting, weight limits and the published pavement strength rating (PCN or PCR) with its component codes
- Per-runway-end details: heading, displaced thresholds, declared distances (TORA/TODA/ASDA/LDA), approach lighting, VGSI, RVR locations, LAHSO
- Structured ILS data: system type, identifier, category, localizer frequency and course, glide slope angle and type, DME channel
- Communication frequencies with usage, sectorization, the FAA's receive-only and on-request qualifiers, the providing facility and its type, call signs and remarks, including the weather broadcast and the remote communications outlet and flight service radio frequencies the FAA lists under the airport
- Traffic pattern altitude in feet above the field where published
- IANA time zone identifier resolved from the facility lat/lon (e.g. `America/New_York`), ready for direct use with `Intl.DateTimeFormat` and other standard date/time APIs

## Installation

```bash
npm install @squawk/airport-data
```

## Usage

```typescript
import { usBundledAirports } from '@squawk/airport-data';

// Inspect metadata
console.log(usBundledAirports.properties.nasrCycleDate); // YYYY-MM-DD
console.log(usBundledAirports.properties.recordCount);

// Use with @squawk/airports for zero-config airport queries
import { createAirportResolver } from '@squawk/airports';

const resolver = createAirportResolver({ data: usBundledAirports.records });
```

Consumers who have their own data pipeline can use `@squawk/airports` alone and
pass any compatible Airport array at initialization.

## Browser / SPA usage

For browsers, edge runtimes (Cloudflare Workers, Deno Deploy), and any other
environment without `node:fs`, import the async loader from the `/browser`
subpath. It fetches and decompresses the bundled `.gz` using Web Streams
(`DecompressionStream`) and the global `fetch`.

```typescript
import { loadUsBundledAirports } from '@squawk/airport-data/browser';
import { createAirportResolver } from '@squawk/airports/browser';

const dataset = await loadUsBundledAirports();
const resolver = createAirportResolver({ data: dataset.records });
```

The default URL is resolved relative to this module's `import.meta.url`,
which works under any modern ESM bundler when the package is installed
normally.

To host the asset on your own CDN, to use a bundler-resolved (hashed)
asset URL, or to override the URL for any other reason, pass an explicit
`url`:

```typescript
import { loadUsBundledAirports } from '@squawk/airport-data/browser';

const dataset = await loadUsBundledAirports({
  url: 'https://your-cdn.example/airports.json.gz',
});
```

The loader also accepts a custom `fetch` implementation, which is useful in
tests or in edge environments that need a configured fetcher.

## Reading the metadata without loading the data

Importing the package decompresses and parses the whole airport snapshot. When all
you need is the data's vintage - to show which cycle you are serving, or to decide
whether to refresh - import the `/meta` subpath instead. It is a plain constant with
no file access, so it costs nothing and works the same in Node and the browser.

```typescript
import { usBundledAirportsProperties } from '@squawk/airport-data/meta';

console.log(usBundledAirportsProperties.nasrCycleDate); // YYYY-MM-DD
console.log(usBundledAirportsProperties.recordCount);
```

The values are identical to `usBundledAirports.properties`; the difference is only
that reading them this way does not pull the records into memory.

## Data format

Each record is a full `Airport` object from `@squawk/types`. Key fields:

| Property                         | Type                | Description                                                            |
| -------------------------------- | ------------------- | ---------------------------------------------------------------------- |
| `faaId`                          | string              | FAA location identifier (e.g. "JFK", "LAX", "3N6")                     |
| `icao`                           | string or undefined | ICAO code when assigned (e.g. "KJFK")                                  |
| `name`                           | string              | Official facility name                                                 |
| `facilityType`                   | FacilityType        | AIRPORT, HELIPORT, SEAPLANE_BASE, etc.                                 |
| `ownershipType`                  | OwnershipType       | PUBLIC or PRIVATE                                                      |
| `useType`                        | FacilityUseType     | PUBLIC or PRIVATE                                                      |
| `status`                         | FacilityStatus      | Always OPEN (closed facilities are excluded)                           |
| `city`, `country`                | string              | Location identifiers                                                   |
| `state`                          | string or undefined | Two-letter code for US facilities, absent for foreign                  |
| `lat`, `lon`                     | number              | Decimal degrees                                                        |
| `timezone`                       | string              | IANA time zone identifier (e.g. "America/New_York")                    |
| `elevationFt`                    | number              | Field elevation in feet MSL                                            |
| `magneticVariationDeg`           | number or undefined | Magnetic variation in degrees                                          |
| `trafficPatternAltitudeFtAgl`    | number or undefined | Traffic pattern altitude in feet above the field, where published      |
| `artccId`, `county`, `towerType` | string or undefined | Responsible ARTCC, county, tower type; present on every bundled record |
| `fuelTypes`                      | string or undefined | e.g. "100LL,A"                                                         |
| `runways`                        | Runway[]            | Runway details (see below)                                             |
| `frequencies`                    | AirportFrequency[]  | Communication frequencies (see below)                                  |

### Runway

| Property                 | Type                                | Description                                                                         |
| ------------------------ | ----------------------------------- | ----------------------------------------------------------------------------------- |
| `id`                     | string                              | Designator (e.g. "04L/22R")                                                         |
| `lengthFt`               | number or undefined                 | Length in feet; absent where the FAA publishes none                                 |
| `widthFt`                | number or undefined                 | Width in feet; absent where the FAA publishes none                                  |
| `surfaceType`            | string or undefined                 | e.g. "CONC", "ASPH", "TURF"                                                         |
| `condition`              | SurfaceCondition                    | EXCELLENT, GOOD, FAIR, POOR, FAILED                                                 |
| `pavementClassification` | PavementClassification or undefined | PCN or PCR rating: value, pavement type, subgrade, tire pressure, evaluation method |
| `lighting`               | RunwayLighting                      | HIGH, MEDIUM, LOW, NONSTANDARD, NONE                                                |
| `ends`                   | RunwayEnd[]                         | Per-end details (typically two)                                                     |

### RunwayEnd

| Property                              | Type                   | Description                                                 |
| ------------------------------------- | ---------------------- | ----------------------------------------------------------- |
| `id`                                  | string                 | Designator (e.g. "04L", "22R")                              |
| `trueHeadingDeg`                      | number or undefined    | True heading in degrees (north appears as 0 or 360)         |
| `ils`                                 | IlsSystem or undefined | Structured ILS data (see below)                             |
| `toraFt`, `todaFt`, `asdaFt`, `ldaFt` | number or undefined    | Declared distances in feet                                  |
| `displacedThresholdFt`                | number or undefined    | Displaced threshold distance in feet                        |
| `vgsiType`                            | VgsiType               | e.g. PAPI-4L, VASI-2L                                       |
| `approachLights`                      | string or undefined    | Approach lighting system code                               |
| `hasRvr`, `rvrLocations`              | boolean, RvrLocation[] | RVR installed, and at which of TOUCHDOWN, MIDPOINT, ROLLOUT |

### IlsSystem

| Property                     | Type                     | Description                                                          |
| ---------------------------- | ------------------------ | -------------------------------------------------------------------- |
| `systemType`                 | IlsSystemType            | ILS, ILS/DME, LOCALIZER, LOC/DME, LOC/GS, LDA, LDA/DME, SDF, SDF/DME |
| `identifier`                 | string                   | Facility identifier (e.g. "I-JFK")                                   |
| `category`                   | IlsCategory or undefined | Approach category (I, II, III, IIIA, IIIB, IIIC)                     |
| `localizerFrequencyMhz`      | number                   | Localizer frequency in MHz (108-112)                                 |
| `localizerMagneticCourseDeg` | number                   | Front course bearing in magnetic degrees                             |
| `glideSlopeAngleDeg`         | number or undefined      | Glide slope angle in degrees (typically ~3.0)                        |
| `glideSlopeType`             | string or undefined      | Glide slope class (GLIDE SLOPE, GLIDE SLOPE/DME)                     |
| `dmeChannel`                 | string or undefined      | DME channel (e.g. "032X", "046X")                                    |

### AirportFrequency

| Property                       | Type                 | Description                                                              |
| ------------------------------ | -------------------- | ------------------------------------------------------------------------ |
| `frequencyMhz`                 | number               | Frequency in MHz (e.g. 119.1); HF published in kHz is converted (5.696)  |
| `use`                          | string               | Purpose (e.g. "LCL/P", "GND/P", "ATIS")                                  |
| `sectorization`                | string or undefined  | Applicability (e.g. "RWY 04L/22R")                                       |
| `receiveOnly`, `onRequest`     | boolean or undefined | The FAA's `R` and `X` qualifiers (122.1R, 8903X)                         |
| `provider`, `providerType`     | string or undefined  | Facility providing the service and its type (e.g. "NEW YORK" / "TRACON") |
| `callSign`, `approachCallSign` | string or undefined  | Tower or communications call sign, primary approach call sign            |
| `remark`                       | string or undefined  | FAA remark, including text the FAA appends to the frequency itself       |

Frequencies are those the FAA lists under the airport: the airport's own
communications, its AWOS/ASOS weather broadcast, and the remote communications
outlets and flight service radio frequencies serviced to it. Most are VHF or UHF;
military fields also publish VHF FM and other bands below 108 MHz and between
137 and 225 MHz. A few remote communications outlets the FAA lists under an
airport sit up to 20 nm from it.

## Coverage limits and known issues

- Coordinates carry up to 8 decimal places, the precision of the FAA's decimal columns (about 1 mm). The same point can differ in its last places between squawk datasets (a navaid in the navaid data and as an airway waypoint, for example), so compare positions across datasets with a tolerance.
- Frequencies published for a navaid that shares the airport's identifier (an
  NDB named `AAA` at airport `AAA`) are not the airport's and are left out.
- The FAA publishes `0` for a runway length or width it does not know; those
  are absent rather than zero. `X36 12/30` and `C98 18/36` publish lengths
  (2,802 and 2,603 ft) that disagree with the distance between their runway
  ends (about 2,040 and 2,000 ft); both are carried as published.
- `CO4 17R/35L` publishes a single-wheel weight limit of 6,000 thousand
  pounds, an FAA entry error whose correct value is unknown; it is carried as
  published.
- Localizer courses are published as magnetic. At a few military fields (`CVS`
  13 and 31, `FCS` 31, `MUI` 25, `BIF` 22) the published course equals the
  runway's true heading, and `HFD` 02 publishes a course of 2.0 against a true
  heading of 9 with 15 degrees of west variation; all are carried as published.
  Offset localizers (`BIH` 17, `CCR` 19R, `DLS` 25) legitimately differ from
  the runway heading.
- `magneticVariationYear` is carried as published, including the 60 airports
  the FAA dates 2030 and the one dated 1904.
- The traffic pattern altitude is above the field, as the FAA publishes it; 246
  of the 540 published values lie below the field elevation, which is how an
  MSL reading would be caught.

## Data source

All data is derived from the [FAA National Airspace System Resource (NASR)](https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/) 28-day
subscription, which is public domain. Airport base data comes from APT_BASE.csv,
runway data from APT_RWY.csv and APT_RWY_END.csv, frequencies from FRQ.csv, and
ILS data from ILS_BASE.csv, ILS_GS.csv, and ILS_DME.csv. The build pipeline that
produces this dataset lives in [tools/build-airport-data](https://github.com/neilcochran/squawk/tree/main/tools/build-airport-data).
