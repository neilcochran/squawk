import { AircraftCategory } from '@squawk/types';

import { extractBits } from './bits.js';
import type { AircraftIdentification } from './types/index.js';

/**
 * The 64-entry ICAO Mode-S callsign alphabet, a truncation of ASCII: 1-26
 * map to 'A'-'Z', 32 is space, 48-57 are '0'-'9', everything else is
 * invalid. Built once from the ASCII rule rather than hand-typed, so there
 * is no separate string literal that could drift from the rule itself.
 */
const CALLSIGN_ALPHABET = buildCallsignAlphabet();

function buildCallsignAlphabet(): string {
  let table = '';
  for (let i = 0; i < 64; i++) {
    if (i >= 1 && i <= 26) {
      table += String.fromCharCode(i | 0x40);
    } else if (i === 32 || (i >= 48 && i <= 57)) {
      table += String.fromCharCode(i);
    } else {
      table += '#';
    }
  }
  return table;
}

function decodeCallsign(me: Uint8Array): string | undefined {
  let callsign = '';
  for (let i = 0; i < 8; i++) {
    const charIndex = extractBits(me, 8 + i * 6, 6);
    callsign += CALLSIGN_ALPHABET[charIndex] ?? '#';
  }
  const trimmed = callsign.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isAircraftCategoryCode(value: string): value is keyof typeof AircraftCategory {
  return Object.hasOwn(AircraftCategory, value);
}

/**
 * Maps a type code's category "set" letter (per DO-260B Table A-2-8) and
 * the 3-bit category subfield to squawk's `AircraftCategory` key, e.g.
 * type code 4 category 5 -> `"A5"` (heavy). Type code 1 and category 0
 * both mean "no category information" and have no key.
 */
function categoryKeyFor(typeCode: number, category: number): string | undefined {
  if (category === 0) {
    return undefined;
  }
  const setLetter = typeCode === 4 ? 'A' : typeCode === 3 ? 'B' : typeCode === 2 ? 'C' : undefined;
  return setLetter === undefined ? undefined : `${setLetter}${category}`;
}

/**
 * Decodes an ADS-B aircraft identification message (BDS 0,8, type codes
 * 1-4).
 *
 * @param me - The 7-byte ME field of a DF17/18 message whose type code is 1-4.
 * @returns The decoded callsign and category.
 */
export function decodeIdentification(me: Uint8Array): AircraftIdentification {
  const typeCode = extractBits(me, 0, 5);
  const categoryBits = extractBits(me, 5, 3);
  const callsign = decodeCallsign(me);
  const key = categoryKeyFor(typeCode, categoryBits);
  const category = key !== undefined && isAircraftCategoryCode(key) ? AircraftCategory[key] : undefined;
  return { callsign, category };
}
