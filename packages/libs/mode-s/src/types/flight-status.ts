/**
 * Decoded 3-bit Flight Status (FS) subfield of a DF4/5/20/21 Mode-S
 * surveillance reply - the Alert (recent squawk change) and Ident (SPI)
 * flags. Ground/airborne status is also nominally packed into this field
 * but is not decoded here - see {@link decodeFlightStatus}.
 */
export interface FlightStatus {
  /** True when the transponder's Ident (SPI) pulse is active. Undefined for a reserved FS value (6 or 7), where Ident status is not defined. */
  identActive: boolean | undefined;
  /** True when the transponder is flagging a recent squawk code change. Undefined for a reserved FS value (6 or 7), where alert status is not defined. */
  squawkAlert: boolean | undefined;
}
