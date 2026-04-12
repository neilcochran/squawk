# @squawk/flightplan

Pure logic library for parsing flight plan route strings into structured,
coordinate-resolved route elements. Composes airport, navaid, fix, airway,
and procedure resolvers to classify and resolve each token in a route string.
Contains no bundled data - accepts resolver instances at initialization. For
zero-config use, pair with the companion data and resolver packages.

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

## API

### `createFlightplanResolver(options)`

Creates a resolver from optional lookup providers.

**Parameters:**

- `options.airports` - airport lookup (must provide `byFaaId` and `byIcao`)
- `options.navaids` - navaid lookup (must provide `byIdent`)
- `options.fixes` - fix lookup (must provide `byIdent`)
- `options.airways` - airway lookup (must provide `byDesignation` and `expand`)
- `options.procedures` - procedure lookup (must provide `byName` and `expand`)

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
| `sid`           | Standard Instrument Departure             | `procedure`, `waypoints`                                    |
| `star`          | Standard Terminal Arrival Route           | `procedure`, `waypoints`                                    |
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
