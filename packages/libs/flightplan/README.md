<h1><img src="../../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/flightplan</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/flightplan)](https://www.npmjs.com/package/@squawk/flightplan) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Pure logic library for parsing flight plan route strings into structured,
coordinate-resolved route elements. Composes airport, navaid, fix, airway,
and procedure resolvers to classify and resolve each token in a route string.
Contains no bundled data - accepts resolver instances at initialization. For
zero-config use, pair with the companion data and resolver packages.

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Usage

```typescript
import { createFlightplanResolver } from '@squawk/flightplan';
import { createAirportResolver } from '@squawk/airports';
import { createNavaidResolver } from '@squawk/navaids';
import { createFixResolver } from '@squawk/fixes';
import { createAirwayResolver } from '@squawk/airways';
import { createProcedureResolver } from '@squawk/procedures';
import { usBundledAirports } from '@squawk/airport-data';
import { usBundledNavaids } from '@squawk/navaid-data';
import { usBundledFixes } from '@squawk/fix-data';
import { usBundledAirways } from '@squawk/airway-data';
import { usBundledProcedures } from '@squawk/procedure-data';

const resolver = createFlightplanResolver({
  airports: createAirportResolver({ data: usBundledAirports.records }),
  navaids: createNavaidResolver({ data: usBundledNavaids.records }),
  fixes: createFixResolver({ data: usBundledFixes.records }),
  airways: createAirwayResolver({ data: usBundledAirways.records }),
  procedures: createProcedureResolver({ data: usBundledProcedures.records }),
});

const route = resolver.parse('KSEA DCT SEA J70 GEP DCT KJFK');
for (const element of route.elements) {
  console.log(element.type, element.raw);
}
```

All resolver providers are optional. Tokens that require a missing provider
are marked as `unresolved`:

```typescript
import { createFlightplanResolver } from '@squawk/flightplan';

// Works with only the resolvers you have
const resolver = createFlightplanResolver({ airports: myAirportResolver });
const route = resolver.parse('KJFK DCT KLAX');
```

## Browser / SPA usage

The resolver factory has no Node-specific imports and ships an explicit `/browser` subpath for SPAs and edge runtimes. Pair it with the `/browser` entries of the resolvers you want to compose:

```typescript
import { loadUsBundledAirports } from '@squawk/airport-data/browser';
import { loadUsBundledNavaids } from '@squawk/navaid-data/browser';
import { loadUsBundledFixes } from '@squawk/fix-data/browser';
import { loadUsBundledAirways } from '@squawk/airway-data/browser';
import { loadUsBundledProcedures } from '@squawk/procedure-data/browser';
import { createAirportResolver } from '@squawk/airports/browser';
import { createNavaidResolver } from '@squawk/navaids/browser';
import { createFixResolver } from '@squawk/fixes/browser';
import { createAirwayResolver } from '@squawk/airways/browser';
import { createProcedureResolver } from '@squawk/procedures/browser';
import { createFlightplanResolver } from '@squawk/flightplan/browser';

const [airports, navaids, fixes, airways, procedures] = await Promise.all([
  loadUsBundledAirports(),
  loadUsBundledNavaids(),
  loadUsBundledFixes(),
  loadUsBundledAirways(),
  loadUsBundledProcedures(),
]);

const resolver = createFlightplanResolver({
  airports: createAirportResolver({ data: airports.records }),
  navaids: createNavaidResolver({ data: navaids.records }),
  fixes: createFixResolver({ data: fixes.records }),
  airways: createAirwayResolver({ data: airways.records }),
  procedures: createProcedureResolver({ data: procedures.records }),
});
```

The `/browser` entry is identical to the main entry.

## API

### `createFlightplanResolver(options)`

Creates a resolver from optional lookup providers.

**Parameters:**

- `options.airports` - airport lookup (must provide `byFaaId` and `byIcao`)
- `options.navaids` - navaid lookup (must provide `byIdent`; may also provide `byIdentAtPosition` for proximity disambiguation)
- `options.fixes` - fix lookup (must provide `byIdent`; may also provide `byIdentAtPosition` for proximity disambiguation)
- `options.airways` - airway lookup (must provide `byDesignation` and `expand`)
- `options.procedures` - procedure lookup (must provide `byIdentifier` and `expand`)

