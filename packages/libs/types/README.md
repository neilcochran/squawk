<h1><img src="../../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/types</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/types)](https://www.npmjs.com/package/@squawk/types) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Shared TypeScript type definitions used across multiple `@squawk` packages. Contains types for core domain models that cross the logic/data/build-script boundary: aircraft, position, airports, navaids, fixes, airways, procedures, airspace, and aircraft registration.

Domain-specific types that are produced and consumed by a single package live in that package instead:

- Weather types (METAR, TAF, SIGMET, AIRMET, PIREP) are exported by `@squawk/weather`
- NOTAM types (ICAO and FAA domestic) are exported by `@squawk/notams`

**[Documentation](https://neilcochran.github.io/squawk/modules/_squawk_types.html)**

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Installation

```bash
npm install @squawk/types
```

## Usage

```ts
import type { Aircraft, Position, Airport, Navaid, Fix } from '@squawk/types';
```

All types are re-exported from the package root. See the [documentation](https://neilcochran.github.io/squawk/modules/_squawk_types.html) for the full reference.
