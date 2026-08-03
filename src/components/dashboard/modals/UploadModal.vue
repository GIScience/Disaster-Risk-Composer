<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { loadCSVData } from "@/utils/duckdb";
import {
  sanitizeIndicatorName,
  type CustomIndicatorDimension,
  type UploadMode,
} from "@/composables/useRiskLogic";
import {
  BASE_DIMENSION_PREFIXES,
  DIMENSION_PREFIX_VALUES,
} from "@/enums/dimensions";
import { HAZARDS } from "@/enums/hazards";
import { isRankingColumn } from "@/utils/riskCalculation";
import { storeToRefs } from "pinia";
import { useRiskMapStore } from "@/store/riskMapStore";
import { downloadIndicatorCSVTemplate } from "@/utils/template";
import {
  parseWeightsCSVText,
  validateIndicatorWeightMatch,
  type WeightCsvEntry,
} from "@/utils/weightCsv";

const store = useRiskMapStore();

const { selectedCountryPcodeFieldMap, selectedCountry, selectedCountryName } =
  storeToRefs(store);

const MATCH_THRESHOLD = 0.9;

const props = defineProps<{
  pcodeField: string;
  existingPcodes: string[];
  hazardPrefix: string;
  knownDimensions?: string[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (
    e: "upload",
    payload: {
      pcodeColumn: string;
      rows: Record<string, any>[];
      assignments: Record<string, CustomIndicatorDimension | "skip">;
      mode: UploadMode;
      weights?: Record<string, WeightCsvEntry>;
    },
  ): void;
}>();

const UPLOAD_MODE_OPTIONS: {
  value: UploadMode;
  icon: string;
  title: string;
  description: string;
}[] = [
  {
    value: "append",
    icon: "mdi-plus-box-outline",
    title: "Append custom sub-indicator",
    description:
      "Keep the current data and add your own column(s) as extra indicators alongside it.",
  },
  {
    value: "replace",
    icon: "mdi-swap-horizontal",
    title: "Replace entire indicator data",
    description:
      "Your file becomes the full indicator set. Risk is calculated from whichever dimensions you assign columns to.",
  },
];

const BASE_DIMENSION_OPTIONS = BASE_DIMENSION_PREFIXES.map(
  ({ prefix, label }) => ({
    value: prefix,
    label,
  }),
);

// Bare dimension names ("exp"/"vul"/"cop") and dimension+hazard combos ("exp_flood",
// "cop_flo", "exp_cyclone", ...) are reserved for the app's own computed composite columns
// (e.g. exp_flo is the exposure score for flood) - they are never real sub-indicators, so a
// CSV column with one of these exact names is ignored rather than offered for assignment.
// Built from the dimensions/hazards this app currently recognizes (dimensions.ts, hazards.ts).
const RESERVED_UPLOAD_COLUMN_NAMES = new Set<string>([
  ...DIMENSION_PREFIX_VALUES,
  ...DIMENSION_PREFIX_VALUES.flatMap((dim) =>
    HAZARDS.flatMap((hazard) => [
      `${dim}_${hazard.prefix}`,
      `${dim}_${hazard.keyword}`,
    ]),
  ),
]);

function isReservedColumn(column: string): boolean {
  return RESERVED_UPLOAD_COLUMN_NAMES.has(column.trim().toLowerCase());
}

const dimensionOptions = computed(() => {
  const extra = (props.knownDimensions ?? [])
    .filter(
      (d) =>
        d !== "total" && !BASE_DIMENSION_OPTIONS.some((o) => o.value === d),
    )
    .map((d) => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) }));
  return [...BASE_DIMENSION_OPTIONS, ...extra];
});

const assignmentSelectOptions = computed(() => [
  { value: "skip", label: "Skip" },
  ...dimensionOptions.value,
]);

type Step = "upload" | "assign";

const step = ref<Step>("upload");
const uploadMode = ref<UploadMode>("append");

