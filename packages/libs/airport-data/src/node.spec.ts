import { describe, it, expect, assert } from 'vitest';

import type { Airport, AirportFrequency, IlsSystem, RunwayEnd } from '@squawk/types';

import { usBundledAirports } from './node.js';

function airport(faaId: string): Airport {
  const found = usBundledAirports.records.find((r) => r.faaId === faaId);
  assert(found !== undefined, `expected to find ${faaId}`);
  return found;
}

function allFrequencies(): { airport: Airport; frequency: AirportFrequency }[] {
  return usBundledAirports.records.flatMap((apt) =>
    apt.frequencies.map((frequency) => ({ airport: apt, frequency })),
  );
}

function allRunwayEnds(): RunwayEnd[] {
  return usBundledAirports.records.flatMap((apt) => apt.runways.flatMap((rwy) => rwy.ends));
}

/** Frequency bands the FAA publishes for airport communications, in MHz. */
function inPublishedBand(frequencyMhz: number): boolean {
  const hf = frequencyMhz >= 2 && frequencyMhz < 30;
  const vhfFm = frequencyMhz >= 30 && frequencyMhz < 108;
  const vhf = frequencyMhz >= 108 && frequencyMhz <= 137;
  const militaryVhf = frequencyMhz > 137 && frequencyMhz < 225;
  const uhf = frequencyMhz >= 225 && frequencyMhz <= 400;
  return hf || vhfFm || vhf || militaryVhf || uhf;
}

