import { describe, it, beforeAll, expect, assert } from 'vitest';
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
    expect(result.raw).toBe('');
    expect(result.elements.length).toBe(0);
  });

  it('returns empty elements for whitespace-only string', () => {
    const result = resolver.parse('   ');
    expect(result.raw).toBe('');
    expect(result.elements.length).toBe(0);
  });

  it('preserves the raw route string', () => {
    const result = resolver.parse('KJFK DCT KLAX');
    expect(result.raw).toBe('KJFK DCT KLAX');
  });

  it('resolves ICAO airport identifiers', () => {
    const result = resolver.parse('KJFK');
    expect(result.elements.length).toBe(1);
    const el = result.elements[0]!;
    expect(el.type).toBe('airport');
    if (el.type === 'airport') {
      expect(el.airport.icao).toBe('KJFK');
    }
  });

  it('resolves FAA airport identifiers', () => {
    const result = resolver.parse('JFK');
    expect(result.elements.length).toBe(1);
    const el = result.elements[0]!;
    expect(el.type).toBe('airport');
    if (el.type === 'airport') {
      expect(el.airport.faaId).toBe('JFK');
    }
  });

  it('parses DCT as a direct element', () => {
    const result = resolver.parse('DCT');
    expect(result.elements.length).toBe(1);
    expect(result.elements[0]!.type).toBe('direct');
    expect(result.elements[0]!.raw).toBe('DCT');
  });

  it('resolves fix waypoints', () => {
    const result = resolver.parse('MERIT');
    expect(result.elements.length).toBe(1);
    const el = result.elements[0]!;
    expect(el.type).toBe('waypoint');
    if (el.type === 'waypoint') {
      assert(el.fix, 'expected fix to be populated');
      expect(el.fix.identifier).toBe('MERIT');
      expect(typeof el.lat).toBe('number');
      expect(typeof el.lon).toBe('number');
    }
  });

  it('resolves navaid waypoints', () => {
    // BOS is a well-known VOR
    const result = resolver.parse('BOS');
    expect(result.elements.length).toBe(1);
    const el = result.elements[0]!;
    // BOS could match as airport or navaid depending on priority
    // Since airports are checked before navaids, check which matched
    assert(el.type === 'airport' || el.type === 'waypoint', 'expected airport or waypoint');
  });

  it('resolves an airway segment between two fixes', () => {
    // DODGR and PRADO are fixes on V16 (US variant)
    const result = resolver.parse('DODGR V16 PRADO');
    expect(result.elements.length).toBe(2);

    const waypointEl = result.elements[0]!;
    expect(waypointEl.type).toBe('waypoint');
    expect(waypointEl.raw).toBe('DODGR');

    const airwayEl = result.elements[1]!;
    expect(airwayEl.type).toBe('airway');
    if (airwayEl.type === 'airway') {
      expect(airwayEl.airway.designation).toBe('V16');
      expect(airwayEl.entryFix).toBe('DODGR');
      expect(airwayEl.exitFix).toBe('PRADO');
      assert(airwayEl.waypoints.length >= 2, 'expected at least entry and exit waypoints');
    }
  });

  it('marks unresolvable airway tokens as unresolved', () => {
    const result = resolver.parse('MERIT FAKEWAY99 BOSCO');
    // MERIT resolves as fix, FAKEWAY99 is not an airway or anything else, BOSCO resolves
    const fakeEl = result.elements.find((e) => e.raw === 'FAKEWAY99');
    assert(fakeEl, 'expected element for FAKEWAY99');
    expect(fakeEl.type).toBe('unresolved');
  });

  it('resolves a SID procedure', () => {
    const result = resolver.parse('ACCRA5');
    expect(result.elements.length).toBe(1);
    const el = result.elements[0]!;
    expect(el.type).toBe('sid');
    if (el.type === 'sid') {
      expect(el.procedure.identifier).toBe('ACCRA5');
      expect(el.procedure.type).toBe('SID');
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
    assert(kdalSid && kdalSid.type === 'sid');
    assert(kdfwSid && kdfwSid.type === 'sid');
    assert(
      kdalSid.procedure.airports.some((a) => a.toUpperCase() === 'KDAL'),
      'expected KDAL DALL4 to resolve to the KDAL adaptation',
    );
    assert(
      kdfwSid.procedure.airports.some((a) => a.toUpperCase() === 'KDFW'),
      'expected KDFW DALL4 to resolve to the KDFW adaptation',
    );
  });

  it('resolves a STAR procedure with legs', () => {
    const result = resolver.parse('AALLE4');
    expect(result.elements.length).toBe(1);
    const el = result.elements[0]!;
    expect(el.type).toBe('star');
    if (el.type === 'star') {
      expect(el.procedure.identifier).toBe('AALLE4');
      expect(el.procedure.type).toBe('STAR');
      assert(el.legs.length > 0, 'expected STAR to have expanded legs');
    }
  });

  it('resolves a SID with a dotted transition', () => {
    const result = resolver.parse('NUBLE4.JJIMY');
    expect(result.elements.length).toBe(1);
    const el = result.elements[0]!;
    expect(el.type).toBe('sid');
    if (el.type === 'sid') {
      expect(el.raw).toBe('NUBLE4.JJIMY');
      expect(el.procedure.identifier).toBe('NUBLE4');
      const identifiers = el.legs.map((leg) => leg.fixIdentifier);
      expect(
        identifiers[identifiers.length - 1],
        'expected dotted SID expansion to end at the transition terminus',
      ).toBe('JJIMY');
      assert(identifiers.includes('RBELA'), 'expected JJIMY transition fix RBELA in the expansion');
    }
  });

  it('resolves a STAR with a dotted transition in arrival order', () => {
    const result = resolver.parse('AALLE4.BBOTL');
    expect(result.elements.length).toBe(1);
    const el = result.elements[0]!;
    expect(el.type).toBe('star');
    if (el.type === 'star') {
      expect(el.raw).toBe('AALLE4.BBOTL');
      expect(el.procedure.identifier).toBe('AALLE4');
      const identifiers = el.legs.map((wp) => wp.fixIdentifier);
      expect(
        identifiers[0],
        'expected dotted STAR expansion to start at the transition origin',
      ).toBe('BBOTL');
    }
  });

  it('marks a dotted procedure with an unknown transition as resolved with empty waypoints', () => {
    const result = resolver.parse('NUBLE4.NOTAREALXFER');
    expect(result.elements.length).toBe(1);
    const el = result.elements[0]!;
    expect(el.type).toBe('sid');
    if (el.type === 'sid') {
      expect(el.procedure.identifier).toBe('NUBLE4');
      expect(el.legs.length).toBe(0);
    }
  });

  it('marks a dotted token with an unknown procedure as unresolved', () => {
    const result = resolver.parse('NOTAPROC.JJIMY');
    expect(result.elements.length).toBe(1);
    expect(result.elements[0]!.type).toBe('unresolved');
    expect(result.elements[0]!.raw).toBe('NOTAPROC.JJIMY');
  });

  it('parses DDMMN/DDDMMEW coordinates', () => {
    const result = resolver.parse('4000N07000W');
    expect(result.elements.length).toBe(1);
    const el = result.elements[0]!;
    expect(el.type).toBe('coordinate');
    if (el.type === 'coordinate') {
      expect(el.lat).toBe(40);
      expect(el.lon).toBe(-70);
    }
  });

  it('parses DDMMN coordinates with minutes', () => {
    const result = resolver.parse('4030N07045W');
    expect(result.elements.length).toBe(1);
    const el = result.elements[0]!;
    expect(el.type).toBe('coordinate');
    if (el.type === 'coordinate') {
      expect(el.lat).toBe(40.5);
      expect(el.lon).toBe(-70.75);
    }
  });

  it('parses DDN/DDDEW coordinates', () => {
    const result = resolver.parse('40N070W');
    expect(result.elements.length).toBe(1);
    const el = result.elements[0]!;
    expect(el.type).toBe('coordinate');
    if (el.type === 'coordinate') {
      expect(el.lat).toBe(40);
      expect(el.lon).toBe(-70);
    }
  });

  it('parses southern/eastern hemisphere coordinates', () => {
    const result = resolver.parse('3330S15100E');
    expect(result.elements.length).toBe(1);
    const el = result.elements[0]!;
    expect(el.type).toBe('coordinate');
    if (el.type === 'coordinate') {
      expect(el.lat).toBe(-33.5);
      expect(el.lon).toBe(151);
    }
  });

  it('parses speed/altitude groups with knots and flight level', () => {
    const result = resolver.parse('N0450F350');
    expect(result.elements.length).toBe(1);
    const el = result.elements[0]!;
    expect(el.type).toBe('speedAltitude');
    if (el.type === 'speedAltitude') {
      expect(el.speedKt).toBe(450);
      expect(el.flightLevel).toBe(350);
    }
  });

  it('parses speed/altitude groups with km/h', () => {
    const result = resolver.parse('K0830F350');
    expect(result.elements.length).toBe(1);
    const el = result.elements[0]!;
    expect(el.type).toBe('speedAltitude');
    if (el.type === 'speedAltitude') {
      expect(el.speedKmPerHr).toBe(830);
      expect(el.flightLevel).toBe(350);
    }
  });

  it('parses speed/altitude groups with mach number', () => {
    const result = resolver.parse('M082F350');
    expect(result.elements.length).toBe(1);
    const el = result.elements[0]!;
    expect(el.type).toBe('speedAltitude');
    if (el.type === 'speedAltitude') {
      expect(el.mach).toBe(0.82);
      expect(el.flightLevel).toBe(350);
    }
  });

  it('parses speed/altitude groups with altitude in feet', () => {
    const result = resolver.parse('N0250A065');
    expect(result.elements.length).toBe(1);
    const el = result.elements[0]!;
    expect(el.type).toBe('speedAltitude');
    if (el.type === 'speedAltitude') {
      expect(el.speedKt).toBe(250);
      expect(el.altitudeFt).toBe(6500);
    }
  });

  it('marks unknown tokens as unresolved', () => {
    const result = resolver.parse('ZZZZZZZZ');
    expect(result.elements.length).toBe(1);
    expect(result.elements[0]!.type).toBe('unresolved');
    expect(result.elements[0]!.raw).toBe('ZZZZZZZZ');
  });

  it('is case-insensitive', () => {
    const result = resolver.parse('kjfk dct klax');
    expect(result.elements.length).toBe(3);
    expect(result.elements[0]!.type).toBe('airport');
    expect(result.elements[1]!.type).toBe('direct');
    expect(result.elements[2]!.type).toBe('airport');
  });

  it('handles a multi-segment route', () => {
    const result = resolver.parse('KJFK DCT MERIT DCT KLAX');
    expect(result.elements.length).toBe(5);
    expect(result.elements[0]!.type).toBe('airport');
    expect(result.elements[1]!.type).toBe('direct');
    expect(result.elements[2]!.type).toBe('waypoint');
    expect(result.elements[3]!.type).toBe('direct');
    expect(result.elements[4]!.type).toBe('airport');
  });

  it('handles a route with airway and direct segments', () => {
    const result = resolver.parse('CIVET J60 RESOR DCT KLAX');
    assert(result.elements.length >= 3, 'expected multiple elements');
    // First element should be the entry waypoint
    expect(result.elements[0]!.type).toBe('waypoint');
    // Second should be the airway
    expect(result.elements[1]!.type).toBe('airway');
    // Then DCT
    const dctIdx = result.elements.findIndex((e) => e.type === 'direct');
    assert(dctIdx >= 0, 'expected a DCT element');
  });

  it('uses an airport identifier as airway entry fix', () => {
    // LAX resolves as an airport but is also a waypoint on J60
    const result = resolver.parse('LAX J60 CIVET');
    expect(result.elements.length).toBe(2);

    const airportEl = result.elements[0]!;
    expect(airportEl.type).toBe('airport');
    expect(airportEl.raw).toBe('LAX');

    const airwayEl = result.elements[1]!;
    expect(airwayEl.type).toBe('airway');
    if (airwayEl.type === 'airway') {
      expect(airwayEl.airway.designation).toBe('J60');
      expect(airwayEl.entryFix).toBe('LAX');
      expect(airwayEl.exitFix).toBe('CIVET');
      assert(airwayEl.waypoints.length >= 2);
    }
  });
});

