import { describe, it, beforeAll } from 'vitest';
import assert from 'node:assert/strict';
import type { FlightplanResolver } from './resolver.js';
import { createFlightplanResolver } from './resolver.js';
import type { FlightplanAirportLookup } from './resolver.js';
import type { FlightplanNavaidLookup } from './resolver.js';
import type { FlightplanFixLookup } from './resolver.js';
import type { FlightplanAirwayLookup } from './resolver.js';
import type { FlightplanProcedureLookup } from './resolver.js';

let airports: FlightplanAirportLookup;
let navaids: FlightplanNavaidLookup;
let fixes: FlightplanFixLookup;
let airways: FlightplanAirwayLookup;
let procedures: FlightplanProcedureLookup;
let resolver: FlightplanResolver;

beforeAll(async () => {
  const [
    { usBundledAirports },
    { createAirportResolver },
    { usBundledNavaids },
    { createNavaidResolver },
    { usBundledFixes },
    { createFixResolver },
    { usBundledAirways },
    { createAirwayResolver },
    { usBundledProcedures },
    { createProcedureResolver },
  ] = await Promise.all([
    import('@squawk/airport-data'),
    import('@squawk/airports'),
    import('@squawk/navaid-data'),
    import('@squawk/navaids'),
    import('@squawk/fix-data'),
    import('@squawk/fixes'),
    import('@squawk/airway-data'),
    import('@squawk/airways'),
    import('@squawk/procedure-data'),
    import('@squawk/procedures'),
  ]);

  airports = createAirportResolver({ data: usBundledAirports.records });
  navaids = createNavaidResolver({ data: usBundledNavaids.records });
  fixes = createFixResolver({ data: usBundledFixes.records });
  airways = createAirwayResolver({ data: usBundledAirways.records });
  procedures = createProcedureResolver({ data: usBundledProcedures.records });
  resolver = createFlightplanResolver({ airports, navaids, fixes, airways, procedures });
});

