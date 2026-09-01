<h1><img src="../../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/mode-s</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/mode-s)](https://www.npmjs.com/package/@squawk/mode-s) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Decodes raw Mode-S/ADS-B messages: downlink format and CRC extraction, CPR
position, airborne velocity, aircraft identification, altitude (both the
ADS-B position-message field and legacy Gillham-coded surveillance replies),
squawk identity, emergency status, ACAS/TCAS Resolution Advisories, target
state and status, aircraft operational status, and Enhanced Surveillance
Comm-B registers (selected vertical intention, track and turn, heading and
speed). Transport-agnostic - it operates on already-framed message bytes and
has no opinion about where they came from (a live Beast feed, a logged
capture, or any other source). For a Beast binary parser and live TCP client
built on top of this package, see [`@squawk/beast`](../beast).

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Installation

```bash
npm install @squawk/mode-s
```

## Usage

### Decoding a whole message

`decodeModeSMessage` is the main entry point - it reads the downlink format,
validates the CRC, and routes to the right per-type decoder, returning a
single discriminated result.

```typescript
import { decodeModeSMessage } from '@squawk/mode-s';

const decoded = decodeModeSMessage(rawMessageBytes); // 7 or 14 raw bytes
if (decoded?.kind === 'extendedSquitterPosition') {
  console.log(decoded.icaoHex, decoded.latCpr, decoded.lonCpr, decoded.altitudeFt);
}
```

`bytes`' length must match what its downlink format implies (7 bytes for a
short message, 14 for long) or the message is rejected outright - a length
mismatch means the buffer is truncated or corrupted, not a genuine message
of that format.

DF17/18 (extended squitter) messages are only decoded when their CRC checks
out exactly - a corrupted squitter reports as undecodable rather than
returning plausible-looking wrong data. DF18 is further gated on its control
field: CF=0/1/2/5/6 share DF17's type-code-coded ME layout and decode the
same way; CF=3 (TIS-B coarse format) uses a different field layout this
package does not decode, and CF=4/7 carry no per-aircraft state. Every
decoded DF17/18 message carries `messageSource`, so a consumer can tell a
real, direct ICAO address from an anonymous or ground-derived one rather
than losing that distinction after the gate:

```typescript
const decoded = decodeModeSMessage(rawMessageBytes);
if (decoded?.kind === 'extendedSquitterPosition' && decoded.messageSource !== 'icaoDirect') {
  // decoded.icaoHex may not be a registered ICAO address (anonymousDirect/anonymousTisb),
  // or the position may be ground-derived rather than heard directly (icaoTisb/adsr)
}
```

