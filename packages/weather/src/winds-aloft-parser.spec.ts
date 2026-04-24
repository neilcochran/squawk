import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getLevelAtFt, parseWindsAloft } from './winds-aloft-parser.js';

// Reference data - selected rows from reference-data/weather/winds-aloft/basic-conus-low.txt
const BASIC_CONUS_LOW = [
  '(Extracted from FBUS31 KWNO 241359)',
  'FD1US1',
  'DATA BASED ON 241200Z',
  'VALID 241800Z   FOR USE 1400-2100Z. TEMPS NEG ABV 24000',
  '',
  'FT  3000    6000    9000   12000   18000   24000  30000  34000  39000',
  'BDL 3509 3521-03 3340-04 3352-08 3275-17 3281-30 327245 325952 324956',
  'EMI 9900 3221+09 3223+02 3025-04 3028-16 3237-27 324841 325152 315564',
  'PSB      3123+09 3025+01 2925-04 3125-16 3238-27 335142 335252 325864',
].join('\n');

// Reference data - selected row from reference-data/weather/winds-aloft/alaska-low.txt.
// Station 5AF exercises light-and-variable winds with both explicit and
// implicit-negative temperature encodings (9900-30 and 990047).
const ALASKA_LIGHT_AND_VAR_WITH_TEMP = [
  '000',
  'FBAK31 KWNO 241359',
  'FD1AK1',
  'DATA BASED ON 241200Z',
  'VALID 241800Z   FOR USE 1400-2100Z. TEMPS NEG ABV 24000',
  '',
  'FT  3000    6000    9000   12000   18000   24000  30000  34000  39000',
  '5AF 2611 2512+03 2511-02 2306-07 1306-20 9900-30 990047 070857 351068',
].join('\n');

// Reference data - selected rows from reference-data/weather/winds-aloft/high-level.txt
const HIGH_LEVEL = [
  '(Extracted from FBUS38 KWNO 241359)',
  'FD9US8',
  'DATA BASED ON 241200Z',
  'VALID 250000Z   FOR USE 2100-0600Z. TEMPS NEG ABV 24000',
  '',
  'FT   45000  53000',
  'CAR 352449 021754',
  'EMI 312161 322661',
].join('\n');

describe('parseWindsAloft - preamble and metadata', () => {
  it('captures AWC "(Extracted from ...)" form as wmoHeader', () => {
    const forecast = parseWindsAloft(BASIC_CONUS_LOW);
    assert.equal(forecast.wmoHeader, 'FBUS31 KWNO 241359');
  });

  it('captures plain WMO header form as wmoHeader', () => {
    const forecast = parseWindsAloft(ALASKA_LIGHT_AND_VAR_WITH_TEMP);
    assert.equal(forecast.wmoHeader, 'FBAK31 KWNO 241359');
  });

  it('captures FD product code', () => {
    const forecast = parseWindsAloft(BASIC_CONUS_LOW);
    assert.equal(forecast.productCode, 'FD1US1');
  });

  it('parses bulletins that omit the WMO / product-code preamble', () => {
    const raw = [
      'DATA BASED ON 241200Z',
      'VALID 241800Z   FOR USE 1400-2100Z. TEMPS NEG ABV 24000',
      '',
      'FT  3000',
      'BDL 3509',
    ].join('\n');
    const forecast = parseWindsAloft(raw);
    assert.equal(forecast.wmoHeader, undefined);
    assert.equal(forecast.productCode, undefined);
    assert.deepEqual(forecast.basedOn, { day: 24, hour: 12, minute: 0 });
  });

  it('parses the DATA BASED ON time', () => {
    const forecast = parseWindsAloft(BASIC_CONUS_LOW);
    assert.deepEqual(forecast.basedOn, { day: 24, hour: 12, minute: 0 });
  });

  it('parses the VALID time and usable period', () => {
    const forecast = parseWindsAloft(BASIC_CONUS_LOW);
    assert.deepEqual(forecast.validAt, { day: 24, hour: 18, minute: 0 });
    assert.deepEqual(forecast.useFrom, { hour: 14, minute: 0 });
    assert.deepEqual(forecast.useTo, { hour: 21, minute: 0 });
  });

  it('retains non-zero minutes in the usable period when present', () => {
    const raw = [
      'DATA BASED ON 241200Z',
      'VALID 241800Z   FOR USE 1430-2045Z. TEMPS NEG ABV 24000',
      '',
      'FT  3000',
      'BDL 3509',
    ].join('\n');
    const forecast = parseWindsAloft(raw);
    assert.deepEqual(forecast.useFrom, { hour: 14, minute: 30 });
    assert.deepEqual(forecast.useTo, { hour: 20, minute: 45 });
  });

  it('parses the TEMPS NEG ABV altitude threshold', () => {
    const forecast = parseWindsAloft(BASIC_CONUS_LOW);
    assert.equal(forecast.negativeTempsAboveFt, 24000);
  });

  it('preserves the original raw text', () => {
    const forecast = parseWindsAloft(BASIC_CONUS_LOW);
    assert.equal(forecast.raw, BASIC_CONUS_LOW);
  });
});

