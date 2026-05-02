import { describe, it, expect, assert } from 'vitest';
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
    expect(isWindToken('21010KT')).toBe(true);
  });

  it('accepts calm wind', () => {
    expect(isWindToken('00000KT')).toBe(true);
  });

  it('accepts gusty wind', () => {
    expect(isWindToken('25015G30KT')).toBe(true);
  });

  it('accepts 3-digit speed', () => {
    expect(isWindToken('22055G105KT')).toBe(true);
  });

  it('accepts VRB wind', () => {
    expect(isWindToken('VRB04KT')).toBe(true);
  });

  it('rejects non-wind token', () => {
    expect(isWindToken('10SM')).toBe(false);
    expect(isWindToken('FEW250')).toBe(false);
    expect(isWindToken('CAVOK')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseWind
// ---------------------------------------------------------------------------

describe('parseWind', () => {
  it('parses basic wind', () => {
    const wind = parseWind('21010KT');
    expect(wind.directionDeg).toBe(210);
    expect(wind.speedKt).toBe(10);
    expect(wind.isVariable).toBe(false);
    expect(wind.isCalm).toBe(false);
    expect(wind.gustKt).toBe(undefined);
  });

  it('parses calm wind', () => {
    const wind = parseWind('00000KT');
    expect(wind.isCalm).toBe(true);
    expect(wind.speedKt).toBe(0);
    expect(wind.directionDeg).toBe(undefined);
  });

  it('parses gusty wind', () => {
    const wind = parseWind('25015G30KT');
    expect(wind.directionDeg).toBe(250);
    expect(wind.speedKt).toBe(15);
    expect(wind.gustKt).toBe(30);
  });

  it('parses extreme wind with 3-digit gusts', () => {
    const wind = parseWind('22055G105KT');
    expect(wind.directionDeg).toBe(220);
    expect(wind.speedKt).toBe(55);
    expect(wind.gustKt).toBe(105);
  });

  it('parses VRB wind', () => {
    const wind = parseWind('VRB04KT');
    expect(wind.isVariable).toBe(true);
    expect(wind.isCalm).toBe(false);
    expect(wind.speedKt).toBe(4);
    expect(wind.directionDeg).toBe(undefined);
  });

  it('throws on invalid token', () => {
    expect(() => parseWind('INVALID')).toThrow(/Invalid wind token/);
  });
});

// ---------------------------------------------------------------------------
// parseVisibility
// ---------------------------------------------------------------------------

describe('parseVisibility', () => {
  it('parses whole statute miles (10SM)', () => {
    const result = parseVisibility(['10SM'], 0);
    assert(result);
    expect(result.visibility.visibilitySm).toBe(10);
    expect(result.visibility.isLessThan).toBe(false);
    expect(result.visibility.isMoreThan).toBe(false);
    expect(result.nextPos).toBe(1);
  });

  it('parses fractional visibility (1 1/2SM)', () => {
    const result = parseVisibility(['1', '1/2SM'], 0);
    assert(result);
    expect(result.visibility.visibilitySm).toBe(1.5);
    expect(result.visibility.isLessThan).toBe(false);
    expect(result.visibility.isMoreThan).toBe(false);
    expect(result.nextPos).toBe(2);
  });

  it('parses less-than visibility (M1/4SM)', () => {
    const result = parseVisibility(['M1/4SM'], 0);
    assert(result);
    expect(result.visibility.visibilitySm).toBe(0.25);
    expect(result.visibility.isLessThan).toBe(true);
    expect(result.visibility.isMoreThan).toBe(false);
  });

  it('parses fraction-only visibility (1/4SM)', () => {
    const result = parseVisibility(['1/4SM'], 0);
    assert(result);
    expect(result.visibility.visibilitySm).toBe(0.25);
    expect(result.visibility.isLessThan).toBe(false);
  });

  it('parses half-mile visibility (1/2SM)', () => {
    const result = parseVisibility(['1/2SM'], 0);
    assert(result);
    expect(result.visibility.visibilitySm).toBe(0.5);
  });

  it('parses three-quarter-mile visibility (3/4SM)', () => {
    const result = parseVisibility(['3/4SM'], 0);
    assert(result);
    expect(result.visibility.visibilitySm).toBe(0.75);
  });

  it('parses plus visibility (P6SM)', () => {
    const result = parseVisibility(['P6SM'], 0);
    assert(result);
    expect(result.visibility.visibilitySm).toBe(6);
    expect(result.visibility.isMoreThan).toBe(true);
    expect(result.visibility.isLessThan).toBe(false);
  });

  it('parses ICAO meters visibility (9999)', () => {
    const result = parseVisibility(['9999'], 0);
    assert(result);
    expect(result.visibility.visibilityM).toBe(9999);
    expect(result.visibility.visibilitySm).toBe(undefined);
    expect(result.visibility.isLessThan).toBe(false);
    expect(result.visibility.isMoreThan).toBe(false);
  });

  it('parses ICAO low visibility (0800)', () => {
    const result = parseVisibility(['0800'], 0);
    assert(result);
    expect(result.visibility.visibilityM).toBe(800);
  });

  it('parses from non-zero position', () => {
    const result = parseVisibility(['21010KT', '5SM', 'BR'], 1);
    assert(result);
    expect(result.visibility.visibilitySm).toBe(5);
    expect(result.nextPos).toBe(2);
  });

  it('returns undefined for non-visibility token', () => {
    const result = parseVisibility(['FEW250'], 0);
    expect(result).toBe(undefined);
  });
});

// ---------------------------------------------------------------------------
// isWeatherToken
// ---------------------------------------------------------------------------

describe('isWeatherToken', () => {
  it('accepts basic precipitation codes', () => {
    expect(isWeatherToken('RA')).toBe(true);
    expect(isWeatherToken('SN')).toBe(true);
    expect(isWeatherToken('DZ')).toBe(true);
  });

  it('accepts intensity prefixed weather', () => {
    expect(isWeatherToken('+TSRA')).toBe(true);
    expect(isWeatherToken('-DZ')).toBe(true);
  });

  it('accepts vicinity weather', () => {
    expect(isWeatherToken('VCSH')).toBe(true);
    expect(isWeatherToken('VCTS')).toBe(true);
    expect(isWeatherToken('VCFG')).toBe(true);
  });

  it('accepts descriptor-only weather', () => {
    expect(isWeatherToken('TS')).toBe(true);
  });

  it('accepts mixed precipitation', () => {
    expect(isWeatherToken('RASN')).toBe(true);
    expect(isWeatherToken('FZRA')).toBe(true);
  });

  it('accepts obscuration codes', () => {
    expect(isWeatherToken('BR')).toBe(true);
    expect(isWeatherToken('FG')).toBe(true);
    expect(isWeatherToken('HZ')).toBe(true);
    expect(isWeatherToken('FU')).toBe(true);
  });

  it('rejects cloud layer tokens', () => {
    expect(isWeatherToken('FEW250')).toBe(false);
    expect(isWeatherToken('SCT040')).toBe(false);
    expect(isWeatherToken('BKN020CB')).toBe(false);
  });

  it('rejects clear sky indicators', () => {
    expect(isWeatherToken('CLR')).toBe(false);
    expect(isWeatherToken('SKC')).toBe(false);
    expect(isWeatherToken('CAVOK')).toBe(false);
    expect(isWeatherToken('NSW')).toBe(false);
  });

  it('rejects vertical visibility', () => {
    expect(isWeatherToken('VV005')).toBe(false);
  });

  it('rejects temp/dewpoint tokens', () => {
    expect(isWeatherToken('18/06')).toBe(false);
    expect(isWeatherToken('M04/M18')).toBe(false);
  });

  it('rejects altimeter tokens', () => {
    expect(isWeatherToken('A3012')).toBe(false);
    expect(isWeatherToken('Q1013')).toBe(false);
  });

  it('rejects NOSIG', () => {
    expect(isWeatherToken('NOSIG')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseWeatherPhenomenon
// ---------------------------------------------------------------------------

describe('parseWeatherPhenomenon', () => {
  it('parses heavy thunderstorm rain (+TSRA)', () => {
    const wx = parseWeatherPhenomenon('+TSRA');
    assert(wx);
    expect(wx.raw).toBe('+TSRA');
    expect(wx.intensity).toBe('HEAVY');
    expect(wx.descriptor).toBe('TS');
    expect(wx.phenomena).toEqual(['RA']);
    expect(wx.isVicinity).toBe(false);
  });

  it('parses moderate rain (RA) with no intensity prefix', () => {
    const wx = parseWeatherPhenomenon('RA');
    assert(wx);
    expect(wx.intensity).toBe('MODERATE');
    expect(wx.phenomena).toEqual(['RA']);
  });

  it('parses light drizzle (-DZ)', () => {
    const wx = parseWeatherPhenomenon('-DZ');
    assert(wx);
    expect(wx.intensity).toBe('LIGHT');
    expect(wx.phenomena).toEqual(['DZ']);
  });

  it('parses freezing rain (FZRA)', () => {
    const wx = parseWeatherPhenomenon('FZRA');
    assert(wx);
    expect(wx.descriptor).toBe('FZ');
    expect(wx.phenomena).toEqual(['RA']);
  });

  it('parses vicinity showers (VCSH)', () => {
    const wx = parseWeatherPhenomenon('VCSH');
    assert(wx);
    expect(wx.isVicinity).toBe(true);
    expect(wx.descriptor).toBe('SH');
  });

  it('parses vicinity thunderstorm (VCTS)', () => {
    const wx = parseWeatherPhenomenon('VCTS');
    assert(wx);
    expect(wx.isVicinity).toBe(true);
    expect(wx.descriptor).toBe('TS');
  });

  it('parses mixed precipitation (RASN)', () => {
    const wx = parseWeatherPhenomenon('RASN');
    assert(wx);
    expect(wx.phenomena).toEqual(['RA', 'SN']);
  });

  it('parses hail with thunderstorm (+TSRAGR)', () => {
    const wx = parseWeatherPhenomenon('+TSRAGR');
    assert(wx);
    expect(wx.intensity).toBe('HEAVY');
    expect(wx.descriptor).toBe('TS');
    expect(wx.phenomena).toEqual(['RA', 'GR']);
  });

  it('parses all precipitation codes', () => {
    for (const code of ['DZ', 'RA', 'SN', 'SG', 'IC', 'PL', 'GR', 'GS', 'UP']) {
      const wx = parseWeatherPhenomenon(code);
      assert(wx, `failed to parse ${code}`);
      expect(wx.phenomena).toEqual([code]);
    }
  });

  it('parses all obscuration codes', () => {
    for (const code of ['BR', 'FG', 'FU', 'VA', 'DU', 'SA', 'HZ', 'PY']) {
      const wx = parseWeatherPhenomenon(code);
      assert(wx, `failed to parse ${code}`);
      expect(wx.phenomena).toEqual([code]);
    }
  });

  it('parses all other phenomenon codes', () => {
    for (const code of ['PO', 'SQ', 'FC', 'SS', 'DS']) {
      const wx = parseWeatherPhenomenon(code);
      assert(wx, `failed to parse ${code}`);
      expect(wx.phenomena).toEqual([code]);
    }
  });

  it('parses all descriptor codes', () => {
    for (const desc of ['MI', 'PR', 'BC', 'DR', 'BL', 'SH', 'TS', 'FZ']) {
      const wx = parseWeatherPhenomenon(`${desc}RA`);
      assert(wx, `failed to parse ${desc}RA`);
      expect(wx.descriptor).toBe(desc);
      expect(wx.phenomena).toEqual(['RA']);
    }
  });

  it('parses blowing snow (BLSN)', () => {
    const wx = parseWeatherPhenomenon('BLSN');
    assert(wx);
    expect(wx.descriptor).toBe('BL');
    expect(wx.phenomena).toEqual(['SN']);
  });

  it('parses drifting snow (DRSN)', () => {
    const wx = parseWeatherPhenomenon('DRSN');
    assert(wx);
    expect(wx.descriptor).toBe('DR');
    expect(wx.phenomena).toEqual(['SN']);
  });

  it('parses shallow fog (MIFG)', () => {
    const wx = parseWeatherPhenomenon('MIFG');
    assert(wx);
    expect(wx.descriptor).toBe('MI');
    expect(wx.phenomena).toEqual(['FG']);
  });

  it('parses patches of fog (BCFG)', () => {
    const wx = parseWeatherPhenomenon('BCFG');
    assert(wx);
    expect(wx.descriptor).toBe('BC');
    expect(wx.phenomena).toEqual(['FG']);
  });

  it('parses thunderstorm descriptor alone (TS)', () => {
    const wx = parseWeatherPhenomenon('TS');
    assert(wx);
    expect(wx.descriptor).toBe('TS');
    expect(wx.phenomena).toEqual([]);
  });

  it('parses heavy funnel cloud (+FC)', () => {
    const wx = parseWeatherPhenomenon('+FC');
    assert(wx);
    expect(wx.intensity).toBe('HEAVY');
    expect(wx.phenomena).toEqual(['FC']);
  });

  it('returns undefined for invalid input', () => {
    expect(parseWeatherPhenomenon('XX')).toBe(undefined);
    expect(parseWeatherPhenomenon('AB')).toBe(undefined);
  });
});

// ---------------------------------------------------------------------------
// parseCloudLayer
// ---------------------------------------------------------------------------

describe('parseCloudLayer', () => {
  it('parses FEW layer', () => {
    const layer = parseCloudLayer('FEW250');
    assert(layer);
    expect(layer.coverage).toBe('FEW');
    expect(layer.altitudeFtAgl).toBe(25000);
    expect(layer.type).toBe(undefined);
  });

  it('parses SCT layer', () => {
    const layer = parseCloudLayer('SCT040');
    assert(layer);
    expect(layer.coverage).toBe('SCT');
    expect(layer.altitudeFtAgl).toBe(4000);
  });

  it('parses BKN layer', () => {
    const layer = parseCloudLayer('BKN020');
    assert(layer);
    expect(layer.coverage).toBe('BKN');
    expect(layer.altitudeFtAgl).toBe(2000);
  });

  it('parses OVC layer', () => {
    const layer = parseCloudLayer('OVC120');
    assert(layer);
    expect(layer.coverage).toBe('OVC');
    expect(layer.altitudeFtAgl).toBe(12000);
  });

  it('parses CB cloud type', () => {
    const layer = parseCloudLayer('BKN020CB');
    assert(layer);
    expect(layer.coverage).toBe('BKN');
    expect(layer.altitudeFtAgl).toBe(2000);
    expect(layer.type).toBe('CB');
  });

  it('parses TCU cloud type', () => {
    const layer = parseCloudLayer('FEW025TCU');
    assert(layer);
    expect(layer.coverage).toBe('FEW');
    expect(layer.altitudeFtAgl).toBe(2500);
    expect(layer.type).toBe('TCU');
  });

  it('parses low altitude layer', () => {
    const layer = parseCloudLayer('OVC003');
    assert(layer);
    expect(layer.altitudeFtAgl).toBe(300);
  });

  it('returns undefined for invalid token', () => {
    expect(parseCloudLayer('CLR')).toBe(undefined);
    expect(parseCloudLayer('VV005')).toBe(undefined);
    expect(parseCloudLayer('10SM')).toBe(undefined);
  });
});
