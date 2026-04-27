import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isWindToken,
  parseWind,
  parseVisibility,
  isWeatherToken,
  parseWeatherPhenomenon,
  parseCloudLayer,
} from './weather-utils.js';

// ---------------------------------------------------------------------------
// isWindToken
// ---------------------------------------------------------------------------

describe('isWindToken', () => {
  it('accepts basic wind token', () => {
    assert.equal(isWindToken('21010KT'), true);
  });

  it('accepts calm wind', () => {
    assert.equal(isWindToken('00000KT'), true);
  });

  it('accepts gusty wind', () => {
    assert.equal(isWindToken('25015G30KT'), true);
  });

  it('accepts 3-digit speed', () => {
    assert.equal(isWindToken('22055G105KT'), true);
  });

  it('accepts VRB wind', () => {
    assert.equal(isWindToken('VRB04KT'), true);
  });

  it('rejects non-wind token', () => {
    assert.equal(isWindToken('10SM'), false);
    assert.equal(isWindToken('FEW250'), false);
    assert.equal(isWindToken('CAVOK'), false);
  });
});

// ---------------------------------------------------------------------------
// parseWind
// ---------------------------------------------------------------------------

describe('parseWind', () => {
  it('parses basic wind', () => {
    const wind = parseWind('21010KT');
    assert.equal(wind.directionDeg, 210);
    assert.equal(wind.speedKt, 10);
    assert.equal(wind.isVariable, false);
    assert.equal(wind.isCalm, false);
    assert.equal(wind.gustKt, undefined);
  });

  it('parses calm wind', () => {
    const wind = parseWind('00000KT');
    assert.equal(wind.isCalm, true);
    assert.equal(wind.speedKt, 0);
    assert.equal(wind.directionDeg, undefined);
  });

  it('parses gusty wind', () => {
    const wind = parseWind('25015G30KT');
    assert.equal(wind.directionDeg, 250);
    assert.equal(wind.speedKt, 15);
    assert.equal(wind.gustKt, 30);
  });

  it('parses extreme wind with 3-digit gusts', () => {
    const wind = parseWind('22055G105KT');
    assert.equal(wind.directionDeg, 220);
    assert.equal(wind.speedKt, 55);
    assert.equal(wind.gustKt, 105);
  });

  it('parses VRB wind', () => {
    const wind = parseWind('VRB04KT');
    assert.equal(wind.isVariable, true);
    assert.equal(wind.isCalm, false);
    assert.equal(wind.speedKt, 4);
    assert.equal(wind.directionDeg, undefined);
  });

  it('throws on invalid token', () => {
    assert.throws(() => parseWind('INVALID'), /Invalid wind token/);
  });
});

// ---------------------------------------------------------------------------
// parseVisibility
// ---------------------------------------------------------------------------

