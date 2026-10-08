import type { DimensionColumns } from "@/enums/dimensions";
import { DIMENSION_PREFIX_VALUES } from "@/enums/dimensions";
import { HazardPrefix, resolveHazardPrefix } from "@/enums/hazards";
import { isRegionIdColumn, isRegionNameColumn } from "@/utils/regionId";

const EXP_FLOOD_COL = `exp_${HazardPrefix.FLOOD}`;
const EXP_CYCLONE_COL = `exp_${HazardPrefix.CYCLONE}`;

// Composite/result columns written by the GAIA pipeline (and recomputed by calculateDynamicRisk).
// They are outputs, never input indicators or custom dimensions - even where their name looks
// like one (e.g. "exp_flood" starts with "exp_", "coping_flood" would otherwise become a custom
// "coping" dimension). Add any new pipeline output column here.
const OUTPUT_COLUMN_NAMES = new Set([
  "vul",
  "cop",
  "exp_flood",
  "exp_cyclone",
  EXP_FLOOD_COL,
  EXP_CYCLONE_COL,
  "coping_flood",
  "coping_cyclone",
]);
const OUTPUT_COLUMN_PREFIXES = ["sus_", "risk_", "rank_", "ranking"];

export function isOutputColumn(column: string): boolean {
  const lower = column.toLowerCase();
  return (
    OUTPUT_COLUMN_NAMES.has(lower) ||
    OUTPUT_COLUMN_PREFIXES.some((prefix) => lower.startsWith(prefix)) ||
    // Region IDs/names (ADM2_PCODE, NUTS3_CODE, ADM2_NAME, ...) are never indicators either.
    isRegionIdColumn(column) ||
    isRegionNameColumn(column)
  );
}

// "rank"/"ranking" columns are always excluded from indicator/dimension discovery - the
// Ranking tab is a read-only view of the already-computed risk score, never a weighted input.
export const RESERVED_DIMENSION_PREFIXES = new Set([
  ...DIMENSION_PREFIX_VALUES,
  "risk",
  "sus",
  "rank",
  "ranking",
]);
const RESERVED_PREFIXES = RESERVED_DIMENSION_PREFIXES;

// Coping capacity columns are inverted (1 - value) by default, since for most of them a higher
// value means better coping (more facilities, more people with access), and the dimension score
// is the *lack* of coping capacity. These already measure a lack of coping capacity (higher =
// worse) and so must not be inverted.
const LACK_OF_COPING_COLUMN_PATTERNS = [
  /_evac_time_minutes_(mean|median|max)$/,
  /_pixels_at_risk$/,
  /_dependency_ratio$/,
];

// Hazard-specific coping columns (flood return periods "RP10".."RP500", cyclone "kt34") only
// feed that hazard's susceptibility; all other coping columns feed both.
export function copingColumnHazard(column: string): "flood" | "cyclone" | null {
  if (/^cop_RP\d+_/.test(column)) return "flood";
  if (/^cop_kt34_/.test(column)) return "cyclone";
  return null;
}

export function isInvertedCopingColumn(column: string): boolean {
  return (
    column.startsWith("cop_") &&
    !LACK_OF_COPING_COLUMN_PATTERNS.some((pattern) => pattern.test(column))
  );
}

// The Ranking tab is a read-only view of the already-computed risk score, never a weighted will not be selected
export function isRankingColumn(column: string): boolean {
  return column.toLowerCase().startsWith("ranking");
}

/**
 * Detects custom indicator dimensions from column naming convention (e.g. "edu_literacy_rate" -> "edu"),
 * the same convention already used for "vul_" / "cop_" / "exp_". A prefix only qualifies as a dimension
 * if at least one of its member columns actually holds numeric data - this keeps admin/name columns
 * (e.g. "ADM2_NAME") from being picked up as bogus dimensions.
 */
