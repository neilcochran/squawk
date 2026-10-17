import type { AircraftRegistration } from '@squawk/types';

import {
  AIRCRAFT_TYPE_MAP,
  ENGINE_TYPE_MAP,
  PLACEHOLDER_REGISTRANT_NAMES,
  REGISTRATION_STATUS_MAP,
} from './code-maps.js';

/**
 * Raw record extracted from MASTER.txt before joining with ACFTREF.
 */
export interface MasterRecord {
  /** Full N-number with "N" prefix (e.g. "N12345"). */
  registration: string;
  /** 24-bit ICAO hex address, uppercase (e.g. "A00001"). */
  icaoHex: string;
  /** Registrant or operator name, as published. */
  name: string;
  /** Year of manufacture, or undefined when the registry publishes none or 0. */
  yearMfr: number | undefined;
  /** FAA manufacturer/model code used to join with ACFTREF.txt. */
  mfrMdlCode: string;
  /** FAA aircraft type code (e.g. "4" for fixed wing single engine). */
  typeAircraft: string;
  /** FAA engine type code (e.g. "1" for reciprocating). */
  typeEngine: string;
  /** FAA registration status code (e.g. "V" for a valid registration). */
  statusCode: string;
  /** Registration expiration date as YYYY-MM-DD, or undefined if not present. */
  expirationDate: string | undefined;
}

/**
 * Aircraft reference record from ACFTREF.txt providing manufacturer
 * and model information for a given MFR MDL CODE.
 */
export interface AcftRefRecord {
  /** Manufacturer/model code (join key). */
  code: string;
  /** Manufacturer name. */
  mfr: string;
  /** Model designation. */
  model: string;
}

/**
 * Parses a column-name-to-index map from a comma-delimited header row.
 * Field names are trimmed and uppercased for case-insensitive matching.
 *
 * @param headerLine - The first line of a comma-delimited file.
 * @returns Map from uppercase field name to column index.
 */
function parseHeader(headerLine: string): Map<string, number> {
  const columns = new Map<string, number>();
  const fields = headerLine.split(',');
  for (let i = 0; i < fields.length; i++) {
    const name = fields[i]?.trim().toUpperCase();
    if (name) {
      columns.set(name, i);
    }
  }
  return columns;
}

/**
 * Retrieves a trimmed field value from a row by column name.
 *
 * @param fields - Split row values.
 * @param columns - Header-to-index map.
 * @param name - Uppercase column name to look up.
 * @returns Trimmed value, or empty string if not found.
 */
function getField(fields: string[], columns: Map<string, number>, name: string): string {
  const idx = columns.get(name);
  if (idx === undefined) {
    return '';
  }
  return fields[idx]?.trim() ?? '';
}

/** Matches the registry's compact YYYYMMDD date form. */
const COMPACT_DATE_PATTERN = /^(\d{4})(\d{2})(\d{2})$/;

/**
 * Parses a year of manufacture. The registry publishes 0 where the year is
 * unknown, which is treated the same as a blank.
 *
 * @param value - Trimmed YEAR MFR field.
 * @returns The year, or undefined when blank, non-numeric or 0.
 */
function parseYear(value: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const year = parseInt(value, 10);
  return Number.isNaN(year) || year === 0 ? undefined : year;
}

/**
 * Converts a registry date in compact YYYYMMDD form to an ISO 8601 calendar
 * date.
 *
 * @param value - Trimmed date field.
 * @returns The date as YYYY-MM-DD, or undefined when blank or malformed.
 */
