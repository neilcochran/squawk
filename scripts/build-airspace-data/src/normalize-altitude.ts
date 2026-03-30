import type { AltitudeBound } from '@squawk/types';

/**
 * Sentinel value used in the Class_Airspace shapefile to indicate an
 * unlimited or undefined ceiling (e.g. Class E airspace with no upper bound).
 * Stored as 99999 ft MSL in the output so queries always have a numeric bound.
 */
const SHAPEFILE_UNDEFINED_VAL = '-9998';

/** Feet per flight level (1 FL = 100 ft). */
const FT_PER_FL = 100;

/**
 * Normalizes a Class B/C/D shapefile altitude field triplet into an AltitudeBound.
 * Handles the LOWER_VAL/LOWER_UOM/LOWER_CODE and UPPER_VAL/UPPER_UOM/UPPER_CODE
 * field sets from the Class_Airspace.dbf attribute table.
 */
export function normalizeShapefileAltitude(
  /** Raw string value from VAL field (e.g. "0", "4800", "-9998"). */
  val: string | null,
  /** Unit of measure from UOM field (e.g. "FT", "FL"). */
  uom: string | null,
  /** Altitude reference from CODE field (e.g. "MSL", "AGL", "SFC"). */
  code: string | null,
): AltitudeBound {
  if (code === 'SFC') {
    return { valueFt: 0, reference: 'SFC' };
  }

  if (val === null || val === SHAPEFILE_UNDEFINED_VAL) {
    return { valueFt: 99999, reference: 'MSL' };
  }

  const numVal = parseInt(val, 10);

  if (uom === 'FL') {
    return { valueFt: numVal * FT_PER_FL, reference: 'MSL' };
  }

  if (code === 'AGL') {
    return { valueFt: numVal, reference: 'AGL' };
  }

  return { valueFt: numVal, reference: 'MSL' };
}

/**
 * Normalizes an SAA AIXM XML altitude element into an AltitudeBound.
 * Handles the upperLimit/lowerLimit elements from AirspaceVolume in the
 * SAA AIXM 5.0 subscriber files, where the value is the parsed numeric
 * text content, uom is the element's uom attribute, and reference is the
 * text content of the paired upperLimitReference/lowerLimitReference element.
 */
export function normalizeSaaAltitude(
  /**
   * Altitude value from the XML element text. Typically numeric (e.g. 3000), but
   * may be a non-numeric string such as "UNL" (unlimited) or "GND" (ground level).
   * fast-xml-parser passes non-numeric text through as strings despite parseTagValue.
   */
  value: number | string,
  /** Unit of measure from the uom attribute (e.g. "FT", "FL", "OTHER"). */
  uom: string,
  /** Altitude reference from the paired reference element (e.g. "MSL", "AGL", "SFC", "STD", "OTHER"). */
  reference: string,
): AltitudeBound | null {
  if (reference === 'SFC') {
    return { valueFt: 0, reference: 'SFC' };
  }

  // uom/reference "OTHER" appears in two geometry cases:
  // - value "UNL": unlimited ceiling, encoded as 99999 ft MSL.
  // - value "GND": ground level floor, treated the same as SFC.
  // All other OTHER combinations are AirspaceUsage schedule placeholders, not geometry.
  if (uom === 'OTHER' || reference === 'OTHER') {
    const normalized = String(value).trim().toUpperCase();
    if (normalized === 'UNL') {
      return { valueFt: 99999, reference: 'MSL' };
    }
    if (normalized === 'GND') {
      return { valueFt: 0, reference: 'SFC' };
    }
    return null;
  }

  const numVal = typeof value === 'number' ? value : parseFloat(String(value));

  if (uom === 'FL' && reference === 'STD') {
    return { valueFt: numVal * FT_PER_FL, reference: 'MSL' };
  }

  if (reference === 'AGL') {
    return { valueFt: numVal, reference: 'AGL' };
  }

  return { valueFt: numVal, reference: 'MSL' };
}