const indicatorInput = ref<HTMLInputElement | null>(null);
const weightInput = ref<HTMLInputElement | null>(null);

const selectedFile = ref<File | null>(null);
const isDragging = ref(false);
const isParsing = ref(false);
const parseError = ref<string | null>(null);

const parsedRows = ref<Record<string, any>[]>([]);
const parsedColumns = ref<string[]>([]);
const pcodeColumn = ref<string | null>(null);
const assignments = ref<Record<string, CustomIndicatorDimension | "skip">>({});

const selectedWeightFile = ref<File | null>(null);
const isDraggingWeight = ref(false);
const isParsingWeight = ref(false);
const weightParseError = ref<string | null>(null);
const weightCsvData = ref<Record<string, WeightCsvEntry>>({});

const existingPcodeSet = computed(
  () => new Set(props.existingPcodes.map(String)),
);

const matchCount = computed(() => {
  if (!pcodeColumn.value) return 0;
  return parsedRows.value.filter((r) =>
    existingPcodeSet.value.has(String(r[pcodeColumn.value!])),
  ).length;
});

const matchRate = computed(() =>
  parsedRows.value.length > 0 ? matchCount.value / parsedRows.value.length : 0,
);
const matchIsSufficient = computed(
  () => pcodeColumn.value !== null && matchRate.value >= MATCH_THRESHOLD,
);

const assignableColumns = computed(() =>
  parsedColumns.value.filter((c) => c !== pcodeColumn.value),
);

const missingRequiredDimensions = computed(() => {
  const assignedDims = new Set(
    Object.values(assignments.value).filter((v) => v !== "skip"),
  );
  return BASE_DIMENSION_OPTIONS.filter((opt) => !assignedDims.has(opt.value));
});

const hasAllRequiredDimensions = computed(
  () => missingRequiredDimensions.value.length === 0,
);

const hasAtLeastOneAssignment = computed(() =>
  Object.values(assignments.value).some((v) => v !== "skip"),
);

// "replace" wipes out any weights the user previously set (mergeCustomIndicators has nothing to
// carry forward in that mode), so a weight file is required to know how to weight the new
// indicator set rather than silently falling back to 1.0 for everything.
const weightFileRequired = computed(() => uploadMode.value === "replace");

const weightFileProvided = computed(
  () =>
    !!selectedWeightFile.value && Object.keys(weightCsvData.value).length > 0,
);

const indicatorFileReady = computed(
  () => parsedRows.value.length > 0 && pcodeColumn.value !== null,
);

// Every assignable column in the file, keyed by its column name and - if detectDimensionForColumn
// already recognized a dimension prefix in it - that dimension. This runs in step 1, before the
// user has manually assigned anything: a column whose dimension isn't known yet is passed through
// with category null, which validateIndicatorWeightMatch matches by name alone (ignoring
// category), since there's no assigned dimension to check it against.
const earlyIndicatorKeysForMatch = computed(() =>
  assignableColumns.value.map((col) => {
    const dim = assignments.value[col];
    return {
      name: sanitizeIndicatorName(col),
      category: dim && dim !== "skip" ? dim : null,
    };
  }),
);

const earlyWeightMatchResult = computed(() =>
  validateIndicatorWeightMatch(
    earlyIndicatorKeysForMatch.value,
    weightCsvData.value,
  ),
);

const earlyWeightMatchIsSufficient = computed(
  () =>
    !weightFileRequired.value ||
    (weightFileProvided.value &&
      earlyWeightMatchResult.value.matchRate >= MATCH_THRESHOLD),
);

// Step 1 gate: weight-to-indicator matching runs here, as soon as both files are parsed, using
// every column's name (and its auto-detected dimension, if any) - rather than waiting for the
// user to reach the manual column-assignment step.
const canContinue = computed(
  () =>
    indicatorFileReady.value &&
    matchIsSufficient.value &&
    (!weightFileRequired.value ||
      (weightFileProvided.value && earlyWeightMatchIsSufficient.value)),
);