describe('parseVisibility', () => {
  it('parses whole statute miles (10SM)', () => {
    const result = parseVisibility(['10SM'], 0);
    assert.ok(result);
    assert.equal(result.visibility.visibilitySm, 10);
    assert.equal(result.visibility.isLessThan, false);
    assert.equal(result.visibility.isMoreThan, false);
    assert.equal(result.nextPos, 1);
  });

  it('parses fractional visibility (1 1/2SM)', () => {
    const result = parseVisibility(['1', '1/2SM'], 0);
    assert.ok(result);
    assert.equal(result.visibility.visibilitySm, 1.5);
    assert.equal(result.visibility.isLessThan, false);
    assert.equal(result.visibility.isMoreThan, false);
    assert.equal(result.nextPos, 2);
  });

  it('parses less-than visibility (M1/4SM)', () => {
    const result = parseVisibility(['M1/4SM'], 0);
    assert.ok(result);
    assert.equal(result.visibility.visibilitySm, 0.25);
    assert.equal(result.visibility.isLessThan, true);
    assert.equal(result.visibility.isMoreThan, false);
  });

  it('parses fraction-only visibility (1/4SM)', () => {
    const result = parseVisibility(['1/4SM'], 0);
    assert.ok(result);
    assert.equal(result.visibility.visibilitySm, 0.25);
    assert.equal(result.visibility.isLessThan, false);
  });

  it('parses half-mile visibility (1/2SM)', () => {
    const result = parseVisibility(['1/2SM'], 0);
    assert.ok(result);
    assert.equal(result.visibility.visibilitySm, 0.5);
  });

  it('parses three-quarter-mile visibility (3/4SM)', () => {
    const result = parseVisibility(['3/4SM'], 0);
    assert.ok(result);
    assert.equal(result.visibility.visibilitySm, 0.75);
  });

  it('parses plus visibility (P6SM)', () => {
    const result = parseVisibility(['P6SM'], 0);
    assert.ok(result);
    assert.equal(result.visibility.visibilitySm, 6);
    assert.equal(result.visibility.isMoreThan, true);
    assert.equal(result.visibility.isLessThan, false);
  });

  it('parses ICAO meters visibility (9999)', () => {
    const result = parseVisibility(['9999'], 0);
    assert.ok(result);
    assert.equal(result.visibility.visibilityM, 9999);
    assert.equal(result.visibility.visibilitySm, undefined);
    assert.equal(result.visibility.isLessThan, false);
    assert.equal(result.visibility.isMoreThan, false);
  });

  it('parses ICAO low visibility (0800)', () => {
    const result = parseVisibility(['0800'], 0);
    assert.ok(result);
    assert.equal(result.visibility.visibilityM, 800);
  });

  it('parses from non-zero position', () => {
    const result = parseVisibility(['21010KT', '5SM', 'BR'], 1);
    assert.ok(result);
    assert.equal(result.visibility.visibilitySm, 5);
    assert.equal(result.nextPos, 2);
  });

  it('returns undefined for non-visibility token', () => {
    const result = parseVisibility(['FEW250'], 0);
    assert.equal(result, undefined);
  });
});

// ---------------------------------------------------------------------------
// isWeatherToken
// ---------------------------------------------------------------------------

describe('isWeatherToken', () => {
  it('accepts basic precipitation codes', () => {
    assert.equal(isWeatherToken('RA'), true);
    assert.equal(isWeatherToken('SN'), true);
    assert.equal(isWeatherToken('DZ'), true);
  });

  it('accepts intensity prefixed weather', () => {
    assert.equal(isWeatherToken('+TSRA'), true);
    assert.equal(isWeatherToken('-DZ'), true);
  });

  it('accepts vicinity weather', () => {
    assert.equal(isWeatherToken('VCSH'), true);
    assert.equal(isWeatherToken('VCTS'), true);
    assert.equal(isWeatherToken('VCFG'), true);
  });

  it('accepts descriptor-only weather', () => {
    assert.equal(isWeatherToken('TS'), true);
  });

  it('accepts mixed precipitation', () => {
    assert.equal(isWeatherToken('RASN'), true);
    assert.equal(isWeatherToken('FZRA'), true);
  });

  it('accepts obscuration codes', () => {
    assert.equal(isWeatherToken('BR'), true);
    assert.equal(isWeatherToken('FG'), true);
    assert.equal(isWeatherToken('HZ'), true);
    assert.equal(isWeatherToken('FU'), true);
  });

  it('rejects cloud layer tokens', () => {
    assert.equal(isWeatherToken('FEW250'), false);
    assert.equal(isWeatherToken('SCT040'), false);
    assert.equal(isWeatherToken('BKN020CB'), false);
  });

  it('rejects clear sky indicators', () => {
    assert.equal(isWeatherToken('CLR'), false);
    assert.equal(isWeatherToken('SKC'), false);
    assert.equal(isWeatherToken('CAVOK'), false);
    assert.equal(isWeatherToken('NSW'), false);
  });

  it('rejects vertical visibility', () => {
    assert.equal(isWeatherToken('VV005'), false);
  });

  it('rejects temp/dewpoint tokens', () => {
    assert.equal(isWeatherToken('18/06'), false);
    assert.equal(isWeatherToken('M04/M18'), false);
  });

  it('rejects altimeter tokens', () => {
    assert.equal(isWeatherToken('A3012'), false);
    assert.equal(isWeatherToken('Q1013'), false);
  });

  it('rejects NOSIG', () => {
    assert.equal(isWeatherToken('NOSIG'), false);
  });
});