describe('usBundledAirports', () => {
  it('loads with a reasonable number of records', () => {
    assert(usBundledAirports.records.length > 15_000);
  });

  it('has metadata with generatedAt, nasrCycleDate, and recordCount', () => {
    assert(usBundledAirports.properties.generatedAt.length > 0);
    assert(usBundledAirports.properties.nasrCycleDate.length > 0);
    expect(usBundledAirports.properties.nasrCycleDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(usBundledAirports.properties.recordCount).toBe(usBundledAirports.records.length);
  });

  it('contains records with the expected required fields', () => {
    for (const apt of usBundledAirports.records) {
      expect(typeof apt.faaId).toBe('string');
      expect(typeof apt.name).toBe('string');
      expect(typeof apt.facilityType).toBe('string');
      expect(typeof apt.ownershipType).toBe('string');
      expect(typeof apt.useType).toBe('string');
      expect(typeof apt.status).toBe('string');
      expect(typeof apt.city).toBe('string');
      expect(typeof apt.country).toBe('string');
      expect(typeof apt.lat).toBe('number');
      expect(typeof apt.lon).toBe('number');
      expect(typeof apt.timezone).toBe('string');
      assert(apt.timezone.length > 0);
      expect(typeof apt.elevationFt).toBe('number');
      assert(Array.isArray(apt.runways));
      assert(Array.isArray(apt.frequencies));
    }
  });

  it('carries the ARTCC, county and tower type the FAA publishes on every record', () => {
    for (const apt of usBundledAirports.records) {
      assert(apt.artccId !== undefined, `${apt.faaId} has no ARTCC`);
      assert(apt.county !== undefined, `${apt.faaId} has no county`);
      assert(apt.towerType !== undefined, `${apt.faaId} has no tower type`);
    }
  });

  it('populates an IANA timezone on every record', () => {
    for (const apt of usBundledAirports.records) {
      assert(
        /^[A-Za-z_]+\/[A-Za-z_/+-]+$|^UTC$|^Etc\//.test(apt.timezone),
        `${apt.faaId}: unexpected timezone ${apt.timezone}`,
      );
    }
  });

  it('resolves expected IANA timezones for well-known airports', () => {
    expect(airport('JFK').timezone).toBe('America/New_York');
    expect(airport('LAX').timezone).toBe('America/Los_Angeles');
    expect(airport('ORD').timezone).toBe('America/Chicago');
    expect(airport('DEN').timezone).toBe('America/Denver');
    expect(airport('HNL').timezone).toBe('Pacific/Honolulu');
    expect(airport('ANC').timezone).toBe('America/Anchorage');
  });

  it('resolves expected IANA timezones for US territories and foreign airports', () => {
    expect(airport('SJU').timezone).toBe('America/Puerto_Rico');
    expect(airport('GUM').timezone).toBe('Pacific/Guam');
    const canadian = usBundledAirports.records.find((r) => r.country === 'CA');
    assert(canadian !== undefined, 'expected a Canadian facility');
    assert(canadian.timezone.startsWith('America/'), `unexpected timezone ${canadian.timezone}`);
  });

  it('populates state for US facilities', () => {
    const us = usBundledAirports.records.filter((r) => r.country === 'US');
    const withState = us.filter((r) => r.state !== undefined);
    assert(
      withState.length / us.length > 0.99,
      'expected nearly every US facility to carry a state',
    );
  });

  it('includes foreign facilities that the FAA publishes (e.g. Canadian airports)', () => {
    const countries = new Set(usBundledAirports.records.map((r) => r.country));
    assert(countries.has('CA'), 'expected Canadian facilities');
    assert(countries.size > 2, 'expected more than US and Canada');
  });

  it('contains records with optional fields populated', () => {
    const withIcao = usBundledAirports.records.find((r) => r.icao !== undefined);
    assert(withIcao !== undefined);
    assert(withIcao.icao !== undefined);
    assert(withIcao.icao.startsWith('K'));

    const withFuel = usBundledAirports.records.find((r) => r.fuelTypes !== undefined);
    assert(withFuel !== undefined);
    expect(typeof withFuel.fuelTypes).toBe('string');
  });

  it('publishes the traffic pattern altitude above the field', () => {
    const published = usBundledAirports.records.filter(
      (r) => r.trafficPatternAltitudeFtAgl !== undefined,
    );
    assert(
      published.length > 400,
      `expected the published pattern altitudes, found ${published.length}`,
    );
    const belowField = published.filter(
      (r) =>
        r.trafficPatternAltitudeFtAgl !== undefined &&
        r.trafficPatternAltitudeFtAgl < r.elevationFt,
    );
    assert(
      belowField.length > 100,
      'expected many AGL pattern altitudes below the field elevation',
    );
    const bxk = airport('BXK');
    expect(bxk.trafficPatternAltitudeFtAgl).toBe(976);
    assert(
      bxk.elevationFt > 976,
      'expected the BXK pattern altitude to lie below its field elevation',
    );
  });

  it('includes all facility types', () => {
    const types = new Set(usBundledAirports.records.map((r) => r.facilityType));
    assert(types.has('AIRPORT'));
    assert(types.has('HELIPORT'));
    assert(types.has('SEAPLANE_BASE'));
  });

  it('only contains open facilities', () => {
    const allOpen = usBundledAirports.records.every((r) => r.status === 'OPEN');
    assert(allOpen);
  });

  it('can look up a known airport by ICAO code', () => {
    const jfk = usBundledAirports.records.find((r) => r.icao === 'KJFK');
    assert(jfk !== undefined);
    expect(jfk.faaId).toBe('JFK');
    expect(jfk.name).toBe('JOHN F KENNEDY INTL');
    expect(jfk.state).toBe('NY');
    expect(jfk.facilityType).toBe('AIRPORT');
    assert(jfk.runways.length >= 4);
    assert(jfk.frequencies.length > 0);
  });

  it('has runways with expected structure', () => {
    const jfk = airport('JFK');
    const rwy = jfk.runways[0];
    assert(rwy !== undefined);
    expect(typeof rwy.id).toBe('string');
    assert(rwy.lengthFt !== undefined);
    assert(rwy.widthFt !== undefined);
    assert(rwy.lengthFt > 0);
    assert(rwy.widthFt > 0);
    assert(rwy.ends.length === 2);
  });

  it('leaves a runway length or width unset rather than zero where the FAA publishes none', () => {
    let missingLength = 0;
    for (const apt of usBundledAirports.records) {
      for (const rwy of apt.runways) {
        assert(
          rwy.lengthFt === undefined || rwy.lengthFt > 0,
          `${apt.faaId} ${rwy.id}: zero length`,
        );
        assert(rwy.widthFt === undefined || rwy.widthFt > 0, `${apt.faaId} ${rwy.id}: zero width`);
        if (rwy.lengthFt === undefined) {
          missingLength += 1;
        }
      }
    }
    assert(
      missingLength < 20,
      `expected only the handful of unpublished lengths, found ${missingLength}`,
    );
  });

  it('carries the published pavement classification on rated runways', () => {
    const rated = usBundledAirports.records.flatMap((apt) =>
      apt.runways.filter((rwy) => rwy.pavementClassification !== undefined),
    );
    assert(rated.length > 1000, `expected the rated runways, found ${rated.length}`);
    const systems = new Set(rated.map((rwy) => rwy.pavementClassification?.system));
    assert(systems.has('PCN') && systems.has('PCR'), 'expected both rating systems');
    for (const rwy of rated) {
      const rating = rwy.pavementClassification;
      assert(rating !== undefined);
      assert(rating.value > 0, `${rwy.id}: rating value ${rating.value}`);
    }
    const anb = airport('ANB').runways.find((rwy) => rwy.id === '05/23');
    expect(anb?.pavementClassification).toEqual({
      system: 'PCN',
      value: 10,
      pavementType: 'FLEXIBLE',
      subgradeStrength: 'C',
      tirePressure: 'X',
      evaluationMethod: 'TECHNICAL',
    });
  });

  it('has runway ends with expected structure', () => {
    const rwy = airport('JFK').runways[0];
    assert(rwy !== undefined);
    const end = rwy.ends[0];
    assert(end !== undefined);
    expect(typeof end.id).toBe('string');
    assert(end.trueHeadingDeg !== undefined);
    assert(end.trueHeadingDeg >= 0 && end.trueHeadingDeg <= 360);
    expect(typeof end.lat).toBe('number');
    expect(typeof end.lon).toBe('number');
  });

  it('records where RVR is measured on the ends that have it', () => {
    const withRvr = allRunwayEnds().filter((end) => end.hasRvr === true);
    assert(withRvr.length > 900, `expected the RVR-equipped ends, found ${withRvr.length}`);
    for (const end of withRvr) {
      assert(
        end.rvrLocations !== undefined && end.rvrLocations.length > 0,
        `${end.id}: RVR without locations`,
      );
    }
    for (const end of allRunwayEnds()) {
      if (end.rvrLocations !== undefined) {
        expect(end.hasRvr).toBe(true);
      }
    }
  });

  it('has frequencies with expected structure and in a published band', () => {
    const frequencies = allFrequencies();
    assert(
      frequencies.length > 30_000,
      `expected the airport frequencies, found ${frequencies.length}`,
    );
    for (const { airport: apt, frequency } of frequencies) {
      expect(typeof frequency.use).toBe('string');
      assert(
        inPublishedBand(frequency.frequencyMhz),
        `${apt.faaId}: ${frequency.frequencyMhz} MHz ${frequency.use} is outside every published band`,
      );
      assert(
        frequency.provider !== undefined && frequency.providerType !== undefined,
        `${apt.faaId}: frequency without a provider`,
      );
    }
  });

  it('attaches no navaid frequencies to airports', () => {
    for (const { airport: apt, frequency } of allFrequencies()) {
      assert(
        !/\b(VOR|VORTAC|VOR\/DME|TACAN|NDB|NDB\/DME|DME|VOT)$/.test(frequency.use),
        `${apt.faaId}: navaid frequency ${frequency.use}`,
      );
    }
    expect(airport('AAA').frequencies.map((f) => f.use)).not.toContain('AAA NDB');
  });

  it('converts HF frequencies to MHz and keeps the qualifiers', () => {
    const hf = allFrequencies().filter(({ frequency }) => frequency.frequencyMhz < 30);
    assert(hf.length > 50, `expected the HF frequencies, found ${hf.length}`);
    const mob = airport('MOB').frequencies.filter((f) => f.use === 'CG OPS');
    expect(mob.map((f) => f.frequencyMhz).sort((a, b) => a - b)).toEqual([3.123, 5.696, 8.984]);
    const receiveOnly = allFrequencies().filter(({ frequency }) => frequency.receiveOnly === true);
    assert(
      receiveOnly.length >= 5,
      `expected the receive-only RCO frequencies, found ${receiveOnly.length}`,
    );
    expect(airport('ABR').frequencies.find((f) => f.receiveOnly)?.frequencyMhz).toBe(122.1);
    const onRequest = allFrequencies().filter(({ frequency }) => frequency.onRequest === true);
    assert(onRequest.length >= 1, 'expected the on-request HF frequencies');
  });

  it('carries the providing facility, call signs and remarks', () => {
    const frequencies = allFrequencies();
    const withCallSign = frequencies.filter(({ frequency }) => frequency.callSign !== undefined);
    assert(withCallSign.length > 10_000, `expected call signs, found ${withCallSign.length}`);
    const withRemark = frequencies.filter(({ frequency }) => frequency.remark !== undefined);
    assert(withRemark.length > 5_000, `expected remarks, found ${withRemark.length}`);
    const providerTypes = new Set(frequencies.map(({ frequency }) => frequency.providerType));
    for (const type of ['ATCT', 'TRACON', 'RCAG', 'NON-ATCT', 'ASOS_AWOS', 'RCO', 'FSS']) {
      assert(providerTypes.has(type), `expected provider type ${type}`);
    }
    const jfkAtis = airport('JFK').frequencies.find((f) => f.use === 'D-ATIS');
    expect(jfkAtis?.providerType).toBe('ATCT');
    expect(jfkAtis?.callSign).toBe('KENNEDY');
    expect(jfkAtis?.approachCallSign).toBe('NEW YORK');
  });

  it('publishes each frequency of an airport once', () => {
    for (const apt of usBundledAirports.records) {
      const keys = new Set(apt.frequencies.map((f) => JSON.stringify(f)));
      expect(keys.size).toBe(apt.frequencies.length);
    }
  });

  it('has a reasonable number of runway ends with ILS data', () => {
    const ilsCount = allRunwayEnds().filter((end) => end.ils !== undefined).length;
    assert(ilsCount > 1000, `expected >1000 ILS systems, got ${ilsCount}`);
  });

  it('has ILS data with expected structure on JFK runway ends', () => {
    const ilsEnds: { id: string; ils: IlsSystem }[] = [];
    for (const rwy of airport('JFK').runways) {
      for (const end of rwy.ends) {
        if (end.ils) {
          ilsEnds.push({ id: end.id, ils: end.ils });
        }
      }
    }

    assert(
      ilsEnds.length >= 4,
      `expected JFK to have >=4 ILS-equipped runway ends, got ${ilsEnds.length}`,
    );

    for (const { ils } of ilsEnds) {
      expect(typeof ils.systemType).toBe('string');
      assert(ils.systemType.length > 0);
      assert(ils.identifier.startsWith('I-'), `unexpected ILS identifier ${ils.identifier}`);
      assert(
        ils.localizerFrequencyMhz >= 108 && ils.localizerFrequencyMhz <= 112,
        `localizer frequency ${ils.localizerFrequencyMhz} outside 108-112 MHz range`,
      );
      assert(ils.localizerMagneticCourseDeg >= 0 && ils.localizerMagneticCourseDeg <= 360);
    }
  });

  it('has ILS systems across multiple system types', () => {
    const types = new Set<string>();
    for (const end of allRunwayEnds()) {
      if (end.ils) {
        types.add(end.ils.systemType);
      }
    }
    assert(types.has('ILS'), 'expected ILS system type');
    assert(types.has('ILS/DME'), 'expected ILS/DME system type');
    assert(types.has('LOCALIZER'), 'expected LOCALIZER system type');
    assert(types.has('LOC/DME'), 'expected LOC/DME system type');
  });

  it('has ILS with glide slope data where expected', () => {
    let ilsWithGs = 0;
    let ilsDmeWithGs = 0;
    for (const end of allRunwayEnds()) {
      if (end.ils && end.ils.glideSlopeAngleDeg !== undefined) {
        if (end.ils.systemType === 'ILS') {
          ilsWithGs++;
        } else if (end.ils.systemType === 'ILS/DME') {
          ilsDmeWithGs++;
        }
      }
    }
    assert(ilsWithGs > 100, `expected >100 ILS with glide slope, got ${ilsWithGs}`);
    assert(ilsDmeWithGs > 100, `expected >100 ILS/DME with glide slope, got ${ilsDmeWithGs}`);
  });

  it('has ILS with DME channel data where expected', () => {
    const ilsDmeWithChannel = allRunwayEnds().filter(
      (end) => end.ils?.systemType === 'ILS/DME' && end.ils.dmeChannel !== undefined,
    ).length;
    assert(
      ilsDmeWithChannel > 100,
      `expected >100 ILS/DME with DME channel, got ${ilsDmeWithChannel}`,
    );
  });
});