**Returns:** `FlightplanResolver` - an object with the `parse` method described below.

### `resolver.parse(routeString)`

Parses a flight plan route string into an ordered sequence of resolved
elements. Each whitespace-separated token is classified and resolved against
the configured lookup providers.

**Returns:** `ParsedRoute` with:

- `raw` - the original route string
- `elements` - ordered array of `RouteElement` values

### Route element types

Each element has a `type` discriminant and a `raw` field with the original token.

| Type            | Description                               | Key fields                                                                   |
| --------------- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| `airport`       | Resolved airport (ICAO or FAA ID)         | `airport`                                                                    |
| `sid`           | Standard Instrument Departure             | `procedure`, `legs`, `transition`, `airportMismatch`                         |
| `star`          | Standard Terminal Arrival Route           | `procedure`, `legs`, `transition`, `airportMismatch`                         |
| `airway`        | Airway segment between entry and exit fix | `airway`, `entryFix`, `exitFix`, `waypoints`, `gaps`, `unusable`, `reversed` |
| `direct`        | DCT (direct) indicator                    | -                                                                            |
| `waypoint`      | Resolved fix or navaid                    | `fix` and/or `navaid`, `lat`, `lon`                                          |
| `coordinate`    | Lat/lon specified in the route string     | `lat`, `lon`                                                                 |
| `speedAltitude` | Speed/altitude group (e.g. N0450F350)     | `speedKt`/`speedKmPerHr`/`mach`, `flightLevel`/`altitudeFt`, `fromPoint`     |
| `unresolved`    | Token that could not be resolved          | -                                                                            |

An airway element's `gaps` lists any published discontinuity its expansion
crosses (the FAA discontinues some airways partway, such as J60 between JOT and
DJB). The waypoints on both sides are still returned so the route can be drawn
and measured, but a non-empty `gaps` means the route files the airway where it
is not defined and is not valid as filed. Its `unusable` lists, in the same
shape, any segment the FAA marks unusable (J34 between DRYER and GAABE, for
example): the segment is still published with its distance but may not be
flown, so a route across it is not valid as filed either. Its `reversed` is
true when the route flies the airway against its published waypoint order. Each
waypoint's segment fields (`distanceToNextNm`, the MEAs, the course) describe
the segment to the next waypoint in published order, so in a reversed element
they describe the segment between the waypoint and the one before it.

### Coordinate formats

- `DDMMN/DDDMMEW` (e.g. `4030N07045W` for 40 deg 30 min N, 70 deg 45 min W)
- `DDN/DDDEW` (e.g. `40N070W` for 40 deg N, 70 deg W)

### Speed/altitude formats

- `N0450F350` - 450 knots at FL350
- `K0830F350` - 830 km/h at FL350
- `M082F350` - Mach 0.82 at FL350
- `N0250A065` - 250 knots at 6500 ft

