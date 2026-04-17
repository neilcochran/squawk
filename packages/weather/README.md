<h1><img src="../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/weather</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/weather)](https://www.npmjs.com/package/@squawk/weather) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Pure parsing library for aviation weather strings. Parses raw METAR, SPECI, TAF,
SIGMET, AIRMET, and PIREP text into fully typed, structured objects. The core
`@squawk/weather` export contains no network calls - consumers provide raw
weather strings however they obtain them (ADDS API, AVWX, local feed, file
dump) and the package returns structured results.

An opt-in fetch layer is available at `@squawk/weather/fetch` for consumers
who want to pull live data directly from the Aviation Weather Center (AWC)
text API. It uses the Node 22+ global `fetch`; pulling it in is a choice so
the core parsing import graph stays network-free.

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

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
console.log(metar.visibility?.visibilitySm); // 10
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

Use `parseSigmetBulletin` as the primary entry point - it handles both single
SIGMETs and multi-SIGMET bulletins (common in AWC convective SIGMET feeds),
always returning an array.

```typescript
import { parseSigmetBulletin } from '@squawk/weather';

// Works with single SIGMETs or full bulletins from any source
const sigmets = parseSigmetBulletin(rawSigmetText);

for (const sigmet of sigmets) {
  if (sigmet.format === 'NONCONVECTIVE') {
    console.log(sigmet.seriesName); // "NOVEMBER"
    console.log(sigmet.hazards[0].hazardType); // "TURBULENCE"
    console.log(sigmet.hazards[0].altitudeRange); // { baseFt: 35000, topFt: 41000 }
  } else if (sigmet.format === 'CONVECTIVE') {
    console.log(sigmet.region); // "C"
    console.log(sigmet.thunderstormType); // "AREA"
    console.log(sigmet.tops); // { altitudeFt: 45000, isAbove: true }
  } else {
    console.log(sigmet.firCode); // "PAZA"
    console.log(sigmet.phenomena); // "SEV TURB"
  }
}
```

If you know you have a single SIGMET record, `parseSigmet` returns a single
object instead of an array:

```typescript
import { parseSigmet } from '@squawk/weather';

const sigmet = parseSigmet(singleSigmetRecord);
console.log(sigmet.format); // "CONVECTIVE" | "NONCONVECTIVE" | "INTERNATIONAL"
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

### `parseSigmetBulletin(raw)`

Recommended entry point for SIGMET parsing. Handles both single SIGMET records
and multi-SIGMET bulletins (e.g. AWC convective bulletins containing multiple
individually numbered SIGMETs with a shared outlook). Returns a `Sigmet[]`
array. For single records, returns a one-element array.

### `parseSigmet(raw)`

Parses a single SIGMET record into a structured `Sigmet` discriminated union.
Use this when you know the input contains exactly one SIGMET. Auto-detects the
format from content and returns one of three variants:

- `ConvectiveSigmet` - domestic CONUS thunderstorm advisories (area/line/isolated TS, outlook sections, severe weather hazards)
- `NonConvectiveSigmet` - domestic CONUS turbulence, icing, volcanic ash, dust/sandstorm (supports multi-hazard and cancellations)
- `InternationalSigmet` - ICAO format for Alaska, oceanic FIRs, and international airspace (tropical cyclone, volcanic ash, cancellations)

Accepts both raw WMO-wrapped messages and body-only messages.

### `parseAirmet(raw)`

Parses an AIRMET bulletin string into a structured `Airmet` object. Handles
Sierra (IFR, mountain obscuration), Tango (turbulence, strong surface winds,
LLWS), and Zulu (icing, freezing levels) series. Accepts both WMO-wrapped
and body-only bulletins.

### `parsePirep(raw)`

Parses a raw PIREP (Pilot Report) string into a structured `Pirep` object.
Handles both routine (UA) and urgent (UUA) reports with all standard
slash-delimited fields: location (/OV) with station, radial/distance, route,
and lat/lon variants; time (/TM); flight level (/FL); aircraft type (/TP);
sky condition (/SK) with standard and compact notation; weather/visibility (/WX);
temperature (/TA); wind (/WV, magnetic); turbulence (/TB) with intensity ranges,
types, frequencies, and BLO/ABV modifiers; icing (/IC) with intensity ranges and
types; and free-text remarks (/RM).

```typescript
import { parsePirep } from '@squawk/weather';

