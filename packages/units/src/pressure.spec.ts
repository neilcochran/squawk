import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { close } from './test-utils.js';
import {
  inchesOfMercuryToHectopascals,
  hectopascalsToInchesOfMercury,
  hectopascalsToMillimetersOfMercury,
  millimetersOfMercuryToHectopascals,
  inchesOfMercuryToMillimetersOfMercury,
  millimetersOfMercuryToInchesOfMercury,
  qnhToQfe,
  qfeToQnh,
  pressureAltitudeFeet,
  ISA_P0_HPA,
  ISA_P0_INHG,
} from './pressure.js';

describe('pressure conversions', () => {
  describe('inchesOfMercuryToHectopascals / hectopascalsToInchesOfMercury', () => {
    it('converts ISA standard pressure: 29.92126 inHg to 1013.25 hPa', () => {
      assert.ok(close(inchesOfMercuryToHectopascals(ISA_P0_INHG), ISA_P0_HPA, 0.1));
    });
    it('converts 1 inHg to ~33.8639 hPa', () => {
      assert.ok(close(inchesOfMercuryToHectopascals(1), 33.8639));
    });
    it('is invertible', () => {
      assert.ok(close(hectopascalsToInchesOfMercury(inchesOfMercuryToHectopascals(30.12)), 30.12));
    });
  });

  describe('hectopascalsToMillimetersOfMercury / millimetersOfMercuryToHectopascals', () => {
    it('converts 1013.25 hPa to 760 mmHg', () => {
      assert.ok(close(hectopascalsToMillimetersOfMercury(1013.25), 760, 0.1));
    });
    it('is invertible', () => {
      assert.ok(
        close(millimetersOfMercuryToHectopascals(hectopascalsToMillimetersOfMercury(1000)), 1000),
      );
    });
  });

  describe('inchesOfMercuryToMillimetersOfMercury / millimetersOfMercuryToInchesOfMercury', () => {
    it('converts 1 inHg to 25.4 mmHg', () => {
      assert.equal(inchesOfMercuryToMillimetersOfMercury(1), 25.4);
    });
    it('converts ISA standard: 29.92126 inHg to 760 mmHg', () => {
      assert.ok(close(inchesOfMercuryToMillimetersOfMercury(ISA_P0_INHG), 760, 0.01));
    });
    it('is invertible', () => {
      assert.ok(
        close(
          millimetersOfMercuryToInchesOfMercury(inchesOfMercuryToMillimetersOfMercury(28.5)),
          28.5,
        ),
      );
    });
  });

  describe('qnhToQfe / qfeToQnh', () => {
    it('returns QNH unchanged for sea-level airfield (0 ft elevation)', () => {
      assert.ok(close(qnhToQfe(1013.25, 0), 1013.25));
    });
    it('QFE is lower than QNH for an elevated airfield', () => {
      const qfe = qnhToQfe(1013.25, 5000);
      assert.ok(qfe < 1013.25, `expected QFE (${qfe}) < QNH (1013.25)`);
    });
    it('is invertible: qfeToQnh(qnhToQfe(qnh, elev), elev) === qnh', () => {
      const qnh = 1020;
      const elevation = 3000;
      assert.ok(close(qfeToQnh(qnhToQfe(qnh, elevation), elevation), qnh));
    });
  });

  describe('pressureAltitudeFeet', () => {
    it('returns indicated altitude unchanged when QNH equals standard pressure (29.92126 inHg)', () => {
      assert.ok(close(pressureAltitudeFeet(10000, ISA_P0_INHG), 10000, 1));
    });
    it('returns higher pressure altitude when QNH is below standard (low pressure)', () => {
      const pa = pressureAltitudeFeet(10000, 29.42);
      assert.ok(pa > 10000, `expected PA (${pa}) > indicated (10000)`);
    });
    it('returns lower pressure altitude when QNH is above standard (high pressure)', () => {
      const pa = pressureAltitudeFeet(10000, 30.42);
      assert.ok(pa < 10000, `expected PA (${pa}) < indicated (10000)`);
    });
  });
});
