import { describe, it, expect } from 'vitest';
import { parseMasterCsv, parseAcftRefCsv, joinRegistryRecords } from './faa-parser.js';

const MASTER_HEADER =
  'N-NUMBER,SERIAL NUMBER,MFR MDL CODE,ENG MFR MDL,YEAR MFR,TYPE REGISTRANT,NAME,STREET,STREET2,CITY,STATE,ZIP CODE,REGION,COUNTY,COUNTRY,LAST ACTION DATE,CERT ISSUE DATE,CERTIFICATION,TYPE AIRCRAFT,TYPE ENGINE,STATUS CODE,MODE S CODE,FRACT OWNER,AIR WORTH DATE,OTHER NAMES(1),OTHER NAMES(2),OTHER NAMES(3),OTHER NAMES(4),OTHER NAMES(5),EXPIRATION DATE,UNIQUE ID,KIT MFR,KIT MODEL,MODE S CODE HEX';

const ACFTREF_HEADER =
  'CODE,MFR,MODEL,TYPE-ACFT,TYPE-ENG,AC-CAT,BUILD-CERT-IND,NO-ENG,NO-SEATS,AC-WEIGHT,SPEED,TC-DATA-SHEET,TC-DATA-HOLDER';

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
