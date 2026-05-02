import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { close } from './test-utils.js';
import { planning } from './index.js';

describe('fuelRequired', () => {
  it('computes fuel for a known leg', () => {
    // 300 nm at 120 kt GS burning 10 gal/hr = 2.5 hrs * 10 = 25 gal.
    const fuel = planning.fuelRequired(300, 120, 10);
    assert.ok(close(fuel, 25, 0.001), `expected 25, got ${fuel}`);
  });

  it('returns zero for zero distance', () => {
    assert.ok(close(planning.fuelRequired(0, 120, 10), 0, 0.001));
  });

  it('scales linearly with distance', () => {
    const short = planning.fuelRequired(100, 120, 10);
    const long = planning.fuelRequired(200, 120, 10);
    assert.ok(close(long, short * 2, 0.001), `expected ${short * 2}, got ${long}`);
  });

  it('scales linearly with burn rate', () => {
    const lowBurn = planning.fuelRequired(300, 120, 8);
    const highBurn = planning.fuelRequired(300, 120, 16);
    assert.ok(close(highBurn, lowBurn * 2, 0.001), `expected ${lowBurn * 2}, got ${highBurn}`);
  });

  it('increases when ground speed decreases (more time aloft)', () => {
    const fast = planning.fuelRequired(300, 150, 10);
    const slow = planning.fuelRequired(300, 100, 10);
    assert.ok(slow > fast, `expected slow GS (${slow}) > fast GS (${fast})`);
  });
});

describe('endurance', () => {
  it('computes endurance for known values', () => {
    // 50 gal at 10 gal/hr = 5 hrs.
    const hrs = planning.endurance(50, 10);
    assert.ok(close(hrs, 5, 0.001), `expected 5, got ${hrs}`);
  });

  it('returns zero for zero fuel', () => {
    assert.ok(close(planning.endurance(0, 10), 0, 0.001));
  });

  it('doubles when fuel doubles', () => {
    const half = planning.endurance(25, 10);
    const full = planning.endurance(50, 10);
    assert.ok(close(full, half * 2, 0.001), `expected ${half * 2}, got ${full}`);
  });
});

describe('enduranceDistanceNm', () => {
  it('computes range for known values', () => {
    // 50 gal at 10 gal/hr at 120 kt = 5 hrs * 120 = 600 nm.
    const range = planning.enduranceDistanceNm(50, 10, 120);
    assert.ok(close(range, 600, 0.001), `expected 600, got ${range}`);
  });

  it('returns zero for zero fuel', () => {
    assert.ok(close(planning.enduranceDistanceNm(0, 10, 120), 0, 0.001));
  });

  it('increases with higher ground speed', () => {
    const slow = planning.enduranceDistanceNm(50, 10, 100);
    const fast = planning.enduranceDistanceNm(50, 10, 150);
    assert.ok(fast > slow, `expected fast (${fast}) > slow (${slow})`);
  });

  it('equals endurance multiplied by ground speed', () => {
    const fuel = 45;
    const burn = 9;
    const gs = 135;
    const range = planning.enduranceDistanceNm(fuel, burn, gs);
    const expected = planning.endurance(fuel, burn) * gs;
    assert.ok(close(range, expected, 0.001), `expected ${expected}, got ${range}`);
  });
});

describe('pointOfNoReturn', () => {
  it('computes PNR with no wind (symmetric ground speed)', () => {
    // 50 gal, 10 gal/hr, 120 kt both ways.
    // Endurance = 5 hrs. PNR = 5 * (120*120)/(120+120) = 5 * 60 = 300 nm.
    // Time = 300/120 = 2.5 hrs.
    const pnr = planning.pointOfNoReturn(50, 10, 120, 120);
    assert.ok(close(pnr.distanceNm, 300, 0.001), `expected 300 nm, got ${pnr.distanceNm}`);
    assert.ok(close(pnr.timeHrs, 2.5, 0.001), `expected 2.5 hrs, got ${pnr.timeHrs}`);
  });

  it('shifts PNR farther out with a tailwind outbound (headwind return)', () => {
    // Tailwind outbound: GS out = 150, GS back = 90.
    // PNR = 5 * (150*90)/(150+90) = 5 * 56.25 = 281.25 nm.
    const noWind = planning.pointOfNoReturn(50, 10, 120, 120);
    const withWind = planning.pointOfNoReturn(50, 10, 150, 90);
    assert.ok(
      close(withWind.distanceNm, 281.25, 0.001),
      `expected 281.25, got ${withWind.distanceNm}`,
    );
    assert.ok(
      withWind.distanceNm < noWind.distanceNm,
      `expected PNR with wind (${withWind.distanceNm}) < no wind (${noWind.distanceNm})`,
    );
  });

  it('shifts PNR closer with a headwind outbound (tailwind return)', () => {
    // Headwind outbound: GS out = 90, GS back = 150.
    const noWind = planning.pointOfNoReturn(50, 10, 120, 120);
    const withWind = planning.pointOfNoReturn(50, 10, 90, 150);
    assert.ok(
      withWind.distanceNm < noWind.distanceNm,
      `expected PNR with headwind (${withWind.distanceNm}) < no wind (${noWind.distanceNm})`,
    );
  });

  it('returns zero distance and time for zero fuel', () => {
    const pnr = planning.pointOfNoReturn(0, 10, 120, 120);
    assert.ok(close(pnr.distanceNm, 0, 0.001), `expected 0, got ${pnr.distanceNm}`);
    assert.ok(close(pnr.timeHrs, 0, 0.001), `expected 0, got ${pnr.timeHrs}`);
  });

  it('time is consistent with distance and outbound speed', () => {
    const pnr = planning.pointOfNoReturn(40, 8, 130, 100);
    const expectedTime = pnr.distanceNm / 130;
    assert.ok(
      close(pnr.timeHrs, expectedTime, 0.0001),
      `expected ${expectedTime}, got ${pnr.timeHrs}`,
    );
  });

  it('round trip exactly exhausts endurance', () => {
    const fuel = 40;
    const burn = 8;
    const gsOut = 130;
    const gsBack = 100;
    const pnr = planning.pointOfNoReturn(fuel, burn, gsOut, gsBack);
    const timeOut = pnr.distanceNm / gsOut;
    const timeBack = pnr.distanceNm / gsBack;
    const enduranceHrs = planning.endurance(fuel, burn);
    assert.ok(
      close(timeOut + timeBack, enduranceHrs, 0.0001),
      `expected outbound + return (${timeOut + timeBack}) to equal endurance (${enduranceHrs})`,
    );
  });

  it('does not exceed endurance range', () => {
    const fuel = 50;
    const burn = 10;
    const gsOut = 150;
    const gsBack = 90;
    const pnr = planning.pointOfNoReturn(fuel, burn, gsOut, gsBack);
    const maxRange = planning.enduranceDistanceNm(fuel, burn, gsOut);
    assert.ok(
      pnr.distanceNm <= maxRange,
      `expected PNR (${pnr.distanceNm}) <= max range (${maxRange})`,
    );
  });
});