// Keyed the same way buildCustomColumnName derives a column's final name (sanitized raw header +
// assigned dimension), so this lines up with what the weight file's "variable_name"/"category"
// columns are expected to match. Used once the user has assigned (or confirmed) each column's
// dimension in step 2, so - unlike earlyIndicatorKeysForMatch - only counts columns actually
// assigned to a dimension and checks their category strictly.
const indicatorKeysForValidation = computed(() =>
  Object.entries(assignments.value)
    .filter(([, dim]) => dim !== "skip")
    .map(([col, dim]) => ({
      name: sanitizeIndicatorName(col),
      category: dim as string,
    })),
);

const weightMatchResult = computed(() =>
  validateIndicatorWeightMatch(
    indicatorKeysForValidation.value,
    weightCsvData.value,
  ),
);

const weightMatchIsSufficient = computed(
  () =>
    !weightFileRequired.value ||
    (weightFileProvided.value &&
      weightMatchResult.value.matchRate >= MATCH_THRESHOLD),
);

// Neither mode requires covering every base dimension - risk is calculated from whichever
// dimensions actually have assigned columns. At least one assigned column is still required so
// there's something to upload.
const canUpload = computed(
  () =>
    matchIsSufficient.value &&
    hasAtLeastOneAssignment.value &&
    weightMatchIsSufficient.value,
);

// Switching to "append" makes the weight file meaningless, so drop it instead of keeping a stale
// file around that would be silently ignored.
watch(uploadMode, (mode) => {
  if (mode === "append") clearWeightFile();
});

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function detectPcodeColumn(columns: string[]): string | null {
  const lowerTarget = props.pcodeField.toLowerCase();
  const exact = columns.find((c) => c.toLowerCase() === lowerTarget);
  if (exact) return exact;
  const generic = columns.find((c) => c.toLowerCase() === "pcode");
  if (generic) return generic;
  return null;
}

// "Skip" is just the pre-selected default for columns whose dimension can't be inferred - it
// isn't a hard exclusion. If a column's name already carries a known dimension prefix (e.g.
// "vul_female_pop", matching the same "vul_"/"cop_"/"exp_" convention used by the sample data),
// pre-select that dimension automatically so the user doesn't have to map it by hand.
function detectDimensionForColumn(
  column: string,
): CustomIndicatorDimension | "skip" {
  const sanitized = sanitizeIndicatorName(column);
  const match = dimensionOptions.value.find((opt) => {
    const prefix = opt.value.toLowerCase();
    return sanitized === prefix || sanitized.startsWith(`${prefix}_`);
  });
  return match?.value ?? "skip";
}

function resetIndicatorData() {
  parsedRows.value = [];
  parsedColumns.value = [];
  pcodeColumn.value = null;
  assignments.value = {};
}

async function parseFile(file: File) {
  isParsing.value = true;
  parseError.value = null;
  resetIndicatorData();
  try {
    const rows = await loadCSVData(file);
    if (!rows.length) {
      parseError.value =
        "This CSV has no rows. Add your data and upload again.";
      return;
    }
    const columns = Object.keys(rows[0]);
    const detected = detectPcodeColumn(columns);
    if (!detected) {
      parseError.value = `No PCODE column found. Add a column named "${props.pcodeField}" or "PCODE".`;
      return;
    }

    const selectableColumns = columns.filter(
      (c) => !isRankingColumn(c) && !isReservedColumn(c),
    );
    const dataColumns = selectableColumns.filter((c) => c !== detected);
    if (dataColumns.length === 0) {
      parseError.value =
        "This CSV only has the PCODE column. Add at least one data column to upload.";
      return;
    }

    parsedRows.value = rows;
    parsedColumns.value = selectableColumns;
    pcodeColumn.value = detected;
    assignments.value = Object.fromEntries(
      dataColumns.map((c) => [c, detectDimensionForColumn(c)]),
    );
  } catch (err) {
    console.error("Failed to parse CSV", err);
    parseError.value = "Could not read this file. Upload a valid CSV.";
  } finally {
    isParsing.value = false;
  }
}

