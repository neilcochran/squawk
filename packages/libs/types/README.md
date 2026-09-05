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

## Exported types by domain

| Domain                | Types                                                                                                                                                                                                                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aircraft (ADS-B)      | `Aircraft`, `AircraftCategory`, `EmergencyState`, `TargetStateAndStatus`, `AcasResolutionAdvisoryReport`, `ResolutionAdvisoryType`, `AcasThreat`, `AcasThreatType`, `AcasThreatNone`, `AcasThreatIcaoAddress`, `AcasThreatAltitudeRangeBearing`                                                                       |
| Position              | `Position`, `Coordinates`                                                                                                                                                                                                                                                                                             |
| Airport               | `Airport`, `Runway`, `RunwayEnd`, `IlsSystem`, `AirportFrequency`, `FacilityType`, `OwnershipType`, `FacilityUseType`, `FacilityStatus`, `SurfaceCondition`, `SurfaceTreatment`, `RunwayLighting`, `RunwayMarkingType`, `RunwayMarkingCondition`, `VgsiType`, `IlsCategory`, `IlsSystemType`                          |
| Navaid                | `Navaid`, `NavaidType`, `NavaidStatus`                                                                                                                                                                                                                                                                                |
| Fix                   | `Fix`, `FixUseCode`, `FixCompulsory`, `FixNavaidAssociation`                                                                                                                                                                                                                                                          |
| Airway                | `Airway`, `AirwayWaypoint`, `AirwayType`, `AirwayRegion`, `AirwayWaypointType`                                                                                                                                                                                                                                        |
| Airspace              | `AirspaceFeature`, `AirspaceType`, `ArtccStratum`, `AltitudeBound`, `AltitudeReference`                                                                                                                                                                                                                               |
| Procedure             | `Procedure`, `ProcedureType`, `ApproachType`, `ProcedureLeg`, `ProcedureLegPathTerminator`, `ProcedureLegFixCategory`, `ProcedureTransition`, `ProcedureCommonRoute`, `MissedApproachSequence`, `AltitudeConstraint`, `AltitudeConstraintDescriptor`, `SpeedConstraint`, `SpeedConstraintDescriptor`, `TurnDirection` |
| Aircraft registration | `AircraftRegistration`, `AircraftType`, `EngineType`                                                                                                                                                                                                                                                                  |

The package also re-exports source-code lookup maps (`FACILITY_TYPE_MAP`, `NAVAID_TYPE_MAP`, `AWY_TYPE_MAP`, `ATS_TYPE_MAP`, `AIRWAY_REGION_MAP`, `FIX_USE_CODE_MAP`, `FIX_COMPULSORY_MAP`, `NAVAID_STATUS_MAP`, `ILS_CATEGORY_MAP`, `ILS_SYSTEM_TYPE_MAP`) used by the FAA NASR build pipelines to translate raw source-data values to the typed unions above. See the [TypeDoc reference](https://neilcochran.github.io/squawk/modules/_squawk_types.html) for full per-type signatures and field-level documentation.

## Type guards

For the user-facing string-literal union types - the ones that flow in from URL params, config files, or MCP tool inputs - the package ships an `is<Name>` predicate paired with a `<NAME>S` const array as the single source of truth. Use the predicate to narrow an external string into the union without hand-rolling the membership list per consumer; use the const array as the value-side iteration target (e.g. building a lookup table keyed by the union):

```ts
import {
  AIRSPACE_TYPES,
  ARTCC_STRATA,
  FACILITY_TYPES,
  AIRWAY_TYPES,
  NAVAID_TYPES,
  FIX_USE_CODES,
  isAirspaceType,
  isArtccStratum,
  isFacilityType,
  isAirwayType,
  isNavaidType,
  isFixUseCode,
} from '@squawk/types';

const raw = new URLSearchParams(window.location.search).get('type') ?? '';
if (isAirspaceType(raw)) {
  // raw is now narrowed to AirspaceType
}
```

The arrays are branded with `as const satisfies readonly <Type>[]`, so adding a new union member without updating the array fails the build.