describe('parseWindsAloft - FT altitude header', () => {
  it('reads a low-level 9-column altitude header', () => {
    const forecast = parseWindsAloft(BASIC_CONUS_LOW);
    assert.deepEqual(
      forecast.altitudesFt,
      [3000, 6000, 9000, 12000, 18000, 24000, 30000, 34000, 39000],
    );
  });

  it('reads a high-level 2-column altitude header', () => {
    const forecast = parseWindsAloft(HIGH_LEVEL);
    assert.deepEqual(forecast.altitudesFt, [45000, 53000]);
  });
});

describe('parseWindsAloft - wind decoding', () => {
  it('decodes a normal wind with no temperature (below 5000 ft)', () => {
    const forecast = parseWindsAloft(BASIC_CONUS_LOW);
    const level = forecast.stations[0]!.levels[0]!;
    assert.equal(level.altitudeFt, 3000);
    assert.equal(level.isMissing, false);
    assert.equal(level.isLightAndVariable, false);
    assert.equal(level.directionDeg, 350);
    assert.equal(level.speedKt, 9);
    assert.equal(level.temperatureC, undefined);
  });

  it('decodes a normal wind with explicit-sign positive temperature', () => {
    const forecast = parseWindsAloft(BASIC_CONUS_LOW);
    const emi = forecast.stations.find((s) => s.stationId === 'EMI')!;
    const level = emi.levels[1]!;
    assert.equal(level.altitudeFt, 6000);
    assert.equal(level.directionDeg, 320);
    assert.equal(level.speedKt, 21);
    assert.equal(level.temperatureC, 9);
  });

  it('decodes a normal wind with explicit-sign negative temperature', () => {
    const forecast = parseWindsAloft(BASIC_CONUS_LOW);
    const bdl = forecast.stations[0]!;
    const level = bdl.levels[4]!;
    assert.equal(level.altitudeFt, 18000);
    assert.equal(level.directionDeg, 320);
    assert.equal(level.speedKt, 75);
    assert.equal(level.temperatureC, -17);
  });

  it('decodes implicit-negative temperature above the TEMPS NEG ABV threshold', () => {
    const forecast = parseWindsAloft(BASIC_CONUS_LOW);
    const bdl = forecast.stations[0]!;
    const level = bdl.levels[6]!;
    assert.equal(level.altitudeFt, 30000);
    assert.equal(level.directionDeg, 320);
    assert.equal(level.speedKt, 72);
    assert.equal(level.temperatureC, -45);
  });

  it('decodes high-speed wind encoding (direction code 51-86)', () => {
    const raw = [
      'DATA BASED ON 241200Z',
      'VALID 241800Z   FOR USE 1400-2100Z. TEMPS NEG ABV 24000',
      '',
      'FT  30000',
      'ABC 7347',
    ].join('\n');
    const forecast = parseWindsAloft(raw);
    const level = forecast.stations[0]!.levels[0]!;
    assert.equal(level.directionDeg, 230);
    assert.equal(level.speedKt, 147);
  });

  it('decodes high-speed wind at the low end of the range (51 -> 10deg, 100 kt)', () => {
    const raw = [
      'DATA BASED ON 241200Z',
      'VALID 241800Z   FOR USE 1400-2100Z. TEMPS NEG ABV 24000',
      '',
      'FT  30000',
      'ABC 5100',
    ].join('\n');
    const forecast = parseWindsAloft(raw);
    const level = forecast.stations[0]!.levels[0]!;
    assert.equal(level.directionDeg, 10);
    assert.equal(level.speedKt, 100);
  });

  it('decodes high-speed wind at the high end of the range (86 -> 360deg)', () => {
    const raw = [
      'DATA BASED ON 241200Z',
      'VALID 241800Z   FOR USE 1400-2100Z. TEMPS NEG ABV 24000',
      '',
      'FT  30000',
      'ABC 8625',
    ].join('\n');
    const forecast = parseWindsAloft(raw);
    const level = forecast.stations[0]!.levels[0]!;
    assert.equal(level.directionDeg, 360);
    assert.equal(level.speedKt, 125);
  });
});

