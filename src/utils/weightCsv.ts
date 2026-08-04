export interface WeightCsvEntry {
  category: string;
  weight: number;
  activated: boolean | null;
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

  const headers = lines[0].split(",").map((h) => h.trim());
  const nameIdx = headers.indexOf("variable_name");
  const catIdx = headers.indexOf("category");
  const weightIdx = headers.indexOf("weight");
  const actIdx = headers.indexOf("activated");
  if (nameIdx === -1 || catIdx === -1 || weightIdx === -1) return {};

  const csvData: Record<string, WeightCsvEntry> = {};
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",").map((p) => p.trim());
    if (parts.length <= Math.max(nameIdx, catIdx, weightIdx)) continue;
    const rawName = parts[nameIdx];
    const category = parts[catIdx];
    const weight = parseFloat(parts[weightIdx]);
    const activated =
      actIdx !== -1 && parts.length > actIdx
        ? parts[actIdx].toUpperCase() === "TRUE"
        : null;
    if (rawName && category && !isNaN(weight)) {
      csvData[rawName] = {
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