describe('parse', () => {
  it('returns empty elements for empty string', () => {
    const result = resolver.parse('');
    assert.equal(result.raw, '');
    assert.equal(result.elements.length, 0);
  });

  it('returns empty elements for whitespace-only string', () => {
    const result = resolver.parse('   ');
    assert.equal(result.raw, '');
    assert.equal(result.elements.length, 0);
  });

  it('preserves the raw route string', () => {
    const result = resolver.parse('KJFK DCT KLAX');
    assert.equal(result.raw, 'KJFK DCT KLAX');
  });

  it('resolves ICAO airport identifiers', () => {
    const result = resolver.parse('KJFK');
    assert.equal(result.elements.length, 1);
    const el = result.elements[0]!;
    assert.equal(el.type, 'airport');
    if (el.type === 'airport') {
      assert.equal(el.airport.icao, 'KJFK');
    }
  });

  it('resolves FAA airport identifiers', () => {
    const result = resolver.parse('JFK');
    assert.equal(result.elements.length, 1);
    const el = result.elements[0]!;
    assert.equal(el.type, 'airport');
    if (el.type === 'airport') {
      assert.equal(el.airport.faaId, 'JFK');
    }
  });

  it('parses DCT as a direct element', () => {
    const result = resolver.parse('DCT');
    assert.equal(result.elements.length, 1);
    assert.equal(result.elements[0]!.type, 'direct');
    assert.equal(result.elements[0]!.raw, 'DCT');
  });

  it('resolves fix waypoints', () => {
    const result = resolver.parse('MERIT');
    assert.equal(result.elements.length, 1);
    const el = result.elements[0]!;
    assert.equal(el.type, 'waypoint');
    if (el.type === 'waypoint') {
      assert.ok(el.fix, 'expected fix to be populated');
      assert.equal(el.fix.identifier, 'MERIT');
      assert.equal(typeof el.lat, 'number');
      assert.equal(typeof el.lon, 'number');
    }
  });

  it('resolves navaid waypoints', () => {
    // BOS is a well-known VOR
    const result = resolver.parse('BOS');
    assert.equal(result.elements.length, 1);
    const el = result.elements[0]!;
    // BOS could match as airport or navaid depending on priority
    // Since airports are checked before navaids, check which matched
    assert.ok(el.type === 'airport' || el.type === 'waypoint', 'expected airport or waypoint');
  });

  it('resolves an airway segment between two fixes', () => {
    // DODGR and PRADO are fixes on V16 (US variant)
    const result = resolver.parse('DODGR V16 PRADO');
    assert.equal(result.elements.length, 2);

    const waypointEl = result.elements[0]!;
    assert.equal(waypointEl.type, 'waypoint');
    assert.equal(waypointEl.raw, 'DODGR');

    const airwayEl = result.elements[1]!;
    assert.equal(airwayEl.type, 'airway');
    if (airwayEl.type === 'airway') {
      assert.equal(airwayEl.airway.designation, 'V16');
      assert.equal(airwayEl.entryFix, 'DODGR');
      assert.equal(airwayEl.exitFix, 'PRADO');
      assert.ok(airwayEl.waypoints.length >= 2, 'expected at least entry and exit waypoints');
    }
  });

  it('marks unresolvable airway tokens as unresolved', () => {
    const result = resolver.parse('MERIT FAKEWAY99 BOSCO');
    // MERIT resolves as fix, FAKEWAY99 is not an airway or anything else, BOSCO resolves
    const fakeEl = result.elements.find((e) => e.raw === 'FAKEWAY99');
    assert.ok(fakeEl, 'expected element for FAKEWAY99');
    assert.equal(fakeEl.type, 'unresolved');
  });

  it('resolves a SID procedure', () => {
    const result = resolver.parse('ACCRA5');
    assert.equal(result.elements.length, 1);
    const el = result.elements[0]!;
    assert.equal(el.type, 'sid');
    if (el.type === 'sid') {
      assert.equal(el.procedure.identifier, 'ACCRA5');
      assert.equal(el.procedure.type, 'SID');
    }
  });

  it('picks the procedure adaptation matching the preceding airport', () => {
    // DALL4 is adapted at KDAL and KDFW (among others). When parsing a
    // route with a specific departure airport, the resolver should pick
    // the adaptation at that airport, not an arbitrary first match.
    const kdalRoute = resolver.parse('KDAL DALL4');
    const kdfwRoute = resolver.parse('KDFW DALL4');
    const kdalSid = kdalRoute.elements.find((e) => e.type === 'sid');
    const kdfwSid = kdfwRoute.elements.find((e) => e.type === 'sid');
    assert.ok(kdalSid && kdalSid.type === 'sid');
    assert.ok(kdfwSid && kdfwSid.type === 'sid');
    assert.ok(
      kdalSid.procedure.airports.some((a) => a.toUpperCase() === 'KDAL'),
      'expected KDAL DALL4 to resolve to the KDAL adaptation',
    );
    assert.ok(
      kdfwSid.procedure.airports.some((a) => a.toUpperCase() === 'KDFW'),
      'expected KDFW DALL4 to resolve to the KDFW adaptation',
    );
  });

  it('resolves a STAR procedure with legs', () => {
    const result = resolver.parse('AALLE4');
    assert.equal(result.elements.length, 1);
    const el = result.elements[0]!;
    assert.equal(el.type, 'star');
    if (el.type === 'star') {
      assert.equal(el.procedure.identifier, 'AALLE4');
      assert.equal(el.procedure.type, 'STAR');
      assert.ok(el.legs.length > 0, 'expected STAR to have expanded legs');
    }
  });

  it('resolves a SID with a dotted transition', () => {
    const result = resolver.parse('NUBLE4.JJIMY');
    assert.equal(result.elements.length, 1);
    const el = result.elements[0]!;
    assert.equal(el.type, 'sid');
    if (el.type === 'sid') {
      assert.equal(el.raw, 'NUBLE4.JJIMY');
      assert.equal(el.procedure.identifier, 'NUBLE4');
      const identifiers = el.legs.map((leg) => leg.fixIdentifier);
      assert.equal(
        identifiers[identifiers.length - 1],
        'JJIMY',
        'expected dotted SID expansion to end at the transition terminus',
      );
      assert.ok(
        identifiers.includes('RBELA'),
        'expected JJIMY transition fix RBELA in the expansion',
      );
    }
  });

  it('resolves a STAR with a dotted transition in arrival order', () => {
    const result = resolver.parse('AALLE4.BBOTL');
    assert.equal(result.elements.length, 1);
    const el = result.elements[0]!;
    assert.equal(el.type, 'star');
    if (el.type === 'star') {
      assert.equal(el.raw, 'AALLE4.BBOTL');
      assert.equal(el.procedure.identifier, 'AALLE4');
      const identifiers = el.legs.map((wp) => wp.fixIdentifier);
      assert.equal(
        identifiers[0],
        'BBOTL',
        'expected dotted STAR expansion to start at the transition origin',
      );
    }
  });

  it('marks a dotted procedure with an unknown transition as resolved with empty waypoints', () => {
    const result = resolver.parse('NUBLE4.NOTAREALXFER');
    assert.equal(result.elements.length, 1);
    const el = result.elements[0]!;
    assert.equal(el.type, 'sid');
    if (el.type === 'sid') {
      assert.equal(el.procedure.identifier, 'NUBLE4');
      assert.equal(el.legs.length, 0);
    }
  });

  it('marks a dotted token with an unknown procedure as unresolved', () => {
    const result = resolver.parse('NOTAPROC.JJIMY');
    assert.equal(result.elements.length, 1);
    assert.equal(result.elements[0]!.type, 'unresolved');
    assert.equal(result.elements[0]!.raw, 'NOTAPROC.JJIMY');
  });

  it('parses DDMMN/DDDMMEW coordinates', () => {
    const result = resolver.parse('4000N07000W');
    assert.equal(result.elements.length, 1);
    const el = result.elements[0]!;
    assert.equal(el.type, 'coordinate');
    if (el.type === 'coordinate') {
      assert.equal(el.lat, 40);
      assert.equal(el.lon, -70);
    }
  });

  it('parses DDMMN coordinates with minutes', () => {
    const result = resolver.parse('4030N07045W');
    assert.equal(result.elements.length, 1);
    const el = result.elements[0]!;
    assert.equal(el.type, 'coordinate');
    if (el.type === 'coordinate') {
      assert.equal(el.lat, 40.5);
      assert.equal(el.lon, -70.75);
    }
  });

  it('parses DDN/DDDEW coordinates', () => {
    const result = resolver.parse('40N070W');
    assert.equal(result.elements.length, 1);
    const el = result.elements[0]!;
    assert.equal(el.type, 'coordinate');
    if (el.type === 'coordinate') {
      assert.equal(el.lat, 40);
      assert.equal(el.lon, -70);
    }
  });

  it('parses southern/eastern hemisphere coordinates', () => {
    const result = resolver.parse('3330S15100E');
    assert.equal(result.elements.length, 1);
    const el = result.elements[0]!;
    assert.equal(el.type, 'coordinate');
    if (el.type === 'coordinate') {
      assert.equal(el.lat, -33.5);
      assert.equal(el.lon, 151);
    }
  });

  it('parses speed/altitude groups with knots and flight level', () => {
    const result = resolver.parse('N0450F350');
    assert.equal(result.elements.length, 1);
    const el = result.elements[0]!;
    assert.equal(el.type, 'speedAltitude');
    if (el.type === 'speedAltitude') {
      assert.equal(el.speedKt, 450);
      assert.equal(el.flightLevel, 350);
    }
  });

  it('parses speed/altitude groups with km/h', () => {
    const result = resolver.parse('K0830F350');
    assert.equal(result.elements.length, 1);
    const el = result.elements[0]!;
    assert.equal(el.type, 'speedAltitude');
    if (el.type === 'speedAltitude') {
      assert.equal(el.speedKmPerHr, 830);
      assert.equal(el.flightLevel, 350);
    }
  });

  it('parses speed/altitude groups with mach number', () => {
    const result = resolver.parse('M082F350');
    assert.equal(result.elements.length, 1);
    const el = result.elements[0]!;
    assert.equal(el.type, 'speedAltitude');
    if (el.type === 'speedAltitude') {
      assert.equal(el.mach, 0.82);
      assert.equal(el.flightLevel, 350);
    }
  });

  it('parses speed/altitude groups with altitude in feet', () => {
    const result = resolver.parse('N0250A065');
    assert.equal(result.elements.length, 1);
    const el = result.elements[0]!;
    assert.equal(el.type, 'speedAltitude');
    if (el.type === 'speedAltitude') {
      assert.equal(el.speedKt, 250);
      assert.equal(el.altitudeFt, 6500);
    }
  });

  it('marks unknown tokens as unresolved', () => {
    const result = resolver.parse('ZZZZZZZZ');
    assert.equal(result.elements.length, 1);
    assert.equal(result.elements[0]!.type, 'unresolved');
    assert.equal(result.elements[0]!.raw, 'ZZZZZZZZ');
  });

  it('is case-insensitive', () => {
    const result = resolver.parse('kjfk dct klax');
    assert.equal(result.elements.length, 3);
    assert.equal(result.elements[0]!.type, 'airport');
    assert.equal(result.elements[1]!.type, 'direct');
    assert.equal(result.elements[2]!.type, 'airport');
  });

  it('handles a multi-segment route', () => {
    const result = resolver.parse('KJFK DCT MERIT DCT KLAX');
    assert.equal(result.elements.length, 5);
    assert.equal(result.elements[0]!.type, 'airport');
    assert.equal(result.elements[1]!.type, 'direct');
    assert.equal(result.elements[2]!.type, 'waypoint');
    assert.equal(result.elements[3]!.type, 'direct');
    assert.equal(result.elements[4]!.type, 'airport');
  });

  it('handles a route with airway and direct segments', () => {
    const result = resolver.parse('CIVET J60 RESOR DCT KLAX');
    assert.ok(result.elements.length >= 3, 'expected multiple elements');
    // First element should be the entry waypoint
    assert.equal(result.elements[0]!.type, 'waypoint');
    // Second should be the airway
    assert.equal(result.elements[1]!.type, 'airway');
    // Then DCT
    const dctIdx = result.elements.findIndex((e) => e.type === 'direct');
    assert.ok(dctIdx >= 0, 'expected a DCT element');
  });

  it('uses an airport identifier as airway entry fix', () => {
    // LAX resolves as an airport but is also a waypoint on J60
    const result = resolver.parse('LAX J60 CIVET');
    assert.equal(result.elements.length, 2);

    const airportEl = result.elements[0]!;
    assert.equal(airportEl.type, 'airport');
    assert.equal(airportEl.raw, 'LAX');

    const airwayEl = result.elements[1]!;
    assert.equal(airwayEl.type, 'airway');
    if (airwayEl.type === 'airway') {
      assert.equal(airwayEl.airway.designation, 'J60');
      assert.equal(airwayEl.entryFix, 'LAX');
      assert.equal(airwayEl.exitFix, 'CIVET');
      assert.ok(airwayEl.waypoints.length >= 2);
    }
  });
});