// ---------------------------------------------------------------------------
// parseWeatherPhenomenon
// ---------------------------------------------------------------------------

describe('parseWeatherPhenomenon', () => {
  it('parses heavy thunderstorm rain (+TSRA)', () => {
    const wx = parseWeatherPhenomenon('+TSRA');
    assert.ok(wx);
    assert.equal(wx.raw, '+TSRA');
    assert.equal(wx.intensity, 'HEAVY');
    assert.equal(wx.descriptor, 'TS');
    assert.deepEqual(wx.phenomena, ['RA']);
    assert.equal(wx.isVicinity, false);
  });

  it('parses moderate rain (RA) with no intensity prefix', () => {
    const wx = parseWeatherPhenomenon('RA');
    assert.ok(wx);
    assert.equal(wx.intensity, 'MODERATE');
    assert.deepEqual(wx.phenomena, ['RA']);
  });

  it('parses light drizzle (-DZ)', () => {
    const wx = parseWeatherPhenomenon('-DZ');
    assert.ok(wx);
    assert.equal(wx.intensity, 'LIGHT');
    assert.deepEqual(wx.phenomena, ['DZ']);
  });

  it('parses freezing rain (FZRA)', () => {
    const wx = parseWeatherPhenomenon('FZRA');
    assert.ok(wx);
    assert.equal(wx.descriptor, 'FZ');
    assert.deepEqual(wx.phenomena, ['RA']);
  });

  it('parses vicinity showers (VCSH)', () => {
    const wx = parseWeatherPhenomenon('VCSH');
    assert.ok(wx);
    assert.equal(wx.isVicinity, true);
    assert.equal(wx.descriptor, 'SH');
  });

  it('parses vicinity thunderstorm (VCTS)', () => {
    const wx = parseWeatherPhenomenon('VCTS');
    assert.ok(wx);
    assert.equal(wx.isVicinity, true);
    assert.equal(wx.descriptor, 'TS');
  });

  it('parses mixed precipitation (RASN)', () => {
    const wx = parseWeatherPhenomenon('RASN');
    assert.ok(wx);
    assert.deepEqual(wx.phenomena, ['RA', 'SN']);
  });

  it('parses hail with thunderstorm (+TSRAGR)', () => {
    const wx = parseWeatherPhenomenon('+TSRAGR');
    assert.ok(wx);
    assert.equal(wx.intensity, 'HEAVY');
    assert.equal(wx.descriptor, 'TS');
    assert.deepEqual(wx.phenomena, ['RA', 'GR']);
  });

  it('parses all precipitation codes', () => {
    for (const code of ['DZ', 'RA', 'SN', 'SG', 'IC', 'PL', 'GR', 'GS', 'UP']) {
      const wx = parseWeatherPhenomenon(code);
      assert.ok(wx, `failed to parse ${code}`);
      assert.deepEqual(wx.phenomena, [code]);
    }
  });

  it('parses all obscuration codes', () => {
    for (const code of ['BR', 'FG', 'FU', 'VA', 'DU', 'SA', 'HZ', 'PY']) {
      const wx = parseWeatherPhenomenon(code);
      assert.ok(wx, `failed to parse ${code}`);
      assert.deepEqual(wx.phenomena, [code]);
    }
  });

  it('parses all other phenomenon codes', () => {
    for (const code of ['PO', 'SQ', 'FC', 'SS', 'DS']) {
      const wx = parseWeatherPhenomenon(code);
      assert.ok(wx, `failed to parse ${code}`);
      assert.deepEqual(wx.phenomena, [code]);
    }
  });

  it('parses all descriptor codes', () => {
    for (const desc of ['MI', 'PR', 'BC', 'DR', 'BL', 'SH', 'TS', 'FZ']) {
      const wx = parseWeatherPhenomenon(`${desc}RA`);
      assert.ok(wx, `failed to parse ${desc}RA`);
      assert.equal(wx.descriptor, desc);
      assert.deepEqual(wx.phenomena, ['RA']);
    }
  });

  it('parses blowing snow (BLSN)', () => {
    const wx = parseWeatherPhenomenon('BLSN');
    assert.ok(wx);
    assert.equal(wx.descriptor, 'BL');
    assert.deepEqual(wx.phenomena, ['SN']);
  });

  it('parses drifting snow (DRSN)', () => {
    const wx = parseWeatherPhenomenon('DRSN');
    assert.ok(wx);
    assert.equal(wx.descriptor, 'DR');
    assert.deepEqual(wx.phenomena, ['SN']);
  });

  it('parses shallow fog (MIFG)', () => {
    const wx = parseWeatherPhenomenon('MIFG');
    assert.ok(wx);
    assert.equal(wx.descriptor, 'MI');
    assert.deepEqual(wx.phenomena, ['FG']);
  });

  it('parses patches of fog (BCFG)', () => {
    const wx = parseWeatherPhenomenon('BCFG');
    assert.ok(wx);
    assert.equal(wx.descriptor, 'BC');
    assert.deepEqual(wx.phenomena, ['FG']);
  });

  it('parses thunderstorm descriptor alone (TS)', () => {
    const wx = parseWeatherPhenomenon('TS');
    assert.ok(wx);
    assert.equal(wx.descriptor, 'TS');
    assert.deepEqual(wx.phenomena, []);
  });

  it('parses heavy funnel cloud (+FC)', () => {
    const wx = parseWeatherPhenomenon('+FC');
    assert.ok(wx);
    assert.equal(wx.intensity, 'HEAVY');
    assert.deepEqual(wx.phenomena, ['FC']);
  });

  it('returns undefined for invalid input', () => {
    assert.equal(parseWeatherPhenomenon('XX'), undefined);
    assert.equal(parseWeatherPhenomenon('AB'), undefined);
  });
});