describe('parseWindsAloft - light and variable', () => {
  it('decodes 9900 as light-and-variable with no direction/speed', () => {
    const forecast = parseWindsAloft(BASIC_CONUS_LOW);
    const emi = forecast.stations.find((s) => s.stationId === 'EMI')!;
    const level = emi.levels[0]!;
    assert.equal(level.isLightAndVariable, true);
    assert.equal(level.directionDeg, undefined);
    assert.equal(level.speedKt, undefined);
    assert.equal(level.temperatureC, undefined);
  });

  it('decodes 9900 with explicit-sign temperature (e.g. "9900-30")', () => {
    const forecast = parseWindsAloft(ALASKA_LIGHT_AND_VAR_WITH_TEMP);
    const level = forecast.stations[0]!.levels[5]!;
    assert.equal(level.altitudeFt, 24000);
    assert.equal(level.isLightAndVariable, true);
    assert.equal(level.directionDeg, undefined);
    assert.equal(level.speedKt, undefined);
    assert.equal(level.temperatureC, -30);
  });

  it('decodes 9900 with implicit-negative temperature (e.g. "990047")', () => {
    const forecast = parseWindsAloft(ALASKA_LIGHT_AND_VAR_WITH_TEMP);
    const level = forecast.stations[0]!.levels[6]!;
    assert.equal(level.altitudeFt, 30000);
    assert.equal(level.isLightAndVariable, true);
    assert.equal(level.temperatureC, -47);
  });
});

describe('parseWindsAloft - missing columns', () => {
  it('marks a blank column as missing with no wind or temp values', () => {
    const forecast = parseWindsAloft(BASIC_CONUS_LOW);
    const psb = forecast.stations.find((s) => s.stationId === 'PSB')!;
    const level = psb.levels[0]!;
    assert.equal(level.altitudeFt, 3000);
    assert.equal(level.isMissing, true);
    assert.equal(level.isLightAndVariable, false);
    assert.equal(level.directionDeg, undefined);
    assert.equal(level.speedKt, undefined);
    assert.equal(level.temperatureC, undefined);
  });

  it('still decodes later non-blank columns correctly when the first is missing', () => {
    const forecast = parseWindsAloft(BASIC_CONUS_LOW);
    const psb = forecast.stations.find((s) => s.stationId === 'PSB')!;
    assert.equal(psb.levels[1]!.altitudeFt, 6000);
    assert.equal(psb.levels[1]!.directionDeg, 310);
    assert.equal(psb.levels[1]!.speedKt, 23);
    assert.equal(psb.levels[1]!.temperatureC, 9);
  });
});

