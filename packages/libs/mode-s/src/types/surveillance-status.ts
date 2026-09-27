/**
 * Decoded 2-bit Surveillance Status (SS) subfield of an ADS-B airborne
 * position message (type codes 0, 9-18, and 20-22), per RTCA DO-260B: the one
 * condition, if any, the transponder is flagging alongside the position.
 * The field holds a single value and an alert outranks an ident, so
 * `permanentAlert` and `temporaryAlert` say nothing about whether an ident
 * is active at the same time.
 *
 * - `none` - no alert and no ident.
 * - `permanentAlert` - an emergency condition (squawk 7500, 7600, or 7700).
 * - `temporaryAlert` - the squawk was recently changed to a code other than
 *   an emergency one; the transponder holds this for about 18 seconds.
 * - `ident` - the SPI (Special Position Identification) condition: the
 *   pilot has pressed Ident.
 */
export type SurveillanceStatus = 'none' | 'permanentAlert' | 'temporaryAlert' | 'ident';