const pirep = parsePirep(
  'UA /OV OKC063015/TM 1522/FL085/TP C172/SK BKN065-TOP090/TB LGT/IC LGT RIME/RM SMOOTH',
);

console.log(pirep.type); // "UA"
console.log(pirep.altitudeFtMsl); // 8500
console.log(pirep.aircraftType); // "C172"
console.log(pirep.turbulence?.[0]?.intensity); // "LGT"
console.log(pirep.icing?.[0]?.type); // "RIME"
```

### `deriveFlightCategory(visibilityStatuteMiles, isLessThan, sky, isCavok)`

Derives the flight category (VFR, MVFR, IFR, LIFR) from visibility and ceiling
conditions.

## Fetch integration

Import from the `@squawk/weather/fetch` subpath to get fetch+parse helpers
that hit the AWC text API. Each function issues a single HTTP request and
returns parsed results alongside any per-record parse errors and the full
raw body.

```typescript
import {
  fetchMetar,
  fetchTaf,
  fetchPirep,
  fetchSigmets,
  fetchInternationalSigmets,
} from '@squawk/weather/fetch';

const { metars } = await fetchMetar(['KJFK', 'KLAX']);
const { tafs } = await fetchTaf('KJFK');
const { pireps } = await fetchPirep('KDEN');
const { sigmets } = await fetchSigmets();
const { sigmets: international } = await fetchInternationalSigmets();
```

`fetchMetar` and `fetchTaf` accept a single 4-letter ICAO identifier or an
array of them (comma-joined into one request). `fetchPirep` takes a single
4-letter ICAO identifier as the search center; the AWC endpoint rejects
shorter forms (e.g. `DEN`) with a 400. `fetchSigmets` and
`fetchInternationalSigmets` return the full current SIGMET set for their
respective regions and take no ID argument:

- `fetchSigmets` - domestic (CONUS) SIGMETs via `/api/data/airsigmet`.
- `fetchInternationalSigmets` - international / ICAO-format SIGMETs via
  `/api/data/isigmet`. Does not include SIGMETs issued by the US in
  domestic format.

AWC does not currently expose a raw-text AIRMET endpoint; `parseAirmet` is
still available for callers who have AIRMET text from another source.

### Endpoint-specific options

`fetchPirep` accepts additional AWC filter parameters:

```typescript
await fetchPirep('KDEN', {
  distance: 100, // nautical miles from the center station
  age: 6, // hours back
  level: 200, // altitude in hundreds of feet (+/-3000 ft)
  inten: 'mod', // minimum intensity: 'lgt' | 'mod' | 'sev'
});
```

`fetchSigmets` accepts a hazard filter:

```typescript
await fetchSigmets({ hazard: 'turb' }); // 'conv' | 'turb' | 'ice' | 'ifr'
```

### Options

Every fetch function accepts an optional options object:

```typescript
await fetchMetar('KJFK', {
  signal: controller.signal, // AbortController signal for cancellation
  baseUrl: 'https://mirror.test/api', // override the AWC base URL
});
```

### Error handling

- **HTTP non-2xx**: throws `AwcFetchError` with `status`, `statusText`, `body`, and `url`.
- **Network / abort errors**: rethrown as-is.
- **Parse errors on an individual record**: captured in the `parseErrors`
  array in the result, not thrown. Other records in the same response still
  parse successfully.

```typescript
import { fetchMetar, AwcFetchError } from '@squawk/weather/fetch';

try {
  const { metars, parseErrors } = await fetchMetar('KJFK');
  for (const { raw, error } of parseErrors) {
    console.warn('Failed to parse:', raw, error);
  }
} catch (err) {
  if (err instanceof AwcFetchError) {
    console.error(`AWC ${err.status}: ${err.body}`);
  } else {
    throw err;
  }
}
```

## Types

This package exports all weather-related type definitions directly. Import types from `@squawk/weather` rather than `@squawk/types`:

```typescript
import type { Metar, Taf, Sigmet, Airmet, Pirep, FlightCategory } from '@squawk/weather';
```