describe('parse with partial resolvers', () => {
  it('works with no resolvers at all', () => {
    const partial = createFlightplanResolver({});
    const result = partial.parse('KJFK DCT KLAX');
    expect(result.elements.length).toBe(3);
    // DCT should still resolve
    expect(result.elements[1]!.type).toBe('direct');
    // Airports become unresolved without airport resolver
    expect(result.elements[0]!.type).toBe('unresolved');
    expect(result.elements[2]!.type).toBe('unresolved');
  });

  it('resolves coordinates without any resolvers', () => {
    const partial = createFlightplanResolver({});
    const result = partial.parse('4000N07000W');
    expect(result.elements.length).toBe(1);
    expect(result.elements[0]!.type).toBe('coordinate');
  });

  it('resolves speed/altitude without any resolvers', () => {
    const partial = createFlightplanResolver({});
    const result = partial.parse('N0450F350');
    expect(result.elements.length).toBe(1);
    expect(result.elements[0]!.type).toBe('speedAltitude');
  });

  it('works with only airport resolver', () => {
    const partial = createFlightplanResolver({ airports });
    const result = partial.parse('KJFK DCT KLAX');
    expect(result.elements.length).toBe(3);
    expect(result.elements[0]!.type).toBe('airport');
    expect(result.elements[1]!.type).toBe('direct');
    expect(result.elements[2]!.type).toBe('airport');
  });
});

