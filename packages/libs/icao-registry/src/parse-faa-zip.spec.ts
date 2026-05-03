import AdmZip from 'adm-zip';
import { describe, it, expect } from 'vitest';

import { parseFaaRegistryZip } from './parse-faa-zip.js';

const MASTER_HEADER =
  'N-NUMBER,SERIAL NUMBER,MFR MDL CODE,ENG MFR MDL,YEAR MFR,TYPE REGISTRANT,NAME,STREET,STREET2,CITY,STATE,ZIP CODE,REGION,COUNTY,COUNTRY,LAST ACTION DATE,CERT ISSUE DATE,CERTIFICATION,TYPE AIRCRAFT,TYPE ENGINE,STATUS CODE,MODE S CODE,FRACT OWNER,AIR WORTH DATE,OTHER NAMES(1),OTHER NAMES(2),OTHER NAMES(3),OTHER NAMES(4),OTHER NAMES(5),EXPIRATION DATE,UNIQUE ID,KIT MFR,KIT MODEL,MODE S CODE HEX';

const ACFTREF_HEADER =
  'CODE,MFR,MODEL,TYPE-ACFT,TYPE-ENG,AC-CAT,BUILD-CERT-IND,NO-ENG,NO-SEATS,AC-WEIGHT,SPEED,TC-DATA-SHEET,TC-DATA-HOLDER';

/**
 * Creates a synthetic ReleasableAircraft.zip buffer containing
 * MASTER.txt and ACFTREF.txt with the given content.
 */
function createTestZip(masterContent: string, acftRefContent: string): Buffer {
  const zip = new AdmZip();
  zip.addFile('MASTER.txt', Buffer.from(masterContent, 'utf-8'));
  zip.addFile('ACFTREF.txt', Buffer.from(acftRefContent, 'utf-8'));
  return zip.toBuffer();
}

describe('parseFaaRegistryZip', () => {
  it('parses a ZIP with valid MASTER and ACFTREF data', () => {
    const master =
      MASTER_HEADER +
      '\n12345,28246,7100510,00000,2005,4,ACME LLC,123 MAIN ST,,ANYTOWN,VA,20001,2,001,US,20230101,20050601,1N,4,1,A,50012345,,,,,,,,20260601,12345678,,,A004B3';
    const acftRef = ACFTREF_HEADER + '\n7100510,CESSNA,172S,4,1,1,0,1,4,CLASS 1,126,,';

    const records = parseFaaRegistryZip(createTestZip(master, acftRef));

    expect(records.length).toBe(1);
    expect(records[0]?.icaoHex).toBe('A004B3');
    expect(records[0]?.registration).toBe('N12345');
    expect(records[0]?.make).toBe('CESSNA');
    expect(records[0]?.model).toBe('172S');
    expect(records[0]?.operator).toBe('ACME LLC');
    expect(records[0]?.aircraftType).toBe('fixedWingSingleEngine');
    expect(records[0]?.engineType).toBe('reciprocating');
    expect(records[0]?.yearManufactured).toBe(2005);
  });

  it('handles multiple records', () => {
    const master =
      MASTER_HEADER +
      '\n12345,28246,7100510,00000,2005,4,ACME LLC,,,ANYTOWN,VA,20001,2,001,US,,,1N,4,1,A,50012345,,,,,,,,,12345678,,,A004B3' +
      '\n67890,99999,2800100,00000,2018,4,SKY INC,,,OTHERTOWN,CA,90001,2,001,US,,,1N,5,5,A,50067890,,,,,,,,,87654321,,,B00123';
    const acftRef =
      ACFTREF_HEADER +
      '\n7100510,CESSNA,172S,4,1,1,0,1,4,CLASS 1,126,,' +
      '\n2800100,BOEING,737-800,5,5,1,0,2,189,CLASS 3,453,,';

    const records = parseFaaRegistryZip(createTestZip(master, acftRef));

    expect(records.length).toBe(2);
    expect(records[0]?.registration).toBe('N12345');
    expect(records[0]?.make).toBe('CESSNA');
    expect(records[1]?.registration).toBe('N67890');
    expect(records[1]?.make).toBe('BOEING');
    expect(records[1]?.model).toBe('737-800');
    expect(records[1]?.aircraftType).toBe('fixedWingMultiEngine');
    expect(records[1]?.engineType).toBe('turboFan');
  });

  it('throws if MASTER.txt is missing from the ZIP', () => {
    const zip = new AdmZip();
    zip.addFile('ACFTREF.txt', Buffer.from(ACFTREF_HEADER, 'utf-8'));

    expect(() => parseFaaRegistryZip(zip.toBuffer())).toThrow('MASTER.txt not found in ZIP');
  });

  it('throws if ACFTREF.txt is missing from the ZIP', () => {
    const zip = new AdmZip();
    zip.addFile('MASTER.txt', Buffer.from(MASTER_HEADER, 'utf-8'));

    expect(() => parseFaaRegistryZip(zip.toBuffer())).toThrow('ACFTREF.txt not found in ZIP');
  });

  it('handles case-insensitive file name matching', () => {
    const zip = new AdmZip();
    zip.addFile(
      'master.txt',
      Buffer.from(
        MASTER_HEADER +
          '\n12345,28246,7100510,00000,2005,4,ACME LLC,,,ANYTOWN,VA,20001,2,001,US,,,1N,4,1,A,50012345,,,,,,,,,12345678,,,A004B3',
        'utf-8',
      ),
    );
    zip.addFile('acftref.txt', Buffer.from(ACFTREF_HEADER, 'utf-8'));

    const records = parseFaaRegistryZip(zip.toBuffer());
    expect(records.length).toBe(1);
    expect(records[0]?.icaoHex).toBe('A004B3');
  });
});
