import { describe, it, expect } from 'vitest';

import { parseMasterCsv, parseAcftRefCsv, joinRegistryRecords } from './faa-parser.js';

const MASTER_HEADER =
  'N-NUMBER,SERIAL NUMBER,MFR MDL CODE,ENG MFR MDL,YEAR MFR,TYPE REGISTRANT,NAME,STREET,STREET2,CITY,STATE,ZIP CODE,REGION,COUNTY,COUNTRY,LAST ACTION DATE,CERT ISSUE DATE,CERTIFICATION,TYPE AIRCRAFT,TYPE ENGINE,STATUS CODE,MODE S CODE,FRACT OWNER,AIR WORTH DATE,OTHER NAMES(1),OTHER NAMES(2),OTHER NAMES(3),OTHER NAMES(4),OTHER NAMES(5),EXPIRATION DATE,UNIQUE ID,KIT MFR,KIT MODEL,MODE S CODE HEX';

const ACFTREF_HEADER =
  'CODE,MFR,MODEL,TYPE-ACFT,TYPE-ENG,AC-CAT,BUILD-CERT-IND,NO-ENG,NO-SEATS,AC-WEIGHT,SPEED,TC-DATA-SHEET,TC-DATA-HOLDER';

/**
 * Builds a MASTER.txt data row from named column values, leaving every other
 * column blank.
 *
 * @param values - Column values keyed by MASTER.txt column name.
 * @returns A comma-delimited data row in header order.
 */
function masterRow(values: Record<string, string>): string {
  return MASTER_HEADER.split(',')
    .map((column) => values[column] ?? '')
    .join(',');
}

/** Column values of a complete, valid registration. */
const VALID_ROW: Record<string, string> = {
  'N-NUMBER': '12345',
  'MFR MDL CODE': '7100510',
  'YEAR MFR': '2005',
  NAME: 'ACME LLC',
  'TYPE AIRCRAFT': '4',
  'TYPE ENGINE': '1',
  'STATUS CODE': 'V',
  'EXPIRATION DATE': '20290630',
  'MODE S CODE HEX': 'A004B3',
};

