<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { DataSourcesURL } from "@/config";
import { HAZARDS } from "@/enums/hazards";
import { cn } from "@/utils/cn";

interface DataSource {
  name: string;
  description: string;
  url: string | null;
  hazard_type: string[];
  used_indicator: string[];
}


const data = ref<DataSource[]>([]);

const isLoading = ref(false);
const selectedHazard = ref<string | null>(HAZARDS[0].keyword);
const expandedNames = ref<Set<string>>(new Set());

// Filter the data based on the selected hazard type
const filteredData = computed(() => {
  if (!selectedHazard.value) return data.value;
  return data.value.filter((item) =>
    item.hazard_type.includes(selectedHazard.value as string),
  );
});

function toggleExpanded(name: string) {
  const next = new Set(expandedNames.value);
  if (next.has(name)) {
    next.delete(name);
  } else {
    next.add(name);
  }
  expandedNames.value = next;
}

async function fetchDataSources() {
  isLoading.value = true;
  try {
    const response = await fetch(DataSourcesURL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data.value = await response.json();
  } catch (error) {
    console.error("Error fetching data sources:", error);
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchDataSources();
});
</script>

<template>
  <section class="h-full min-h-[400px] flex flex-col">
    <h3 class="text-lg font-extrabold text-slate-900 mb-2 mt-2 tracking-tight">
      Data Sources
    </h3>
    <div id="data-sources" class="flex-1 space-y-6 w-[43rem]">
      <div class="flex flex-wrap bg-slate-100 rounded-md shadow-sm w-fit">
        <v-btn
          v-for="(hazard, index) in HAZARDS"
          variant="outlined"
          :key="hazard.keyword"
          @click="selectedHazard = hazard.keyword"
          :class="
            cn(
              'bg-slate-100 text-slate-700 text-xs font-bold uppercase shadow-none tracking-wider transition-colors py-1 px-4',
              'rounded-none',
              index === 0 && 'rounded-s-md',
              index === HAZARDS.length - 1 && 'rounded-e-md',
              selectedHazard === hazard.keyword
                ? 'bg-heigit-red text-white'
                : 'text-slate-700 bg-none',
            )
          "
        >
          {{ hazard.label }}
        </v-btn>
      </div>
      <div class="overflow-auto custom-scrollbar space-y-2">
        <div
          v-for="item in filteredData"
          :key="item.name"
          class="border border-slate-200 rounded-lg bg-white overflow-hidden"
        >
          <button
            type="button"
            class="w-full flex items-center justify-between hover:bg-slate-50 gap-2 px-4 py-2.5 text-left cursor-pointer"
            @click="toggleExpanded(item.name)"
          >
            <span class="font-medium text-slate-900 break-words">{{
              item.name
            }}</span>
            <v-icon
              :icon="
                expandedNames.has(item.name)
                  ? 'mdi-chevron-down'
                  : 'mdi-chevron-right'
              "
              size="20"
              class="shrink-0 text-slate-500"
            />
          </button>
          <div
            v-if="expandedNames.has(item.name)"
            class="px-4 pb-3 pt-0 border-t border-slate-100 space-y-2 text-sm text-slate-600"
          >
            <div class="pt-3">
              <p
                class="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1"
              >
                Description
              </p>
              <p>{{ item.description }}</p>
            </div>
            <div>
              <p
                class="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1"
              >
               URL
              </p>
              <a
                v-if="item.url"
                :href="item.url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-heigit-red underline break-all"
              >
                {{ item.url }}
              </a>
              <span v-else class="text-slate-400">No link available</span>
            </div>
            <div v-if="item.used_indicator?.length" class="pt-1">
              <p
                class="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5"
              >
                Derived Indicators ({{ item.used_indicator.length }})
              </p>
              <div
                class="flex flex-wrap gap-1.5 max-h-60 overflow-y-auto custom-scrollbar pr-1"
              >
                <span
                  v-for="indicator in item.used_indicator"
                  :key="indicator"
                  class="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-mono"
                >
                  {{ indicator }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
