<h1><img src="../../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/notams</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/notams)](https://www.npmjs.com/package/@squawk/notams) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Pure parsing library for ICAO-format NOTAM (Notice to Air Missions) strings.
Parses raw NOTAMs into fully typed, structured objects. Contains no network
calls or data fetching - consumers provide raw NOTAM strings however they
obtain them (FAA NOTAM API, ICAO API, local feed, file dump) and the package
returns structured results.

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Usage

```typescript
import { parseNotam } from '@squawk/notams';

const notam = parseNotam(
  'A1242/24 NOTAMN\n' +
    'Q) EGLL/QMRLC/IV/NBO/A/000/999/5129N00028W005\n' +
    'A) EGLL\n' +
    'B) 2404201400\n' +
    'C) 2404202200\n' +
    'E) RWY 09L/27R CLSD DUE TO RESURFACING CONSTRUCTION\n' +
    'F) SFC\n' +
    'G) UNL',
);

console.log(notam.id); // "A1242/24"
console.log(notam.action); // "NEW"
console.log(notam.qualifier?.fir); // "EGLL"
console.log(notam.qualifier?.subjectCode); // "MR"
console.log(notam.qualifier?.conditionCode); // "LC"
console.log(notam.locationCodes); // ["EGLL"]
console.log(notam.text); // "RWY 09L/27R CLSD DUE TO RESURFACING CONSTRUCTION"
console.log(notam.effectiveFrom); // { year: 24, month: 4, day: 20, hour: 14, minute: 0 }
console.log(notam.lowerLimit); // "SFC"
console.log(notam.upperLimit); // "UNL"
```

## API

### `parseNotam(raw)`

Parses a raw ICAO-format NOTAM string into a structured `Notam` object. Handles
NOTAMN (new), NOTAMR (replacement), and NOTAMC (cancellation) action types.
Parses the Q-line qualifier and items A through G:

- **Q-line** - FIR, NOTAM code (subject + condition), traffic type, purpose,
  scope, altitude limits, center coordinates and radius
- **Item A** - Affected location ICAO code
- **Item B** - Start of effective period (YYMMDDHHmm UTC)
- **Item C** - End of effective period, PERM (permanent), or EST (estimated)
- **Item D** - Schedule for intermittent activity (e.g. "MON-FRI 0700-1600")
- **Item E** - Free-text description of the condition or hazard
- **Item F** - Lower altitude limit (e.g. "SFC", "FL050")
- **Item G** - Upper altitude limit (e.g. "UNL", "FL180")

Accepts both multi-line and single-line NOTAM input. Gracefully handles
NOTAMs without a Q-line when items A through E are present.

## Types

This package exports all NOTAM-related type definitions directly. Import types from `@squawk/notams` rather than `@squawk/types`:

```typescript
import type { Notam, NotamQualifier, FaaNotam, FaaNotamKeyword } from '@squawk/notams';
```
