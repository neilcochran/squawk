<h1><img src="../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/flight-math</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/flight-math)](https://www.npmjs.com/package/@squawk/flight-math) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Aviation flight computer calculations - the programmatic equivalent of an E6B flight computer. Pure functions for wind triangles, altitude corrections, airspeed conversions, and more.

**[Documentation](https://neilcochran.github.io/squawk/modules/_squawk_flight_math.html)**

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Installation

```bash
npm install @squawk/flight-math
```

## Usage

All exports are organized by domain namespace, following the same pattern as `@squawk/units`:

```ts
import { atmosphere, airspeed, wind } from '@squawk/flight-math';

// Density altitude from field observations
const da = atmosphere.densityAltitude(5000, 29.92, 35); // field elev, altimeter, OAT

// True altitude corrected for non-standard temperature
const ta = atmosphere.trueAltitude(10000, 29.85, -10);

// CAS from TAS (inverse of isa.trueAirspeedFromCalibratedKt in @squawk/units)
const cas = airspeed.calibratedAirspeedFromTrueAirspeed(250, 20000);

// E6B wind triangle: find heading and groundspeed for a desired course
const wt = wind.solveWindTriangle(150, 270, 310, 25); // TAS, course, wind dir, wind speed
// wt.trueHeadingDeg, wt.windCorrectionAngleDeg, wt.groundSpeedKt

// Headwind and crosswind components for a runway
const hw = wind.headwindCrosswind(310, 15, 280); // wind dir, wind speed, runway heading
// hw.headwindKt, hw.crosswindKt

// Absolute crosswind for limit checking
const xw = wind.crosswindComponent(310, 15, 280);

// Reverse wind triangle: find the wind from observed flight data
const w = wind.findWind(135, 150, 275, 270); // GS, TAS, heading, track
// w.directionDeg, w.speedKt
```

## Relationship to @squawk/units

This package complements `@squawk/units`, which provides unit conversions, formatting, and the ISA standard atmosphere model. `@squawk/flight-math` provides higher-level computations that combine multiple inputs (wind triangles, density altitude from field observations, etc.) and uses `@squawk/units` internally.

Functions that already exist in `@squawk/units` are not re-exported. Import them directly:

| Calculation                                | Package                                                               |
| ------------------------------------------ | --------------------------------------------------------------------- |
| Pressure altitude from indicated alt + QNH | `@squawk/units` (`pressure.pressureAltitudeFt`)                       |
| Density altitude from PA + OAT             | `@squawk/units` (`isa.densityAltitudeFt`)                             |
| TAS from CAS                               | `@squawk/units` (`isa.trueAirspeedFromCalibratedKt`)                  |
| Mach from TAS                              | `@squawk/units` (`isa.machFromTrueAirspeedKt`)                        |
| TAS from Mach                              | `@squawk/units` (`isa.trueAirspeedFromMachKt`)                        |
| Density altitude from field observations   | `@squawk/flight-math` (`atmosphere.densityAltitude`)                  |
| True altitude correction                   | `@squawk/flight-math` (`atmosphere.trueAltitude`)                     |
| CAS from TAS                               | `@squawk/flight-math` (`airspeed.calibratedAirspeedFromTrueAirspeed`) |
| Wind triangle / components                 | `@squawk/flight-math` (`wind.*`)                                      |

## Namespaces

- **atmosphere** - Altitude calculations combining multiple field inputs
- **airspeed** - Airspeed conversions not covered by `@squawk/units`
- **wind** - E6B wind triangle, headwind/crosswind components, reverse wind triangle
- **descent** - Top of descent, required descent/climb rate, gradient conversions, VDP
- **navigation** - Holding pattern entry, DME arc lead, 1-in-60 rule
- **turn** - Standard rate bank angle, turn radius, time to turn, load factor
- **glide** - Glide distance with and without wind correction
- **pivotal** - Pivotal altitude for ground reference maneuvers
- **solar** - Sunrise/sunset, civil twilight, day/night determination (NOAA algorithm)
- **magnetic** - Magnetic declination and field components (WMM2025), true/magnetic bearing conversion