describe('parseMasterCsv', () => {
  it('parses a valid master record', () => {
    const content =
      MASTER_HEADER +
      '\n12345,28246,7100510,00000,2005,4,ACME AVIATION LLC,123 MAIN ST,,ANYTOWN,VA,20001,2,001,US,20230101,20050601,1N,4,1,A,50012345,,,,,,,,20260601,12345678,,,A004B3';

    const records = parseMasterCsv(content);
    expect(records.length).toBe(1);
    expect(records[0]?.registration).toBe('N12345');
    expect(records[0]?.icaoHex).toBe('A004B3');
    expect(records[0]?.name).toBe('ACME AVIATION LLC');
    expect(records[0]?.yearMfr).toBe(2005);
    expect(records[0]?.mfrMdlCode).toBe('7100510');
    expect(records[0]?.typeAircraft).toBe('4');
    expect(records[0]?.typeEngine).toBe('1');
    expect(records[0]?.statusCode).toBe('A');
    expect(records[0]?.expirationDate).toBe('2026-06-01');
  });

  it('treats a YEAR MFR of 0 as no year', () => {
    const records = parseMasterCsv(
      MASTER_HEADER + '\n' + masterRow({ ...VALID_ROW, 'YEAR MFR': '0' }),
    );
    expect(records[0]?.yearMfr).toBe(undefined);
  });

  it('leaves the year undefined when it is not a number', () => {
    const records = parseMasterCsv(
      MASTER_HEADER + '\n' + masterRow({ ...VALID_ROW, 'YEAR MFR': 'UNKN' }),
    );
    expect(records[0]?.yearMfr).toBe(undefined);
  });

  it('leaves the expiration date undefined when blank or malformed', () => {
    const blank = parseMasterCsv(
      MASTER_HEADER + '\n' + masterRow({ ...VALID_ROW, 'EXPIRATION DATE': '' }),
    );
    const malformed = parseMasterCsv(
      MASTER_HEADER + '\n' + masterRow({ ...VALID_ROW, 'EXPIRATION DATE': '2029/06/30' }),
    );
    expect(blank[0]?.expirationDate).toBe(undefined);
    expect(malformed[0]?.expirationDate).toBe(undefined);
  });

  it('skips records with empty MODE S CODE HEX', () => {
    const content =
      MASTER_HEADER +
      '\n99999,12345,7100510,00000,2005,4,NO HEX LLC,,,ANYTOWN,VA,20001,2,001,US,,,1N,4,1,A,50012345,,,,,,,,,12345678,,,';

    const records = parseMasterCsv(content);
    expect(records.length).toBe(0);
  });

  it('skips records with empty N-NUMBER', () => {
    const content =
      MASTER_HEADER +
      '\n,12345,7100510,00000,2005,4,NO NNUM LLC,,,ANYTOWN,VA,20001,2,001,US,,,1N,4,1,A,50012345,,,,,,,,,12345678,,,A004B3';

    const records = parseMasterCsv(content);
    expect(records.length).toBe(0);
  });

  it('handles missing year as undefined', () => {
    const content =
      MASTER_HEADER +
      '\n12345,28246,7100510,00000,,4,ACME LLC,,,ANYTOWN,VA,20001,2,001,US,,,1N,4,1,A,50012345,,,,,,,,,12345678,,,A004B3';

    const records = parseMasterCsv(content);
    expect(records[0]?.yearMfr).toBe(undefined);
  });

  it('trims whitespace from fields', () => {
    const content =
      MASTER_HEADER +
      '\n 12345 ,28246, 7100510 ,00000, 2005 ,4, ACME LLC ,,,ANYTOWN,VA,20001,2,001,US,,,1N, 4 , 1 ,A,50012345,,,,,,,,,12345678,,, A004B3 ';

    const records = parseMasterCsv(content);
    expect(records[0]?.registration).toBe('N12345');
    expect(records[0]?.icaoHex).toBe('A004B3');
    expect(records[0]?.name).toBe('ACME LLC');
    expect(records[0]?.typeAircraft).toBe('4');
  });

  it('returns empty array for empty content', () => {
    expect(parseMasterCsv('').length).toBe(0);
  });

  it('skips blank lines in the middle of the file', () => {
    const content =
      MASTER_HEADER +
      '\n12345,28246,7100510,00000,2005,4,ACME LLC,,,ANYTOWN,VA,20001,2,001,US,,,1N,4,1,A,50012345,,,,,,,,,12345678,,,A004B3' +
      '\n   ' +
      '\n67890,28247,7100510,00000,2010,4,BETA LLC,,,ANYTOWN,VA,20001,2,001,US,,,1N,4,1,A,50012346,,,,,,,,,12345679,,,A004B4';

    const records = parseMasterCsv(content);
    expect(records.length).toBe(2);
  });

  it('returns empty string for missing optional columns', () => {
    // Header omits NAME so getField returns "" via the columns.get(idx)===undefined branch.
    const minimalHeader =
      'N-NUMBER,SERIAL NUMBER,MFR MDL CODE,ENG MFR MDL,YEAR MFR,TYPE AIRCRAFT,TYPE ENGINE,MODE S CODE HEX';
    const content = minimalHeader + '\n12345,28246,7100510,00000,2005,4,1,A004B3';

    const records = parseMasterCsv(content);
    expect(records[0]?.name).toBe('');
    expect(records[0]?.statusCode).toBe('');
    expect(records[0]?.expirationDate).toBe(undefined);
    expect(records[0]?.icaoHex).toBe('A004B3');
  });
});

describe('parseAcftRefCsv', () => {
  it('parses a valid ACFTREF record', () => {
    const content = ACFTREF_HEADER + '\n7100510,CESSNA,172S,4,1,1,0,1,4,CLASS 1,126,,';

    const ref = parseAcftRefCsv(content);
    expect(ref.size).toBe(1);
    const record = ref.get('7100510');
    expect(record?.mfr).toBe('CESSNA');
    expect(record?.model).toBe('172S');
  });

  it('skips records with empty CODE', () => {
    const content = ACFTREF_HEADER + '\n,UNKNOWN,MYSTERY,4,1,1,0,1,4,CLASS 1,0,,';

    const ref = parseAcftRefCsv(content);
    expect(ref.size).toBe(0);
  });

  it('returns empty map for empty content', () => {
    expect(parseAcftRefCsv('').size).toBe(0);
  });

  it('skips blank lines in the middle of the file', () => {
    const content =
      ACFTREF_HEADER +
      '\n7100510,CESSNA,172S,4,1,1,0,1,4,CLASS 1,126,,' +
      '\n  ' +
      '\n7100511,CESSNA,182,4,1,1,0,1,4,CLASS 1,135,,';

    const ref = parseAcftRefCsv(content);
    expect(ref.size).toBe(2);
  });
});

