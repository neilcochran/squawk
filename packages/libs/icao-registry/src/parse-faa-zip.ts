import type { AircraftRegistration } from '@squawk/types';
import AdmZip from 'adm-zip';
import { parseMasterCsv, parseAcftRefCsv, joinRegistryRecords } from './faa-parser.js';

/**
 * Parses an FAA ReleasableAircraft.zip buffer into an array of
 * AircraftRegistration records.
 *
 * The ZIP is available for download at:
 * https://registry.faa.gov/database/ReleasableAircraft.zip
 *
 * This function extracts MASTER.txt and ACFTREF.txt from the ZIP, parses
 * both CSV files, joins the tables on the manufacturer/model code, and maps
 * FAA numeric codes to typed values.
 *
 * @param zipBuffer - Buffer containing the ReleasableAircraft.zip file contents.
 * @returns Array of parsed AircraftRegistration records.
 */
export function parseFaaRegistryZip(zipBuffer: Buffer): AircraftRegistration[] {
  const zip = new AdmZip(zipBuffer);

  const masterEntry = zip
    .getEntries()
    .find((e) => e.entryName.toUpperCase().endsWith('MASTER.TXT'));
  if (!masterEntry) {
    throw new Error('MASTER.txt not found in ZIP');
  }

  const acftRefEntry = zip
    .getEntries()
    .find((e) => e.entryName.toUpperCase().endsWith('ACFTREF.TXT'));
  if (!acftRefEntry) {
    throw new Error('ACFTREF.txt not found in ZIP');
  }

  const masterRecords = parseMasterCsv(zip.readAsText(masterEntry));
  const acftRef = parseAcftRefCsv(zip.readAsText(acftRefEntry));

  return joinRegistryRecords(masterRecords, acftRef);
}
