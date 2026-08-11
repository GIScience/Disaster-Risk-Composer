<script setup lang="ts">
import { computed, ref, nextTick, onMounted, onBeforeUnmount, watch } from "vue";
import { useIndicatorColumns } from "@/composables/useIndicatorColumns";
import { useIndicatorWeights } from "@/composables/useIndicatorWeights";
import RankingTab from "@/components/dashboard/statistics/RankingTab.vue";
import ComponentsTab from "@/components/dashboard/statistics/ComponentsTab.vue";
import DemographicsTab from "@/components/dashboard/statistics/DemographicsTab.vue";
import IndicatorsTab from "@/components/dashboard/statistics/IndicatorsTab.vue";
import WeightsTab from "@/components/dashboard/statistics/WeightsTab.vue";
import TableTab from "@/components/dashboard/statistics/TableTab.vue";
import MetadataTab from "@/components/dashboard/statistics/MetadataTab.vue";

const props = defineProps<{
  data: any[];
  selectedDisaster: string;
  selectedCountry: string;
  pcodeField: string;
  indicatorWeights: Record<string, number>;
  isMobile?: boolean;
  customIndicatorsReplaced?: boolean;
}>();

const emit = defineEmits<{
  (e: "region-hover", pcode: string | null): void;
  (e: "region-click", pcode: string): void;
  (e: "update:indicatorWeights", val: Record<string, number>): void;
  (e: "reset-custom-data"): void;
}>();

const activeTab = ref<
  | "ranking"
  | "components"
  | "demographics"
  | "indicators"
  | "weights"
  | "table"
  | "metadata"
>("ranking");

const tabsScrollEl = ref<HTMLElement | null>(null);
const canScrollLeft = ref(false);
const canScrollRight = ref(false);

function updateScrollState() {
  const el = tabsScrollEl.value;
  if (!el) return;
  canScrollLeft.value = el.scrollLeft > 0;
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
}

function scrollTabs(direction: "left" | "right") {
  const el = tabsScrollEl.value;
  if (!el) return;
  el.scrollBy({ left: direction === "left" ? -150 : 150, behavior: "smooth" });
}

onMounted(() => {
  updateScrollState();
  window.addEventListener("resize", updateScrollState);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", updateScrollState);
});

watch(
  () => props.isMobile,
  () => nextTick(updateScrollState),
);

const {
  disasterLabel,
  formatColName,
  indicatorCols,
  indicatorDimensionGroups,
  dimensionSummaryText,
} = useIndicatorColumns(props);

// True as soon as any custom upload (append or replace) has added/replaced indicator columns
// for this country - drives the "Reset to Default" button in the Indicators tab.
const hasCustomUpload = computed(
  () =>
    !!props.customIndicatorsReplaced ||
    indicatorCols.value.some((c) => c.includes("_custom_")),
);

const {
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
} = useIndicatorWeights(props, emit, indicatorDimensionGroups);
</script>

<template>
  <div class="risk-statistics h-full flex flex-col bg-white">
    <!-- Tabs Header -->
    <div class="relative flex items-center gap-1 p-4 border-b border-slate-200 w-full">
      <button
        v-if="canScrollLeft"
        type="button"
        aria-label="Scroll tabs left"
        class="flex-none p-0 text-heigit-red flex items-center justify-center hover:bg-heigit-50 absolute left-1 z-20 border border-red-300 bg-white rounded-md shadow-2xl "
        @click="scrollTabs('left')"
      >
        <v-icon icon="mdi-chevron-left" size="24" />
      </button>

      <div
        ref="tabsScrollEl"
        class="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth"
        @scroll="updateScrollState"
      >
        <button
          v-for="tab in isMobile
            ? ['ranking', 'table', 'indicators', 'weights', 'metadata']
            : [
                'ranking',
                'components',
                'demographics',
                'table',
                'indicators',
                'weights',
                'metadata',
              ]"
          :key="tab"
          @click="activeTab = tab as any"
          class="flex-none px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors"
          :class="
            activeTab === tab
              ? 'bg-heigit-red text-white'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          "
        >
          {{ tab }}
        </button>
      </div>

      <button
        v-if="canScrollRight"
        type="button"
        aria-label="Scroll tabs right"
        class="flex-none p-0 text-heigit-red flex items-center justify-center  hover:bg-heigit-50 absolute right-1 bg-white rounded-md shadow-2xl "
        @click="scrollTabs('right')"
      >
        <v-icon icon="mdi-chevron-right" size="24" />
      </button>
    </div>

    <!-- Content section -->
    <div
      class="flex-1 p-2 flex flex-col min-h-0"
      :class="activeTab !== 'table' ? 'overflow-y-auto custom-scrollbar' : ''"
    >
      <RankingTab
        v-if="activeTab === 'ranking'"
        :data="data"
        :selected-disaster="selectedDisaster"
        :pcode-field="pcodeField"
        @region-hover="emit('region-hover', $event)"
      />

      <ComponentsTab
        v-else-if="activeTab === 'components'"
        :data="data"
        :selected-disaster="selectedDisaster"
        :pcode-field="pcodeField"
        @region-hover="emit('region-hover', $event)"
      />

      <DemographicsTab v-else-if="activeTab === 'demographics'" :data="data" />

      <IndicatorsTab
        v-else-if="activeTab === 'indicators'"
        :dimension-groups="indicatorDimensionGroups"
        :get-weight="getWeight"
        :set-weight="setWeight"
        :is-sub-indicator-active="isSubIndicatorActive"
        :toggle-sub-indicator="toggleSubIndicator"
        :is-group-active="isGroupActive"
        :toggle-group="toggleGroup"
        :format-col-name="formatColName"
        :has-custom-upload="hasCustomUpload"
        @reset-custom-data="emit('reset-custom-data')"
      />

      <WeightsTab
        v-else-if="activeTab === 'weights'"
        :is-mobile="isMobile"
        :dimension-groups="indicatorDimensionGroups"
        :disaster-label="disasterLabel"
        :dimension-summary-text="dimensionSummaryText"
        :get-weight="getWeight"
        :set-weight="setWeight"
        :format-col-name="formatColName"
        :reset-dimension-weights="resetDimensionWeights"
        :download-weights-c-s-v="downloadWeightsCSV"
        :upload-weights-c-s-v="uploadWeightsCSV"
        :pending-weight-upload="pendingWeightUpload"
        :confirm-weight-upload="confirmWeightUpload"
        :cancel-weight-upload="cancelWeightUpload"
      />

      <TableTab
        v-else-if="activeTab === 'table'"
        :data="data"
        :selected-disaster="selectedDisaster"
        :pcode-field="pcodeField"
        :disaster-label="disasterLabel"
        :indicator-cols="indicatorCols"
        :format-col-name="formatColName"
        @region-hover="emit('region-hover', $event)"
      />
      <MetadataTab v-else-if="activeTab === 'metadata'" />
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #8b4c4c; /* HeiGIT Red */
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #8b4c4c; /* Darker HeiGIT Red */
}
</style>
