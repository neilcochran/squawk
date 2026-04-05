# @squawk/weather

Pure parsing library for aviation weather strings. Parses raw METAR, SPECI, TAF,
SIGMET, and AIRMET text into fully typed, structured objects. Contains no network
calls or data fetching - consumers provide raw weather strings however they
obtain them (ADDS API, AVWX, local feed, file dump) and the package returns
structured results.

## Usage

### METAR / SPECI

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

### TAF

```typescript
import { parseTaf } from '@squawk/weather';

const taf = parseTaf(
  'TAF KJFK 041730Z 0418/0524 21012KT P6SM FEW250 FM042200 24015G25KT P6SM SCT040 BKN080',
);

console.log(taf.stationId); // "KJFK"
console.log(taf.validFromDay); // 4
console.log(taf.forecast[0].wind?.speedKt); // 12
console.log(taf.forecast[0].visibility?.isMoreThan); // true
console.log(taf.forecast[1].changeType); // "FM"
```

## API

### `parseMetar(raw)`

Parses a raw METAR or SPECI string into a structured `Metar` object. SPECI
observations use the same parser and are distinguished by the `type` field.

### `parseTaf(raw)`

Parses a raw TAF string into a structured `Taf` object. Handles both US (FAA)
and ICAO formats including FM, TEMPO, BECMG, and PROB change groups, wind shear
(WS), turbulence (5-group), icing (6-group), CAVOK, NSW, and cancelled (CNL)
forecasts. Multi-line TAFs are normalized automatically.

### `deriveFlightCategory(visibilityStatuteMiles, isLessThan, sky, isCavok)`

Derives the flight category (VFR, MVFR, IFR, LIFR) from visibility and ceiling
conditions.

## Implementation Status

| Format      | Status  |
| ----------- | ------- |
| METAR/SPECI | Done    |
| TAF         | Done    |
| SIGMET      | Planned |
| AIRMET      | Planned |
