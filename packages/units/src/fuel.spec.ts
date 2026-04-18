import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { close } from './test-utils.js';
import {
  FUEL_DENSITY,
  gallonsToLiters,
  litersToGallons,
  poundsToKilograms,
  kilogramsToPounds,
  gallonsToPounds,
  poundsToGallons,
  gallonsToKilograms,
  kilogramsToGallons,
  litersToPounds,
  poundsToLiters,
  litersToKilograms,
  kilogramsToLiters,
} from './fuel.js';
import type { FuelDensity } from './fuel.js';

describe('fuel conversions', () => {
  describe('gallonsToLiters / litersToGallons', () => {
    it('converts 1 US gallon to 3.7854 L', () => {
      assert.ok(close(gallonsToLiters(1), 3.785411784));
    });
    it('converts 10 gal to 37.854 L', () => {
      assert.ok(close(gallonsToLiters(10), 37.85411784));
    });
    it('is invertible', () => {
      assert.ok(close(litersToGallons(gallonsToLiters(42)), 42));
    });
    it('converts zero to zero', () => {
      assert.equal(gallonsToLiters(0), 0);
      assert.equal(litersToGallons(0), 0);
    });
  });

  describe('poundsToKilograms / kilogramsToPounds', () => {
    it('converts 1 lb to 0.4536 kg', () => {
      assert.ok(close(poundsToKilograms(1), 0.45359237));
    });
    it('converts 1 kg to 2.2046 lb', () => {
      assert.ok(close(kilogramsToPounds(1), 2.20462262, 0.0001));
    });
    it('is invertible', () => {
      assert.ok(close(kilogramsToPounds(poundsToKilograms(150)), 150));
    });
    it('converts zero to zero', () => {
      assert.equal(poundsToKilograms(0), 0);
      assert.equal(kilogramsToPounds(0), 0);
    });
  });

  describe('gallonsToPounds / poundsToGallons', () => {
    it('100LL: 1 gal weighs ~6.01 lb', () => {
      assert.ok(close(gallonsToPounds(1, FUEL_DENSITY['100LL']), 6.009, 0.01));
    });
    it('Jet A: 1 gal weighs ~6.70 lb', () => {
      assert.ok(close(gallonsToPounds(1, FUEL_DENSITY['Jet A']), 6.702, 0.01));
    });
    it('accepts lb/gal density and matches kg/L density within tolerance', () => {
      const fromKgPerL = gallonsToPounds(100, { kgPerL: 0.72 });
      const fromLbPerGal = gallonsToPounds(100, { lbPerGal: 6.01 });
      assert.ok(
        close(fromKgPerL, fromLbPerGal, 0.5),
        `kgPerL-based (${fromKgPerL}) should match lbPerGal-based (${fromLbPerGal}) within 0.5 lb`,
      );
    });
    it('is invertible for kg/L density', () => {
      const density: FuelDensity = { kgPerL: 0.803 };
      assert.ok(close(poundsToGallons(gallonsToPounds(75, density), density), 75));
    });
    it('is invertible for lb/gal density', () => {
      const density: FuelDensity = { lbPerGal: 6.01 };
      assert.ok(close(poundsToGallons(gallonsToPounds(50, density), density), 50));
    });
    it('converts zero to zero', () => {
      assert.equal(gallonsToPounds(0, FUEL_DENSITY['100LL']), 0);
      assert.equal(poundsToGallons(0, FUEL_DENSITY['100LL']), 0);
    });
  });

  describe('gallonsToKilograms / kilogramsToGallons', () => {
    it('100LL: 1 gal weighs ~2.726 kg', () => {
      assert.ok(close(gallonsToKilograms(1, FUEL_DENSITY['100LL']), 2.7255, 0.001));
    });
    it('Jet A: 100 gal weighs ~304 kg', () => {
      assert.ok(close(gallonsToKilograms(100, FUEL_DENSITY['Jet A']), 303.97, 0.1));
    });
    it('is invertible', () => {
      const density: FuelDensity = { kgPerL: 0.72 };
      assert.ok(close(kilogramsToGallons(gallonsToKilograms(30, density), density), 30));
    });
  });

  describe('litersToPounds / poundsToLiters', () => {
    it('100LL: 1 L weighs ~1.587 lb', () => {
      assert.ok(close(litersToPounds(1, FUEL_DENSITY['100LL']), 1.5873, 0.001));
    });
    it('Jet A: 200 L weighs ~354 lb', () => {
      assert.ok(close(litersToPounds(200, FUEL_DENSITY['Jet A']), 354.07, 0.1));
    });
    it('is invertible', () => {
      const density: FuelDensity = { kgPerL: 0.803 };
      assert.ok(close(poundsToLiters(litersToPounds(120, density), density), 120));
    });
  });

  describe('litersToKilograms / kilogramsToLiters', () => {
    it('100LL: 1 L weighs 0.72 kg', () => {
      assert.ok(close(litersToKilograms(1, FUEL_DENSITY['100LL']), 0.72));
    });
    it('Jet A: 1000 L weighs 803 kg', () => {
      assert.ok(close(litersToKilograms(1000, FUEL_DENSITY['Jet A']), 803));
    });
    it('is invertible for kg/L density', () => {
      const density: FuelDensity = { kgPerL: 0.803 };
      assert.ok(close(kilogramsToLiters(litersToKilograms(500, density), density), 500));
    });
    it('is invertible for lb/gal density', () => {
      const density: FuelDensity = { lbPerGal: 6.7 };
      assert.ok(close(kilogramsToLiters(litersToKilograms(500, density), density), 500));
    });
  });

  describe('round-trip invariance across density shapes', () => {
    const quantities = [0, 1, 42, 250, 1000];
    const densities: FuelDensity[] = [
      { kgPerL: 0.72 },
      { kgPerL: 0.803 },
      { lbPerGal: 6.01 },
      { lbPerGal: 6.7 },
    ];
    for (const density of densities) {
      for (const q of quantities) {
        it(`gallons -> pounds -> gallons preserves ${q} gal for ${JSON.stringify(density)}`, () => {
          assert.ok(close(poundsToGallons(gallonsToPounds(q, density), density), q, 1e-9));
        });
        it(`gallons -> kilograms -> gallons preserves ${q} gal for ${JSON.stringify(density)}`, () => {
          assert.ok(close(kilogramsToGallons(gallonsToKilograms(q, density), density), q, 1e-9));
        });
        it(`liters -> pounds -> liters preserves ${q} L for ${JSON.stringify(density)}`, () => {
          assert.ok(close(poundsToLiters(litersToPounds(q, density), density), q, 1e-9));
        });
        it(`liters -> kilograms -> liters preserves ${q} L for ${JSON.stringify(density)}`, () => {
          assert.ok(close(kilogramsToLiters(litersToKilograms(q, density), density), q, 1e-9));
        });
      }
    }
  });

  describe('POH weight-and-balance scenarios', () => {
    it('Cessna 172 full tanks (56 gal 100LL) weighs ~336 lb', () => {
      const weight = gallonsToPounds(56, FUEL_DENSITY['100LL']);
      assert.ok(close(weight, 336.5, 1), `expected ~336 lb, got ${weight}`);
    });
    it('Piper PA-28 (48 gal 100LL) weighs ~288 lb', () => {
      const weight = gallonsToPounds(48, FUEL_DENSITY['100LL']);
      assert.ok(close(weight, 288.4, 1), `expected ~288 lb, got ${weight}`);
    });
    it('Citation CJ1 (3220 lb Jet A) converts to ~480 gal', () => {
      const gallons = poundsToGallons(3220, FUEL_DENSITY['Jet A']);
      assert.ok(close(gallons, 480.4, 1), `expected ~480 gal, got ${gallons}`);
    });
    it('European fuel log (200 L Jet A-1) converts to ~161 kg', () => {
      const kg = litersToKilograms(200, FUEL_DENSITY['Jet A-1']);
      assert.ok(close(kg, 160.8, 0.1), `expected ~160.8 kg, got ${kg}`);
    });
  });

  describe('FUEL_DENSITY constants', () => {
    it('100LL density matches 0.72 kg/L', () => {
      assert.deepEqual(FUEL_DENSITY['100LL'], { kgPerL: 0.72 });
    });
    it('Jet A density matches 0.803 kg/L', () => {
      assert.deepEqual(FUEL_DENSITY['Jet A'], { kgPerL: 0.803 });
    });
    it('Jet A-1 density matches 0.804 kg/L', () => {
      assert.deepEqual(FUEL_DENSITY['Jet A-1'], { kgPerL: 0.804 });
    });
    it('Jet B density matches 0.762 kg/L', () => {
      assert.deepEqual(FUEL_DENSITY['Jet B'], { kgPerL: 0.762 });
    });
    it('100LL density corresponds to ~6.01 lb/gal', () => {
      const lbPerGal = gallonsToPounds(1, FUEL_DENSITY['100LL']);
      assert.ok(close(lbPerGal, 6.009, 0.01));
    });
    it('Jet A density corresponds to ~6.70 lb/gal', () => {
      const lbPerGal = gallonsToPounds(1, FUEL_DENSITY['Jet A']);
      assert.ok(close(lbPerGal, 6.702, 0.01));
    });
  });

  describe('large and small quantities', () => {
    it('handles a single drop (0.001 gal of 100LL)', () => {
      const lb = gallonsToPounds(0.001, FUEL_DENSITY['100LL']);
      assert.ok(close(lb, 0.006, 0.001));
    });
    it('handles a tanker load (10000 gal of Jet A)', () => {
      const lb = gallonsToPounds(10000, FUEL_DENSITY['Jet A']);
      assert.ok(close(lb, 67013.6, 1), `expected ~67013 lb, got ${lb}`);
    });
  });
});