describe('coordinate routes', () => {
  it('parses a sequence of coordinates connected by DCT', () => {
    const result = resolver.parse('51N050W DCT 51N040W DCT 51N030W DCT 51N020W');
    expect(result.elements.length).toBe(7);

    expect(result.elements[0]!.type).toBe('coordinate');
    expect(result.elements[1]!.type).toBe('direct');
    expect(result.elements[2]!.type).toBe('coordinate');
    expect(result.elements[3]!.type).toBe('direct');
    expect(result.elements[4]!.type).toBe('coordinate');
    expect(result.elements[5]!.type).toBe('direct');
    expect(result.elements[6]!.type).toBe('coordinate');

    // Verify coordinates are parsed correctly
    if (result.elements[0]!.type === 'coordinate') {
      expect(result.elements[0]!.lat).toBe(51);
      expect(result.elements[0]!.lon).toBe(-50);
    }
    if (result.elements[6]!.type === 'coordinate') {
      expect(result.elements[6]!.lat).toBe(51);
      expect(result.elements[6]!.lon).toBe(-20);
    }
  });

  it('parses a route mixing a departure airport, fixes, coordinates, and an arrival airport', () => {
    const result = resolver.parse('KJFK DCT MERIT DCT 4130N06000W DCT 4500N05000W DCT KLAX');
    expect(result.elements.length).toBe(9);

    expect(result.elements[0]!.type).toBe('airport');
    expect(result.elements[1]!.type).toBe('direct');
    expect(result.elements[2]!.type).toBe('waypoint');
    expect(result.elements[3]!.type).toBe('direct');
    expect(result.elements[4]!.type).toBe('coordinate');
    expect(result.elements[5]!.type).toBe('direct');
    expect(result.elements[6]!.type).toBe('coordinate');
    expect(result.elements[7]!.type).toBe('direct');
    expect(result.elements[8]!.type).toBe('airport');

    if (result.elements[4]!.type === 'coordinate') {
      expect(result.elements[4]!.lat).toBe(41.5);
      expect(result.elements[4]!.lon).toBe(-60);
    }
  });

  it('parses DDMMN/DDDMMEW coordinates with minutes in a route', () => {
    const result = resolver.parse('5130N05030W DCT 5130N04030W');
    expect(result.elements.length).toBe(3);

    if (result.elements[0]!.type === 'coordinate') {
      expect(result.elements[0]!.lat).toBe(51.5);
      expect(result.elements[0]!.lon).toBe(-50.5);
    }
    if (result.elements[2]!.type === 'coordinate') {
      expect(result.elements[2]!.lat).toBe(51.5);
      expect(result.elements[2]!.lon).toBe(-40.5);
    }
  });
});