describe('parse with partial resolvers', () => {
  it('works with no resolvers at all', () => {
    const partial = createFlightplanResolver({});
    const result = partial.parse('KJFK DCT KLAX');
    assert.equal(result.elements.length, 3);
    // DCT should still resolve
    assert.equal(result.elements[1]!.type, 'direct');
    // Airports become unresolved without airport resolver
    assert.equal(result.elements[0]!.type, 'unresolved');
    assert.equal(result.elements[2]!.type, 'unresolved');
  });

  it('resolves coordinates without any resolvers', () => {
    const partial = createFlightplanResolver({});
    const result = partial.parse('4000N07000W');
    assert.equal(result.elements.length, 1);
    assert.equal(result.elements[0]!.type, 'coordinate');
  });

  it('resolves speed/altitude without any resolvers', () => {
    const partial = createFlightplanResolver({});
    const result = partial.parse('N0450F350');
    assert.equal(result.elements.length, 1);
    assert.equal(result.elements[0]!.type, 'speedAltitude');
  });

  it('works with only airport resolver', () => {
    const partial = createFlightplanResolver({ airports });
    const result = partial.parse('KJFK DCT KLAX');
    assert.equal(result.elements.length, 3);
    assert.equal(result.elements[0]!.type, 'airport');
    assert.equal(result.elements[1]!.type, 'direct');
    assert.equal(result.elements[2]!.type, 'airport');
  });
});

