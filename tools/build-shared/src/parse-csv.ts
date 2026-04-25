/**
 * A parsed CSV record as a map from column name to trimmed string value.
 * Empty strings are omitted.
 */
export type CsvRecord = Record<string, string>;

/**
 * UTF-8 byte order mark code point. Stripped from the very first character
 * of the input when present, otherwise the BOM gets glued to the first
 * column name and breaks `indexOf` lookups against expected header strings.
 */
const UTF8_BOM = '\uFEFF';

/**
 * Parses a single CSV line that may contain a mix of quoted and unquoted
 * fields. Handles the FAA NASR format where string fields are quoted but
 * numeric fields may be unquoted, including escaped double-quotes (`""`)
 * inside quoted fields. A leading UTF-8 BOM is stripped so header parsing
 * works on files that ship one.
 *
 * @param line - Raw CSV line to parse.
 * @returns Array of field values with quotes stripped.
 */
export function parseCsvLine(line: string): string[] {
  const stripped = line.startsWith(UTF8_BOM) ? line.slice(1) : line;
  const fields: string[] = [];
  let i = 0;

  while (i <= stripped.length) {
    if (i === stripped.length) {
      fields.push('');
      break;
    }

    if (stripped[i] === '"') {
      // Quoted field - find the closing quote.
      let j = i + 1;
      let value = '';
      while (j < stripped.length) {
        if (stripped[j] === '"') {
          if (stripped[j + 1] === '"') {
            // Escaped double-quote inside a quoted field.
            value += '"';
            j += 2;
          } else {
            // End of quoted field.
            break;
          }
        } else {
          value += stripped[j];
          j++;
        }
      }
      fields.push(value);
      // Advance past closing quote and comma (or end of line).
      i = j + 2;
    } else {
      // Unquoted field - find the next comma.
      const commaIdx = stripped.indexOf(',', i);
      if (commaIdx === -1) {
        fields.push(stripped.substring(i));
        break;
      }
      fields.push(stripped.substring(i, commaIdx));
      i = commaIdx + 1;
    }
  }

  return fields;
}

/**
 * Parses a full CSV string into an array of record objects keyed by column
 * name. Only non-empty, trimmed values are included in each record.
 *
 * @param text - Full CSV text content.
 * @returns Array of parsed records.
 */
export function parseCsv(text: string): CsvRecord[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const firstLine = lines[0];
  if (!firstLine) {
    return [];
  }

  const headers = parseCsvLine(firstLine);
  const records: CsvRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      continue;
    }
    const values = parseCsvLine(line);
    const record: CsvRecord = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const val = values[j]?.trim();
      if (header && val) {
        record[header] = val;
      }
    }
    records.push(record);
  }

  return records;
}