describe('equalTimePoint', () => {
  it('returns midpoint with no wind (symmetric ground speed)', () => {
    // 500 nm total, 120 kt both ways. ETP = 500 * 120/(120+120) = 250 nm.
    // Time = 250/120 = 2.083... hrs.
    const etp = planning.equalTimePoint(500, 120, 120);
    assert.ok(close(etp.distanceNm, 250, 0.001), `expected 250 nm, got ${etp.distanceNm}`);
    assert.ok(
      close(etp.timeHrs, 250 / 120, 0.001),
      `expected ${250 / 120} hrs, got ${etp.timeHrs}`,
    );
  });

  it('shifts ETP toward destination with headwind (faster return)', () => {
    // 500 nm, GS out = 90 (headwind), GS back = 150 (tailwind).
    // ETP = 500 * 150/(90+150) = 500 * 0.625 = 312.5 nm.
    const etp = planning.equalTimePoint(500, 90, 150);
    assert.ok(close(etp.distanceNm, 312.5, 0.001), `expected 312.5 nm, got ${etp.distanceNm}`);
    assert.ok(
      etp.distanceNm > 250,
      `expected ETP (${etp.distanceNm}) past midpoint with headwind outbound`,
    );
  });

  it('shifts ETP toward departure with tailwind (slower return)', () => {
    // 500 nm, GS out = 150 (tailwind), GS back = 90 (headwind).
    // ETP = 500 * 90/(150+90) = 500 * 0.375 = 187.5 nm.
    const etp = planning.equalTimePoint(500, 150, 90);
    assert.ok(close(etp.distanceNm, 187.5, 0.001), `expected 187.5 nm, got ${etp.distanceNm}`);
    assert.ok(
      etp.distanceNm < 250,
      `expected ETP (${etp.distanceNm}) before midpoint with tailwind outbound`,
    );
  });

  it('returns zero for zero total distance', () => {
    const etp = planning.equalTimePoint(0, 120, 120);
    assert.ok(close(etp.distanceNm, 0, 0.001), `expected 0, got ${etp.distanceNm}`);
    assert.ok(close(etp.timeHrs, 0, 0.001), `expected 0, got ${etp.timeHrs}`);
  });

  it('time is consistent with distance and outbound speed', () => {
    const etp = planning.equalTimePoint(600, 110, 140);
    const expectedTime = etp.distanceNm / 110;
    assert.ok(
      close(etp.timeHrs, expectedTime, 0.0001),
      `expected ${expectedTime}, got ${etp.timeHrs}`,
    );
  });

  it('time to continue equals time to return', () => {
    const total = 600;
    const gsOut = 110;
    const gsBack = 140;
    const etp = planning.equalTimePoint(total, gsOut, gsBack);
    const timeContinue = (total - etp.distanceNm) / gsOut;
    const timeReturn = etp.distanceNm / gsBack;
    assert.ok(
      close(timeContinue, timeReturn, 0.0001),
      `expected continue (${timeContinue}) to equal return (${timeReturn})`,
    );
  });

  it('does not exceed total distance', () => {
    const total = 500;
    const etp = planning.equalTimePoint(total, 90, 150);
    assert.ok(
      etp.distanceNm <= total,
      `expected ETP (${etp.distanceNm}) <= total distance (${total})`,
    );
  });
});