describe('coordinate routes', () => {
  it('parses a sequence of coordinates connected by DCT', () => {
    const result = resolver.parse('51N050W DCT 51N040W DCT 51N030W DCT 51N020W');
    assert.equal(result.elements.length, 7);

    assert.equal(result.elements[0]!.type, 'coordinate');
    assert.equal(result.elements[1]!.type, 'direct');
    assert.equal(result.elements[2]!.type, 'coordinate');
    assert.equal(result.elements[3]!.type, 'direct');
    assert.equal(result.elements[4]!.type, 'coordinate');
    assert.equal(result.elements[5]!.type, 'direct');
    assert.equal(result.elements[6]!.type, 'coordinate');

    // Verify coordinates are parsed correctly
    if (result.elements[0]!.type === 'coordinate') {
      assert.equal(result.elements[0]!.lat, 51);
      assert.equal(result.elements[0]!.lon, -50);
    }
    if (result.elements[6]!.type === 'coordinate') {
      assert.equal(result.elements[6]!.lat, 51);
      assert.equal(result.elements[6]!.lon, -20);
    }
  });

  it('parses a route mixing a departure airport, fixes, coordinates, and an arrival airport', () => {
    const result = resolver.parse('KJFK DCT MERIT DCT 4130N06000W DCT 4500N05000W DCT KLAX');
    assert.equal(result.elements.length, 9);

    assert.equal(result.elements[0]!.type, 'airport');
    assert.equal(result.elements[1]!.type, 'direct');
    assert.equal(result.elements[2]!.type, 'waypoint');
    assert.equal(result.elements[3]!.type, 'direct');
    assert.equal(result.elements[4]!.type, 'coordinate');
    assert.equal(result.elements[5]!.type, 'direct');
    assert.equal(result.elements[6]!.type, 'coordinate');
    assert.equal(result.elements[7]!.type, 'direct');
    assert.equal(result.elements[8]!.type, 'airport');

    if (result.elements[4]!.type === 'coordinate') {
      assert.equal(result.elements[4]!.lat, 41.5);
      assert.equal(result.elements[4]!.lon, -60);
    }
  });

  it('parses DDMMN/DDDMMEW coordinates with minutes in a route', () => {
    const result = resolver.parse('5130N05030W DCT 5130N04030W');
    assert.equal(result.elements.length, 3);

    if (result.elements[0]!.type === 'coordinate') {
      assert.equal(result.elements[0]!.lat, 51.5);
      assert.equal(result.elements[0]!.lon, -50.5);
    }
    if (result.elements[2]!.type === 'coordinate') {
      assert.equal(result.elements[2]!.lat, 51.5);
      assert.equal(result.elements[2]!.lon, -40.5);
    }
  });
});

