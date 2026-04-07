# @squawk/types

Shared TypeScript type definitions used across multiple `@squawk` packages. Contains types for core domain models that cross the logic/data/build-script boundary: aircraft, position, airports, navaids, fixes, airways, procedures, airspace, ADS-B sources, and flight-math results.

Domain-specific types that are produced and consumed by a single package live in that package instead:

- Weather types (METAR, TAF, SIGMET, AIRMET, PIREP) are exported by `@squawk/weather`
- NOTAM types (ICAO and FAA domestic) are exported by `@squawk/notams`

**[Documentation](https://neilcochran.github.io/squawk/modules/_squawk_types.html)**

## Installation

```bash
npm install @squawk/types
```

## Usage

```ts
import type { Aircraft, Position, Airport, Navaid, Fix } from '@squawk/types';
```

All types are re-exported from the package root. See the [documentation](https://neilcochran.github.io/squawk/modules/_squawk_types.html) for the full reference.