function pickIndicatorFile(file: File) {
  selectedFile.value = file;
  parseFile(file);
}

function handleDrop(event: DragEvent) {
  isDragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) pickIndicatorFile(file);
}

function handleFileInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) pickIndicatorFile(file);
  input.value = "";
}

function clearIndicatorFile() {
  selectedFile.value = null;
  parseError.value = null;
  resetIndicatorData();
}

function parseWeightFile(file: File) {
  weightParseError.value = null;
  weightCsvData.value = {};
  isParsingWeight.value = true;
  const reader = new FileReader();
  reader.onload = (e) => {
    isParsingWeight.value = false;
    const text = e.target?.result as string;
    const parsed = parseWeightsCSVText(text);
    if (Object.keys(parsed).length === 0) {
      weightCsvData.value = {};
      weightParseError.value =
        'No weights found. This file needs "variable_name", "category" and "weight" columns.';
      return;
    }
    weightCsvData.value = parsed;
  };
  reader.onerror = () => {
    isParsingWeight.value = false;
    weightCsvData.value = {};
    weightParseError.value = "Could not read this file. Upload a valid CSV.";
  };
  reader.readAsText(file);
}

function pickWeightFile(file: File) {
  selectedWeightFile.value = file;
  parseWeightFile(file);
}

function handleWeightDrop(event: DragEvent) {
  isDraggingWeight.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) pickWeightFile(file);
}

function handleWeightFileInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) pickWeightFile(file);
  input.value = "";
}

function clearWeightFile() {
  selectedWeightFile.value = null;
  weightCsvData.value = {};
  weightParseError.value = null;
}

function goToAssign() {
  if (canContinue.value) step.value = "assign";
}

function backToUpload() {
  step.value = "upload";
}

function handleUpload() {
  if (!pcodeColumn.value || !canUpload.value) return;
  emit("upload", {
    pcodeColumn: pcodeColumn.value,
    rows: parsedRows.value,
    assignments: assignments.value,
    mode: uploadMode.value,
    weights: weightFileRequired.value ? weightCsvData.value : undefined,
  });
  emit("close");
}

function handleDownloadTemplate() {
  downloadIndicatorCSVTemplate(
    [],
    selectedCountryPcodeFieldMap.value,
    "ADM2_PCODE",
    `custom_Indicator_template`,
    selectedCountryName.value,
  );
}
</script>