function parseCompactDate(value: string): string | undefined {
  const match = COMPACT_DATE_PATTERN.exec(value);
  if (!match) {
    return undefined;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/**
 * Parses the raw text content of FAA MASTER.txt into an array of MasterRecord
 * objects. Skips records that have no MODE S CODE HEX (unregistered or
 * deregistered aircraft).
 *
 * @param content - Raw text content of MASTER.txt.
 * @returns Array of parsed master records.
 */
export function parseMasterCsv(content: string): MasterRecord[] {
  const lines = content.split('\n');
  const headerLine = lines[0];
  if (!headerLine) {
    return [];
  }

  const columns = parseHeader(headerLine);
  const records: MasterRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line?.trim()) {
      continue;
    }

    const fields = line.split(',');
    const icaoHex = getField(fields, columns, 'MODE S CODE HEX').toUpperCase();
    if (!icaoHex) {
      continue;
    }

    const nNumber = getField(fields, columns, 'N-NUMBER');
    if (!nNumber) {
      continue;
    }

    records.push({
      registration: `N${nNumber}`,
      icaoHex,
      name: getField(fields, columns, 'NAME'),
      yearMfr: parseYear(getField(fields, columns, 'YEAR MFR')),
      mfrMdlCode: getField(fields, columns, 'MFR MDL CODE'),
      typeAircraft: getField(fields, columns, 'TYPE AIRCRAFT'),
      typeEngine: getField(fields, columns, 'TYPE ENGINE'),
      statusCode: getField(fields, columns, 'STATUS CODE'),
      expirationDate: parseCompactDate(getField(fields, columns, 'EXPIRATION DATE')),
    });
  }

  return records;
}

/**
 * Parses the raw text content of FAA ACFTREF.txt into a Map keyed by
 * manufacturer/model code.
 *
 * @param content - Raw text content of ACFTREF.txt.
 * @returns Map from code to AcftRefRecord.
 */
export function parseAcftRefCsv(content: string): Map<string, AcftRefRecord> {
  const lines = content.split('\n');
  const headerLine = lines[0];
  if (!headerLine) {
    return new Map();
  }

  const columns = parseHeader(headerLine);
  const records = new Map<string, AcftRefRecord>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line?.trim()) {
      continue;
    }

    const fields = line.split(',');
    const code = getField(fields, columns, 'CODE');
    if (!code) {
      continue;
    }

    records.set(code, {
      code,
      mfr: getField(fields, columns, 'MFR'),
      model: getField(fields, columns, 'MODEL'),
    });
  }

  return records;
}

/**
 * Joins MASTER records with ACFTREF reference data and maps FAA codes to
 * typed AircraftRegistration values. A registrant name that is one of the
 * FAA's placeholders for a registration with no current registrant leaves
 * the operator unset.
 *
 * @param masterRecords - Parsed MASTER.txt records.
 * @param acftRef - Parsed ACFTREF.txt lookup map.
 * @returns Array of AircraftRegistration records.
 */
export function joinRegistryRecords(
  masterRecords: MasterRecord[],
  acftRef: Map<string, AcftRefRecord>,
): AircraftRegistration[] {
  const results: AircraftRegistration[] = [];

  for (const master of masterRecords) {
    const ref = acftRef.get(master.mfrMdlCode);

    const record: AircraftRegistration = {
      icaoHex: master.icaoHex,
      registration: master.registration,
    };
    const registrationStatus = REGISTRATION_STATUS_MAP[master.statusCode];
    if (registrationStatus !== undefined) {
      record.registrationStatus = registrationStatus;
    }
    if (master.expirationDate !== undefined) {
      record.registrationExpirationDate = master.expirationDate;
    }
    if (ref?.mfr) {
      record.make = ref.mfr;
    }
    if (ref?.model) {
      record.model = ref.model;
    }
    if (master.name && !PLACEHOLDER_REGISTRANT_NAMES.has(master.name)) {
      record.operator = master.name;
    }
    const aircraftType = AIRCRAFT_TYPE_MAP[master.typeAircraft];
    if (aircraftType !== undefined) {
      record.aircraftType = aircraftType;
    }
    const engineType = ENGINE_TYPE_MAP[master.typeEngine];
    if (engineType !== undefined) {
      record.engineType = engineType;
    }
    if (master.yearMfr !== undefined) {
      record.yearManufactured = master.yearMfr;
    }

    results.push(record);
  }

  return results;
}
