import { describe, it, expect, assert } from 'vitest';
import { close } from './test-utils.js';
import { degreesToRadians, radiansToDegrees } from './angle.js';

describe('angle conversions', () => {
  describe('degreesToRadians', () => {
    it('converts 0 degrees to 0 radians', () => {
      expect(degreesToRadians(0)).toBe(0);
    });
    it('converts 180 degrees to pi radians', () => {
      assert(close(degreesToRadians(180), Math.PI, 0.000001));
    });
    it('converts 360 degrees to 2*pi radians', () => {
      assert(close(degreesToRadians(360), 2 * Math.PI, 0.000001));
    });
    it('converts 90 degrees to pi/2 radians', () => {
      assert(close(degreesToRadians(90), Math.PI / 2, 0.000001));
    });
    it('converts 45 degrees to pi/4 radians', () => {
      assert(close(degreesToRadians(45), Math.PI / 4, 0.000001));
    });
  });

  describe('radiansToDegrees', () => {
    it('converts 0 radians to 0 degrees', () => {
      expect(radiansToDegrees(0)).toBe(0);
    });
    it('converts pi radians to 180 degrees', () => {
      assert(close(radiansToDegrees(Math.PI), 180, 0.000001));
    });
    it('converts 2*pi radians to 360 degrees', () => {
      assert(close(radiansToDegrees(2 * Math.PI), 360, 0.000001));
    });
    it('converts pi/2 radians to 90 degrees', () => {
      assert(close(radiansToDegrees(Math.PI / 2), 90, 0.000001));
    });
  });

  describe('round-trip', () => {
    it('degreesToRadians then radiansToDegrees returns original value', () => {
      assert(close(radiansToDegrees(degreesToRadians(270)), 270, 0.000001));
    });
    it('radiansToDegrees then degreesToRadians returns original value', () => {
      assert(close(degreesToRadians(radiansToDegrees(1.5)), 1.5, 0.000001));
    });
  });

  describe('negative angles and angle wrapping', () => {
    it('converts -90 degrees to -pi/2 radians', () => {
      assert(close(degreesToRadians(-90), -Math.PI / 2, 0.000001));
    });
    it('converts 450 degrees (360 + 90) to pi/2 + 2*pi radians', () => {
      assert(close(degreesToRadians(450), Math.PI / 2 + 2 * Math.PI, 0.000001));
    });
    it('converts 0 radians to 0 degrees', () => {
      expect(degreesToRadians(0)).toBe(0);
    });
    it('converts negative radians correctly', () => {
      assert(close(radiansToDegrees(-Math.PI), -180, 0.000001));
    });
  });
});