<template>
  <v-dialog
    :model-value="true"
    max-width="38rem"
    scrollable
    @update:model-value="$emit('close')"
  >
    <v-card rounded="xl">
      <v-card-title
        class="d-flex align-center justify-space-between px-6 pt-4 pb-2"
      >
        <span class="text-h6 font-weight-bold">Upload custom data</span>
        <v-btn
          icon="mdi-close"
          variant="text"
          density="comfortable"
          @click="$emit('close')"
        />
      </v-card-title>

      <!-- Step rail: two steps, always visible so the flow is obvious before the first upload -->
      <div class="px-6 pb-6">
        <div class="flex items-center gap-2">
          <div
            class="flex items-center gap-2 text-slate-400"
            :class="{
              'text-heigit-red': step === 'upload',
              'text-green-800': step === 'assign',
            }"
          >
            <span
              class="inline-flex items-center justify-center w-[1.375rem] h-[1.375rem] rounded-full border-[1.5px] border-current text-[0.7rem] font-bold"
            >
              <v-icon v-if="step === 'assign'" icon="mdi-check" size="14" />
              <template v-else>1</template>
            </span>
            <span class="text-[0.8rem] font-semibold">Upload files</span>
          </div>
          <span class="flex-1 h-[1.5px] bg-slate-200" />
          <div
            class="flex items-center gap-2 text-slate-400"
            :class="{ 'text-heigit-red': step === 'assign' }"
          >
            <span
              class="inline-flex items-center justify-center w-[1.375rem] h-[1.375rem] rounded-full border-[1.5px] border-current text-[0.7rem] font-bold"
            >
              2
            </span>
            <span class="text-[0.8rem] font-semibold">Assign columns</span>
          </div>
        </div>
      </div>

      <v-divider />

      <v-card-text
        class="px-6 py-5 max-h-[60vh] overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb:hover]:bg-slate-400"
      >
        <!-- STEP 1 -->
        <div v-if="step === 'upload'" class="d-flex flex-column gap-6">
          <div class="d-flex flex-column gap-2">
            <div
              class="flex items-center py-2 pl-3 pr-2 rounded-[10px] bg-slate-50 text-slate-500 mb-4"
            >
              <v-icon icon="mdi-information-outline" size="16" class="mr-2" />
              <span class="text-caption text-sm">
                Need the right format? The {{ selectedCountryName }} template
                already has the ADM2_PCODE column.
              </span>
              <v-btn
                variant="flat"
                color="heigit-red"
                size="small"
                :title="`Download a CSV template for ${selectedCountryName}`"
                :aria-label="`Download a CSV template for ${selectedCountryName}`"
                class="shrink-0 text-white text-none gap-1.5 px-2 font-bold"
                prepend-icon="mdi-download"
                @click="handleDownloadTemplate()"
              >
                Template
              </v-btn>
            </div>
            <div
              class="text-[0.7rem] font-bold uppercase tracking-[0.06em] text-slate-500 mb-2"
            >
              How should this data be used?
            </div>
            <div class="flex flex-col gap-2">
              <button
                v-for="opt in UPLOAD_MODE_OPTIONS"
                :key="opt.value"
                type="button"
                class="mode-option"
                :class="{ 'mode-option--active': uploadMode === opt.value }"
                @click="uploadMode = opt.value"
              >
                <v-icon
                  :icon="opt.icon"
                  size="20"
                  class="mr-2 mt-1"
                  :color="uploadMode === opt.value ? 'heigit-red' : undefined"
                />
                <div class="text-left">
                  <div class="text-base font-weight-semibold">
                    {{ opt.title }}
                  </div>
                  <div class="text-sm text-medium-emphasis">
                    {{ opt.description }}
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div>
            <div
              class="text-[0.7rem] font-bold uppercase tracking-[0.06em] text-slate-500 mb-2"
            >
              {{ weightFileRequired ? "Files (2 required)" : "File" }}
            </div>

            <div class="d-flex flex-column gap-3">
              <!-- Indicator data -->
              <div
                class="flex items-start gap-3 py-3 px-3.5 border-[1.5px] border-slate-200 rounded-[10px] bg-white transition-colors duration-150"
                :class="{
                  'border-heigit-red bg-[#fdf2f3]': isDragging,
                  'border-green-200 bg-[#f6fdf8]':
                    indicatorFileReady && matchIsSufficient,
                  'border-red-200 bg-[#fef6f6]':
                    !!parseError || (indicatorFileReady && !matchIsSufficient),
                }"
                @dragover.prevent="isDragging = true"
                @dragleave.prevent="isDragging = false"
                @drop.prevent="handleDrop"
              >
                <v-icon
                  :icon="
                    indicatorFileReady && matchIsSufficient
                      ? 'mdi-check-circle'
                      : 'mdi-file-table-outline'
                  "
                  size="20"
                  :color="
                    indicatorFileReady && matchIsSufficient
                      ? 'success'
                      : 'heigit-red'
                  "
                  class="mt-1"
                />
                <div class="flex-1 min-w-0 space-y-1">
                  <div class="text-body-2 font-weight-semibold">
                    Indicator data
                  </div>
                  <div class="text-caption text-xs text-medium-emphasis">
                    CSV with a PCODE column named "{{ pcodeField }}", plus your
                    indicator columns.
                  </div>

                  <div
                    v-if="isParsing"
                    class="flex items-center text-[0.72rem] mt-1.5 text-slate-500"
                  >
                    <v-progress-circular
                      indeterminate
                      size="14"
                      width="2"
                      class="mr-2"
                    />
                    Reading file...
                  </div>

                  <div
                    v-else-if="selectedFile"
                    class="flex items-center gap-1 mt-2 py-1 pl-2 pr-1 border border-slate-200 rounded-lg bg-slate-50 max-w-full"
                  >
                    <v-icon
                      icon="mdi-file-document-outline"
                      size="16"
                      class="mr-1"
                    />
                    <span
                      class="text-[0.75rem] font-semibold text-slate-700 truncate"
                      >{{ selectedFile.name }}</span
                    >
                    <span class="text-[0.7rem] text-slate-400 shrink-0">{{
                      formatFileSize(selectedFile.size)
                    }}</span>
                    <v-btn
                      icon="mdi-close"
                      variant="text"
                      size="x-small"
                      density="comfortable"
                      aria-label="Remove indicator file"
                      @click="clearIndicatorFile"
                    />
                  </div>

                  <div
                    v-if="!isParsing && indicatorFileReady"
                    class="flex items-center text-[0.72rem] mt-1.5"
                    :class="matchIsSufficient ? 'text-success' : 'text-error'"
                  >
                    {{ matchCount }} of {{ parsedRows.length }} PCODEs match the
                    {{ selectedCountry }} boundaries.
                    <template v-if="!matchIsSufficient">
                      At least {{ Math.round(MATCH_THRESHOLD * 100) }}% need to
                      match.
                    </template>
                  </div>

                  <div
                    v-if="parseError"
                    class="flex items-center text-[0.72rem] mt-1.5 text-error"
                  >
                    {{ parseError }}
                  </div>
                </div>

                <div class="shrink-0">
                  <v-btn
                    variant="flat"
                    color="heigit-red"
                    size="small"
                    :title="`Upload Indicator CSV  for ${selectedCountryName}`"
                    :aria-label="`Upload Indicator CSV for ${selectedCountryName}`"
                    class="shrink-0 text-white text-none gap-1.5 px-2 font-bold"
                    prepend-icon="mdi-tray-arrow-up"
                    @click="indicatorInput?.click()"
                  >
                    {{ selectedFile ? "Replace" : "Upload CSV" }}
                  </v-btn>
                  <input
                    ref="indicatorInput"
                    type="file"
                    accept=".csv"
                    class="d-none"
                    @change="handleFileInput"
                  />
                </div>
              </div>

              <!-- Weight data (replace only) -->
              <div
                v-if="weightFileRequired"
                class="flex items-start gap-3 py-3 px-3.5 border-[1.5px] border-slate-200 rounded-[10px] bg-white transition-colors duration-150"
                :class="{
                  'border-heigit-red bg-[#fdf2f3]': isDraggingWeight,
                  'border-green-200 bg-[#f6fdf8]':
                    weightFileProvided && earlyWeightMatchIsSufficient,
                  'border-red-200 bg-[#fef6f6]':
                    !!weightParseError ||
                    (weightFileProvided && !earlyWeightMatchIsSufficient),
                }"
                @dragover.prevent="isDraggingWeight = true"
                @dragleave.prevent="isDraggingWeight = false"
                @drop.prevent="handleWeightDrop"
              >
                <v-icon
                  :icon="
                    weightFileProvided && earlyWeightMatchIsSufficient
                      ? 'mdi-check-circle'
                      : 'mdi-scale-balance'
                  "
                  size="20"
                  :color="
                    weightFileProvided && earlyWeightMatchIsSufficient
                      ? 'success'
                      : 'heigit-red'
                  "
                  class="mt-1"
                />
                <div class="flex-1 min-w-0 space-y-1">
                  <div class="text-body-2 font-weight-semibold">
                    Weight data
                  </div>
                  <div class="text-caption text-xs text-medium-emphasis">
                    CSV with "variable_name", "category" and "weight" columns.
                    Replacing the indicator set clears existing weights, so this
                    file sets them.
                  </div>

                  <div
                    v-if="isParsingWeight"
                    class="flex items-center text-[0.72rem] mt-1.5 text-slate-500"
                  >
                    <v-progress-circular
                      indeterminate
                      size="14"
                      width="2"
                      class="mr-2"
                    />
                    Reading file...
                  </div>

                  <div
                    v-else-if="selectedWeightFile"
                    class="flex items-center gap-1 mt-2 py-1 pl-2 pr-1 border border-slate-200 rounded-lg bg-slate-50 max-w-full"
                  >
                    <v-icon
                      icon="mdi-file-document-outline"
                      size="16"
                      class="mr-1"
                    />
                    <span
                      class="text-[0.75rem] font-semibold text-slate-700 truncate"
                      >{{ selectedWeightFile.name }}</span
                    >
                    <span class="text-[0.7rem] text-slate-400 shrink-0">{{
                      formatFileSize(selectedWeightFile.size)
                    }}</span>
                    <v-btn
                      icon="mdi-close"
                      variant="text"
                      size="x-small"
                      density="comfortable"
                      aria-label="Remove weight file"
                      @click="clearWeightFile"
                    />
                  </div>

                  <div
                    v-if="!isParsingWeight && weightFileProvided"
                    class="flex items-center text-[0.72rem] mt-1.5 text-success"
                  >
                    {{ Object.keys(weightCsvData).length }} weight entries read.
                  </div>

                  <div
                    v-if="
                      !isParsingWeight &&
                      indicatorFileReady &&
                      weightFileProvided
                    "
                    class="flex items-center text-[0.72rem] mt-1.5"
                    :class="
                      earlyWeightMatchIsSufficient
                        ? 'text-success'
                        : 'text-error'
                    "
                  >
                    {{ earlyWeightMatchResult.matched }} of
                    {{ earlyWeightMatchResult.total }} indicator columns matched
                    a weight entry.
                    <template v-if="!earlyWeightMatchIsSufficient">
                      At least {{ Math.round(MATCH_THRESHOLD * 100) }}% need to
                      match. Check the "variable_name" (and "category", for
                      columns already named with a dimension prefix) values in
                      your weight file.
                    </template>
                  </div>

                  <div
                    v-if="weightParseError"
                    class="flex items-center text-[0.72rem] mt-1.5 text-error"
                  >
                    {{ weightParseError }}
                  </div>
                </div>

                <div class="shrink-0">
                  <v-btn
                    variant="flat"
                    color="heigit-red"
                    size="small"
                    :title="`Upload Weight CSV  for ${selectedCountryName}`"
                    :aria-label="`Upload Weight CSV for ${selectedCountryName}`"
                    class="shrink-0 text-white text-none gap-1.5 px-2 font-bold"
                    prepend-icon="mdi-tray-arrow-up"
                    @click="weightInput?.click()"
                  >
                    {{ selectedWeightFile ? "Replace" : "Upload CSV" }}
                  </v-btn>
                  <input
                    ref="weightInput"
                    type="file"
                    accept=".csv"
                    class="d-none"
                    @change="handleWeightFileInput"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- STEP 2 -->
        <div v-else class="d-flex flex-column gap-4">
          <p class="text-base text-medium-emphasis mb-0">
            <template v-if="uploadMode === 'replace'">
              Assign each column to a risk dimension so it can be weighted in
              the model. Columns left on "Skip" are ignored.
            </template>
            <template v-else>
              Assign the column(s) you want to add as custom sub-indicators.
              Columns left on "Skip" are ignored.
            </template>
          </p>

          <div
            class="flex flex-col border-[1.5px] border-slate-200 rounded-[10px] overflow-hidden"
          >
            <div
              v-for="col in assignableColumns"
              :key="col"
              class="flex items-center justify-between gap-3 py-2 px-3 border-b border-[#eef2f6] last:border-b-0 even:bg-[#fafbfc]"
            >
              <span class="text-sm font-weight-medium text-truncate">{{
                col
              }}</span>
              <v-select
                v-model="assignments[col]"
                :items="assignmentSelectOptions"
                item-title="label"
                item-value="value"
                density="compact"
                variant="outlined"
                color="heigit-red"
                hide-details
                class="flex-none w-30 text-xs  [&_.v-field__input]:text-[0.78rem] [&_.v-field__input]:font-semibold [&_.v-field__input]:min-h-9 [&_.v-field__input]:py-[0.3rem] [&_.v-field__input]:px-[0.3rem]"
              />
            </div>
            <div
              v-if="assignableColumns.length === 0"
              class="text-caption text-medium-emphasis text-center py-3"
            >
              No columns found besides the PCODE column.
            </div>
          </div>

          <v-alert
            v-if="!hasAtLeastOneAssignment"
            type="warning"
            variant="tonal"
            density="compact"
            class="rounded-lg text-sm  flex items-center p-2 gap-2"
          >
            Assign at least one column to a dimension to upload.
          </v-alert>

          <v-alert
            v-else-if="uploadMode === 'replace' && !hasAllRequiredDimensions"
            type="info"
            variant="tonal"
            density="compact"
            class="rounded-lg text-body-2 p-2 gap-2"
          >
            No column assigned to:
            {{ missingRequiredDimensions.map((d) => d.label).join(", ") }}. Risk
            will be calculated from the dimension(s) you did assign.
          </v-alert>

          <v-alert
            v-if="weightFileRequired && hasAtLeastOneAssignment"
            :type="weightMatchIsSufficient ? 'success' : 'error'"
            variant="tonal"
            density="compact"
            class="rounded-lg text-body-2 p-2 gap-2"
          >
            <span v-if="weightMatchIsSufficient">
              {{ weightMatchResult.matched }} of {{ weightMatchResult.total }}
              assigned indicators matched a weight entry.
            </span>
            <span v-else>
              {{ weightMatchResult.matched }} of
              {{ weightMatchResult.total }} assigned indicators matched a weight
              entry (by "variable_name" plus "category"). At least
              {{ Math.round(MATCH_THRESHOLD * 100) }}% need to match. Check the
              dimensions above against the "category" values in your weight
              file.
            </span>
          </v-alert>
        </div>
      </v-card-text>

      <v-divider />

      <v-card-actions class="px-6 py-3">
        <v-btn
          v-if="step === 'assign'"
          variant="text"
          class="text-none space-x-2 px-2"
          prepend-icon="mdi-arrow-left"
          @click="backToUpload"
        >
          Back
        </v-btn>
        <v-btn v-else variant="text" class="text-none" @click="$emit('close')">
          Cancel
        </v-btn>

        <v-spacer />

        <v-btn
          v-if="step === 'upload'"
          variant="flat"
          color="heigit-red"
          class="text-white text-none px-4 font-weight-bold"
          append-icon="mdi-arrow-right"
          :disabled="!canContinue"
          @click="goToAssign"
        >
          Continue
        </v-btn>
        <v-btn
          v-else
          variant="flat"
          color="heigit-red"
          class="text-white text-none px-4 font-weight-bold"
          :disabled="!canUpload"
          @click="handleUpload"
        >
          Upload
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.mode-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.mode-option {
  display: flex;
  align-items: flex-start;
  text-align: left;
  padding: 0.75rem 1rem;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.mode-option--active {
  border-color: #ca2333;
  background-color: #fdf2f3;
}
</style>