export function discoverCustomDimensionPrefixes(data: any[]): string[] {
  if (!data || data.length === 0) return [];
  const cols = Object.keys(data[0]);
  const candidates = new Set<string>();

  for (const col of cols) {
    if (isOutputColumn(col)) continue;
    const idx = col.indexOf("_");
    if (idx === -1) continue;
    const prefix = col.slice(0, idx);
    if (RESERVED_PREFIXES.has(prefix.toLowerCase())) continue;
    candidates.add(prefix);
  }

  return Array.from(candidates).filter((prefix) => {
    const memberCols = cols.filter((c) => c.startsWith(`${prefix}_`));
    return memberCols.some((c) =>
      data.some((row) => row[c] !== null && row[c] !== "" && !isNaN(Number(row[c]))),
    );
  });
}

export function getDimensionColumns(
    data: any[],
    selectedDisaster: string,
): DimensionColumns & { hazardPrefix: string } {
    const disasterSuffix = selectedDisaster.replace('risk_', '');
    const hazardPrefix = resolveHazardPrefix(disasterSuffix);

    const result: DimensionColumns = { exp: '', vul: '', cop: '' };
    if (!data || data.length === 0) return { ...result, hazardPrefix };

    const cols = Object.keys(data[0]);
    result.exp = cols.find(c => c === `exp_${disasterSuffix}`) || cols.find(c => c === 'exp') || '';
    result.vul = cols.find(c => c === 'vul') || '';
    result.cop = cols.find(c => c === 'cop') || '';

    for (const prefix of discoverCustomDimensionPrefixes(data)) {
        const composite = cols.find((c) => c === prefix);
        if (composite) result[prefix] = composite;
    }

    return { ...result, hazardPrefix };
}

/**
 * `selectedDisaster` (e.g. "risk_flood") picks which hazard's coping score is written to the
 * row's composite "cop" column (shown in the dashboard), since coping differs per hazard.
 */
// Number(null) and Number("") are 0, which would turn missing values into real zeros - treat
// them as missing (NaN) so the per-dimension missing-value fallbacks below apply.
function toNumber(value: unknown): number {
  return value === null || value === undefined || value === "" ? NaN : Number(value);
}