A group can stand alone, as the initial cruise speed and level at the start of
an ICAO route, or be attached to a route point with a slash to change speed or
level from that point on (`ENE/N0450F370`). An attached group is split off: the
point resolves as it would on its own, including as the fix where an airway is
joined or left, and the group follows the element that resolved it (the airway
element, when the point is the airway's exit fix). The group element's `raw` is
the group alone and its `fromPoint` names the point; a standalone group has no
`fromPoint`. A slash token whose suffix is not a speed/altitude group is left
unresolved as written.

### Airway handling

When a token matches an airway designation and both a previous waypoint
and a next token (exit fix) are available, the resolver expands the airway
between those fixes. The exit fix token is consumed as part of the airway
element. If expansion fails, the airway token is marked `unresolved` and the
exit fix token is parsed on its own.

An airway lookup supplied in place of `@squawk/airways` may leave out
`reversed`. The route is still expanded, and the legs of that airway are
measured as great circles instead of with the published segment distances.

### What the resolver does not check

Parsing, distance and timing describe the route as filed and do not apply
altitudes or constraints. `checkRouteAltitudes` (below) compares a cruise
altitude with the airway MEAs, MOCAs, MAAs, minimum crossing altitudes and
minimum reception altitudes, and with the cruising altitudes for the direction
of flight; beyond that:

- Procedure legs keep their altitude and speed constraints, path terminators,
  holds and arc data as published. Distance and geometry use only the legs that
  end at a fix, joined by straight lines.
- Signal gaps and the US-airspace-only flag are returned as published and do
  not affect the route. Changeover points are used only to pick the VOR a leg
  is navigated by when checking flight below the MEA.

### Procedure handling

A token that names a SID or STAR is expanded through the procedure provider.
The dotted `PROCEDURE.TRANSITION` form (`DEEZZ6.CANDR`) merges the named
transition into the expansion. Without a dotted transition, the resolver looks
at the adjacent fix - the token after a SID, or the waypoint before a STAR -
and merges that transition when the procedure publishes one by that name,
which is how routes are usually filed (`KJFK DEEZZ6 CANDR`). Otherwise the
common route alone is expanded. The `sid` or `star` element records the merged
transition in `transition`.

Many procedure identifiers are published as a separate adaptation at each of
several airports, and the adaptations' legs differ (PANGG7 has seven common
legs at 05C and five at KMDW). A SID is matched to the route's departure
airport, the last airport before it, and a STAR to the arrival airport, the
first airport after it. When no adaptation serves that airport the first one
published is expanded, so the route still draws, and the element carries the
airport in `airportMismatch`: the route files the procedure at an airport it
does not serve, so it is not valid as filed. A STAR with no airport after it,
or a SID with none before it, is expanded from the first adaptation without a
flag.

A procedure that cannot be expanded is marked `unresolved`: either the dotted
transition is not one of its transitions, or the procedure has no common route
(some SIDs and STARs are published as transitions only) and no adjacent fix
names one of its transitions.

### Identifier ambiguity

When a token could match multiple entity types (e.g. a 3-letter code matching
both an airport and a navaid), the resolver uses this priority order:

1. Airway (if previous waypoint context exists and next token available)
2. Navaid, when the token is an airport's FAA ID, names a navaid, and is
   directly followed by an airway that lists it as a waypoint
3. Airport (ICAO or FAA ID)
4. Procedure (SID/STAR)
5. Fix
6. Navaid

Rule 2 covers the hundreds of airports that share their FAA ID with a navaid,
sometimes miles apart: ahead of an airway, `SAT` in `SAT Q24 LSU` is the SAT
VORTAC the airway is joined at, 6.6 nm from San Antonio's airport. Anywhere
else the token is the airport, and an ICAO code (`KSAT`) always names the
airport.

The same fix or navaid identifier is sometimes published in more than one
region. When the `fixes` or `navaids` provider exposes `byIdentAtPosition`, the
resolver disambiguates such a token by proximity to the most recently resolved
positional element (a preceding airport, coordinate, waypoint, airway exit fix,
or procedure terminus). The first token in a route has no such anchor, and a
provider that exposes only `byIdent` cannot disambiguate; both cases fall back
to the first `byIdent` match.

### `computeRouteDistance(route, groundSpeedKt?)`

Computes the total great-circle route distance and optional estimated time
enroute from a parsed route. Walks the same ordered point sequence as the
geometry helpers below, so distance and geometry stay in agreement. Airway
segments use the FAA-published per-segment distance where the data carries a
positive one, in either direction of travel, falling back to great-circle
computation otherwise.

```typescript
import { computeRouteDistance } from '@squawk/flightplan';

const route = resolver.parse('KSEA DCT SEA J70 GEP DCT KJFK');
const result = computeRouteDistance(route, 450);
console.log(result.totalDistanceNm, result.estimatedTimeEnrouteHrs);
```

**Parameters:**

- `route` - a `ParsedRoute` from `resolver.parse`
- `groundSpeedKt` - optional ground speed in knots; omit to skip ETE

**Returns:** `RouteDistanceResult` with:

- `legs` - ordered `RouteLeg` values, each with `from`/`to` point labels, their `fromLat`/`fromLon`/`toLat`/`toLon` coordinates in decimal degrees, `distanceNm`, `cumulativeDistanceNm`, `crossesGap`, which is true when the leg spans a published gap in the airway it came from (the leg is a straight line that counts toward the total but is not a flyable airway segment), `unusable`, which is true when the leg is an airway segment the FAA marks unusable (counted toward the total but not to be flown), and `procedureAirportMismatch`, which is true when the leg runs along a SID or STAR filed at an airport it does not serve (the element's `airportMismatch`), or joins the route to that airport: the leg in from the departure airport for a SID, the leg out to the arrival airport for a STAR
- `totalDistanceNm` - total great-circle distance in nautical miles
- `estimatedTimeEnrouteHrs` - ETE in hours, or `undefined` when no ground speed was given
- `unresolvedElements` - route elements that could not contribute coordinates

### `computeRouteTiming(route, options)`

Layers per-leg, wind-corrected timing over the same legs as
`computeRouteDistance`. For each leg it derives the initial great-circle true
course, samples the wind at the leg midpoint, and solves the wind triangle for
true heading, wind correction angle, and ground speed. Estimated time enroute
follows from leg distance and ground speed, and fuel burn follows from the same
ground speed.

Winds are supplied through an optional `windProvider` callback, keeping this
function independent of any weather source. The provider takes only a position;
bake the sampling altitude into the closure. A `@squawk/weather` winds-aloft
forecast read at a chosen cruise altitude is one way to satisfy it. When the
provider is omitted, or returns `undefined` for a leg (no data, or light and
variable), that leg is timed as calm: ground speed equals true airspeed and the
wind correction angle is zero.

```typescript
import { computeRouteTiming } from '@squawk/flightplan';

const route = resolver.parse('KSEA DCT SEA J70 GEP DCT KJFK');
const result = computeRouteTiming(route, {
  trueAirspeedKt: 450,
  windProvider: (lat, lon) => ({ directionDeg: 270, speedKt: 80 }),
  fuelBurnPerHr: 600,
  fuelAvailable: 2400,
});
console.log(result.totalEteHrs, result.totalFuelRequired, result.fuelSufficient);
```

**Parameters:**

- `route` - a `ParsedRoute` from `resolver.parse`
- `options.trueAirspeedKt` - true airspeed in knots flown on every leg
- `options.windProvider` - optional `(lat, lon) => WindVector | undefined` callback sampling the wind at each leg midpoint
- `options.fuelBurnPerHr` - optional fuel burn rate per hour (any consistent unit); enables per-leg and total fuel
- `options.fuelAvailable` - optional fuel on board (same unit as `fuelBurnPerHr`); with the burn rate, enables endurance and sufficiency

**Returns:** `RouteTimingResult` with:

- `legs` - ordered `RouteTimingLeg` values, each carrying the distance fields above plus `trueCourseDeg`, `trueHeadingDeg`, `windCorrectionAngleDeg`, `groundSpeedKt`, the applied `wind` (or `undefined` when calm), `eteHrs`, `cumulativeEteHrs`, and `fuelRequired`
- `totalDistanceNm` - total great-circle distance in nautical miles
- `totalEteHrs` - total estimated time enroute in hours, or `undefined` if any leg could not be timed
- `totalFuelRequired` - total fuel across all legs, or `undefined` without a burn rate or when any leg could not be timed
- `enduranceHrs` - endurance in hours from `fuelAvailable` and `fuelBurnPerHr`, or `undefined`
- `fuelSufficient` - whether endurance covers the total ETE, or `undefined`
- `unresolvedElements` - route elements that could not contribute coordinates

Ground speed comes from the wind triangle as a magnitude, so a leg is left
untimed (`eteHrs` is `undefined`) only when ground speed is not positive, which
occurs where a pure headwind equals true airspeed. A headwind exceeding true
airspeed still yields a positive magnitude and is not separately flagged.

### `checkRouteAltitudes(route, options)`

Checks the altitude flown on each airway leg against the published minimum
enroute altitude (MEA) for the direction flown and the aircraft's navigation
equipment, and against the maximum authorized altitude (MAA), and checks each
airway fix against its minimum crossing altitude (MCA) and minimum reception
altitude (MRA). Each leg also gets an advisory check of whether its altitude
suits the direction of flight. Legs and points line up one-for-one with
`computeRouteDistance` legs and `extractRoutePoints` points.

```typescript
import { checkRouteAltitudes } from '@squawk/flightplan';

const route = resolver.parse('KSEA DCT SEA J70 GEP DCT KJFK');
const result = checkRouteAltitudes(route, { altitudeFt: 35000, equipment: ['gnss'] });
console.log(result.status);
for (const leg of result.legs) {
  console.log(
    leg.from,
    leg.to,
    leg.status,
    leg.findings.map((finding) => finding.message),
  );
}
```

**Parameters:**

- `route` - a `ParsedRoute` from `resolver.parse`
- `options.altitudeFt` - optional cruise altitude in feet. It replaces the route's opening speed/altitude group; a group attached to a later point (`ENE/N0450F370`) still changes the altitude from that point onward. Omit it to use the route's own groups. A flight level counts as hundreds of feet (FL350 is 35000).
- `options.equipment` - the navigation equipment aboard, at least one of `'conventional'`, `'gnss'` and `'dmeDmeIru'`

**Which MEA applies:** the lowest one usable with any of the equipment, for the
direction flown.

- `conventional` uses the conventional MEA.
- `gnss` uses the GNSS MEA where one is published and the conventional MEA
  otherwise, since a GNSS MEA is published only where it is lower. On US Jet
  and Q route segments that publish an MEA but no GNSS MEA, FL180 also applies,
  as the GNSS MEA on high altitude routes is FL180 unless published higher.
- `dmeDmeIru` uses only the DME/DME/IRU MEA.

Where an MEA differs by direction, the published direction closest to the
leg's magnetic course applies. An MCA applies when its direction is within
67.5 degrees of the course leaving the fix (or arriving at the airway's last
fix), or both ways when the two published values are equal. A point is crossed
at the altitude of the leg arriving at it, so a group attached to a point takes
effect after it.

**Below the MEA, down to the MOCA:** a leg below its applicable MEA but at or
above the segment's minimum obstruction clearance altitude (MOCA) passes, with a
`belowMeaAllowance` naming the basis, when either:

- the equipment includes `gnss`, which may use the MOCA anywhere on the segment;
  or
- the equipment includes `conventional` and every point of the leg is within 22
  NM of the VOR it is navigated by: the nearest VOR, VOR/DME, VORTAC or TACAN
  along the airway behind and ahead of the leg (not across a published gap),
  switching at the changeover point the VOR publishes, or midway between them
  otherwise.

This follows 14 CFR 91.177(a)(2)(ii) and FAA Order JO 7110.65 4-5-6a, and the
allowance carries their cautions: communications are not assured below the MEA,
and on a radio or navigation failure the pilot climbs to the MEA. `dmeDmeIru`
alone has no allowance. Below the MOCA a leg fails for any equipment. The 300 ft
margin above the floor of controlled airspace and clearance below the MEA with
radar service are not checked.

**Cruising altitude for the direction of flight:** each leg's `cruisingAltitude`
says whether its altitude is `appropriate` or `inappropriate` under the
east/west rule of 14 CFR 91.179(b), and names the nearest cruising altitudes
when it is not. A magnetic course of 0 to 179 degrees takes odd thousands of
feet (3000, 5000, FL190, FL350) and 180 to 359 degrees even thousands (4000,
6000, FL180, FL360), up to FL410; above that, eastbound flight uses FL450, 490,
530 and so on, and westbound FL430, 470, 510 and so on. RVSM is assumed from
FL290 to FL410. The course is the airway segment's published magnetic course in
the direction flown, or else the leg's initial great-circle course converted to
magnetic with the World Magnetic Model. SID and STAR legs, including the leg
into a SID's first fix and out of a STAR's last fix, are `notDeterminable`,
since the aircraft is climbing or descending there. The check is advisory and
never changes a leg's or the route's `status`: ATC assigns altitudes in
controlled airspace, and some routes publish altitudes against the rule.

**Returns:** `RouteAltitudeCheckResult` with:

- `status` - `pass`, `fail` or `notDeterminable`, the worst across all legs and points; or `noAltitude`, with nothing else, when neither the options nor the route give an altitude
- `legs` - ordered `RouteAltitudeLeg` values, each with `from`/`to`, the `airway` it runs along, `altitudeFt` and its `altitudeSource` (`input`, or the route group's `raw` and `fromPoint`), `status`, `findings`, the applied `minimumEnrouteAltitude` (value, MEA kind, direction, and whether it is published or the GNSS FL180 default), the `maximumAuthorizedAltitudeFt`, the `minimumObstructionClearanceAltitudeFt`, the `belowMeaAllowance` (`basis` of `gnss` or `vorWithin22Nm`, the MOCA as `altitudeFt`, the `vors` navigated by, and `cautions`) when the leg may be flown below its MEA, and the advisory `cruisingAltitude` (`status`, `message`, `magneticCourseDeg`, `courseSource` of `published` or `computed`, and `direction` of `eastbound` or `westbound`)
- `points` - ordered `RouteAltitudePoint` values, each with `label`, `lat`/`lon`, the crossing `altitudeFt`, `status`, `findings`, the applicable `minimumCrossingAltitude`, the `minimumReceptionAltitudeFt` and the point's FAA `remarks`
- `airwayRemarks` - the FAA remarks of each airway flown that publishes any, once per airway

Each finding has a `code`, a `kind` and a `message`. A `fail` finding makes its
leg or point `fail`; otherwise a `notDeterminable` finding makes it
`notDeterminable`; an `info` finding leaves the status as it is.

| Code                     | Kind              | Meaning                                                                                                        |
| ------------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------- |
| `belowMea`               | `fail`            | Below the applicable MEA, with no MOCA the equipment may use                                                   |
| `belowMoca`              | `fail`            | Below the applicable MEA and the MOCA                                                                          |
| `mocaBeyondVorRange`     | `fail`            | Below the MEA and at or above the MOCA, but beyond 22 NM of the VOR navigated by, or with no VOR on the airway |
| `mocaAllowance`          | `info`            | Below the MEA but at or above the MOCA, which the equipment may use (see `belowMeaAllowance`)                  |
| `aboveMaa`               | `fail`            | Above the MAA                                                                                                  |
| `belowMca`               | `fail`            | Point crossed below the MCA for the direction flown                                                            |
| `belowMra`               | `fail` or `info`  | Point crossed below the MRA; `fail` only when the equipment is conventional alone                              |
| `unusableSegment`        | `fail`            | The FAA marks the airway segment unusable                                                                      |
| `acrossGap`              | `fail`            | The leg spans a published gap in its airway                                                                    |
| `mcaNotApplicable`       | `info`            | The point's MCA direction matches neither direction of travel, so it is not used                               |
| `noAltitude`             | `notDeterminable` | No altitude is known for the leg or point                                                                      |
| `noPublishedMea`         | `notDeterminable` | The airway segment publishes no MEA                                                                            |
| `noMeaForEquipment`      | `notDeterminable` | The segment publishes no MEA usable with the equipment                                                         |
| `noPublishedCourse`      | `notDeterminable` | A directional value needs the segment's course, which is not published                                         |
| `airwayDirectionUnknown` | `notDeterminable` | The airway lookup did not report which way the airway is flown                                                 |
| `notOnAirway`            | `notDeterminable` | Direct, coordinate and procedure legs, where no published enroute altitude applies                             |

### `extractRoutePoints(route)`

Extracts the ordered sequence of drawable geographic points from a parsed
route. Expands airway and SID/STAR segments into their constituent fixes and
suppresses consecutive duplicate points (e.g. an airway entry fix that matches
the preceding waypoint). Elements without coordinates (DCT, speed/altitude
groups, unresolved tokens) contribute no points.

**Returns:** `RoutePoint[]`, each with `label`, `lat`, and `lon`.

### `routeToLineString(route)`

Builds a GeoJSON `LineString` from a parsed route, ready to render as a
polyline on a map (e.g. MapLibre, Leaflet). Coordinates follow the GeoJSON
`[lon, lat]` ordering. Returns `undefined` when the route yields fewer than
two drawable points, since a `LineString` requires at least two positions.

```typescript
import { routeToLineString } from '@squawk/flightplan';

const route = resolver.parse('KSEA DCT SEA J70 GEP DCT KJFK');
const line = routeToLineString(route);
if (line) {
  map.addSource('route', { type: 'geojson', data: line });
}
```