describe('airway edge cases', () => {
  it('marks a recognized airway as unresolved when expansion fails', () => {
    // MERIT is a valid fix and J60 is a valid airway, but MERIT is not on J60.
    // J60 should become unresolved and ZZZZZ should be parsed independently.
    const result = resolver.parse('MERIT J60 ZZZZZ');
    expect(result.elements.length).toBe(3);

    expect(result.elements[0]!.type).toBe('waypoint');
    expect(result.elements[0]!.raw).toBe('MERIT');

    // J60 recognized as airway but expand(J60, MERIT, ZZZZZ) fails
    expect(result.elements[1]!.type).toBe('unresolved');
    expect(result.elements[1]!.raw).toBe('J60');

    // ZZZZZ was NOT consumed by the airway and is parsed on its own
    expect(result.elements[2]!.type).toBe('unresolved');
    expect(result.elements[2]!.raw).toBe('ZZZZZ');
  });

  it('marks an airway as unresolved when it is the last token', () => {
    const result = resolver.parse('MERIT J60');
    expect(result.elements.length).toBe(2);

    expect(result.elements[0]!.type).toBe('waypoint');
    expect(result.elements[0]!.raw).toBe('MERIT');

    // J60 has no exit fix token after it
    expect(result.elements[1]!.type).toBe('unresolved');
    expect(result.elements[1]!.raw).toBe('J60');
  });

  it('marks an airway as unresolved when there is no previous waypoint', () => {
    // J60 appears first with no prior waypoint context
    const result = resolver.parse('J60 CIVET');
    expect(result.elements.length).toBe(2);

    expect(result.elements[0]!.type).toBe('unresolved');
    expect(result.elements[0]!.raw).toBe('J60');

    // CIVET is parsed independently as a fix
    expect(result.elements[1]!.type).toBe('waypoint');
    expect(result.elements[1]!.raw).toBe('CIVET');
  });

  it('does not break airway chaining after a coordinate', () => {
    // A coordinate clears lastWaypointIdent, so a following airway cannot expand.
    // The airway becomes unresolved and the exit fix is parsed independently.
    const result = resolver.parse('4000N07000W J60 CIVET');
    expect(result.elements.length).toBe(3);

    expect(result.elements[0]!.type).toBe('coordinate');

    // J60 recognized as airway but no lastWaypointIdent after coordinate
    expect(result.elements[1]!.type).toBe('unresolved');
    expect(result.elements[1]!.raw).toBe('J60');

    expect(result.elements[2]!.type).toBe('waypoint');
    expect(result.elements[2]!.raw).toBe('CIVET');
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
    expect(result.elements.length).toBe(9);

    // KABQ - departure airport
    const el0 = result.elements[0]!;
    expect(el0.type).toBe('airport');
    if (el0.type === 'airport') {
      expect(el0.airport.icao).toBe('KABQ');
    }

    // CNX - Carrizozo VORTAC
    const el1 = result.elements[1]!;
    expect(el1.type).toBe('waypoint');
    if (el1.type === 'waypoint') {
      assert(el1.navaid, 'expected CNX to resolve as navaid');
      expect(el1.navaid.identifier).toBe('CNX');
    }

    // J15 CNX->CME - reverse traversal (CNX is after CME in stored order)
    const el2 = result.elements[2]!;
    expect(el2.type).toBe('airway');
    if (el2.type === 'airway') {
      expect(el2.airway.designation).toBe('J15');
      expect(el2.entryFix).toBe('CNX');
      expect(el2.exitFix).toBe('CME');
      assert(el2.waypoints.length >= 2);
      // Entry fix should be first waypoint in result
      expect(el2.waypoints[0]!.identifier).toBe('CNX');
      // Exit fix should be last waypoint in result
      expect(el2.waypoints[el2.waypoints.length - 1]!.identifier).toBe('CME');
    }

    // BGS - Big Spring VORTAC
    const el3 = result.elements[3]!;
    expect(el3.type).toBe('waypoint');

    // SAT - San Antonio (resolves as airport since it has both airport and navaid)
    const el4 = result.elements[4]!;
    expect(el4.type).toBe('airport');

    // Q24 SAT->LSU
    const el5 = result.elements[5]!;
    expect(el5.type).toBe('airway');
    if (el5.type === 'airway') {
      expect(el5.airway.designation).toBe('Q24');
      expect(el5.entryFix).toBe('SAT');
      expect(el5.exitFix).toBe('LSU');
    }

    // SHYRE - named fix
    const el6 = result.elements[6]!;
    expect(el6.type).toBe('waypoint');
    if (el6.type === 'waypoint') {
      assert(el6.fix, 'expected SHYRE to resolve as fix');
    }

    // HOBTT3 - STAR
    const el7 = result.elements[7]!;
    expect(el7.type).toBe('star');
    if (el7.type === 'star') {
      expect(el7.procedure.identifier).toBe('HOBTT3');
      assert(el7.legs.length > 0, 'expected STAR to have waypoints');
    }

    // KATL - arrival airport
    const el8 = result.elements[8]!;
    expect(el8.type).toBe('airport');
    if (el8.type === 'airport') {
      expect(el8.airport.icao).toBe('KATL');
    }
  });

  // CDR: ABQBWIJ1 - Albuquerque to Baltimore via four consecutive J-routes
  // Exercises: airport as airway entry fix, four chained J-routes where each
  //            exit fix becomes the next entry fix, navaid waypoints, STAR
  it('parses KABQ ALS J13 FQF J128 HCT J60 JOT J30 APE AIR KEMAN ANTHM5 KBWI', () => {
    const result = resolver.parse(
      'KABQ ALS J13 FQF J128 HCT J60 JOT J30 APE AIR KEMAN ANTHM5 KBWI',
    );
    expect(result.elements.length).toBe(10);

    // KABQ - departure
    expect(result.elements[0]!.type).toBe('airport');

    // ALS - Alamosa airport (also on J13 as a waypoint)
    const el1 = result.elements[1]!;
    expect(el1.type).toBe('airport');

    // J13 ALS->FQF - first airway in chain
    const el2 = result.elements[2]!;
    expect(el2.type).toBe('airway');
    if (el2.type === 'airway') {
      expect(el2.airway.designation).toBe('J13');
      expect(el2.entryFix).toBe('ALS');
      expect(el2.exitFix).toBe('FQF');
    }

    // J128 FQF->HCT - chained from J13 exit fix
    const el3 = result.elements[3]!;
    expect(el3.type).toBe('airway');
    if (el3.type === 'airway') {
      expect(el3.airway.designation).toBe('J128');
      expect(el3.entryFix).toBe('FQF');
      expect(el3.exitFix).toBe('HCT');
    }

    // J60 HCT->JOT - chained from J128 exit fix
    const el4 = result.elements[4]!;
    expect(el4.type).toBe('airway');
    if (el4.type === 'airway') {
      expect(el4.airway.designation).toBe('J60');
      expect(el4.entryFix).toBe('HCT');
      expect(el4.exitFix).toBe('JOT');
    }

    // J30 JOT->APE - chained from J60 exit fix
    const el5 = result.elements[5]!;
    expect(el5.type).toBe('airway');
    if (el5.type === 'airway') {
      expect(el5.airway.designation).toBe('J30');
      expect(el5.entryFix).toBe('JOT');
      expect(el5.exitFix).toBe('APE');
    }

    // AIR - navaid waypoint
    expect(result.elements[6]!.type).toBe('waypoint');

    // KEMAN - fix waypoint
    expect(result.elements[7]!.type).toBe('waypoint');

    // ANTHM5 - STAR
    const el8 = result.elements[8]!;
    expect(el8.type).toBe('star');
    if (el8.type === 'star') {
      expect(el8.procedure.identifier).toBe('ANTHM5');
    }

    // KBWI - arrival
    expect(result.elements[9]!.type).toBe('airport');
  });

  // CDR: ABQASESK - Albuquerque to Aspen via SID and STAR
  // Exercises: SID with expanded waypoints, navaid waypoints, STAR
  it('parses KABQ LARGO3 RSK SLIPY LOYYD1 KASE', () => {
    const result = resolver.parse('KABQ LARGO3 RSK SLIPY LOYYD1 KASE');
    expect(result.elements.length).toBe(6);

    // KABQ - departure
    expect(result.elements[0]!.type).toBe('airport');

    // LARGO3 - SID
    const el1 = result.elements[1]!;
    expect(el1.type).toBe('sid');
    if (el1.type === 'sid') {
      expect(el1.procedure.identifier).toBe('LARGO3');
      expect(el1.procedure.type).toBe('SID');
      assert(el1.legs.length > 0, 'expected SID to have waypoints');
    }

    // RSK - navaid waypoint
    expect(result.elements[2]!.type).toBe('waypoint');

    // SLIPY - fix waypoint
    const el3 = result.elements[3]!;
    expect(el3.type).toBe('waypoint');

    // LOYYD1 - STAR
    const el4 = result.elements[4]!;
    expect(el4.type).toBe('star');
    if (el4.type === 'star') {
      expect(el4.procedure.identifier).toBe('LOYYD1');
      expect(el4.procedure.type).toBe('STAR');
    }

    // KASE - arrival
    expect(result.elements[5]!.type).toBe('airport');
  });

  // CDR: ABECLTHV - Allentown to Charlotte via J64 and many waypoints
  // Exercises: J-route mid-route, many fix/navaid waypoints between airways, STAR
  it('parses KABE ETX RAV J64 BURNI TYROO QUARM AIR HVQ LNDIZ PARQR4 KCLT', () => {
    const result = resolver.parse('KABE ETX RAV J64 BURNI TYROO QUARM AIR HVQ LNDIZ PARQR4 KCLT');
    expect(result.elements.length).toBe(11);

    // KABE - departure
    expect(result.elements[0]!.type).toBe('airport');

    // ETX - navaid/fix waypoint
    expect(result.elements[1]!.type).toBe('waypoint');

    // RAV - waypoint (entry fix for J64)
    expect(result.elements[2]!.type).toBe('waypoint');

    // J64 RAV->BURNI
    const el3 = result.elements[3]!;
    expect(el3.type).toBe('airway');
    if (el3.type === 'airway') {
      expect(el3.airway.designation).toBe('J64');
      expect(el3.entryFix).toBe('RAV');
      expect(el3.exitFix).toBe('BURNI');
    }

    // TYROO through LNDIZ - individual waypoints
    expect(result.elements[4]!.type).toBe('waypoint');
    expect(result.elements[5]!.type).toBe('waypoint');
    expect(result.elements[6]!.type).toBe('waypoint');
    expect(result.elements[7]!.type).toBe('waypoint');
    expect(result.elements[8]!.type).toBe('waypoint');

    // PARQR4 - STAR
    const el9 = result.elements[9]!;
    expect(el9.type).toBe('star');
    if (el9.type === 'star') {
      expect(el9.procedure.identifier).toBe('PARQR4');
    }

    // KCLT - arrival
    expect(result.elements[10]!.type).toBe('airport');
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
    expect(unresolved.length, 'expected no unresolved elements').toBe(0);

    // KABQ - departure
    expect(result.elements[0]!.type).toBe('airport');
    if (result.elements[0]!.type === 'airport') {
      expect(result.elements[0]!.airport.icao).toBe('KABQ');
    }

    // MNZNO3 - SID
    const sid = result.elements[1]!;
    expect(sid.type).toBe('sid');
    if (sid.type === 'sid') {
      expect(sid.procedure.identifier).toBe('MNZNO3');
    }

    // Verify airway segments exist with correct designations
    const airwayElements = result.elements.filter((e) => e.type === 'airway');
    const airwayDesignations = airwayElements.map((e) => {
      if (e.type === 'airway') {
        return e.airway.designation;
      }
      return '';
    });
    assert(airwayDesignations.includes('J15'), 'expected J15 airway');
    assert(airwayDesignations.includes('J4'), 'expected J4 airway');
    assert(airwayDesignations.includes('Q30'), 'expected Q30 airway');
    assert(airwayDesignations.includes('Q58'), 'expected Q58 airway');

    // RAVNN8 - STAR
    const starEl = result.elements.find((e) => e.type === 'star');
    assert(starEl, 'expected a STAR element');
    if (starEl && starEl.type === 'star') {
      expect(starEl.procedure.identifier).toBe('RAVNN8');
    }

    // KBWI - arrival
    const lastEl = result.elements[result.elements.length - 1]!;
    expect(lastEl.type).toBe('airport');
    if (lastEl.type === 'airport') {
      expect(lastEl.airport.icao).toBe('KBWI');
    }
  });

  // CDR: ABQCVGCV - Albuquerque to Cincinnati via J18 and STAR
  // Exercises: simple airway route with fix waypoint and STAR
  it('parses KABQ FTI J18 GCK DAAVE SARGO5 KCVG', () => {
    const result = resolver.parse('KABQ FTI J18 GCK DAAVE SARGO5 KCVG');
    expect(result.elements.length).toBe(6);

    expect(result.elements[0]!.type).toBe('airport');

    // FTI - navaid waypoint
    expect(result.elements[1]!.type).toBe('waypoint');

    // J18 FTI->GCK
    const el2 = result.elements[2]!;
    expect(el2.type).toBe('airway');
    if (el2.type === 'airway') {
      expect(el2.airway.designation).toBe('J18');
      expect(el2.entryFix).toBe('FTI');
      expect(el2.exitFix).toBe('GCK');
    }

    // DAAVE - fix waypoint
    const el3 = result.elements[3]!;
    expect(el3.type).toBe('waypoint');
    if (el3.type === 'waypoint') {
      assert(el3.fix, 'expected DAAVE to resolve as fix');
    }

    // SARGO5 - STAR
    const el4 = result.elements[4]!;
    expect(el4.type).toBe('star');

    expect(result.elements[5]!.type).toBe('airport');
  });
});