DF0/4/5/20/21 (Mode-S surveillance replies) are targeted responses whose CRC
is XORed with the responding aircraft's ICAO address rather than being a
plain checksum, so their `candidateIcaoHex` needs cross-checking against an
address already known from squitter traffic before it can be trusted - this
package doesn't perform that cross-check itself. DF20/21 (`'commBAltitudeReply'`/`'commBIdentityReply'`)
carry the same altitude/squawk payload as DF4/5 plus a 56-bit MB field,
decoded into `commBRegisters` - see
[Enhanced Surveillance Comm-B registers](#enhanced-surveillance-comm-b-registers).

### Resolving CPR position

Airborne and surface position messages carry raw CPR-encoded lat/lon
fields, not a directly usable position - resolving them needs either a
paired even/odd frame or a nearby reference position, and pairing state
(tracking the most recent even and odd frame per aircraft) is the caller's
responsibility, not this package's:

```typescript
import { decodeAirborneCprPair, decodeAirborneCprWithReference } from '@squawk/mode-s';

// From a paired even + odd frame (global decode, no reference needed)
const position = decodeAirborneCprPair(evenFrame, oddFrame, 'even');

// From a single frame plus a known-nearby reference (e.g. the aircraft's
// last known position, or the receiver's own location for a new aircraft)
const position2 = decodeAirborneCprWithReference('even', frame, referencePosition);
```

`decodeSurfaceCprPair` / `decodeSurfaceCprWithReference` are the equivalents
for on-ground traffic (type codes 5-8), which additionally need a reference
position to resolve the correct hemisphere and longitude quadrant.

An airborne position message with type code 0 signals that no position fix
is currently available - `latCpr`/`lonCpr` are undefined in that case even
though `altitudeFt` may still be populated.

### ACAS / TCAS Resolution Advisories

An active Resolution Advisory reaches `decodeModeSMessage` two ways: DF16
(a targeted air-air surveillance reply, replacing DF0 while an RA is active)
and a DF17/18 type-code-28 subtype-2 message (the same report broadcast over
ADS-B so aircraft without interrogation capability can still see it).

```typescript
const decoded = decodeModeSMessage(rawMessageBytes);
if (decoded?.kind === 'longAirAirSurveillanceReply' && decoded.resolutionAdvisory?.active) {
  console.log(decoded.resolutionAdvisory.advisoryType); // e.g. 'climb', 'crossingDescend', 'increaseClimb'
}
```

`advisoryType` names the RA per RTCA DO-185B Table 2-16 (`climb`, `descend`,
`crossingClimb`, `crossingDescend`, `increaseClimb`, `increaseDescent`,
`reduceClimb`, `reduceDescent`, `doNotClimb`, `doNotDescend`,
`reversalToClimb`, `reversalToDescend`), derived from the report's
corrective/sense/rate/crossing/reversal flags - all of which are also
exposed individually on `AcasResolutionAdvisoryReport`, along with the
Resolution Advisory Complement flags (`doNotPassBelow`/`doNotPassAbove`;
`doNotTurnLeft`/`doNotTurnRight` are decoded for completeness but TCAS II
issues vertical RAs only, so they are expected to always be false). `advisoryType`
is undefined when no RA is currently active, or for the one flag combination
DO-185B leaves undefined (positive + preventive).

`threat` identifies what the RA is responding to, discriminated by
`threat.threatType`:

```typescript
if (decoded.resolutionAdvisory?.threat.threatType === 'icaoAddress') {
  console.log(decoded.resolutionAdvisory.threat.threatIcaoHex);
}
```

`'none'` carries no further fields; `'icaoAddress'` carries `threatIcaoHex`;
`'altitudeRangeBearing'` carries `threatAltitudeFt`/`threatRangeNm`/`threatBearingDeg`
(each independently undefined if that specific field is unavailable).

### Target state and status

A type-code-29 ADS-B message reports what the aircraft's flight management
system is currently targeting - selected altitude, selected heading, and
which autopilot modes are engaged - not the aircraft's actual state:

```typescript
const decoded = decodeModeSMessage(rawMessageBytes);
if (decoded?.kind === 'extendedSquitterTargetStateAndStatus') {
  console.log(
    decoded.targetStateAndStatus.selectedAltitudeFt,
    decoded.targetStateAndStatus.selectedHeadingDeg,
  );
}
```

Each field is independently undefined when its source data isn't available -
`selectedAltitudeSource` further distinguishes an MCP/FCU-selected altitude
from an FMS-selected one. `autopilotEngaged`/`vnavModeActive`/`altitudeHoldModeActive`/`approachModeActive`/`lnavModeActive`
are reported together (all defined or all undefined) since they share a
single status bit; `tcasOperational` has its own independent status.

### Aircraft operational status

A type-code-31 ADS-B message reports the transmitting aircraft's ADS-B
version, surveillance integrity/accuracy figures, and heading reference -
metadata about the quality of the aircraft's other broadcasts rather than
its position or state:

```typescript
const decoded = decodeModeSMessage(rawMessageBytes);
if (decoded?.kind === 'extendedSquitterOperationalStatus') {
  console.log(
    decoded.operationalStatus.adsbVersion,
    decoded.operationalStatus.navAccuracyCategoryPosition,
  );
}
```

`capabilityClassCode`/`operationalModeCode` are exposed as their raw 16-bit
values rather than individually decoded sub-fields. `nicBaro` is only
populated for an airborne report on ADS-B version 1+; `silSupplementPerHour`
is only populated on version 2, where SIL changes from "per sample" to a
choice between per-sample and per-hour.

### Enhanced Surveillance Comm-B registers

DF20/21's 56-bit MB field can carry any of several "Enhanced Surveillance"
Comm-B registers (BDS 4,0 selected vertical intention, BDS 5,0 track and
turn report, BDS 6,0 heading and speed report), but unlike a DF17/18 ME
field's type code, nothing in the message itself declares which one. This
package validates the MB field's bytes against each register's expected
structure (status-bit consistency, reserved bits, physically-plausible
ranges) and returns every register that plausibly matches - usually exactly
one, occasionally none, and occasionally more than one when the bytes are
genuinely ambiguous (BDS 5,0 and 6,0 are the pair most likely to overlap):

```typescript
const decoded = decodeModeSMessage(rawMessageBytes);
if (decoded?.kind === 'commBAltitudeReply') {
  for (const register of decoded.commBRegisters) {
    if (register.bdsCode === '5,0') {
      console.log(register.rollAngleDeg, register.trueTrackDeg, register.groundSpeedKt);
    }
  }
}
```

`inferCommBRegisters(mb)` is also exported directly for callers working with
a raw MB field outside of `decodeModeSMessage`'s DF20/21 dispatch.

### Mode A/C

Mode A/C predates Mode-S and carries no ICAO address, so it has no natural
key in an ICAO-hex-indexed tracking model - it's decoded here, but
deliberately not part of `decodeModeSMessage`'s dispatch:

```typescript
import { decodeModeAc } from '@squawk/mode-s';

const reply = decodeModeAc(twoRawBytes);
console.log(reply.squawk, reply.identActive, reply.altitudeFt);
```

## API

- `decodeModeSMessage(bytes)` - decodes a raw 7 or 14 byte Mode-S message into a discriminated `DecodedModeSMessage`.
- `decodeModeAc(bytes)` - decodes a raw 2-byte Mode A/C reply.
- `parseModeSFrame(bytes)`, `extractDownlinkFormat(bytes)`, `computeCrc24(bytes)` - lower-level envelope parsing, used internally by `decodeModeSMessage`.
- `decodeAirborneCprPair`, `decodeAirborneCprWithReference`, `decodeSurfaceCprPair`, `decodeSurfaceCprWithReference`, `cprNumLongitudeZones` - CPR position resolution.
- `decodeAirborneVelocity(me)` - airborne velocity/heading from a type-19 ME field.
- `decodeIdentification(me)` - callsign and category from a type 1-4 ME field.
- `decodeIdentityCode(idField)` - 4-digit octal squawk from a 13-bit identity field (shared by DF5/21 and ADS-B emergency status).
- `decodeAltitudeCode(altitudeCode)`, `decodeAdsbPositionAltitude(field)`, `decodeAdsbGnssAltitude(field)` - altitude decoding.
- `decodeSurfaceMovement(field)` - ground speed from a surface position message's movement field.
- `decodeEmergencyState(rawState)` - emergency/priority state from an ADS-B aircraft status message.
- `decodeAcasResolutionAdvisory(payload)` - ACAS/TCAS Resolution Advisory report from a DF16 MV field or a type-code-28 subtype-2 ME field.
- `decodeTargetStateAndStatus(me)` - target state and status from a type-29 ME field.
- `decodeAircraftOperationalStatus(me)` - operational status from a type-31 ME field.
- `inferCommBRegisters(mb)` - every Enhanced Surveillance Comm-B register (BDS 4,0/5,0/6,0) a DF20/21 MB field plausibly holds.
- `decodeSelectedVerticalIntention(mb)`, `decodeTrackAndTurnReport(mb)`, `decodeHeadingAndSpeedReport(mb)` - decode a single Comm-B register directly, given its BDS code is already known.

Every decoder that can fail to produce a result returns `undefined` rather
than throwing - a message that doesn't decode cleanly (unsupported type,
failed CRC, reserved value) is an expected outcome, not an exceptional one.
