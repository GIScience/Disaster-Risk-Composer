export type CSVDelimiter = "," | ";" | "\t";

// Splits one CSV line into fields
export function parseCSVLine(line: string, delimiter: CSVDelimiter = ","): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      fields.push(field);
      field = "";
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
}

// Excel in many European locales saves "CSV" with ";" between fields (and "," as the decimal
// separator), so pick whichever candidate occurs most often in the header, outside quotes.
function detectDelimiter(headerLine: string): CSVDelimiter {
  const counts: Record<CSVDelimiter, number> = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  for (const char of headerLine) {
    if (char === '"') inQuotes = !inQuotes;
    else if (!inQuotes && char in counts) counts[char as CSVDelimiter]++;
  }
  return (Object.keys(counts) as CSVDelimiter[]).reduce((best, d) =>
    counts[d] > counts[best] ? d : best,
  );
}

const BOM = "\uFEFF";

// Shared by the indicator and weight file parsers: strips a BOM, splits lines (any line ending)
// and fields (detected delimiter, quoted fields supported).
export function splitCSVText(text: string): {
  delimiter: CSVDelimiter;
  rows: string[][];
} {
  const withoutBom = text.startsWith(BOM) ? text.slice(BOM.length) : text;
  const lines = withoutBom
    .split(/\r\n|\n|\r/)
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { delimiter: ",", rows: [] };
  const delimiter = detectDelimiter(lines[0]);
  return { delimiter, rows: lines.map((l) => parseCSVLine(l, delimiter)) };
}

// With a non-comma delimiter, "," is the decimal separator (e.g. "0,5"), so accept and convert it.
export function parseCSVNumber(value: string, delimiter: CSVDelimiter): number {
  const normalized = delimiter === "," ? value : value.replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}

// Only coerces fields that are entirely numeric, so PCODEs (which always carry a letter prefix in the CSV) are left as strings.
function coerceValue(value: string, delimiter: CSVDelimiter): string | number {
  if (value === "") return value;
  const num = parseCSVNumber(value, delimiter);
  return isNaN(num) ? value : num;
}

export function parseIndicatorCSVText(text: string): Record<string, any>[] {
  const { delimiter, rows: lines } = splitCSVText(text);
  if (lines.length < 2) return [];

  const headers = lines[0].map((h) => h.trim());
  const rows: Record<string, any>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i];
    const row: Record<string, any> = {};
    headers.forEach((header, idx) => {
      row[header] = coerceValue((values[idx] ?? "").trim(), delimiter);
    });
    rows.push(row);
  }
  return rows;
}

export async function parseIndicatorCSV(
  file: File,
): Promise<Record<string, any>[]> {
  const text = await file.text();
  return parseIndicatorCSVText(text);
}
