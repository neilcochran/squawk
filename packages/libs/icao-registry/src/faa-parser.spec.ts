import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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
    assert.equal(records.length, 1);
    assert.equal(records[0]?.registration, 'N12345');
    assert.equal(records[0]?.icaoHex, 'A004B3');
    assert.equal(records[0]?.name, 'ACME AVIATION LLC');
    assert.equal(records[0]?.yearMfr, 2005);
    assert.equal(records[0]?.mfrMdlCode, '7100510');
    assert.equal(records[0]?.typeAircraft, '4');
    assert.equal(records[0]?.typeEngine, '1');
  });

  it('skips records with empty MODE S CODE HEX', () => {
    const content =
      MASTER_HEADER +
      '\n99999,12345,7100510,00000,2005,4,NO HEX LLC,,,ANYTOWN,VA,20001,2,001,US,,,1N,4,1,A,50012345,,,,,,,,,12345678,,,';

    const records = parseMasterCsv(content);
    assert.equal(records.length, 0);
  });

  it('skips records with empty N-NUMBER', () => {
    const content =
      MASTER_HEADER +
      '\n,12345,7100510,00000,2005,4,NO NNUM LLC,,,ANYTOWN,VA,20001,2,001,US,,,1N,4,1,A,50012345,,,,,,,,,12345678,,,A004B3';

    const records = parseMasterCsv(content);
    assert.equal(records.length, 0);
  });

  it('handles missing year as undefined', () => {
    const content =
      MASTER_HEADER +
      '\n12345,28246,7100510,00000,,4,ACME LLC,,,ANYTOWN,VA,20001,2,001,US,,,1N,4,1,A,50012345,,,,,,,,,12345678,,,A004B3';

    const records = parseMasterCsv(content);
    assert.equal(records[0]?.yearMfr, undefined);
  });

  it('trims whitespace from fields', () => {
    const content =
      MASTER_HEADER +
      '\n 12345 ,28246, 7100510 ,00000, 2005 ,4, ACME LLC ,,,ANYTOWN,VA,20001,2,001,US,,,1N, 4 , 1 ,A,50012345,,,,,,,,,12345678,,, A004B3 ';

    const records = parseMasterCsv(content);
    assert.equal(records[0]?.registration, 'N12345');
    assert.equal(records[0]?.icaoHex, 'A004B3');
    assert.equal(records[0]?.name, 'ACME LLC');
    assert.equal(records[0]?.typeAircraft, '4');
  });

  it('returns empty array for empty content', () => {
    assert.equal(parseMasterCsv('').length, 0);
  });
});

describe('parseAcftRefCsv', () => {
  it('parses a valid ACFTREF record', () => {
    const content = ACFTREF_HEADER + '\n7100510,CESSNA,172S,4,1,1,0,1,4,CLASS 1,126,,';

    const ref = parseAcftRefCsv(content);
    assert.equal(ref.size, 1);
    const record = ref.get('7100510');
    assert.equal(record?.mfr, 'CESSNA');
    assert.equal(record?.model, '172S');
  });

  it('skips records with empty CODE', () => {
    const content = ACFTREF_HEADER + '\n,UNKNOWN,MYSTERY,4,1,1,0,1,4,CLASS 1,0,,';

    const ref = parseAcftRefCsv(content);
    assert.equal(ref.size, 0);
  });

  it('returns empty map for empty content', () => {
    assert.equal(parseAcftRefCsv('').size, 0);
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
    assert.equal(joined.length, 1);
    assert.equal(joined[0]?.icaoHex, 'A004B3');
    assert.equal(joined[0]?.registration, 'N12345');
    assert.equal(joined[0]?.make, 'CESSNA');
    assert.equal(joined[0]?.model, '172S');
    assert.equal(joined[0]?.operator, 'ACME LLC');
    assert.equal(joined[0]?.aircraftType, 'fixedWingSingleEngine');
    assert.equal(joined[0]?.engineType, 'reciprocating');
    assert.equal(joined[0]?.yearManufactured, 2005);
  });

  it('handles missing ACFTREF match', () => {
    const master = parseMasterCsv(
      MASTER_HEADER +
        '\n12345,28246,9999999,00000,2005,4,ACME LLC,,,ANYTOWN,VA,20001,2,001,US,,,1N,4,1,A,50012345,,,,,,,,,12345678,,,A004B3',
    );
    const acftRef = parseAcftRefCsv(ACFTREF_HEADER);

    const joined = joinRegistryRecords(master, acftRef);
    assert.equal(joined[0]?.make, undefined);
    assert.equal(joined[0]?.model, undefined);
    assert.equal(joined[0]?.registration, 'N12345');
  });

  it('omits optional fields when empty', () => {
    const master = parseMasterCsv(
      MASTER_HEADER +
        '\n12345,28246,7100510,00000,,4,,,,ANYTOWN,VA,20001,2,001,US,,,1N,,,A,50012345,,,,,,,,,12345678,,,A004B3',
    );
    const acftRef = parseAcftRefCsv(ACFTREF_HEADER);

    const joined = joinRegistryRecords(master, acftRef);
    assert.equal(joined[0]?.operator, undefined);
    assert.equal(joined[0]?.yearManufactured, undefined);
    assert.equal(joined[0]?.aircraftType, undefined);
    assert.equal(joined[0]?.engineType, undefined);
  });
});
