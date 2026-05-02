import { describe, it, expect } from 'vitest';
import {
  parseAltitudeFt,
  parseAltitudeRange,
  parseIntensityChange,
  parseTimeString,
  parseMovement,
  parseVolcanoPosition,
  parseIcaoPosition,
} from './advisory-utils.js';

describe('parseAltitudeFt', () => {
  it('returns undefined for SFC', () => {
    expect(parseAltitudeFt('SFC')).toBeUndefined();
  });

  it('returns undefined for FRZLVL', () => {
    expect(parseAltitudeFt('FRZLVL')).toBeUndefined();
  });

  it('parses an FL-prefixed altitude (FL350 -> 35000)', () => {
    expect(parseAltitudeFt('FL350')).toBe(35000);
  });

  it('parses a numeric altitude (040 -> 4000)', () => {
    expect(parseAltitudeFt('040')).toBe(4000);
  });
});

describe('parseAltitudeRange', () => {
  it('parses a "BTN SFC AND FL100" range', () => {
    const result = parseAltitudeRange('SEV TURB BTN SFC AND FL100');
    expect(result?.baseFt).toBeUndefined();
    expect(result?.topFt).toBe(10000);
  });

  it('parses a "BTN FRZLVL AND FL180" range and flags the freezing level', () => {
    const result = parseAltitudeRange('MOD ICE BTN FRZLVL AND FL180');
    expect(result?.baseIsFreezingLevel).toBe(true);
    expect(result?.topFt).toBe(18000);
  });

  it('parses a slash-format altitude range (FL250/FL350)', () => {
    const result = parseAltitudeRange('VA OBS AT 1100Z FL250/FL350');
    expect(result?.baseFt).toBe(25000);
    expect(result?.topFt).toBe(35000);
  });

  it('parses a slash-format range with SFC base', () => {
    const result = parseAltitudeRange('VA SFC/FL100');
    expect(result?.baseFt).toBeUndefined();
    expect(result?.topFt).toBe(10000);
  });

  it('returns undefined when no range is recognized', () => {
    expect(parseAltitudeRange('NO RANGE HERE')).toBeUndefined();
  });
});

describe('parseTimeString', () => {
  it('parses a 2-digit hour string', () => {
    expect(parseTimeString('14Z')).toEqual({ hour: 14, minute: 0 });
  });

  it('parses a 4-digit HHMM string', () => {
    expect(parseTimeString('1430Z')).toEqual({ hour: 14, minute: 30 });
  });

  it('parses a 6-digit DDHHMM string with day component', () => {
    expect(parseTimeString('051430Z')).toEqual({ day: 5, hour: 14, minute: 30 });
  });

  it('returns undefined for an unrecognized length', () => {
    expect(parseTimeString('123')).toBeUndefined();
  });
});

describe('parseMovement', () => {
  it('parses domestic format MOV FROM dddssKT', () => {
    const result = parseMovement('MOV FROM 26035KT');
    expect(result?.directionDeg).toBe(260);
    expect(result?.speedKt).toBe(35);
  });

  it('parses domestic format with KMH units', () => {
    const result = parseMovement('MOV FROM 26035KMH');
    expect(result?.speedKmPerHr).toBe(35);
    expect(result?.speedKt).toBeUndefined();
  });

  it('parses international format MOV [compass] [speed] KT', () => {
    const result = parseMovement('MOV NE 25 KT');
    expect(result?.directionCompass).toBe('NE');
    expect(result?.speedKt).toBe(25);
  });

  it('parses international format with KMH units', () => {
    const result = parseMovement('MOV NE 30 KMH');
    expect(result?.directionCompass).toBe('NE');
    expect(result?.speedKmPerHr).toBe(30);
  });

  it('returns undefined when no movement is recognized', () => {
    expect(parseMovement('NO MOVEMENT INFO')).toBeUndefined();
  });
});

describe('parseIntensityChange', () => {
  it('returns INTENSIFYING for INTSF', () => {
    expect(parseIntensityChange('CONDS INTSF')).toBe('INTENSIFYING');
  });

  it('returns WEAKENING for WKN', () => {
    expect(parseIntensityChange('CONDS WKN')).toBe('WEAKENING');
  });

  it('returns NO_CHANGE for NC', () => {
    expect(parseIntensityChange('STNR NC')).toBe('NO_CHANGE');
  });

  it('does not match NC inside ANC', () => {
    expect(parseIntensityChange('ANCHORAGE')).toBeUndefined();
  });

  it('returns undefined when no marker is present', () => {
    expect(parseIntensityChange('CONDS')).toBeUndefined();
  });
});

describe('parseVolcanoPosition', () => {
  it('parses a northern-hemisphere east-longitude position', () => {
    expect(parseVolcanoPosition('6042N15610E')).toEqual({
      lat: 60 + 42 / 60,
      lon: 156 + 10 / 60,
    });
  });

  it('parses a southern-hemisphere west-longitude position', () => {
    const result = parseVolcanoPosition('1530S07845W');
    expect(result?.lat).toBeCloseTo(-(15 + 30 / 60), 4);
    expect(result?.lon).toBeCloseTo(-(78 + 45 / 60), 4);
  });

  it('returns undefined for an unrecognized format', () => {
    expect(parseVolcanoPosition('NOT A POS')).toBeUndefined();
  });
});

describe('parseIcaoPosition', () => {
  it('parses a northern-hemisphere west-longitude position', () => {
    const result = parseIcaoPosition('N2540 W08830');
    expect(result?.lat).toBeCloseTo(25 + 40 / 60, 4);
    expect(result?.lon).toBeCloseTo(-(88 + 30 / 60), 4);
  });

  it('parses a southern-hemisphere east-longitude position', () => {
    const result = parseIcaoPosition('S2540 E08830');
    expect(result?.lat).toBeCloseTo(-(25 + 40 / 60), 4);
    expect(result?.lon).toBeCloseTo(88 + 30 / 60, 4);
  });

  it('returns undefined for an unrecognized format', () => {
    expect(parseIcaoPosition('not a position')).toBeUndefined();
  });
});