export function calculateDynamicRisk(
    data: any[],
    weights: Record<string, number>,
    selectedDisaster = "",
): any[] {
    if (!data.length) return data;

    const cols = Object.keys(data[0]);
    const customDimensionPrefixes = discoverCustomDimensionPrefixes(data);
    const susceptibilityDims = ['vul', 'cop', ...customDimensionPrefixes];
    const displayedHazard = selectedDisaster.includes('cyclone') ? 'cyclone' : 'flood';

    const bounds: Record<string, { min: number, max: number }> = {};

    for (const col of cols) {
        const isTrackedPrefix = col.startsWith('exp_') || col.startsWith('vul_') || col.startsWith('cop_')
            || customDimensionPrefixes.some((p) => col.startsWith(`${p}_`));
        if (!isTrackedPrefix || isOutputColumn(col)) continue;

        let min = Infinity;
        let max = -Infinity;
        for (const row of data) {
            const v = toNumber(row[col]);
            if (isNaN(v)) continue;
            if (v < min) min = v;
            if (v > max) max = v;
        }
        if (min !== Infinity) {
            bounds[col] = { min, max };
        }
    }

    const normalize = (val: number, col: string) => {
        if (isNaN(val) || !bounds[col]) return val;
        const { min, max } = bounds[col];
        if (max === min) return val;
        return (val - min) / (max - min);
    };

    const getW = (col: string) => weights[col] ?? 1.0;

    for (const row of data) {
        // Remove stale computed columns that may linger from original parquet data
        delete row['cop'];
        delete row['vul'];
        delete row['exp_flood'];
        delete row['sus_flood'];
        delete row['risk_flood'];
        delete row['exp_cyclone'];
        delete row['sus_cyclone'];
        delete row['risk_cyclone'];
        delete row[EXP_FLOOD_COL];
        delete row[EXP_CYCLONE_COL];
        for (const prefix of customDimensionPrefixes) delete row[prefix];

        const dimSum: Record<string, number> = {};
        const dimW: Record<string, number> = {};
        // Hazard-specific coping contributions, kept apart from the shared ones in dimSum.cop
        const copHazardSum = { flood: 0, cyclone: 0 };
        const copHazardW = { flood: 0, cyclone: 0 };

        let floodSum = 0; let floodW = 0;
        let cycloneSum = 0; let cycloneW = 0;

        for (const col of cols) {
            if (isOutputColumn(col) || customDimensionPrefixes.includes(col)) continue;

            const w = getW(col);
            let rawValue = toNumber(row[col]);
            let val = normalize(rawValue, col);

            let matchedDim: string | null = null;
            if (col.startsWith('cop_')) matchedDim = 'cop';
            else if (col.startsWith('vul_')) matchedDim = 'vul';
            else {
                for (const prefix of customDimensionPrefixes) {
                    if (col.startsWith(`${prefix}_`)) { matchedDim = prefix; break; }
                }
            }

            if (matchedDim) {
                // Missing values count as the worst case for their dimension.
                const inverted = isInvertedCopingColumn(col);
                if (isNaN(val)) val = inverted ? 0 : 1;
                const contribution = inverted ? (1 - val) : val;
                const copHazard = matchedDim === 'cop' ? copingColumnHazard(col) : null;
                if (copHazard) {
                    copHazardSum[copHazard] += contribution * w;
                    copHazardW[copHazard] += w;
                    continue;
                }
                dimSum[matchedDim] = (dimSum[matchedDim] ?? 0) + contribution * w;
                dimW[matchedDim] = (dimW[matchedDim] ?? 0) + w;
                continue;
            }

            if (isNaN(val)) val = 0;
            if (col.startsWith(`${EXP_FLOOD_COL}_`)) {
                floodSum += val * w;
                floodW += w;
            } else if (col.startsWith(`${EXP_CYCLONE_COL}_`)) {
                cycloneSum += val * w;
                cycloneW += w;
            }
        }

        // A dimension with no assigned columns (dimW <= 0) is dropped from the susceptibility
        // score rather than treated as 0 - a custom upload isn't required to cover every base
        // dimension, so susceptibility is the geometric mean of whichever dimensions actually
        // have data for this row. Coping is scored per hazard: shared columns plus that hazard's
        // own (e.g. flood evacuation times never affect cyclone susceptibility).
        const susceptibilityFor = (hazard: 'flood' | 'cyclone') => {
            const dimScore: Record<string, number> = {};
            for (const dim of susceptibilityDims) {
                let sum = dimSum[dim] ?? 0;
                let w = dimW[dim] ?? 0;
                if (dim === 'cop') {
                    sum += copHazardSum[hazard];
                    w += copHazardW[hazard];
                }
                if (w > 0) dimScore[dim] = sum / w;
            }
            const presentDims = Object.keys(dimScore);
            const score = presentDims.length > 0
                ? Math.pow(presentDims.reduce((acc, dim) => acc * dimScore[dim], 1), 1 / presentDims.length)
                : null;
            return { dimScore, score };
        };

        const floodSus = susceptibilityFor('flood');
        const cycloneSus = susceptibilityFor('cyclone');
        const displayed = displayedHazard === 'cyclone' ? cycloneSus : floodSus;
        for (const [dim, score] of Object.entries(displayed.dimScore)) row[dim] = score;

        if (floodW > 0) {
            let expFloScore = floodSum / floodW;
            row['exp_flood'] = expFloScore;
            if (floodSus.score !== null) {
                row['sus_flood'] = floodSus.score;
                row['risk_flood'] = Math.sqrt(expFloScore * floodSus.score);
            }
        }
        if (cycloneW > 0) {
            let expCycScore = cycloneSum / cycloneW;
            row['exp_cyclone'] = expCycScore;
            if (cycloneSus.score !== null) {
                row['sus_cyclone'] = cycloneSus.score;
                row['risk_cyclone'] = Math.sqrt(expCycScore * cycloneSus.score);
            }
        }
    }

    return data;
}
