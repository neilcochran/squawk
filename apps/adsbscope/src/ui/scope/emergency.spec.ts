import { describe, expect, it } from 'vitest';

import { EMERGENCY_CODES, EMERGENCY_FLASH_PERIOD_MS, isEmergencyFlashOn } from './emergency.js';

describe('EMERGENCY_CODES', () => {
  it('uses the codes a real scope shows for the three emergency squawks', () => {
    expect(EMERGENCY_CODES.general).toBe('EM');
    expect(EMERGENCY_CODES.radioFailure).toBe('RF');
    expect(EMERGENCY_CODES.unlawfulInterference).toBe('HJ');
  });

  it('gives every kind a distinct code short enough to follow a callsign', () => {
    const codes = Object.values(EMERGENCY_CODES);

    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(code.length).toBeLessThanOrEqual(4);
    }
  });
});

describe('isEmergencyFlashOn', () => {
  it('is lit for the first half of each period and dark for the second', () => {
    expect(isEmergencyFlashOn(0)).toBe(true);
    expect(isEmergencyFlashOn(EMERGENCY_FLASH_PERIOD_MS / 2 - 1)).toBe(true);
    expect(isEmergencyFlashOn(EMERGENCY_FLASH_PERIOD_MS / 2)).toBe(false);
    expect(isEmergencyFlashOn(EMERGENCY_FLASH_PERIOD_MS - 1)).toBe(false);
    expect(isEmergencyFlashOn(EMERGENCY_FLASH_PERIOD_MS * 3)).toBe(true);
  });
});