describe('airway edge cases', () => {
  it('marks a recognized airway as unresolved when expansion fails', () => {
    // MERIT is a valid fix and J60 is a valid airway, but MERIT is not on J60.
    // J60 should become unresolved and ZZZZZ should be parsed independently.
    const result = resolver.parse('MERIT J60 ZZZZZ');
    assert.equal(result.elements.length, 3);

    assert.equal(result.elements[0]!.type, 'waypoint');
    assert.equal(result.elements[0]!.raw, 'MERIT');

    // J60 recognized as airway but expand(J60, MERIT, ZZZZZ) fails
    assert.equal(result.elements[1]!.type, 'unresolved');
    assert.equal(result.elements[1]!.raw, 'J60');

    // ZZZZZ was NOT consumed by the airway and is parsed on its own
    assert.equal(result.elements[2]!.type, 'unresolved');
    assert.equal(result.elements[2]!.raw, 'ZZZZZ');
  });

  it('marks an airway as unresolved when it is the last token', () => {
    const result = resolver.parse('MERIT J60');
    assert.equal(result.elements.length, 2);

    assert.equal(result.elements[0]!.type, 'waypoint');
    assert.equal(result.elements[0]!.raw, 'MERIT');

    // J60 has no exit fix token after it
    assert.equal(result.elements[1]!.type, 'unresolved');
    assert.equal(result.elements[1]!.raw, 'J60');
  });

  it('marks an airway as unresolved when there is no previous waypoint', () => {
    // J60 appears first with no prior waypoint context
    const result = resolver.parse('J60 CIVET');
    assert.equal(result.elements.length, 2);

    assert.equal(result.elements[0]!.type, 'unresolved');
    assert.equal(result.elements[0]!.raw, 'J60');

    // CIVET is parsed independently as a fix
    assert.equal(result.elements[1]!.type, 'waypoint');
    assert.equal(result.elements[1]!.raw, 'CIVET');
  });

  it('does not break airway chaining after a coordinate', () => {
    // A coordinate clears lastWaypointIdent, so a following airway cannot expand.
    // The airway becomes unresolved and the exit fix is parsed independently.
    const result = resolver.parse('4000N07000W J60 CIVET');
    assert.equal(result.elements.length, 3);

    assert.equal(result.elements[0]!.type, 'coordinate');

    // J60 recognized as airway but no lastWaypointIdent after coordinate
    assert.equal(result.elements[1]!.type, 'unresolved');
    assert.equal(result.elements[1]!.raw, 'J60');

    assert.equal(result.elements[2]!.type, 'waypoint');
    assert.equal(result.elements[2]!.raw, 'CIVET');
  });
});

