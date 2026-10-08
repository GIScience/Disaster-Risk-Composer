/**
 * Region ID columns differ by boundary source. Countries with OCHA COD-AB boundaries use
 * "<LEVEL>_PCODE" (e.g. "ADM2_PCODE"); EU countries with Eurostat GISCO NUTS boundaries use
 * "NUTS<n>_CODE" ("NUTS3_CODE" at ADM2, "NUTS1_CODE"/"NUTS2_CODE" at ADM1). The parquet and the
 * PMTiles of a country always use the same column/property name. A country can switch between
 * the two when the pipeline is rerun, so the column is detected per file, never assumed.
 */

const REGION_ID_PATTERN = /^(ADM\d?_PCODE|ADM_PCODE|NUTS\d?_CODE|NUTS_CODE)$/i;
const REGION_NAME_PATTERN = /^ADM\d?_NAME$/i;

export function isRegionIdColumn(column: string): boolean {
  return REGION_ID_PATTERN.test(column);
}

export function isRegionNameColumn(column: string): boolean {
  return REGION_NAME_PATTERN.test(column);
}

/** Picks the ID column of a file at the given admin level ("ADM2" or "ADM1"). */
export function detectRegionIdColumn(
  columns: string[],
  level: string,
): string | null {
  const ocha = columns.find((c) => c === `${level}_PCODE`);
  if (ocha) return ocha;
  // Most specific NUTS level first (NUTS3 at ADM2; NUTS2 or NUTS1 at ADM1).
  const nuts = columns
    .filter((c) => /^NUTS\d_CODE$/.test(c))
    .sort()
    .reverse()[0];
  if (nuts) return nuts;
  return columns.find((c) => /^ADM\d_PCODE$/.test(c)) ?? null;
}

export function isNutsIdColumn(column: string): boolean {
  return /^NUTS\d?_CODE$/i.test(column);
}

/** User-facing name of the region ID, e.g. for table headers and upload messages. */
export function regionIdLabel(column: string): string {
  return isNutsIdColumn(column) ? "NUTS code" : "P-code";
}