// ---------------------------------------------------------------------------
// parseCloudLayer
// ---------------------------------------------------------------------------

describe('parseCloudLayer', () => {
  it('parses FEW layer', () => {
    const layer = parseCloudLayer('FEW250');
    assert.ok(layer);
    assert.equal(layer.coverage, 'FEW');
    assert.equal(layer.altitudeFtAgl, 25000);
    assert.equal(layer.type, undefined);
  });

  it('parses SCT layer', () => {
    const layer = parseCloudLayer('SCT040');
    assert.ok(layer);
    assert.equal(layer.coverage, 'SCT');
    assert.equal(layer.altitudeFtAgl, 4000);
  });

  it('parses BKN layer', () => {
    const layer = parseCloudLayer('BKN020');
    assert.ok(layer);
    assert.equal(layer.coverage, 'BKN');
    assert.equal(layer.altitudeFtAgl, 2000);
  });

  it('parses OVC layer', () => {
    const layer = parseCloudLayer('OVC120');
    assert.ok(layer);
    assert.equal(layer.coverage, 'OVC');
    assert.equal(layer.altitudeFtAgl, 12000);
  });

  it('parses CB cloud type', () => {
    const layer = parseCloudLayer('BKN020CB');
    assert.ok(layer);
    assert.equal(layer.coverage, 'BKN');
    assert.equal(layer.altitudeFtAgl, 2000);
    assert.equal(layer.type, 'CB');
  });

  it('parses TCU cloud type', () => {
    const layer = parseCloudLayer('FEW025TCU');
    assert.ok(layer);
    assert.equal(layer.coverage, 'FEW');
    assert.equal(layer.altitudeFtAgl, 2500);
    assert.equal(layer.type, 'TCU');
  });

  it('parses low altitude layer', () => {
    const layer = parseCloudLayer('OVC003');
    assert.ok(layer);
    assert.equal(layer.altitudeFtAgl, 300);
  });

  it('returns undefined for invalid token', () => {
    assert.equal(parseCloudLayer('CLR'), undefined);
    assert.equal(parseCloudLayer('VV005'), undefined);
    assert.equal(parseCloudLayer('10SM'), undefined);
  });
});
