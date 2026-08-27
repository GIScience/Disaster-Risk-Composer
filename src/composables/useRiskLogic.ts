import { watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { loadParquetData } from "../utils/duckdb";
import { checkFileExists, fetchCountries } from "../services/dataService";
import {
  calculateDynamicRisk,
  isRankingColumn,
  discoverCustomDimensionPrefixes,
} from "../utils/riskCalculation";
import {
  DimensionPrefix,
  isRiskViewMode,
  type RiskViewMode,
} from "../enums/dimensions";
import { useRiskMapStore } from "../store/riskMapStore";
import { useIsEmbedded } from "./use-is-embedded";
import {
  stripDimensionPrefix,
  sanitizeIndicatorName,
  type WeightCsvEntry,
} from "../utils/weightCsv";

export { sanitizeIndicatorName };

export type { RiskViewMode };

// A dimension key ("exp" | "vul" | "cop") custom prefix detected from column names), or "skip".
export type CustomIndicatorDimension = string;


export type UploadMode = "replace" | "append";

export interface CustomUploadPayload {
  pcodeColumn: string;
  rows: Record<string, any>[];
  assignments: Record<string, CustomIndicatorDimension | "skip">;
  mode?: UploadMode;
  // Parsed "variable_name,category,weight" weight file, keyed by variable_name. Required for
  // "replace" uploads since that mode has no prior weights to fall back on - see UploadModal.vue.
  weights?: Record<string, WeightCsvEntry>;
}

const CUSTOM_UPLOAD_MATCH_THRESHOLD = 0.9;
const customUploadStorageKey = (countryCode: string) =>
  `gaia-custom-upload:${countryCode}`;

// Stored as an array so "append" uploads can stack on top of one another across reloads.
// A "replace" upload starts the array over, since it wipes everything that came before it.
// Older saves are a single payload object rather than an array - normalize on read.
function readStoredUploads(countryCode: string): CustomUploadPayload[] {
  try {
    const saved = localStorage.getItem(customUploadStorageKey(countryCode));
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function persistCustomUpload(countryCode: string, payload: CustomUploadPayload) {
  try {
    const priorUploads =
      payload.mode === "replace" ? [] : readStoredUploads(countryCode);
    localStorage.setItem(
      customUploadStorageKey(countryCode),
      JSON.stringify([...priorUploads, payload]),
    );
  } catch (err) {
    console.warn("Could not persist custom upload to localStorage", err);
  }
}

export function useRiskLogic() {
  const route = useRoute();
  const router = useRouter();
  const store = useRiskMapStore();
  const isEmbedded = useIsEmbedded();

  const {
    selectedCountry,
    selectedDisaster,
    disasters,
    pmtilesUrl,
    pcodeField,
    matchArray,
    isLoading,
    error,
    lastLoadedData,
    rawOriginalData,
    lastLoadedCountry,
    highlightedPcode,
    indicatorWeights,
    viewMode,
    showAnalysis,
    showAboutModal,
    showUploadModal,
    showCustomDataInfo,
    pendingCustomDataCountry,
    riskViewMode,
    uploadError,
    countries,
    dimensions,
    riskViewLabel,
    dimensionColumns,
    selectedCountryName,
    existingPcodes,
    customIndicatorsReplaced,
  } = storeToRefs(store);

  if (!store.initialized) {
    selectedCountry.value = (route.query.country as string) || "";
    selectedDisaster.value = (route.query.disaster as string) || "";
    const queryDimension = route.query.dimension as string;
    if (isRiskViewMode(queryDimension, store.dimensions)) {
      riskViewMode.value = queryDimension;
    }
    store.markInitialized();
  }

  onMounted(async () => {
    store.setCountries(await fetchCountries());
    if (selectedCountry.value) {
      updateCountryData(selectedCountry.value);
    }
  });

  function updateRiskLayer(riskColumn: string, data: any[], level: string) {
    const field = `${level}_PCODE`;

    const values = data
      .map((d) => Number(d[riskColumn]))
      .filter((v) => !isNaN(v))
      .sort((a, b) => a - b);

    if (values.length === 0) {
      store.setMatchArray([]);
      return;
    }

    const q1 = values[Math.floor(values.length * 0.25)];
    const q2 = values[Math.floor(values.length * 0.5)];
    const q3 = values[Math.floor(values.length * 0.75)];

    const matches: [string, string, number][] = [];
    data.forEach((d) => {
      const val = Number(d[riskColumn]);
      if (isNaN(val)) return;
      let color = "#FFFFFF";
      if (val > q3) color = "#cc0130";
      else if (val > q2) color = "#f6a44d";
      else if (val > q1) color = "#f9d5b6";
      matches.push([d[field], color, val]);
    });

    store.setMatchArray(matches);
  }

  function refreshMapLayer() {
    const activeValueColumn = store.activeValueColumn;
    if (
      !lastLoadedData.value.length ||
      !pcodeField.value ||
      !activeValueColumn
    ) {
      store.setMatchArray([]);
      return;
    }
    const level = pcodeField.value.split("_")[0];
    updateRiskLayer(activeValueColumn, lastLoadedData.value, level);
  }

  async function updateCountryData(
    countryCode: string,
    options: { force?: boolean } = {},
  ) {
    if (!countryCode) {
      store.resetToHome();
      return;
    }

    if (!options.force && countryCode === lastLoadedCountry.value) return;

    isLoading.value = true;
    error.value = null;
    viewMode.value = "DASHBOARD";
    store.resetForNewCountry();
    if (isEmbedded) store.setShowAnalysis(false);

    try {
      const folder = countryCode.toLowerCase();
      let level = "ADM2";
      let pmtUrl = `https://hot.storage.heigit.org/heigit-hdx-public/risk_assessment_inputs/${folder}/${countryCode}_ADM2.pmtiles`;
      let parquetUrl = `https://hot.storage.heigit.org/heigit-hdx-public/risk_assessment_inputs/${folder}/${countryCode}_ADM2_risk.parquet`;

      const exists = await checkFileExists(pmtUrl);

      if (!exists) {
        level = "ADM1";
        pmtUrl = `https://hot.storage.heigit.org/heigit-hdx-public/risk_assessment_inputs/${folder}/${countryCode}_ADM1.pmtiles`;
        parquetUrl = `https://hot.storage.heigit.org/heigit-hdx-public/risk_assessment_inputs/${folder}/${countryCode}_ADM1_risk.parquet`;
      }

      const data = await loadParquetData(parquetUrl);

      const rawJSON = JSON.parse(
        JSON.stringify(data, (_, value) =>
          typeof value === "bigint" ? Number(value) : value,
        ),
      );

      store.setRawOriginalData(JSON.parse(JSON.stringify(rawJSON)));

      // Build a mapping of PCODE to its corresponding level key (e.g., ADM1_PCODE or ADM1_PCODE)
      store.setSelectedCountryPcodeFieldMap(
        JSON.parse(JSON.stringify(rawJSON)).map((row: any) => row.ADM2_PCODE),
      );

      const currentLevel = level;
      pcodeField.value = `${currentLevel}_PCODE`;
      lastLoadedData.value = rawJSON;
      lastLoadedCountry.value = countryCode;

      const riskCols = Object.keys(data[0] || {}).filter((c) =>
        c.startsWith("risk_"),
      );
      disasters.value = riskCols;

      if (
        !selectedDisaster.value ||
        !riskCols.includes(selectedDisaster.value)
      ) {
        selectedDisaster.value = riskCols[0] || "";
      }

      refreshMapLayer();
      pmtilesUrl.value = pmtUrl;

      reapplySavedCustomUpload(countryCode);
    } catch (err: any) {
      console.error("Failed to load country data:", err);
      error.value = `No Risk Assessment available for ${countryCode}`;
      pmtilesUrl.value = "";
      matchArray.value = [];
      lastLoadedData.value = [];
      viewMode.value = "HOME";
    } finally {
      isLoading.value = false;
    }
  }

  function goHome() {
    selectedCountry.value = "";
  }

  const syncRoute = () => {
    // Preserve any query params this function doesn't own (e.g. basemap).
    const query: Record<string, string> = { ...(route.query as Record<string, string>) };
    delete query.country;
    delete query.disaster;
    delete query.dimension;
    if (selectedCountry.value) query.country = selectedCountry.value;
    if (selectedCountry.value && selectedDisaster.value)
      query.disaster = selectedDisaster.value;
    if (selectedCountry.value && selectedDisaster.value && riskViewMode.value)
      query.dimension = riskViewMode.value;
    router.replace({ query }).catch(() => {});
  };

  function loadAndCalculateWithWeights(weights: Record<string, number>) {
    if (!lastLoadedData.value.length || !selectedDisaster.value) return;

    const rawJSON = JSON.parse(JSON.stringify(rawOriginalData.value));
    const recalculated = calculateDynamicRisk(rawJSON, weights);

    lastLoadedData.value = recalculated;
    refreshMapLayer();
  }

  function buildCustomColumnName(
    rawColumn: string,
    dimension: CustomIndicatorDimension,
    hazardPrefix: string,
    usedNames: Set<string>,
    mode: UploadMode,
  ) {
    const base = sanitizeIndicatorName(rawColumn);
    // In "replace" mode the uploaded file becomes the entire indicator set, so there's nothing
    // native left to distinguish "custom" columns from - drop the "custom" infix and name them
    // like native indicators. "append" uploads sit alongside native columns, so they keep it.
    // A multi-file "replace" upload passes mode "append" for every file after the first (see
    // UploadModal.vue's handleUpload) so only the first strips the native columns once - but
    // customIndicatorsReplaced is already true by then, so check it too or those later files'
    // columns would wrongly keep the "custom_" infix baked into their name permanently (it
    // leaks into the downloaded weights CSV's variable_name, unlike the "Custom:" UI label
    // which formatColName strips based on the same flag).
    const customInfix =
      mode === "replace" || customIndicatorsReplaced.value ? "" : "custom_";
    const prefix =
      dimension === DimensionPrefix.EXPOSURE
        ? `exp_${hazardPrefix}_${customInfix}`
        : `${sanitizeIndicatorName(dimension)}_${customInfix}`;

    let candidate = `${prefix}${base}`;
    let suffix = 1;
    while (usedNames.has(candidate)) {
      candidate = `${prefix}${base}_${suffix}`;
      suffix += 1;
    }
    usedNames.add(candidate);
    return candidate;
  }

  function mergeCustomIndicators(
    payload: CustomUploadPayload,
    options: { persist?: boolean } = {},
  ): { success: boolean; error?: string } {
    uploadError.value = null;
    const mode: UploadMode = payload.mode ?? "replace";

    if (!lastLoadedData.value.length || !pcodeField.value) {
      const message = "Select a country before uploading custom data.";
      uploadError.value = message;
      return { success: false, error: message };
    }

    const existingPcodeSet = new Set(
      lastLoadedData.value.map((d) => String(d[pcodeField.value])),
    );
    const uploadedRowsByPcode = new Map<string, Record<string, any>>();
    let matchedCount = 0;

    for (const row of payload.rows) {
      const pcode = String(row[payload.pcodeColumn]);
      if (existingPcodeSet.has(pcode)) {
        matchedCount += 1;
        uploadedRowsByPcode.set(pcode, row);
      }
    }

    const matchRate =
      payload.rows.length > 0 ? matchedCount / payload.rows.length : 0;
    if (matchRate < CUSTOM_UPLOAD_MATCH_THRESHOLD) {
      const message = `Only ${matchedCount}/${payload.rows.length} PCODEs matched this dataset (need at least ${Math.round(CUSTOM_UPLOAD_MATCH_THRESHOLD * 100)}%).`;
      uploadError.value = message;
      return { success: false, error: message };
    }

    const columnAssignments = Object.entries(payload.assignments).filter(
      ([col, dim]) => dim !== "skip" && !isRankingColumn(col),
    ) as [string, CustomIndicatorDimension][];

    if (columnAssignments.length === 0) {
      const message =
        "Assign at least one column to a risk dimension before uploading.";
      uploadError.value = message;
      return { success: false, error: message };
    }

    // A "replace" upload no longer has to cover every base dimension (exp/vul/cop) - risk is
    // computed as the geometric mean of whichever dimensions actually have assigned columns (see
    // calculateDynamicRisk's presentDims). A dimension left with zero indicators simply drops out
    // of that calculation instead of blocking the upload.

    const { hazardPrefix } = store.dimensionColumns;

    // "replace": the uploaded CSV becomes the entire indicator set, not a patch on top of the
    // existing one - strip every current sub-indicator (default parquet columns and any earlier
    // custom upload) so only what this file provides remains. Non-indicator columns (pcode,
    // admin name, the disaster's risk_/ranking_ columns) are left untouched either way.
    // "append": keep every existing column and only add the newly assigned ones alongside it.
    const customDimensionPrefixes = discoverCustomDimensionPrefixes(
      rawOriginalData.value,
    );
    const isIndicatorColumn = (col: string) =>
      col.startsWith("exp_") ||
      col.startsWith("vul_") ||
      col.startsWith("cop_") ||
      customDimensionPrefixes.some((p) => col.startsWith(`${p}_`));

    const strippedRawData =
      mode === "replace"
        ? rawOriginalData.value.map((row: Record<string, any>) => {
            const clone: Record<string, any> = {};
            for (const [key, value] of Object.entries(row)) {
              if (!isIndicatorColumn(key)) clone[key] = value;
            }
            return clone;
          })
        : rawOriginalData.value.map((row: Record<string, any>) => ({
            ...row,
          }));

    const usedNames = new Set(Object.keys(strippedRawData[0] || {}));
    const columnNameMap = new Map<string, string>();
    for (const [rawColumn, dimension] of columnAssignments) {
      columnNameMap.set(
        rawColumn,
        buildCustomColumnName(rawColumn, dimension, hazardPrefix, usedNames, mode),
      );
    }

    for (const row of strippedRawData) {
      const uploadedRow = uploadedRowsByPcode.get(
        String(row[pcodeField.value]),
      );
      for (const [rawColumn, newColumn] of columnNameMap.entries()) {
        row[newColumn] = uploadedRow ? Number(uploadedRow[rawColumn]) : NaN;
      }
    }
    rawOriginalData.value = strippedRawData;


    const newWeights: Record<string, number> =
      mode === "append" ? { ...indicatorWeights.value } : {};
    for (const [rawColumn, dimension] of columnAssignments) {
      const newColumn = columnNameMap.get(rawColumn)!;
      const rawName = sanitizeIndicatorName(rawColumn);
      // Matches validateIndicatorWeightMatch's lookup in UploadModal.vue - an uploaded
      // indicator column can already carry its dimension prefix (e.g. "vul_female_pop"), which
      // the weight file's "variable_name" won't include, so strip it the same way before
      // looking the weight up here too. Without this the pre-upload match-rate check (which
      // does strip) can pass while the actual weight lookup (previously unstripped) missed
      // every entry and silently fell back to the 1.0 default.
      const lookupName = stripDimensionPrefix(rawName, dimension);
      const weightEntry = payload.weights?.[lookupName];
      newWeights[newColumn] =
        weightEntry && weightEntry.category === dimension
          ? weightEntry.weight
          : 1.0;
    }
    indicatorWeights.value = newWeights;
    loadAndCalculateWithWeights(newWeights);

    if (mode === "replace") customIndicatorsReplaced.value = true;

    if (options.persist !== false && lastLoadedCountry.value) {
      persistCustomUpload(lastLoadedCountry.value, { ...payload, mode });
    }

    return { success: true };
  }

  function reapplySavedCustomUpload(countryCode: string) {
    const uploads = readStoredUploads(countryCode);
    if (!uploads.length) return;
    let appliedAny = false;
    for (const payload of uploads) {
      const result = mergeCustomIndicators(payload, { persist: false });
      if (result.success) appliedAny = true;
    }
    if (appliedAny) {
      pendingCustomDataCountry.value = countryCode;
      showCustomDataInfo.value = true;
    }
  }

  function keepCustomData() {
    showCustomDataInfo.value = false;
    pendingCustomDataCountry.value = null;
  }

  // Since an upload now replaces the entire indicator set in place, there's no per-column
  // backup to restore from - reverting to the HeiGIT default means re-fetching the country's
  // parquet data fresh.
  function discardCustomData() {
    const countryCode =
      pendingCustomDataCountry.value || lastLoadedCountry.value;
    showCustomDataInfo.value = false;
    pendingCustomDataCountry.value = null;

    if (!countryCode) return;
    localStorage.removeItem(customUploadStorageKey(countryCode));
    updateCountryData(countryCode, { force: true });
  }

  let calcTimeout: any;
  watch(
    indicatorWeights,
    (newWeights) => {
      if (!lastLoadedCountry.value) return;
      clearTimeout(calcTimeout);
      calcTimeout = setTimeout(() => {
        loadAndCalculateWithWeights(newWeights);
      }, 300);
    },
    { deep: true },
  );

  watch(selectedCountry, (newVal) => {
    syncRoute();
    updateCountryData(newVal);
    
  });

  watch(selectedDisaster, (newVal) => {
    syncRoute();
    if (!newVal || !lastLoadedData.value.length) return;
    refreshMapLayer();
  });

  watch(riskViewMode, () => {
    syncRoute();
    refreshMapLayer();
  });

  // Watch for route query changes to keep state in sync
  watch(
    () => route.query,
    (newQuery) => {
      const qCountry = (newQuery.country as string) || "";
      const qDisaster = (newQuery.disaster as string) || "";
      const qDimension = newQuery.dimension;
      if (qCountry !== selectedCountry.value) {
        selectedCountry.value = qCountry;
      }
      if (qDisaster !== selectedDisaster.value) {
        selectedDisaster.value = qDisaster;
      }
      if (
        isRiskViewMode(qDimension, store.dimensions) &&
        qDimension !== riskViewMode.value
      ) {
        riskViewMode.value = qDimension;
      }
    },
  );

  return {
    // State
    selectedCountry,
    selectedDisaster,
    disasters,
    pmtilesUrl,
    pcodeField,
    matchArray,
    isLoading,
    error,
    lastLoadedData,
    rawOriginalData,
    lastLoadedCountry,
    highlightedPcode,
    indicatorWeights,
    viewMode,
    showAnalysis,
    showAboutModal,
    showUploadModal,
    showCustomDataInfo,
    riskViewMode,
    uploadError,
    countries,
    dimensions,
    customIndicatorsReplaced,

    // Getters
    riskViewLabel,
    dimensionColumns,
    selectedCountryName,
    existingPcodes,

    // Actions
    updateCountryData,
    updateRiskLayer,
    loadAndCalculateWithWeights,
    mergeCustomIndicators,
    keepCustomData,
    discardCustomData,
    goHome,
  };
}