describe('parseWindsAloft - stations', () => {
  it('parses stations in input order', () => {
    const forecast = parseWindsAloft(BASIC_CONUS_LOW);
    assert.deepEqual(
      forecast.stations.map((s) => s.stationId),
      ['BDL', 'EMI', 'PSB'],
    );
  });

  it('aligns each station level array with the altitude header', () => {
    const forecast = parseWindsAloft(BASIC_CONUS_LOW);
    for (const station of forecast.stations) {
      assert.equal(station.levels.length, forecast.altitudesFt.length);
      for (let i = 0; i < station.levels.length; i++) {
        assert.equal(station.levels[i]!.altitudeFt, forecast.altitudesFt[i]);
      }
    }
  });

  it('accepts alphanumeric station IDs (e.g. Alaska "5AF")', () => {
    const forecast = parseWindsAloft(ALASKA_LIGHT_AND_VAR_WITH_TEMP);
    assert.equal(forecast.stations[0]!.stationId, '5AF');
  });
});

describe('parseWindsAloft - high-level bulletins', () => {
  it('parses 6-character entries with implicit-negative temperatures', () => {
    const forecast = parseWindsAloft(HIGH_LEVEL);
    const car = forecast.stations.find((s) => s.stationId === 'CAR')!;
    assert.equal(car.levels[0]!.altitudeFt, 45000);
    assert.equal(car.levels[0]!.directionDeg, 350);
    assert.equal(car.levels[0]!.speedKt, 24);
    assert.equal(car.levels[0]!.temperatureC, -49);
    assert.equal(car.levels[1]!.altitudeFt, 53000);
    assert.equal(car.levels[1]!.directionDeg, 20);
    assert.equal(car.levels[1]!.speedKt, 17);
    assert.equal(car.levels[1]!.temperatureC, -54);
  });
});

describe('parseWindsAloft - malformed input', () => {
  it('throws when "DATA BASED ON" is missing', () => {
    const raw = [
      '(Extracted from FBUS31 KWNO 241359)',
      'FD1US1',
      'VALID 241800Z   FOR USE 1400-2100Z. TEMPS NEG ABV 24000',
      'FT  3000',
      'BDL 3509',
    ].join('\n');
    assert.throws(() => parseWindsAloft(raw), /DATA BASED ON/);
  });

  it('throws when "VALID" is missing', () => {
    const raw = ['DATA BASED ON 241200Z', 'FT  3000', 'BDL 3509'].join('\n');
    assert.throws(() => parseWindsAloft(raw), /VALID/);
  });

  it('throws when "FT" altitude header is missing', () => {
    const raw = [
      'DATA BASED ON 241200Z',
      'VALID 241800Z   FOR USE 1400-2100Z. TEMPS NEG ABV 24000',
    ].join('\n');
    assert.throws(() => parseWindsAloft(raw), /FT/);
  });

  it('throws when a wind direction code is out of range (e.g. DD=40)', () => {
    const raw = [
      'DATA BASED ON 241200Z',
      'VALID 241800Z   FOR USE 1400-2100Z. TEMPS NEG ABV 24000',
      '',
      'FT  3000',
      'ABC 4010',
    ].join('\n');
    assert.throws(() => parseWindsAloft(raw), /invalid wind direction/);
  });

  it('includes the offending station ID in the thrown error message', () => {
    const raw = [
      'DATA BASED ON 241200Z',
      'VALID 241800Z   FOR USE 1400-2100Z. TEMPS NEG ABV 24000',
      '',
      'FT  3000',
      'ABC 4010',
    ].join('\n');
    assert.throws(() => parseWindsAloft(raw), /station ABC/);
  });

  it('throws when a wind code is non-numeric', () => {
    const raw = [
      'DATA BASED ON 241200Z',
      'VALID 241800Z   FOR USE 1400-2100Z. TEMPS NEG ABV 24000',
      '',
      'FT  3000',
      'ABC XXXX',
    ].join('\n');
    assert.throws(() => parseWindsAloft(raw), /non-numeric/);
  });
});

