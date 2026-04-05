# @squawk/weather

Pure parsing library for aviation weather strings. Parses raw METAR, SPECI, TAF,
SIGMET, and AIRMET text into fully typed, structured objects. Contains no network
calls or data fetching - consumers provide raw weather strings however they
obtain them (ADDS API, AVWX, local feed, file dump) and the package returns
structured results.

## Usage

```typescript
import { parseMetar, deriveFlightCategory } from '@squawk/weather';

// Parse a raw METAR string
const metar = parseMetar(
  'METAR KJFK 041853Z 21010KT 10SM FEW250 18/06 A3012 RMK AO2 SLP203 T01830061',
);

console.log(metar.stationId); // "KJFK"
console.log(metar.type); // "METAR"
console.log(metar.wind?.speedKt); // 10
console.log(metar.wind?.directionDeg); // 210
console.log(metar.visibility?.statuteMiles); // 10
console.log(metar.temperatureC); // 18
console.log(metar.dewpointC); // 6
console.log(metar.altimeter?.inHg); // 30.12
console.log(metar.flightCategory); // "VFR"
console.log(metar.remarks?.seaLevelPressureMb); // 1020.3
console.log(metar.remarks?.preciseTemperatureC); // 18.3
```

SPECI observations use the same parser:

```typescript
const speci = parseMetar(
  'SPECI KORD 041915Z 24018G32KT 2SM +TSRA BKN020CB OVC045 22/20 A2980 RMK AO2 TSB12 PRESRR SLP088 T02220200',
);

console.log(speci.type); // "SPECI"
console.log(speci.wind?.gustKt); // 32
console.log(speci.weather[0]?.raw); // "+TSRA"
console.log(speci.weather[0]?.intensity); // "HEAVY"
console.log(speci.weather[0]?.descriptor); // "TS"
console.log(speci.flightCategory); // "IFR"
```

## API

### `parseMetar(raw)`

Parses a raw METAR or SPECI string into a structured `Metar` object.

**Parameters:**

- `raw` - the raw METAR or SPECI string to parse

**Returns:** `Metar` - a fully parsed weather observation object.

**Throws:** `Error` if the string cannot be parsed as a valid METAR/SPECI.

The returned `Metar` object includes:

| Field                   | Type                  | Description                                         |
| ----------------------- | --------------------- | --------------------------------------------------- |
| `raw`                   | string                | Original raw string                                 |
| `type`                  | `'METAR' \| 'SPECI'`  | Report type                                         |
| `stationId`             | string                | ICAO station identifier                             |
| `dayOfMonth`            | number                | Day of month (UTC)                                  |
| `hour`                  | number                | Hour (UTC)                                          |
| `minute`                | number                | Minute (UTC)                                        |
| `isAutomated`           | boolean               | AUTO station                                        |
| `isCorrected`           | boolean               | Corrected report (COR)                              |
| `isCavok`               | boolean               | Ceiling and visibility OK (ICAO)                    |
| `isNoSignificantChange` | boolean               | NOSIG trend (ICAO)                                  |
| `wind`                  | `Wind`                | Wind direction, speed, gusts, variable range        |
| `visibility`            | `Visibility`          | Prevailing visibility (statute miles or meters)     |
| `rvr`                   | `RunwayVisualRange[]` | Runway Visual Range reports                         |
| `weather`               | `WeatherPhenomenon[]` | Weather phenomena (rain, snow, fog, etc.)           |
| `sky`                   | `SkyCondition`        | Cloud layers, vertical visibility, clear indicators |
| `temperatureC`          | number                | Temperature in whole degrees Celsius                |
| `dewpointC`             | number                | Dewpoint in whole degrees Celsius                   |
| `altimeter`             | `Altimeter`           | Altimeter setting (inHg and/or hPa)                 |
| `remarks`               | `MetarRemarks`        | Parsed remarks section                              |
| `flightCategory`        | `FlightCategory`      | Derived VFR/MVFR/IFR/LIFR                           |

### `deriveFlightCategory(visibilityStatuteMiles, isLessThan, sky, isCavok)`

Derives the flight category from visibility and ceiling conditions.

**Parameters:**

- `visibilityStatuteMiles` - prevailing visibility in statute miles, or undefined
- `isLessThan` - true when visibility is less than the stated value
- `sky` - sky condition with cloud layers and/or vertical visibility
- `isCavok` - true when CAVOK is reported

**Returns:** `FlightCategory` (`'VFR'`, `'MVFR'`, `'IFR'`, or `'LIFR'`), or undefined if insufficient data.

| Category | Ceiling          | Visibility |
| -------- | ---------------- | ---------- |
| VFR      | > 3,000 ft       | > 5 SM     |
| MVFR     | 1,000 - 3,000 ft | 3 - 5 SM   |
| IFR      | 500 - 999 ft     | 1 - < 3 SM |
| LIFR     | < 500 ft         | < 1 SM     |

## Supported Formats

### Currently implemented

- **METAR/SPECI** - Full parsing of US and ICAO format observations including wind, visibility, RVR, weather phenomena, cloud layers, temperature/dewpoint, altimeter, CAVOK, NOSIG, and 20+ structured remark groups.

### Planned

- **TAF** - Terminal aerodrome forecasts with FM/TEMPO/BECMG/PROB groups
- **SIGMET** - Convective and non-convective significant meteorological information
- **AIRMET** - Sierra, Tango, and Zulu airman's meteorological information
