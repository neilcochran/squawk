/**
 * Emergency/priority state carried by an ADS-B aircraft status message
 * (BDS 6,1 subtype 1, type code 28), per the 3-bit emergency state field.
 */
export type EmergencyState =
  | 'none'
  | 'general'
  | 'lifeguardMedical'
  | 'minimumFuel'
  | 'noCommunications'
  | 'unlawfulInterference'
  | 'downed'
  | 'reserved';