describe('parseWindsAloft - temperature edge cases', () => {
  it('decodes an explicit zero temperature ("+00")', () => {
    const raw = [
      'DATA BASED ON 241200Z',
      'VALID 241800Z   FOR USE 1400-2100Z. TEMPS NEG ABV 24000',
      '',
      'FT  3000    6000',
      'ABC 2712 2720+00',
    ].join('\n');
    const forecast = parseWindsAloft(raw);
    const level = forecast.stations[0]!.levels[1]!;
    assert.equal(level.altitudeFt, 6000);
    assert.equal(level.temperatureC, 0);
  });

  it('treats 24000 ft as "at or below" the threshold - explicit sign is required', () => {
    const forecast = parseWindsAloft(BASIC_CONUS_LOW);
    const bdl = forecast.stations[0]!;
    const at24 = bdl.levels[5]!;
    const at30 = bdl.levels[6]!;
    // 24000 is not ABOVE the threshold - the sign is explicit, and -30 decodes as -30.
    assert.equal(at24.altitudeFt, 24000);
    assert.equal(at24.temperatureC, -30);
    // 30000 is above the threshold - the sign is implicit and 45 decodes as -45.
    assert.equal(at30.altitudeFt, 30000);
    assert.equal(at30.temperatureC, -45);
  });
});

describe('parseWindsAloft - truncated rows', () => {
  it('fills missing trailing columns with isMissing: true when a row is truncated', () => {
    // Row has entries for the first two columns only; the FT header declares three.
    // By design the parser does not throw - trailing columns just decode as missing.
    const raw = [
      'DATA BASED ON 241200Z',
      'VALID 241800Z   FOR USE 1400-2100Z. TEMPS NEG ABV 24000',
      '',
      'FT  3000    6000    9000',
      'BDL 3509 3521-03',
    ].join('\n');
    const forecast = parseWindsAloft(raw);
    const bdl = forecast.stations[0]!;
    assert.equal(bdl.levels.length, 3);
    assert.equal(bdl.levels[0]!.isMissing, false);
    assert.equal(bdl.levels[1]!.isMissing, false);
    assert.equal(bdl.levels[2]!.isMissing, true);
    assert.equal(bdl.levels[2]!.altitudeFt, 9000);
  });
});

describe('getLevelAtFt', () => {
  it('returns the matching level for a known altitude', () => {
    const forecast = parseWindsAloft(BASIC_CONUS_LOW);
    const level = getLevelAtFt(forecast.stations[0]!, 9000);
    assert.ok(level, 'expected a level at 9000 ft');
    assert.equal(level.altitudeFt, 9000);
    assert.equal(level.directionDeg, 330);
    assert.equal(level.speedKt, 40);
  });

  it('returns undefined when the altitude is not a column in the bulletin', () => {
    const forecast = parseWindsAloft(BASIC_CONUS_LOW);
    assert.equal(getLevelAtFt(forecast.stations[0]!, 10000), undefined);
  });

  it('returns a missing-flagged level when the station has a blank column at the altitude', () => {
    // PSB has a blank 3000 ft column in the sample bulletin. getLevelAtFt
    // still returns the level - it is flagged isMissing rather than missing
    // from the array.
    const forecast = parseWindsAloft(BASIC_CONUS_LOW);
    const psb = forecast.stations.find((s) => s.stationId === 'PSB')!;
    const level = getLevelAtFt(psb, 3000);
    assert.ok(level, 'expected a level at 3000 ft for PSB even though the column is blank');
    assert.equal(level.isMissing, true);
    assert.equal(level.directionDeg, undefined);
    assert.equal(level.speedKt, undefined);
    assert.equal(level.temperatureC, undefined);
  });
});
