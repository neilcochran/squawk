import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

/**
 * Parses a single line of the FAA NASR APT_BASE.csv format into an array of
 * field values. Every field in the FAA CSV is wrapped in double quotes, so the
 * strategy is to strip the leading and trailing quote from the whole line and
 * then split on the literal sequence `","`.
 */
function parseCsvLine(line: string): string[] {
  return line.replace(/^"|"$/g, '').split('","');
}

/**
 * Reads the FAA NASR APT_BASE.csv file and returns a map from airport
 * identifier (ARPT_ID) to two-letter state code (STATE_CODE). Used to enrich
 * Class B/C/D airspace features whose shapefile does not include a state field.
 */
export async function loadAirportStates(
  /** Absolute path to the APT_BASE.csv file extracted from the NASR CSV ZIP. */
  csvPath: string,
): Promise<Map<string, string>> {
  const stateByIdent = new Map<string, string>();

  const rl = createInterface({
    input: createReadStream(csvPath),
    crlfDelay: Infinity,
  });

  let arptIdCol = -1;
  let stateCodeCol = -1;
  let isHeader = true;

  for await (const line of rl) {
    if (!line.trim()) continue;
    const fields = parseCsvLine(line);

    if (isHeader) {
      arptIdCol = fields.indexOf('ARPT_ID');
      stateCodeCol = fields.indexOf('STATE_CODE');
      if (arptIdCol === -1 || stateCodeCol === -1) {
        throw new Error(
          `APT_BASE.csv is missing expected columns. ` + `Found: ${fields.slice(0, 10).join(', ')}`,
        );
      }
      isHeader = false;
      continue;
    }

    const arptId = fields[arptIdCol];
    const stateCode = fields[stateCodeCol];
    if (arptId && stateCode) {
      stateByIdent.set(arptId, stateCode);
    }
  }

  return stateByIdent;
}
