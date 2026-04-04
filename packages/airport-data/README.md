# @squawk/airport-data

Pre-processed snapshot of US airport data derived from the FAA NASR 28-day
subscription cycle. Data only - no query logic, no dependency on
`@squawk/airports`.

**[Documentation](https://neilcochran.github.io/squawk/modules/_squawk_airport-data.html)**

## Coverage

- All open US aviation facilities: airports, heliports, seaplane bases, gliderports, ultralight, and balloonports
- Runway dimensions, surface, condition, lighting, and weight limits
- Per-runway-end details: heading, displaced thresholds, declared distances (TORA/TODA/ASDA/LDA), approach lighting, VGSI, LAHSO
- Structured ILS data: system type, identifier, category, localizer frequency and course, glide slope angle and type, DME channel
- Communication frequencies with usage and sectorization

## Installation

```bash
npm install @squawk/airport-data
```

## Usage

```typescript
import { usBundledAirports } from '@squawk/airport-data';

// Inspect metadata
console.log(usBundledAirports.properties.nasrCycleDate); // "2026-01-22"
console.log(usBundledAirports.properties.recordCount); // 19146

// Use with @squawk/airports for zero-config airport queries
import { createAirportResolver } from '@squawk/airports';

const resolver = createAirportResolver({ data: usBundledAirports.records });
```

Consumers who have their own data pipeline can use `@squawk/airports` alone and
pass any compatible Airport array at initialization.

## Data format

Each record is a full `Airport` object from `@squawk/types`. Key fields:

| Property                   | Type                | Description                                        |
| -------------------------- | ------------------- | -------------------------------------------------- |
| `faaId`                    | string              | FAA location identifier (e.g. "JFK", "LAX", "3N6") |
| `icao`                     | string or undefined | ICAO code when assigned (e.g. "KJFK")              |
| `name`                     | string              | Official facility name                             |
| `facilityType`             | FacilityType        | AIRPORT, HELIPORT, SEAPLANE_BASE, etc.             |
| `ownershipType`            | OwnershipType       | PUBLIC or PRIVATE                                  |
| `useType`                  | FacilityUseType     | PUBLIC or PRIVATE                                  |
| `status`                   | FacilityStatus      | Always OPEN (closed facilities are excluded)       |
| `city`, `state`, `country` | string              | Location identifiers                               |
| `lat`, `lon`               | number              | Decimal degrees                                    |
| `elevationFt`              | number or undefined | Field elevation in feet MSL                        |
| `magneticVariation`        | number or undefined | Magnetic variation in degrees                      |
| `towerType`                | string or undefined | e.g. "ATCT", "NON-ATCT"                            |
| `fuelTypes`                | string or undefined | e.g. "100LL,A"                                     |
| `runways`                  | Runway[]            | Runway details (see below)                         |
| `frequencies`              | AirportFrequency[]  | Communication frequencies (see below)              |

### Runway

| Property      | Type                | Description                          |
| ------------- | ------------------- | ------------------------------------ |
| `id`          | string              | Designator (e.g. "04L/22R")          |
| `lengthFt`    | number or undefined | Length in feet                       |
| `widthFt`     | number or undefined | Width in feet                        |
| `surfaceType` | string or undefined | e.g. "CONC", "ASPH", "TURF"          |
| `condition`   | SurfaceCondition    | EXCELLENT, GOOD, FAIR, POOR, FAILED  |
| `lighting`    | RunwayLighting      | HIGH, MEDIUM, LOW, NONSTANDARD, NONE |
| `ends`        | RunwayEnd[]         | Per-end details (typically two)      |

### RunwayEnd

| Property                              | Type                   | Description                          |
| ------------------------------------- | ---------------------- | ------------------------------------ |
| `id`                                  | string                 | Designator (e.g. "04L", "22R")       |
| `trueHeading`                         | number or undefined    | True heading in degrees              |
| `ils`                                 | IlsSystem or undefined | Structured ILS data (see below)      |
| `toraFt`, `todaFt`, `asdaFt`, `ldaFt` | number or undefined    | Declared distances in feet           |
| `displacedThresholdFt`                | number or undefined    | Displaced threshold distance in feet |
| `vgsiType`                            | VgsiType               | e.g. PAPI-4L, VASI-2L                |
| `approachLights`                      | string or undefined    | Approach lighting system code        |

### IlsSystem

| Property                | Type                     | Description                                                          |
| ----------------------- | ------------------------ | -------------------------------------------------------------------- |
| `systemType`            | IlsSystemType            | ILS, ILS/DME, LOCALIZER, LOC/DME, LOC/GS, LDA, LDA/DME, SDF, SDF/DME |
| `identifier`            | string or undefined      | Facility identifier (e.g. "I-JFK")                                   |
| `category`              | IlsCategory or undefined | Approach category (I, II, III, IIIA, IIIB, IIIC)                     |
| `localizerFrequencyMhz` | number or undefined      | Localizer frequency in MHz (108-112)                                 |
| `localizerCourseDeg`    | number or undefined      | Front course bearing in magnetic degrees                             |
| `glideSlopeAngleDeg`    | number or undefined      | Glide slope angle in degrees (typically ~3.0)                        |
| `glideSlopeType`        | string or undefined      | Glide slope class (GLIDE SLOPE, GLIDE SLOPE/DME)                     |
| `dmeChannel`            | string or undefined      | DME channel (e.g. "032X", "046X")                                    |

### AirportFrequency

| Property        | Type                | Description                             |
| --------------- | ------------------- | --------------------------------------- |
| `frequencyMhz`  | number              | Frequency in MHz (e.g. 119.1)           |
| `use`           | string              | Purpose (e.g. "LCL/P", "GND/P", "ATIS") |
| `sectorization` | string or undefined | Applicability (e.g. "RWY 04L/22R")      |

## Data source

All data is derived from the FAA National Airspace System Resource (NASR) 28-day
subscription, which is public domain. Airport base data comes from APT_BASE.csv,
runway data from APT_RWY.csv and APT_RWY_END.csv, frequencies from FRQ.csv, and
ILS data from ILS_BASE.csv, ILS_GS.csv, and ILS_DME.csv. The build pipeline that
produces this dataset lives in `scripts/build-airport-data/`.
