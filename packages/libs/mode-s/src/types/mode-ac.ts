/**
 * Decoded Mode A/C reply. Mode A/C predates Mode-S and carries no ICAO
 * address - there is nothing here that identifies which aircraft sent it,
 * only the squawk code and (if the reply looks like a valid altitude
 * report) an altitude.
 */
export interface ModeAcReply {
  kind: 'modeAc';
  /** 4-digit octal squawk code, e.g. "1200". */
  squawk: string;
  /** True if the Ident (SPI - Special Position Identification) pulse is set. */
  identActive: boolean;
  /** Altitude in feet, if the reply decodes as a valid Mode C altitude report. Undefined for a Mode A (identity-only) reply or an invalid code. */
  altitudeFt: number | undefined;
}