describe('joinRegistryRecords', () => {
  it('joins master records with ACFTREF data', () => {
    const master = parseMasterCsv(
      MASTER_HEADER +
        '\n12345,28246,7100510,00000,2005,4,ACME LLC,,,ANYTOWN,VA,20001,2,001,US,,,1N,4,1,A,50012345,,,,,,,,,12345678,,,A004B3',
    );
    const acftRef = parseAcftRefCsv(
      ACFTREF_HEADER + '\n7100510,CESSNA,172S,4,1,1,0,1,4,CLASS 1,126,,',
    );

    const joined = joinRegistryRecords(master, acftRef);
    expect(joined.length).toBe(1);
    expect(joined[0]?.icaoHex).toBe('A004B3');
    expect(joined[0]?.registration).toBe('N12345');
    expect(joined[0]?.make).toBe('CESSNA');
    expect(joined[0]?.model).toBe('172S');
    expect(joined[0]?.operator).toBe('ACME LLC');
    expect(joined[0]?.aircraftType).toBe('fixedWingSingleEngine');
    expect(joined[0]?.engineType).toBe('reciprocating');
    expect(joined[0]?.yearManufactured).toBe(2005);
  });

  it('maps the status code and carries the expiration date', () => {
    const master = parseMasterCsv(MASTER_HEADER + '\n' + masterRow(VALID_ROW));

    const joined = joinRegistryRecords(master, new Map());
    expect(joined[0]?.registrationStatus).toBe('valid');
    expect(joined[0]?.registrationExpirationDate).toBe('2029-06-30');
  });

  it('keeps a registration that is not valid, with its status', () => {
    const master = parseMasterCsv(
      MASTER_HEADER +
        '\n' +
        masterRow({ ...VALID_ROW, 'STATUS CODE': '22', 'EXPIRATION DATE': '' }),
    );

    const joined = joinRegistryRecords(master, new Map());
    expect(joined.length).toBe(1);
    expect(joined[0]?.registrationStatus).toBe('revokedCanceled');
    expect(joined[0]?.registrationExpirationDate).toBe(undefined);
  });

  it('leaves the status unset for a blank or unknown status code', () => {
    const master = parseMasterCsv(
      MASTER_HEADER +
        '\n' +
        masterRow({ ...VALID_ROW, 'STATUS CODE': '' }) +
        '\n' +
        masterRow({ ...VALID_ROW, 'STATUS CODE': '99', 'MODE S CODE HEX': 'A004B4' }),
    );

    const joined = joinRegistryRecords(master, new Map());
    expect(joined[0]?.registrationStatus).toBe(undefined);
    expect(joined[1]?.registrationStatus).toBe(undefined);
  });

  it('leaves the operator unset for the FAA placeholder registrant names', () => {
    const master = parseMasterCsv(
      MASTER_HEADER +
        '\n' +
        masterRow({ ...VALID_ROW, NAME: 'REGISTRATION PENDING', 'STATUS CODE': 'R' }) +
        '\n' +
        masterRow({
          ...VALID_ROW,
          NAME: 'SALE REPORTED',
          'STATUS CODE': '7',
          'MODE S CODE HEX': 'A004B4',
        }),
    );

    const joined = joinRegistryRecords(master, new Map());
    expect(joined[0]?.operator).toBe(undefined);
    expect(joined[0]?.registrationStatus).toBe('registrationPending');
    expect(joined[1]?.operator).toBe(undefined);
    expect(joined[1]?.registrationStatus).toBe('saleReported');
  });

  it('maps TYPE AIRCRAFT O to other', () => {
    const master = parseMasterCsv(
      MASTER_HEADER + '\n' + masterRow({ ...VALID_ROW, 'TYPE AIRCRAFT': 'O' }),
    );

    const joined = joinRegistryRecords(master, new Map());
    expect(joined[0]?.aircraftType).toBe('other');
  });

  it('handles missing ACFTREF match', () => {
    const master = parseMasterCsv(
      MASTER_HEADER +
        '\n12345,28246,9999999,00000,2005,4,ACME LLC,,,ANYTOWN,VA,20001,2,001,US,,,1N,4,1,A,50012345,,,,,,,,,12345678,,,A004B3',
    );
    const acftRef = parseAcftRefCsv(ACFTREF_HEADER);

    const joined = joinRegistryRecords(master, acftRef);
    expect(joined[0]?.make).toBe(undefined);
    expect(joined[0]?.model).toBe(undefined);
    expect(joined[0]?.registration).toBe('N12345');
  });

  it('omits optional fields when empty', () => {
    const master = parseMasterCsv(
      MASTER_HEADER +
        '\n12345,28246,7100510,00000,,4,,,,ANYTOWN,VA,20001,2,001,US,,,1N,,,A,50012345,,,,,,,,,12345678,,,A004B3',
    );
    const acftRef = parseAcftRefCsv(ACFTREF_HEADER);

    const joined = joinRegistryRecords(master, acftRef);
    expect(joined[0]?.operator).toBe(undefined);
    expect(joined[0]?.yearManufactured).toBe(undefined);
    expect(joined[0]?.aircraftType).toBe(undefined);
    expect(joined[0]?.engineType).toBe(undefined);
  });
});
