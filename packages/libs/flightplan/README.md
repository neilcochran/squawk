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

const route = resolver.parse('KJFK DCT MERIT J60 MARTN DCT KLAX');
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

The `/browser` entry is identical to the main entry; the separate subpath exists so browser support is an explicit, `publint`-verified part of the public API surface.

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

| Type            | Description                               | Key fields                                                  |
| --------------- | ----------------------------------------- | ----------------------------------------------------------- |
| `airport`       | Resolved airport (ICAO or FAA ID)         | `airport`                                                   |
| `sid`           | Standard Instrument Departure             | `procedure`, `legs`                                         |
| `star`          | Standard Terminal Arrival Route           | `procedure`, `legs`                                         |
| `airway`        | Airway segment between entry and exit fix | `airway`, `entryFix`, `exitFix`, `waypoints`                |
| `direct`        | DCT (direct) indicator                    | -                                                           |
| `waypoint`      | Resolved fix or navaid                    | `fix` and/or `navaid`, `lat`, `lon`                         |
| `coordinate`    | Lat/lon specified in the route string     | `lat`, `lon`                                                |
| `speedAltitude` | Speed/altitude group (e.g. N0450F350)     | `speedKt`/`speedKmPerHr`/`mach`, `flightLevel`/`altitudeFt` |
| `unresolved`    | Token that could not be resolved          | -                                                           |

### Coordinate formats

- `DDMMN/DDDMMEW` (e.g. `4030N07045W` for 40 deg 30 min N, 70 deg 45 min W)
- `DDN/DDDEW` (e.g. `40N070W` for 40 deg N, 70 deg W)

### Speed/altitude formats

- `N0450F350` - 450 knots at FL350
- `K0830F350` - 830 km/h at FL350
- `M082F350` - Mach 0.82 at FL350
- `N0250A065` - 250 knots at 6500 ft

### Airway handling

When a token matches an airway designation and both a previous waypoint
and a next token (exit fix) are available, the resolver expands the airway
between those fixes. The exit fix token is consumed as part of the airway
element. If expansion fails, the airway token falls through to other
resolution strategies.

### Identifier ambiguity

When a token could match multiple entity types (e.g. a 3-letter code matching
both an airport and a navaid), the resolver uses this priority order:

1. Airway (if previous waypoint context exists and next token available)
2. Airport (ICAO or FAA ID)
3. Procedure (SID/STAR)
4. Fix
5. Navaid

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
segments use FAA-published per-segment distances when available, falling back
to great-circle computation.

```typescript
import { computeRouteDistance } from '@squawk/flightplan';

const route = resolver.parse('KJFK DCT MERIT J60 MARTN DCT KLAX');
const result = computeRouteDistance(route, 450);
console.log(result.totalDistanceNm, result.estimatedTimeEnrouteHrs);
```

**Parameters:**

- `route` - a `ParsedRoute` from `resolver.parse`
- `groundSpeedKt` - optional ground speed in knots; omit to skip ETE

**Returns:** `RouteDistanceResult` with:

- `legs` - ordered `RouteLeg` values, each with `from`/`to` point labels, their `fromLat`/`fromLon`/`toLat`/`toLon` coordinates in decimal degrees, `distanceNm`, and `cumulativeDistanceNm`
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

const route = resolver.parse('KJFK DCT MERIT J60 MARTN DCT KLAX');
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

const route = resolver.parse('KJFK DCT MERIT J60 MARTN DCT KLAX');
const line = routeToLineString(route);
if (line) {
  map.addSource('route', { type: 'geojson', data: line });
}
```
