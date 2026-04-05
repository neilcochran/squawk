# @squawk/weather

Pure parsing library for aviation weather strings. Parses raw METAR, SPECI, TAF,
SIGMET, and AIRMET text into fully typed, structured objects. Contains no network
calls or data fetching - consumers provide raw weather strings however they
obtain them (ADDS API, AVWX, local feed, file dump) and the package returns
structured results.

## Usage

```typescript
import { parseMetar } from '@squawk/weather';

const metar = parseMetar(
  'METAR KJFK 041853Z 21010KT 10SM FEW250 18/06 A3012 RMK AO2 SLP203 T01830061',
);

console.log(metar.stationId); // "KJFK"
console.log(metar.wind?.speedKt); // 10
console.log(metar.visibility?.statuteMiles); // 10
console.log(metar.flightCategory); // "VFR"
console.log(metar.remarks?.seaLevelPressureMb); // 1020.3
```

## API

### `parseMetar(raw)`

Parses a raw METAR or SPECI string into a structured `Metar` object. SPECI
observations use the same parser and are distinguished by the `type` field.

### `deriveFlightCategory(visibilityStatuteMiles, isLessThan, sky, isCavok)`

Derives the flight category (VFR, MVFR, IFR, LIFR) from visibility and ceiling
conditions.

## Implementation Status

| Format      | Status  |
| ----------- | ------- |
| METAR/SPECI | Done    |
| TAF         | Planned |
| SIGMET      | Planned |
| AIRMET      | Planned |
