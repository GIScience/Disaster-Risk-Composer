<script setup lang="ts">
import { ref, reactive, computed, watch } from "vue";
import { parseIndicatorCSV } from "@/utils/csv";
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
      "Your file(s) become the full indicator set. Risk is calculated from whichever dimensions you assign columns to.",
  },
];

const BASE_DIMENSION_OPTIONS = BASE_DIMENSION_PREFIXES.map(
  ({ prefix, label }) => ({
    value: prefix,
    label,
  }),
);

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

interface IndicatorFileEntry {
  id: string;
  file: File;
  isParsing: boolean;
  parseError: string | null;
  rows: Record<string, any>[];
  columns: string[];
  pcodeColumn: string | null;
  assignments: Record<string, CustomIndicatorDimension | "skip">;
}

const isDragging = ref(false);
const indicatorFiles = ref<IndicatorFileEntry[]>([]);

const selectedWeightFile = ref<File | null>(null);
const isDraggingWeight = ref(false);
const isParsingWeight = ref(false);
const weightParseError = ref<string | null>(null);
const weightCsvData = ref<Record<string, WeightCsvEntry>>({});

const existingPcodeSet = computed(
  () => new Set(props.existingPcodes.map(String)),
);

function matchCountFor(entry: IndicatorFileEntry): number {
  if (!entry.pcodeColumn) return 0;
  return entry.rows.filter((r) =>
    existingPcodeSet.value.has(String(r[entry.pcodeColumn!])),
  ).length;
}

function matchRateFor(entry: IndicatorFileEntry): number {
  return entry.rows.length > 0 ? matchCountFor(entry) / entry.rows.length : 0;
}

function matchIsSufficientFor(entry: IndicatorFileEntry): boolean {
  return entry.pcodeColumn !== null && matchRateFor(entry) >= MATCH_THRESHOLD;
}

const indicatorFilesReady = computed(
  () =>
    indicatorFiles.value.length > 0 &&
    indicatorFiles.value.every(
      (f) => !f.isParsing && f.rows.length > 0 && f.pcodeColumn !== null,
    ),
);

const allMatchIsSufficient = computed(
  () =>
    indicatorFiles.value.length > 0 &&
    indicatorFiles.value.every((f) => matchIsSufficientFor(f)),
);

const allAssignedDimensions = computed(() => {
  const dims = new Set<string>();
  for (const entry of indicatorFiles.value) {
    for (const v of Object.values(entry.assignments)) {
      if (v !== "skip") dims.add(v);
    }
  }
  return dims;
});

const missingRequiredDimensions = computed(() =>
  BASE_DIMENSION_OPTIONS.filter(
    (opt) => !allAssignedDimensions.value.has(opt.value),
  ),
);

const hasAllRequiredDimensions = computed(
  () => missingRequiredDimensions.value.length === 0,
);

const hasAtLeastOneAssignment = computed(
  () => allAssignedDimensions.value.size > 0,
);

const weightFileRequired = computed(() => uploadMode.value === "replace");

const weightFileProvided = computed(
  () =>
    !!selectedWeightFile.value && Object.keys(weightCsvData.value).length > 0,
);

const earlyIndicatorKeysForMatch = computed(() =>
  indicatorFiles.value.flatMap((entry) =>
    entry.columns.map((col) => {
      const dim = entry.assignments[col];
      return {
        name: sanitizeIndicatorName(col),
        category: dim && dim !== "skip" ? dim : null,
      };
    }),
  ),
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
    indicatorFilesReady.value &&
    allMatchIsSufficient.value &&
    (!weightFileRequired.value ||
      (weightFileProvided.value && earlyWeightMatchIsSufficient.value)),
);

