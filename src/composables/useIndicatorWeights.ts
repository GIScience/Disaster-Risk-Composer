import { ref, watch, type ComputedRef } from "vue";
import type { DimensionGroup } from "@/composables/useIndicatorColumns";
import { generateFilename } from "@/utils/filenameGenerator";
import { parseWeightsCSVText, type WeightCsvEntry } from "@/utils/weightCsv";

interface IndicatorWeightsProps {
  indicatorWeights: Record<string, number>;
  selectedDisaster: string;
  selectedCountry: string;
}

interface IndicatorWeightsEmit {
  (e: "update:indicatorWeights", val: Record<string, number>): void;
}

export interface WeightUploadMatchResult {
  matched: number;
  total: number;
  unmatchedCols: string[];
}

export interface PendingWeightUpload {
  fileName: string;
  entryCount: number;
  parseError: string | null;
  matchResult: WeightUploadMatchResult;
}

function getRawName(col: string, category: string): string {
  if (category === "exp") {
    const parts = col.split("_");
    if (parts.length > 2) return parts.slice(2).join("_");
    return col.replace(/^exp_/, "");
  }
  return col.replace(new RegExp(`^${category}_`), "");
}

export function useIndicatorWeights(
  props: IndicatorWeightsProps,
  emit: IndicatorWeightsEmit,
  indicatorDimensionGroups: ComputedRef<DimensionGroup[]>,
) {
  const localWeights = ref<Record<string, number>>({
    ...props.indicatorWeights,
  });

  // Resync local state whenever the parent's weight set changes shape (e.g. a "replace" upload
  // swaps in a whole new set of indicator columns, with weights read from an uploaded weight
  // file) - a same-shape change is our own setWeight/toggle call echoing back down and must not
  // clobber in-progress local edits, so only a change in which columns exist triggers a resync.
  watch(
    () => props.indicatorWeights,
    (newVal) => {
      const newKeys = Object.keys(newVal);
      const localKeys = Object.keys(localWeights.value);
      const structurallyChanged =
        newKeys.length !== localKeys.length ||
        newKeys.some((k) => !(k in localWeights.value));
      if (structurallyChanged) {
        localWeights.value = { ...newVal };
      }
    },
    { deep: true },
  );

  function getWeight(col: string) {
    return localWeights.value[col] ?? 1.0;
  }

  function setWeight(col: string, val: number) {
    localWeights.value[col] = val;
    emit("update:indicatorWeights", { ...localWeights.value });
  }

  const disabledIndicators = ref<Set<string>>(new Set());
  const savedSliderValues = ref<Record<string, number>>({});

  function isSubIndicatorActive(col: string) {
    return !disabledIndicators.value.has(col);
  }

  function toggleSubIndicator(col: string) {
    if (disabledIndicators.value.has(col)) {
      disabledIndicators.value = new Set(
        [...disabledIndicators.value].filter((c) => c !== col),
      );
      const saved = savedSliderValues.value[col];
      if (saved !== undefined) {
        localWeights.value[col] = saved;
        delete savedSliderValues.value[col];
      } else {
        delete localWeights.value[col];
      }
    } else {
      savedSliderValues.value[col] = getWeight(col);
      localWeights.value[col] = 0;
      disabledIndicators.value = new Set([...disabledIndicators.value, col]);
    }
    emit("update:indicatorWeights", { ...localWeights.value });
  }

  function isGroupActive(columns: string[]) {
    return (
      columns.length === 0 || columns.every((c) => isSubIndicatorActive(c))
    );
  }

  function toggleGroup(columns: string[]) {
    const allActive = isGroupActive(columns);
    for (const col of columns) {
      if (allActive && isSubIndicatorActive(col)) {
        toggleSubIndicator(col);
      } else if (!allActive && !isSubIndicatorActive(col)) {
        toggleSubIndicator(col);
      }
    }
  }

  function resetDimensionWeights(cols: string[]) {
    const newWeights = { ...localWeights.value };
    cols.forEach((c) => delete newWeights[c]);
    localWeights.value = newWeights;
    const newDisabled = new Set(disabledIndicators.value);
    cols.forEach((c) => {
      newDisabled.delete(c);
      delete savedSliderValues.value[c];
    });
    disabledIndicators.value = newDisabled;
    emit("update:indicatorWeights", newWeights);
  }

  function downloadWeightsCSV() {
    let csvContent = "variable_name,category,weight,direction,activated\n";

    const processCols = (
      cols: string[],
      category: string,
      direction: number,
    ) => {
      cols.forEach((col) => {
        const rawName = getRawName(col, category);
        const weight = getWeight(col);
        const activated = isSubIndicatorActive(col) ? "TRUE" : "FALSE";
        csvContent += `${rawName},${category},${weight},${direction},${activated}\n`;
      });
    };

    indicatorDimensionGroups.value.forEach((dim) => {
      if (dim.cols.length > 0)
        processCols(dim.cols, dim.key, dim.key === "cop" ? -1 : 1);
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `${generateFilename(`Weights_${props.selectedDisaster}`, props.selectedCountry, "csv")}`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function applyWeightCsv(csvData: Record<string, WeightCsvEntry>) {
    const newWeights = { ...localWeights.value };
    const newDisabled = new Set(disabledIndicators.value);

    const matchAndSet = (cols: string[], category: string) => {
      cols.forEach((col) => {
        const rawName = getRawName(col, category);
        const entry = csvData[rawName];
        if (!entry || entry.category !== category) return;

        if (entry.activated === false) {
          savedSliderValues.value[col] = entry.weight;
          newWeights[col] = 0;
          newDisabled.add(col);
        } else {
          newWeights[col] = entry.weight;
          newDisabled.delete(col);
          delete savedSliderValues.value[col];
        }
      });
    };

    indicatorDimensionGroups.value.forEach((dim) =>
      matchAndSet(dim.cols, dim.key),
    );

    localWeights.value = newWeights;
    disabledIndicators.value = newDisabled;
    emit("update:indicatorWeights", { ...newWeights });
  }

  // Same match rule as applyWeightCsv's matchAndSet (entry exists AND category lines up), so the
  function computeMatchResult(
    csvData: Record<string, WeightCsvEntry>,
  ): WeightUploadMatchResult {
    let matched = 0;
    const unmatchedCols: string[] = [];
    indicatorDimensionGroups.value.forEach((dim) => {
      dim.cols.forEach((col) => {
        const rawName = getRawName(col, dim.key);
        console.log("Checking col", col, "rawName", rawName, "category", dim.key);
        const entry = csvData[rawName];
        if (entry && entry.category === dim.key) {
          matched++;
        } else {
          unmatchedCols.push(col);
        }
      });
    });
    return { matched, total: matched + unmatchedCols.length, unmatchedCols };
  }

  const pendingWeightUpload = ref<PendingWeightUpload | null>(null);
  let pendingCsvData: Record<string, WeightCsvEntry> | null = null;


  function uploadWeightsCSV(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      const csvData = parseWeightsCSVText(text);
      if (Object.keys(csvData).length === 0) {
        pendingCsvData = null;
        pendingWeightUpload.value = {
          fileName: file.name,
          entryCount: 0,
          parseError:
            'No weights found. This file needs "variable_name", "category" and "weight" columns.',
          matchResult: { matched: 0, total: 0, unmatchedCols: [] },
        };
        return;
      }

      pendingCsvData = csvData;
      pendingWeightUpload.value = {
        fileName: file.name,
        entryCount: Object.keys(csvData).length,
        parseError: null,
        matchResult: computeMatchResult(csvData),
      };
    };
    reader.onerror = () => {
      pendingCsvData = null;
      pendingWeightUpload.value = {
        fileName: file.name,
        entryCount: 0,
        parseError: "Could not read this file. Upload a valid CSV.",
        matchResult: { matched: 0, total: 0, unmatchedCols: [] },
      };
    };

    reader.readAsText(file);
    input.value = "";
  }

  function confirmWeightUpload() {
    if (!pendingCsvData) return;
    applyWeightCsv(pendingCsvData);
    pendingCsvData = null;
    pendingWeightUpload.value = null;
  }

  function cancelWeightUpload() {
    pendingCsvData = null;
    pendingWeightUpload.value = null;
  }

  return {
    getWeight,
    setWeight,
    isSubIndicatorActive,
    toggleSubIndicator,
    isGroupActive,
    toggleGroup,
    resetDimensionWeights,
    downloadWeightsCSV,
    uploadWeightsCSV,
    pendingWeightUpload,
    confirmWeightUpload,
    cancelWeightUpload,
  };
}
