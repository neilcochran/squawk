/**
 * Parses an ARINC 424 latitude string in the format
 * `{N|S}DDMMSSSS` (9 chars total: hemisphere + 2-digit degrees +
 * 2-digit minutes + 4-digit seconds with hundredths) into decimal
 * degrees rounded to 6 places.
 *
 * Returns `undefined` when the string is blank or malformed.
 *
 * @param raw - 9-character latitude slice from an ARINC 424 record.
 */
export function parseArincLatitude(raw: string): number | undefined {
  if (raw.length < 9) {
    return undefined;
  }
  const hemisphere = raw.charAt(0);
  if (hemisphere !== 'N' && hemisphere !== 'S') {
    return undefined;
  }
  const degrees = Number.parseInt(raw.substring(1, 3), 10);
  const minutes = Number.parseInt(raw.substring(3, 5), 10);
  const secondsHundredths = Number.parseInt(raw.substring(5, 9), 10);
  if (Number.isNaN(degrees) || Number.isNaN(minutes) || Number.isNaN(secondsHundredths)) {
    return undefined;
  }
  const seconds = secondsHundredths / 100;
  let decimal = degrees + minutes / 60 + seconds / 3600;
  if (hemisphere === 'S') {
    decimal = -decimal;
  }
  return Math.round(decimal * 1_000_000) / 1_000_000;
}

/**
 * Parses an ARINC 424 longitude string in the format
 * `{E|W}DDDMMSSSS` (10 chars total: hemisphere + 3-digit degrees +
 * 2-digit minutes + 4-digit seconds with hundredths) into decimal
 * degrees rounded to 6 places.
 *
 * Returns `undefined` when the string is blank or malformed.
 *
 * @param raw - 10-character longitude slice from an ARINC 424 record.
 */
export function parseArincLongitude(raw: string): number | undefined {
  if (raw.length < 10) {
    return undefined;
  }
  const hemisphere = raw.charAt(0);
  if (hemisphere !== 'E' && hemisphere !== 'W') {
    return undefined;
  }
  const degrees = Number.parseInt(raw.substring(1, 4), 10);
  const minutes = Number.parseInt(raw.substring(4, 6), 10);
  const secondsHundredths = Number.parseInt(raw.substring(6, 10), 10);
  if (Number.isNaN(degrees) || Number.isNaN(minutes) || Number.isNaN(secondsHundredths)) {
    return undefined;
  }
  const seconds = secondsHundredths / 100;
  let decimal = degrees + minutes / 60 + seconds / 3600;
  if (hemisphere === 'W') {
    decimal = -decimal;
  }
  return Math.round(decimal * 1_000_000) / 1_000_000;
}