// Keyed the same way buildCustomColumnName derives a column's final name (sanitized raw header +
// assigned dimension), so this lines up with what the weight file's "variable_name"/"category"
// columns are expected to match. Used once the user has assigned (or confirmed) each column's
// dimension in step 2, so - unlike earlyIndicatorKeysForMatch - only counts columns actually
// assigned to a dimension and checks their category strictly.
const indicatorKeysForValidation = computed(() =>
  indicatorFiles.value.flatMap((entry) =>
    Object.entries(entry.assignments)
      .filter(([, dim]) => dim !== "skip")
      .map(([col, dim]) => ({
        name: sanitizeIndicatorName(col),
        category: dim as string,
      })),
  ),
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

const canUpload = computed(
  () =>
    allMatchIsSufficient.value &&
    hasAtLeastOneAssignment.value &&
    weightMatchIsSufficient.value,
);

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

function makeFileEntryId(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`;
}

async function parseEntry(entry: IndicatorFileEntry) {
  try {
    const rows = await parseIndicatorCSV(entry.file);
    if (!rows.length) {
      entry.parseError =
        "This CSV has no rows. Add your data and upload again.";
      return;
    }
    const columns = Object.keys(rows[0]);
    const detected = detectPcodeColumn(columns);
    if (!detected) {
      entry.parseError = `No PCODE column found. Add a column named "${props.pcodeField}" or "PCODE".`;
      return;
    }

    const selectableColumns = columns.filter(
      (c) => !isRankingColumn(c) && !isReservedColumn(c),
    );
    const dataColumns = selectableColumns.filter((c) => c !== detected);
    if (dataColumns.length === 0) {
      entry.parseError =
        "This CSV only has the PCODE column. Add at least one data column to upload.";
      return;
    }

    entry.rows = rows;
    entry.columns = dataColumns;
    entry.pcodeColumn = detected;
    entry.assignments = Object.fromEntries(
      dataColumns.map((c) => [c, detectDimensionForColumn(c)]),
    );
  } catch (err) {
    console.error("Failed to parse CSV", err);
    entry.parseError = "Could not read this file. Upload a valid CSV.";
  } finally {
    entry.isParsing = false;
  }
}

function parseIndicatorFile(file: File) {
  const entry: IndicatorFileEntry = reactive({
    id: makeFileEntryId(file),
    file,
    isParsing: true,
    parseError: null,
    rows: [],
    columns: [],
    pcodeColumn: null,
    assignments: {},
  });
  indicatorFiles.value.push(entry);
  parseEntry(entry);
}

function handleDrop(event: DragEvent) {
  isDragging.value = false;
  const files = Array.from(event.dataTransfer?.files ?? []);
  files.forEach(parseIndicatorFile);
}

function handleFileInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  files.forEach(parseIndicatorFile);
  input.value = "";
}

function removeIndicatorFile(id: string) {
  indicatorFiles.value = indicatorFiles.value.filter((f) => f.id !== id);
  collapsedFileIds.value.delete(id);
}

// Step 2's per-file column list is collapsible so a batch of several files (each potentially with
// many columns) doesn't turn into one long unbroken scroll - collapsed by default has no value
// here, so this only tracks which files the user has explicitly collapsed.
const collapsedFileIds = ref<Set<string>>(new Set());

function toggleFileCollapsed(id: string) {
  const next = new Set(collapsedFileIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  collapsedFileIds.value = next;
}

function bulkAssignFile(
  entry: IndicatorFileEntry,
  dimension: CustomIndicatorDimension | "skip",
) {
  for (const col of entry.columns) {
    entry.assignments[col] = dimension;
  }
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
  if (!canUpload.value) return;
  indicatorFiles.value.forEach((entry, index) => {
    if (!entry.pcodeColumn) return;
    emit("upload", {
      pcodeColumn: entry.pcodeColumn,
      rows: entry.rows,
      assignments: entry.assignments,
      mode:
        uploadMode.value === "replace" && index === 0 ? "replace" : "append",
      weights: weightFileRequired.value ? weightCsvData.value : undefined,
    });
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
            class="flex items-center gap-2"
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
              {{
                weightFileRequired ? "Files (weight file required)" : "Files"
              }}
            </div>

            <div class="d-flex flex-column gap-3">
              <!-- Indicator data -->
              <div
                class="flex flex-col gap-3 py-3 px-3.5 border-[1.5px] border-slate-200 rounded-[10px] bg-white transition-colors duration-150"
                :class="{
                  'border-heigit-red bg-[#fdf2f3]': isDragging,
                  'border-green-200 bg-[#f6fdf8]':
                    indicatorFilesReady && allMatchIsSufficient,
                  'border-red-200 bg-[#fef6f6]':
                    indicatorFiles.some((f) => f.parseError) ||
                    (indicatorFilesReady && !allMatchIsSufficient),
                }"
                @dragover.prevent="isDragging = true"
                @dragleave.prevent="isDragging = false"
                @drop.prevent="handleDrop"
              >
                <div class="flex items-start gap-3">
                  <v-icon
                    :icon="
                      indicatorFilesReady && allMatchIsSufficient
                        ? 'mdi-check-circle'
                        : 'mdi-file-table-outline'
                    "
                    size="20"
                    :color="
                      indicatorFilesReady && allMatchIsSufficient
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
                      CSV(s) with a PCODE column named "{{ pcodeField }}", plus
                      your indicator columns. Select multiple files to add
                      several indicators at once.
                    </div>
                  </div>

                  <div class="shrink-0">
                    <v-btn
                      variant="flat"
                      color="heigit-red"
                      size="small"
                      :title="`Upload Indicator CSV(s) for ${selectedCountryName}`"
                      :aria-label="`Upload Indicator CSV(s) for ${selectedCountryName}`"
                      class="shrink-0 text-white text-none gap-1.5 px-2 font-bold"
                      prepend-icon="mdi-tray-arrow-up"
                      @click="indicatorInput?.click()"
                    >
                      {{ indicatorFiles.length ? "Add more" : "Upload CSV" }}
                    </v-btn>
                    <input
                      ref="indicatorInput"
                      type="file"
                      accept=".csv"
                      multiple
                      class="d-none"
                      @change="handleFileInput"
                    />
                  </div>
                </div>

                <div
                  v-if="indicatorFiles.length"
                  class="d-flex flex-column gap-1.5 pl-8"
                >
                  <div
                    v-for="entry in indicatorFiles"
                    :key="entry.id"
                    class="flex flex-col gap-1 py-1.5 px-2 border border-slate-200 rounded-lg bg-slate-50"
                  >
                    <div class="flex items-center gap-1">
                      <v-icon
                        icon="mdi-file-document-outline"
                        size="16"
                        class="mr-1"
                      />
                      <span
                        class="text-[0.75rem] font-semibold text-slate-700 truncate flex-1 min-w-0"
                        >{{ entry.file.name }}</span
                      >
                      <span class="text-[0.7rem] text-slate-400 shrink-0">{{
                        formatFileSize(entry.file.size)
                      }}</span>
                      <v-btn
                        icon="mdi-close"
                        variant="text"
                        size="x-small"
                        density="comfortable"
                        :aria-label="`Remove ${entry.file.name}`"
                        @click="removeIndicatorFile(entry.id)"
                      />
                    </div>

                    <div
                      v-if="entry.isParsing"
                      class="flex items-center text-[0.72rem] text-slate-500"
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
                      v-else-if="entry.rows.length && entry.pcodeColumn"
                      class="flex items-center text-[0.72rem]"
                      :class="
                        matchIsSufficientFor(entry)
                          ? 'text-success'
                          : 'text-error'
                      "
                    >
                      {{ matchCountFor(entry) }} of
                      {{ entry.rows.length }} PCODEs match the
                      {{ selectedCountry }} boundaries.
                      <template v-if="!matchIsSufficientFor(entry)">
                        At least {{ Math.round(MATCH_THRESHOLD * 100) }}% need
                        to match.
                      </template>
                    </div>

                    <div
                      v-if="entry.parseError"
                      class="flex items-center text-[0.72rem] text-error"
                    >
                      {{ entry.parseError }}
                    </div>
                  </div>
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
                    file sets weights for every indicator file above.
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
                      indicatorFilesReady &&
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
          <p class="text-sm text-medium-emphasis mb-0">
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
            v-for="entry in indicatorFiles"
            :key="entry.id"
            class="d-flex flex-column gap-1.5"
          >
            <div
              v-if="indicatorFiles.length > 1"
              class="flex items-center justify-between sticky -top-5 shadow-xs bg-slate-100 border border-slate-200 px-2 py-1 gap-1 text-sm h-12 rounded-xs w-full font-bold text-slate-700 z-10 p-0 cursor-pointer max-w-full"
              @click="toggleFileCollapsed(entry.id)"
            >
              <span class="truncate">{{ entry.file.name }}</span>
              <v-icon
                :icon="
                  collapsedFileIds.has(entry.id)
                    ? 'mdi-chevron-right'
                    : 'mdi-chevron-down'
                "
                size="20"
                class="shrink-0"
              />
            </div>
            <div
              v-if="!collapsedFileIds.has(entry.id)"
              class="flex flex-col ml-4 border-[1.5px] overflow-clip border-slate-200"
            >
              <div
                v-if="entry.columns.length > 1"
                class="flex items-center justify-between gap-3 py-2 px-3 border-b border-[#eef2f6] bg-slate-50"
              >
                <span class="text-xs font-weight-medium text-slate-500"
                  >Assign all columns to</span
                >
                <v-select
                  :items="assignmentSelectOptions"
                  item-title="label"
                  item-value="value"
                  density="compact"
                  variant="outlined"
                  color="heigit-red"
                  hide-details
                  placeholder="Choose..."
                  :list-props="{ density: 'compact' }"
                  :menu-props="{ contentClass: 'upload-assign-menu' }"
                  class="flex-none w-30 border px-2 rounded-md [&_.v-field__input]:text-[0.7rem] [&_.v-field__input]:font-medium [&_.v-field__input]:min-h-8 [&_.v-field__input]:py-[0.2rem] [&_.v-field__input]:px-[0.3rem]"
                  @update:model-value="bulkAssignFile(entry, $event)"
                />
              </div>
              <div
                v-for="col in entry.columns"
                :key="col"
                class="flex items-center justify-between gap-3 py-2 px-3 border-b border-[#eef2f6] last:border-b-0 even:bg-[#fafbfc]"
              >
                <span class="text-sm font-weight-medium text-truncate">{{
                  col
                }}</span>
                <v-select
                  v-model="entry.assignments[col]"
                  :items="assignmentSelectOptions"
                  item-title="label"
                  item-value="value"
                  density="compact"
                  variant="outlined"
                  color="heigit-red"
                  hide-details
                  :list-props="{ density: 'compact' }"
                  :menu-props="{ contentClass: 'upload-assign-menu' }"
                  class="flex-none w-30 border px-2 rounded-md [&_.v-field__input]:text-[0.7rem] [&_.v-field__input]:font-medium [&_.v-field__input]:min-h-8 [&_.v-field__input]:py-[0.2rem] [&_.v-field__input]:px-[0.3rem]"
                />
              </div>
              <div
                v-if="entry.columns.length === 0"
                class="text-caption text-medium-emphasis text-center py-3"
              >
                No columns found besides the PCODE column.
              </div>
            </div>
          </div>

          <v-alert
            v-if="!hasAtLeastOneAssignment"
            type="warning"
            variant="tonal"
            density="compact"
            class="rounded-lg text-sm flex items-center p-2 gap-2"
          >
            Assign at least one column to a dimension to upload.
          </v-alert>

          <v-alert
            v-else-if="uploadMode === 'replace' && !hasAllRequiredDimensions"
            type="info"
            variant="tonal"
            density="compact"
            class="rounded-lg text-sm p-2 gap-2"
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
            class="rounded-lg text-sm p-2 gap-2"
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
.alert-small-icon :deep(.v-alert__icon) {
  font-size: 0.075rem;
}
</style>

<style>
.upload-assign-menu {
  border-radius: 10px;
  font-size: 0.7rem !important;
}

.upload-assign-menu .v-list {
  padding: 0;
}

.upload-assign-menu .v-list-item {
  min-height: 32px;
  padding-inline: 10px;
  font-size: 0.7rem !important;
}
</style>
