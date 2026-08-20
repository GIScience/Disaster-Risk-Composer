export interface WeightCsvEntry {
  category: string;
  weight: number;
  activated: boolean | null;
}

// Also used by useRiskLogic.ts to derive indicator column names from uploaded file headers.
// Defined here (rather than in useRiskLogic.ts) so parseWeightsCSVText can normalize
// "variable_name" values the same way, without a circular import between the two modules.
export function sanitizeIndicatorName(name: string) {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "indicator";
}

// Strips a wrapping pair of double quotes from a CSV field (e.g. `"0.2"` -> `0.2`), unescaping
// doubled quotes inside. Fields are otherwise split on raw "," (no support for commas embedded
// inside quotes), which is enough for the "variable_name,category,weight,direction,activated"
// shape this parser targets.
function stripQuotes(field: string): string {
  if (field.length >= 2 && field.startsWith('"') && field.endsWith('"')) {
    return field.slice(1, -1).replace(/""/g, '"');
  }
  return field;
}

// Shared by the Weights tab's upload/download flow (useIndicatorWeights.ts) and the "replace"
// upload flow (UploadModal.vue), so both parse the same "variable_name,category,weight,
// direction,activated" CSV shape identically.
export function parseWeightsCSVText(text: string): Record<string, WeightCsvEntry> {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l);
  if (lines.length < 2) return {};

  const headers = lines[0].split(",").map((h) => stripQuotes(h.trim()));
  const nameIdx = headers.indexOf("variable_name");
  const catIdx = headers.indexOf("category");
  const weightIdx = headers.indexOf("weight");
  const actIdx = headers.indexOf("activated");
  if (nameIdx === -1 || catIdx === -1 || weightIdx === -1) return {};

  const csvData: Record<string, WeightCsvEntry> = {};
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",").map((p) => stripQuotes(p.trim()));
    if (parts.length <= Math.max(nameIdx, catIdx, weightIdx)) continue;
    const rawName = parts[nameIdx];
    const category = parts[catIdx];
    const weight = parseFloat(parts[weightIdx]);
    const activated =
      actIdx !== -1 && parts.length > actIdx
        ? parts[actIdx].toUpperCase() === "TRUE"
        : null;
    if (rawName && category && !isNaN(weight)) {
      // Sanitized the same way indicator column names are (see sanitizeIndicatorName), so a
      // weight file's "variable_name" matches regardless of case/punctuation differences from
      // the uploaded indicator column header - otherwise entries that differ only in casing or
      // spacing silently miss their lookup and the indicator falls back to the 1.0 default.
      csvData[sanitizeIndicatorName(rawName)] = {
        category,
        weight: Math.min(5, Math.max(0, weight)),
        activated,
      };
    }
  }
  return csvData;
}

export interface WeightIndicatorKey {
  name: string;
  // Null when the indicator's dimension isn't known yet (e.g. before the user has manually
  // assigned it in step 2, and its column name didn't carry a recognizable dimension prefix) -
  // matched by name only, against a weight entry of any category, in that case.
  category: string | null;
}

export interface WeightMatchResult {
  matched: number;
  total: number;
  matchRate: number;
  unmatchedIndicators: WeightIndicatorKey[];
}

// Weight file "variable_name" values are the raw indicator name without its dimension prefix
// (see getRawName in useIndicatorWeights.ts) - an uploaded indicator column can already be named
// with that prefix (e.g. "vul_female_pop", matching the sample data convention), so strip it
// before looking the name up in the weight file.
export function stripDimensionPrefix(name: string, category: string): string {
  const prefix = `${category}_`;
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

// Reusable check that a weight file's (variable_name, category) entries actually cover a given
// set of indicator keys - e.g. the columns a "replace" upload assigns to dimensions. An indicator
// only counts as matched when both its sanitized name AND its assigned dimension line up with an
// entry in the weight file, since the same raw name can be reused across different categories.
export function validateIndicatorWeightMatch(
  indicatorKeys: WeightIndicatorKey[],
  weightsByName: Record<string, WeightCsvEntry>,
): WeightMatchResult {
  const unmatchedIndicators = indicatorKeys.filter((key) => {
    const lookupName = key.category
      ? stripDimensionPrefix(key.name, key.category)
      : key.name;
    const entry = weightsByName[lookupName];
    if (!entry) return true;
    return key.category !== null && entry.category !== key.category;
  });
  const total = indicatorKeys.length;
  const matched = total - unmatchedIndicators.length;
  return {
    matched,
    total,
    matchRate: total > 0 ? matched / total : 0,
    unmatchedIndicators,
  };
}
