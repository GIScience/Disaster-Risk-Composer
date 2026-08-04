// Splits one CSV line into fields
function parseCSVLine(line: string): string[] {
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
    } else if (char === ",") {
      fields.push(field);
      field = "";
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
}

const NUMERIC_PATTERN = /^-?\d+(\.\d+)?$/;

// Only coerces fields that are entirely numeric, so PCODEs (which always carry a letter prefix in the CSV) are left as strings.
function coerceValue(value: string): string | number {
  return value !== "" && NUMERIC_PATTERN.test(value) ? Number(value) : value;
}

const BOM = "﻿";

export function parseIndicatorCSVText(text: string): Record<string, any>[] {
  const withoutBom = text.startsWith(BOM) ? text.slice(BOM.length) : text;
  const lines = withoutBom.split(/\r\n|\n|\r/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.trim());
  const rows: Record<string, any>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, any> = {};
    headers.forEach((header, idx) => {
      row[header] = coerceValue((values[idx] ?? "").trim());
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