// ---------------------------------------------------------------------------
// Integration tests using real FAA Coded Departure Routes (CDR.txt)
// These routes are published by the FAA and serve as ground-truth for
// validating the parser against real-world flight plans.
// ---------------------------------------------------------------------------

describe('FAA Coded Departure Routes', () => {
  // CDR: ABQATLER - Albuquerque to Atlanta via J15 and Q24
  // Exercises: airports, navaid waypoints, reverse airway traversal (J15),
  //            Q-route, fix waypoint, STAR
  it('parses KABQ CNX J15 CME BGS SAT Q24 LSU SHYRE HOBTT3 KATL', () => {
    const result = resolver.parse('KABQ CNX J15 CME BGS SAT Q24 LSU SHYRE HOBTT3 KATL');
    assert.equal(result.elements.length, 9);

    // KABQ - departure airport
    const el0 = result.elements[0]!;
    assert.equal(el0.type, 'airport');
    if (el0.type === 'airport') {
      assert.equal(el0.airport.icao, 'KABQ');
    }

    // CNX - Carrizozo VORTAC
    const el1 = result.elements[1]!;
    assert.equal(el1.type, 'waypoint');
    if (el1.type === 'waypoint') {
      assert.ok(el1.navaid, 'expected CNX to resolve as navaid');
      assert.equal(el1.navaid.identifier, 'CNX');
    }

    // J15 CNX->CME - reverse traversal (CNX is after CME in stored order)
    const el2 = result.elements[2]!;
    assert.equal(el2.type, 'airway');
    if (el2.type === 'airway') {
      assert.equal(el2.airway.designation, 'J15');
      assert.equal(el2.entryFix, 'CNX');
      assert.equal(el2.exitFix, 'CME');
      assert.ok(el2.waypoints.length >= 2);
      // Entry fix should be first waypoint in result
      assert.equal(el2.waypoints[0]!.identifier, 'CNX');
      // Exit fix should be last waypoint in result
      assert.equal(el2.waypoints[el2.waypoints.length - 1]!.identifier, 'CME');
    }

    // BGS - Big Spring VORTAC
    const el3 = result.elements[3]!;
    assert.equal(el3.type, 'waypoint');

    // SAT - San Antonio (resolves as airport since it has both airport and navaid)
    const el4 = result.elements[4]!;
    assert.equal(el4.type, 'airport');

    // Q24 SAT->LSU
    const el5 = result.elements[5]!;
    assert.equal(el5.type, 'airway');
    if (el5.type === 'airway') {
      assert.equal(el5.airway.designation, 'Q24');
      assert.equal(el5.entryFix, 'SAT');
      assert.equal(el5.exitFix, 'LSU');
    }

    // SHYRE - named fix
    const el6 = result.elements[6]!;
    assert.equal(el6.type, 'waypoint');
    if (el6.type === 'waypoint') {
      assert.ok(el6.fix, 'expected SHYRE to resolve as fix');
    }

    // HOBTT3 - STAR
    const el7 = result.elements[7]!;
    assert.equal(el7.type, 'star');
    if (el7.type === 'star') {
      assert.equal(el7.procedure.identifier, 'HOBTT3');
      assert.ok(el7.legs.length > 0, 'expected STAR to have waypoints');
    }

    // KATL - arrival airport
    const el8 = result.elements[8]!;
    assert.equal(el8.type, 'airport');
    if (el8.type === 'airport') {
      assert.equal(el8.airport.icao, 'KATL');
    }
  });

  // CDR: ABQBWIJ1 - Albuquerque to Baltimore via four consecutive J-routes
  // Exercises: airport as airway entry fix, four chained J-routes where each
  //            exit fix becomes the next entry fix, navaid waypoints, STAR
  it('parses KABQ ALS J13 FQF J128 HCT J60 JOT J30 APE AIR KEMAN ANTHM5 KBWI', () => {
    const result = resolver.parse(
      'KABQ ALS J13 FQF J128 HCT J60 JOT J30 APE AIR KEMAN ANTHM5 KBWI',
    );
    assert.equal(result.elements.length, 10);

    // KABQ - departure
    assert.equal(result.elements[0]!.type, 'airport');

    // ALS - Alamosa airport (also on J13 as a waypoint)
    const el1 = result.elements[1]!;
    assert.equal(el1.type, 'airport');

    // J13 ALS->FQF - first airway in chain
    const el2 = result.elements[2]!;
    assert.equal(el2.type, 'airway');
    if (el2.type === 'airway') {
      assert.equal(el2.airway.designation, 'J13');
      assert.equal(el2.entryFix, 'ALS');
      assert.equal(el2.exitFix, 'FQF');
    }

    // J128 FQF->HCT - chained from J13 exit fix
    const el3 = result.elements[3]!;
    assert.equal(el3.type, 'airway');
    if (el3.type === 'airway') {
      assert.equal(el3.airway.designation, 'J128');
      assert.equal(el3.entryFix, 'FQF');
      assert.equal(el3.exitFix, 'HCT');
    }

    // J60 HCT->JOT - chained from J128 exit fix
    const el4 = result.elements[4]!;
    assert.equal(el4.type, 'airway');
    if (el4.type === 'airway') {
      assert.equal(el4.airway.designation, 'J60');
      assert.equal(el4.entryFix, 'HCT');
      assert.equal(el4.exitFix, 'JOT');
    }

    // J30 JOT->APE - chained from J60 exit fix
    const el5 = result.elements[5]!;
    assert.equal(el5.type, 'airway');
    if (el5.type === 'airway') {
      assert.equal(el5.airway.designation, 'J30');
      assert.equal(el5.entryFix, 'JOT');
      assert.equal(el5.exitFix, 'APE');
    }

    // AIR - navaid waypoint
    assert.equal(result.elements[6]!.type, 'waypoint');

    // KEMAN - fix waypoint
    assert.equal(result.elements[7]!.type, 'waypoint');

    // ANTHM5 - STAR
    const el8 = result.elements[8]!;
    assert.equal(el8.type, 'star');
    if (el8.type === 'star') {
      assert.equal(el8.procedure.identifier, 'ANTHM5');
    }

    // KBWI - arrival
    assert.equal(result.elements[9]!.type, 'airport');
  });

  // CDR: ABQASESK - Albuquerque to Aspen via SID and STAR
  // Exercises: SID with expanded waypoints, navaid waypoints, STAR
  it('parses KABQ LARGO3 RSK SLIPY LOYYD1 KASE', () => {
    const result = resolver.parse('KABQ LARGO3 RSK SLIPY LOYYD1 KASE');
    assert.equal(result.elements.length, 6);

    // KABQ - departure
    assert.equal(result.elements[0]!.type, 'airport');

    // LARGO3 - SID
    const el1 = result.elements[1]!;
    assert.equal(el1.type, 'sid');
    if (el1.type === 'sid') {
      assert.equal(el1.procedure.identifier, 'LARGO3');
      assert.equal(el1.procedure.type, 'SID');
      assert.ok(el1.legs.length > 0, 'expected SID to have waypoints');
    }

    // RSK - navaid waypoint
    assert.equal(result.elements[2]!.type, 'waypoint');

    // SLIPY - fix waypoint
    const el3 = result.elements[3]!;
    assert.equal(el3.type, 'waypoint');

    // LOYYD1 - STAR
    const el4 = result.elements[4]!;
    assert.equal(el4.type, 'star');
    if (el4.type === 'star') {
      assert.equal(el4.procedure.identifier, 'LOYYD1');
      assert.equal(el4.procedure.type, 'STAR');
    }

    // KASE - arrival
    assert.equal(result.elements[5]!.type, 'airport');
  });

  // CDR: ABECLTHV - Allentown to Charlotte via J64 and many waypoints
  // Exercises: J-route mid-route, many fix/navaid waypoints between airways, STAR
  it('parses KABE ETX RAV J64 BURNI TYROO QUARM AIR HVQ LNDIZ PARQR4 KCLT', () => {
    const result = resolver.parse('KABE ETX RAV J64 BURNI TYROO QUARM AIR HVQ LNDIZ PARQR4 KCLT');
    assert.equal(result.elements.length, 11);

    // KABE - departure
    assert.equal(result.elements[0]!.type, 'airport');

    // ETX - navaid/fix waypoint
    assert.equal(result.elements[1]!.type, 'waypoint');

    // RAV - waypoint (entry fix for J64)
    assert.equal(result.elements[2]!.type, 'waypoint');

    // J64 RAV->BURNI
    const el3 = result.elements[3]!;
    assert.equal(el3.type, 'airway');
    if (el3.type === 'airway') {
      assert.equal(el3.airway.designation, 'J64');
      assert.equal(el3.entryFix, 'RAV');
      assert.equal(el3.exitFix, 'BURNI');
    }

    // TYROO through LNDIZ - individual waypoints
    assert.equal(result.elements[4]!.type, 'waypoint');
    assert.equal(result.elements[5]!.type, 'waypoint');
    assert.equal(result.elements[6]!.type, 'waypoint');
    assert.equal(result.elements[7]!.type, 'waypoint');
    assert.equal(result.elements[8]!.type, 'waypoint');

    // PARQR4 - STAR
    const el9 = result.elements[9]!;
    assert.equal(el9.type, 'star');
    if (el9.type === 'star') {
      assert.equal(el9.procedure.identifier, 'PARQR4');
    }

    // KCLT - arrival
    assert.equal(result.elements[10]!.type, 'airport');
  });

  // CDR: ABQBWIVZ - Albuquerque to Baltimore via SID, multiple J and Q routes
  // Exercises: SID, J-route, mixed Q-routes, many fix waypoints, STAR
  // This is a long complex route with 18 tokens
  it('parses KABQ MNZNO3 CME J15 INK J4 FUZ UIM ELD IZAAC Q30 VLKNN THRSR KBLER KELLN Q58 PEETT THHMP RAVNN8 KBWI', () => {
    const result = resolver.parse(
      'KABQ MNZNO3 CME J15 INK J4 FUZ UIM ELD IZAAC Q30 VLKNN THRSR KBLER KELLN Q58 PEETT THHMP RAVNN8 KBWI',
    );

    // No element should be unresolved
    const unresolved = result.elements.filter((e) => e.type === 'unresolved');
    assert.equal(unresolved.length, 0, 'expected no unresolved elements');

    // KABQ - departure
    assert.equal(result.elements[0]!.type, 'airport');
    if (result.elements[0]!.type === 'airport') {
      assert.equal(result.elements[0]!.airport.icao, 'KABQ');
    }

    // MNZNO3 - SID
    const sid = result.elements[1]!;
    assert.equal(sid.type, 'sid');
    if (sid.type === 'sid') {
      assert.equal(sid.procedure.identifier, 'MNZNO3');
    }

    // Verify airway segments exist with correct designations
    const airwayElements = result.elements.filter((e) => e.type === 'airway');
    const airwayDesignations = airwayElements.map((e) => {
      if (e.type === 'airway') {
        return e.airway.designation;
      }
      return '';
    });
    assert.ok(airwayDesignations.includes('J15'), 'expected J15 airway');
    assert.ok(airwayDesignations.includes('J4'), 'expected J4 airway');
    assert.ok(airwayDesignations.includes('Q30'), 'expected Q30 airway');
    assert.ok(airwayDesignations.includes('Q58'), 'expected Q58 airway');

    // RAVNN8 - STAR
    const starEl = result.elements.find((e) => e.type === 'star');
    assert.ok(starEl, 'expected a STAR element');
    if (starEl && starEl.type === 'star') {
      assert.equal(starEl.procedure.identifier, 'RAVNN8');
    }

    // KBWI - arrival
    const lastEl = result.elements[result.elements.length - 1]!;
    assert.equal(lastEl.type, 'airport');
    if (lastEl.type === 'airport') {
      assert.equal(lastEl.airport.icao, 'KBWI');
    }
  });

  // CDR: ABQCVGCV - Albuquerque to Cincinnati via J18 and STAR
  // Exercises: simple airway route with fix waypoint and STAR
  it('parses KABQ FTI J18 GCK DAAVE SARGO5 KCVG', () => {
    const result = resolver.parse('KABQ FTI J18 GCK DAAVE SARGO5 KCVG');
    assert.equal(result.elements.length, 6);

    assert.equal(result.elements[0]!.type, 'airport');

    // FTI - navaid waypoint
    assert.equal(result.elements[1]!.type, 'waypoint');

    // J18 FTI->GCK
    const el2 = result.elements[2]!;
    assert.equal(el2.type, 'airway');
    if (el2.type === 'airway') {
      assert.equal(el2.airway.designation, 'J18');
      assert.equal(el2.entryFix, 'FTI');
      assert.equal(el2.exitFix, 'GCK');
    }

    // DAAVE - fix waypoint
    const el3 = result.elements[3]!;
    assert.equal(el3.type, 'waypoint');
    if (el3.type === 'waypoint') {
      assert.ok(el3.fix, 'expected DAAVE to resolve as fix');
    }

    // SARGO5 - STAR
    const el4 = result.elements[4]!;
    assert.equal(el4.type, 'star');

    assert.equal(result.elements[5]!.type, 'airport');
  });
});
