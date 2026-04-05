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
console.log(metar.observationTime); // { day: 4, hour: 18, minute: 53 }
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
console.log(taf.issuedAt); // { day: 4, hour: 17, minute: 30 }
console.log(taf.validFrom); // { day: 4, hour: 18, minute: 0 }
console.log(taf.forecast[0].wind?.speedKt); // 12
console.log(taf.forecast[1].changeType); // "FM"
console.log(taf.forecast[1].start); // { day: 4, hour: 22, minute: 0 }
```

### SIGMET

```typescript
import { parseSigmet } from '@squawk/weather';

// Non-convective SIGMET
const sigmet = parseSigmet(
  'SIGMET NOVEMBER 3 VALID UNTIL 050200Z\n' +
    'FROM 40NW SLC-60SE BOI-30SW BIL-40NW SLC\n' +
    'SEV TURB BTN FL350 AND FL410. DUE TO JTST. CONDS CONTG BYD 0200Z.',
);
if (sigmet.format === 'NONCONVECTIVE') {
  console.log(sigmet.seriesName); // "NOVEMBER"
  console.log(sigmet.hazards[0].hazardType); // "TURBULENCE"
  console.log(sigmet.hazards[0].altitudeRange); // { baseFt: 35000, topFt: 41000 }
}

// Convective SIGMET
const convective = parseSigmet(
  'CONVECTIVE SIGMET 45C\nVALID UNTIL 042055Z\nKS OK TX\n' +
    'FROM 30NW ICT-40S MCI-20W ADM-50SW ABI-30NW ICT\n' +
    'AREA SEV TS MOV FROM 26025KT. TOPS ABV FL450.',
);
if (convective.format === 'CONVECTIVE') {
  console.log(convective.region); // "C"
  console.log(convective.thunderstormType); // "AREA"
  console.log(convective.tops); // { altitudeFt: 45000, isAbove: true }
}
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

### `parseSigmet(raw)`

Parses a raw SIGMET string into a structured `Sigmet` discriminated union.
Auto-detects the format from content and returns one of three variants:

- `ConvectiveSigmet` - domestic CONUS thunderstorm advisories (area/line/isolated TS, outlook sections, severe weather hazards)
- `NonConvectiveSigmet` - domestic CONUS turbulence, icing, volcanic ash, dust/sandstorm (supports multi-hazard and cancellations)
- `InternationalSigmet` - ICAO format for Alaska, oceanic FIRs, and international airspace (tropical cyclone, cancellations)

Accepts both raw WMO-wrapped messages and body-only messages.

### `deriveFlightCategory(visibilityStatuteMiles, isLessThan, sky, isCavok)`

Derives the flight category (VFR, MVFR, IFR, LIFR) from visibility and ceiling
conditions.

## Implementation Status

| Format      | Status  |
| ----------- | ------- |
| METAR/SPECI | Done    |
| TAF         | Done    |
| SIGMET      | Done    |
| AIRMET      | Planned |
