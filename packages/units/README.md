<h1><img src="../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/units</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/units)](https://www.npmjs.com/package/@squawk/units) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Aviation-aware unit conversion and formatting utilities. Conversions and formatters for speed, distance, altitude, pressure, temperature, and angle—plus ISA standard atmosphere calculations and compressible-flow aerodynamics.

**[Documentation](https://neilcochran.github.io/squawk/modules/_squawk_units.html)**

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Installation

```bash
npm install @squawk/units
```

## Usage

All exports are organized by domain namespace to keep call sites self-documenting:

```ts
import {
  speed,
  distance,
  altitude,
  pressure,
  temperature,
  angle,
  isa,
  format,
} from '@squawk/units';

// Speed conversions
const kmh = speed.knotsToKilometersPerHour(250);

// Distance conversions
const meters = distance.nauticalMilesToMeters(5);

// Altitude conversions
const feet = altitude.metersToFeet(3000);

// Pressure conversions and QNH/QFE
const hpa = pressure.inchesOfMercuryToHectopascals(29.92);
const qfe = pressure.qnhToQfe(1013.25, 5280); // Denver elevation

// Temperature conversions
const celsius = temperature.fahrenheitToCelsius(59);

// Angle conversions
const radians = angle.degreesToRadians(45);

// ISA standard atmosphere
const isaTemp = isa.isaTemperatureCelsius(35000);
const tas = isa.trueAirspeedFromCalibratedKt(250, 35000); // CAS to TAS at altitude
const da = isa.densityAltitudeFt(5000, 30); // Pressure altitude + OAT

// Formatting with locale support
const altLabel = format.formatAltitude(3500); // "3,500 ft"
const flLabel = format.formatAltitude(35000); // "FL350"
const speedLabel = format.formatSpeed(0.82, 'mach'); // "M0.82"
const tempLabel = format.formatTemperature(15, 'C', {
  showISADeviation: true,
  altitudeFt: 0,
}); // "15°C (+0 ISA)"
```

## Key Features

- **Speed:** Knots, km/h, mph, m/s
- **Distance:** Nautical miles, statute miles, kilometres, metres, feet
- **Altitude:** Feet, metres (with flight-level awareness)
- **Pressure:** inHg, hPa, mmHg; QNH/QFE conversions; pressure altitude
- **Temperature:** Celsius, Fahrenheit, Kelvin
- **Angle:** Degrees, radians
- **ISA Atmosphere:** Temperature and pressure profiles, TAS/CAS/Mach calculations, density altitude
- **Formatting:** Locale-aware number formatting, flight-level conversion, ISA deviation display
