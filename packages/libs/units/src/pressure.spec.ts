import { describe, it, expect, assert } from 'vitest';

import {
  inchesOfMercuryToHectopascals,
  hectopascalsToInchesOfMercury,
  hectopascalsToMillimetersOfMercury,
  millimetersOfMercuryToHectopascals,
  inchesOfMercuryToMillimetersOfMercury,
  millimetersOfMercuryToInchesOfMercury,
  hectopascalsToKilopascals,
  kilopascalsToHectopascals,
  hectopascalsToMillibars,
  millibarsToHectopascals,
  inchesOfMercuryToKilopascals,
  kilopascalsToInchesOfMercury,
  inchesOfMercuryToMillibars,
  millibarsToInchesOfMercury,
  kilopascalsToMillibars,
  millibarsToKilopascals,
  millibarsToMillimetersOfMercury,
  millimetersOfMercuryToMillibars,
  kilopascalsToMillimetersOfMercury,
  millimetersOfMercuryToKilopascals,
  qnhToQfe,
  qfeToQnh,
  pressureAltitudeFt,
  ISA_P0_HPA,
  ISA_P0_INHG,
} from './pressure.js';
import { close } from './test-utils.js';

describe('pressure conversions', () => {
  describe('inchesOfMercuryToHectopascals / hectopascalsToInchesOfMercury', () => {
    it('converts ISA standard pressure: 29.92126 inHg to 1013.25 hPa', () => {
      assert(close(inchesOfMercuryToHectopascals(ISA_P0_INHG), ISA_P0_HPA, 0.1));
    });
    it('converts 1 inHg to ~33.8639 hPa', () => {
      assert(close(inchesOfMercuryToHectopascals(1), 33.8639));
    });
    it('is invertible', () => {
      assert(close(hectopascalsToInchesOfMercury(inchesOfMercuryToHectopascals(30.12)), 30.12));
    });
  });

  describe('hectopascalsToMillimetersOfMercury / millimetersOfMercuryToHectopascals', () => {
    it('converts 1013.25 hPa to 760 mmHg', () => {
      assert(close(hectopascalsToMillimetersOfMercury(1013.25), 760, 0.1));
    });
    it('is invertible', () => {
      assert(
        close(millimetersOfMercuryToHectopascals(hectopascalsToMillimetersOfMercury(1000)), 1000),
      );
    });
  });

  describe('inchesOfMercuryToMillimetersOfMercury / millimetersOfMercuryToInchesOfMercury', () => {
    it('converts 1 inHg to 25.4 mmHg', () => {
      expect(inchesOfMercuryToMillimetersOfMercury(1)).toBe(25.4);
    });
    it('converts ISA standard: 29.92126 inHg to 760 mmHg', () => {
      assert(close(inchesOfMercuryToMillimetersOfMercury(ISA_P0_INHG), 760, 0.01));
    });
    it('is invertible', () => {
      assert(
        close(
          millimetersOfMercuryToInchesOfMercury(inchesOfMercuryToMillimetersOfMercury(28.5)),
          28.5,
        ),
      );
    });
  });

  describe('hectopascalsToKilopascals / kilopascalsToHectopascals', () => {
    it('converts 1013.25 hPa to 101.325 kPa', () => {
      assert(close(hectopascalsToKilopascals(1013.25), 101.325));
    });
    it('converts 100 kPa to 1000 hPa (exact)', () => {
      expect(kilopascalsToHectopascals(100)).toBe(1000);
    });
    it('is invertible', () => {
      assert(close(kilopascalsToHectopascals(hectopascalsToKilopascals(1020)), 1020));
    });
  });

  describe('hectopascalsToMillibars / millibarsToHectopascals (identity)', () => {
    it('1 mb equals 1 hPa exactly', () => {
      expect(hectopascalsToMillibars(1)).toBe(1);
      expect(millibarsToHectopascals(1)).toBe(1);
    });
    it('ISA standard 1013.25 hPa equals 1013.25 mb', () => {
      expect(hectopascalsToMillibars(ISA_P0_HPA)).toBe(1013.25);
    });
    it('is invertible', () => {
      expect(millibarsToHectopascals(hectopascalsToMillibars(995.3))).toBe(995.3);
    });
  });

  describe('inchesOfMercuryToKilopascals / kilopascalsToInchesOfMercury', () => {
    it('converts ISA standard 29.92126 inHg to ~101.325 kPa', () => {
      assert(close(inchesOfMercuryToKilopascals(ISA_P0_INHG), 101.325, 0.01));
    });
    it('is invertible', () => {
      assert(
        close(kilopascalsToInchesOfMercury(inchesOfMercuryToKilopascals(30.12)), 30.12, 0.001),
      );
    });
  });

  describe('inchesOfMercuryToMillibars / millibarsToInchesOfMercury', () => {
    it('converts ISA standard 29.92126 inHg to ~1013.25 mb', () => {
      assert(close(inchesOfMercuryToMillibars(ISA_P0_INHG), 1013.25, 0.1));
    });
    it('is invertible', () => {
      assert(close(millibarsToInchesOfMercury(inchesOfMercuryToMillibars(29.42)), 29.42));
    });
  });

  describe('kilopascalsToMillibars / millibarsToKilopascals', () => {
    it('converts 101.325 kPa to 1013.25 mb', () => {
      assert(close(kilopascalsToMillibars(101.325), 1013.25));
    });
    it('converts 1000 mb to 100 kPa (exact)', () => {
      expect(millibarsToKilopascals(1000)).toBe(100);
    });
    it('is invertible', () => {
      assert(close(millibarsToKilopascals(kilopascalsToMillibars(102.5)), 102.5));
    });
  });

  describe('millibarsToMillimetersOfMercury / millimetersOfMercuryToMillibars', () => {
    it('converts 1013.25 mb to 760 mmHg', () => {
      assert(close(millibarsToMillimetersOfMercury(1013.25), 760, 0.1));
    });
    it('is invertible', () => {
      assert(close(millimetersOfMercuryToMillibars(millibarsToMillimetersOfMercury(1000)), 1000));
    });
  });

  describe('kilopascalsToMillimetersOfMercury / millimetersOfMercuryToKilopascals', () => {
    it('converts 101.325 kPa to 760 mmHg', () => {
      assert(close(kilopascalsToMillimetersOfMercury(101.325), 760, 0.1));
    });
    it('is invertible', () => {
      assert(close(millimetersOfMercuryToKilopascals(kilopascalsToMillimetersOfMercury(100)), 100));
    });
  });

  describe('qnhToQfe / qfeToQnh', () => {
    it('returns QNH unchanged for sea-level airfield (0 ft elevation)', () => {
      assert(close(qnhToQfe(1013.25, 0), 1013.25));
    });
    it('QFE is lower than QNH for an elevated airfield', () => {
      const qfe = qnhToQfe(1013.25, 5000);
      assert(qfe < 1013.25, `expected QFE (${qfe}) < QNH (1013.25)`);
    });
    it('is invertible: qfeToQnh(qnhToQfe(qnh, elev), elev) === qnh', () => {
      const qnh = 1020;
      const elevation = 3000;
      assert(close(qfeToQnh(qnhToQfe(qnh, elevation), elevation), qnh));
    });
  });

  describe('pressureAltitudeFt', () => {
    it('returns indicated altitude unchanged when QNH equals standard pressure (29.92126 inHg)', () => {
      assert(close(pressureAltitudeFt(10000, ISA_P0_INHG), 10000, 1));
    });
    it('returns higher pressure altitude when QNH is below standard (low pressure)', () => {
      const pa = pressureAltitudeFt(10000, 29.42);
      assert(pa > 10000, `expected PA (${pa}) > indicated (10000)`);
    });
    it('returns lower pressure altitude when QNH is above standard (high pressure)', () => {
      const pa = pressureAltitudeFt(10000, 30.42);
      assert(pa < 10000, `expected PA (${pa}) < indicated (10000)`);
    });
  });

  describe('high-elevation airport scenarios', () => {
    it('Denver (5280 ft): QNH/QFE difference is significant', () => {
      const qnh = 1013.25;
      const elevation = 5280;
      const qfe = qnhToQfe(qnh, elevation);
      const difference = qnh - qfe;
      // At 5280 ft, QFE should be ~17-18% lower than QNH
      assert(difference > 170 && difference < 190, `QNH-QFE difference: ${difference} hPa`);
    });
    it('La Paz (12000 ft): even more dramatic QNH/QFE difference', () => {
      const qnh = 1013.25;
      const elevation = 12000;
      const qfe = qnhToQfe(qnh, elevation);
      const difference = qnh - qfe;
      // At 12000 ft, QFE should be ~36% lower than QNH
      assert(difference > 350 && difference < 380, `QNH-QFE difference: ${difference} hPa`);
    });
    it('roundtrip is invertible at high elevation', () => {
      const qnh = 1009.5;
      const elevation = 8500;
      assert(close(qfeToQnh(qnhToQfe(qnh, elevation), elevation), qnh, 0.01));
    });
  });

  describe('extreme pressure scenarios', () => {
    it('handles very low QNH (strong low-pressure system)', () => {
      const qfe = qnhToQfe(980, 0);
      assert(close(qfe, 980, 0.1));
    });
    it('handles very high QNH (strong high-pressure system)', () => {
      const qfe = qnhToQfe(1040, 0);
      assert(close(qfe, 1040, 0.1));
    });
    it('pressure altitude is reasonable at extremes', () => {
      // Very low QNH = higher PA (worse)
      const paLow = pressureAltitudeFt(5000, 28.92);
      // Very high QNH = lower PA (better)
      const paHigh = pressureAltitudeFt(5000, 30.92);
      assert(paLow > paHigh, 'low QNH should give higher PA than high QNH');
    });
  });

  describe('zero and boundary pressure', () => {
    it('QNH/QFE at sea level (0 ft elevation) are equal', () => {
      const qnh = 1013.25;
      assert(close(qnhToQfe(qnh, 0), qnh, 0.01));
    });
    it('pressure altitude is 0 ft when indicated is 0 ft at standard QNH', () => {
      assert(close(pressureAltitudeFt(0, ISA_P0_INHG), 0, 1));
    });
  });

  describe('reference values (immutable anchors)', () => {
    it('ISA standard: 1013.25 hPa = 29.92126 inHg = 760 mmHg', () => {
      assert(close(inchesOfMercuryToHectopascals(ISA_P0_INHG), ISA_P0_HPA, 0.1));
      assert(close(hectopascalsToMillimetersOfMercury(ISA_P0_HPA), 760, 0.1));
    });
    it('1 inHg = 33.8639 hPa (exact)', () => {
      assert(close(inchesOfMercuryToHectopascals(1), 33.8639, 0.001));
    });
  });

  describe('real-world atmospheric scenarios', () => {
    it('high pressure system: 30.5 inHg = 1032.8 hPa', () => {
      assert(close(inchesOfMercuryToHectopascals(30.5), 1032.8, 1));
    });
    it('low pressure system: 28.92 inHg = 979.3 hPa', () => {
      assert(close(inchesOfMercuryToHectopascals(28.92), 979.3, 1));
    });
  });

  describe('real-world airport pressure conversions', () => {
    it('Denver (5280 ft): QNH-QFE difference validates altimeter setting spread', () => {
      const qnh = 1013.25;
      const elevation = 5280;
      const qfe = qnhToQfe(qnh, elevation);
      const difference = qnh - qfe;
      // Denver has significant QNH-QFE difference due to elevation
      assert(difference > 170 && difference < 190);
    });
    it('Chicago (673 ft): small QNH-QFE spread at low elevation', () => {
      const qnh = 1013.25;
      const qfe = qnhToQfe(qnh, 673);
      const difference = qnh - qfe;
      assert(difference > 20 && difference < 30); // ~24 hPa
    });
    it('Mexico City (7382 ft): larger QNH-QFE spread than Denver', () => {
      const qnh = 1013.25;
      const qfe = qnhToQfe(qnh, 7382);
      const difference = qnh - qfe;
      assert(difference > 230 && difference < 250); // ~243 hPa
    });
  });

  describe('critical physics constraint: QFE <= QNH always', () => {
    it('QFE equals QNH at sea level (0 ft elevation)', () => {
      const qnh = 1013.25;
      const qfe = qnhToQfe(qnh, 0);
      assert(close(qfe, qnh, 0.01), `QFE (${qfe}) should equal QNH (${qnh}) at sea level`);
    });
    it('QFE is always <= QNH for any valid elevation', () => {
      const qnh = 1013.25;
      const elevations = [0, 500, 1000, 2500, 5000, 10000, 15000, 20000];
      for (const elev of elevations) {
        const qfe = qnhToQfe(qnh, elev);
        assert(qfe <= qnh, `QFE (${qfe}) should be <= QNH (${qnh}) at elevation ${elev} ft`);
      }
    });
    it('QFE decreases as elevation increases (for constant QNH)', () => {
      const qnh = 1013.25;
      const qfe1000 = qnhToQfe(qnh, 1000);
      const qfe5000 = qnhToQfe(qnh, 5000);
      const qfe10000 = qnhToQfe(qnh, 10000);
      assert(qfe1000 > qfe5000, `QFE at 1000 ft should be > QFE at 5000 ft`);
      assert(qfe5000 > qfe10000, `QFE at 5000 ft should be > QFE at 10000 ft`);
    });
    it('QFE <= QNH holds across range of QNH values', () => {
      const qnhValues = [980, 1000, 1013.25, 1030, 1050];
      const elevation = 5000;
      for (const qnh of qnhValues) {
        const qfe = qnhToQfe(qnh, elevation);
        assert(qfe <= qnh, `QFE (${qfe}) should be <= QNH (${qnh}) at 5000 ft`);
      }
    });
  });

  describe('critical physics constraint: Pressure must be positive', () => {
    it('QFE is always positive (for valid QNH and elevation)', () => {
      const qnhValues = [980, 1000, 1013.25, 1030, 1050];
      const elevations = [0, 1000, 5000, 10000, 20000];
      for (const qnh of qnhValues) {
        for (const elev of elevations) {
          const qfe = qnhToQfe(qnh, elev);
          assert(qfe > 0, `QFE (${qfe}) should be > 0 for QNH ${qnh} at ${elev} ft`);
        }
      }
    });
    it('QFE should remain positive even at extreme elevations', () => {
      const qnh = 1013.25;
      const extremeElevations = [20000, 25000, 30000];
      for (const elev of extremeElevations) {
        const qfe = qnhToQfe(qnh, elev);
        assert(qfe > 0, `QFE (${qfe}) should be > 0 at extreme elevation ${elev} ft`);
      }
    });
  });
});
