<script setup lang="ts">
import { ref, computed } from "vue";
// import { DataSourcesURL } from "@/config";
import { HAZARDS } from "@/enums/hazards";
import { cn } from "@/utils/cn";

interface DataSource {
  name: string;
  description: string;
  url: string | null;
  hazard_type: string[];
}

// To be replaced with a fetch from the API once the file returns the right json is available
const data = ref<DataSource[]>([
  {
    name: "Worldpop",
    description: "2030 Projection",
    url: "https://hub.worldpop.org/geodata/listing?id=135",
    hazard_type: ["flood", "cyclone"],
  },
  {
    name: "OpenStreetMap",
    description: "March 2026",
    url: "https://wiki.openstreetmap.org/wiki/Ohsome_API",
    hazard_type: ["flood", "cyclone"],
  },
  {
    name: "Global Human Settlement Layer",
    description: "2030 Projection",
    url: "https://human-settlement.emergency.copernicus.eu/ghs_pop2023.php",
    hazard_type: ["flood", "cyclone"],
  },
  {
    name: "JRC Flood Hazard Map",
    description: "2024",
    url: "https://data.jrc.ec.europa.eu/dataset/jrc-floods-floodmapgl_rp50y-tif",
    hazard_type: ["flood"],
  },
  {
    name: "International Best Track Archive for Climate Stewardship",
    description: "March 2026",
    url: "https://www.ncei.noaa.gov/products/international-best-track-archive",
    hazard_type: ["cyclone"],
  },
]);

// const isLoading = ref(false);
const selectedHazard = ref<string | null>(HAZARDS[0].keyword);

// Filter the data based on the selected hazard type
const filteredData = computed(() => {
  if (!selectedHazard.value) return data.value;
  return data.value.filter((item) =>
    item.hazard_type.includes(selectedHazard.value as string),
  );
});

// async function fetchDataSources() {
//   isLoading.value = true;
//   try {
//     const response = await fetch(DataSourcesURL);
//     if (!response.ok) throw new Error(`HTTP ${response.status}`);
//     data.value = await response.json();
//   } catch (error) {
//     console.error("Error fetching data sources:", error);
//   } finally {
//     isLoading.value = false;
//   }
// }

// onMounted(() => {
//   fetchDataSources();
// });
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
      <div
        class="overflow-auto border border-slate-200 rounded-lg custom-scrollbar bg-white"
      >
        <v-table
          class="w-full table-fixed rounded text-left text-sm text-slate-600 relative border-collapse"
        >
          <thead
            class="text-xs text-slate-500 uppercase sticky top-0 z-10 shadow-sm border-b border-slate-200"
          >
            <tr>
              <th
                class="w-1/4 px-4 py-2 bg-slate-50 whitespace-nowrap border-b border-slate-200"
              >
                Name
              </th>
              <th
                class="w-1/4 px-4 py-2 bg-slate-50 whitespace-nowrap border-b border-slate-200"
              >
                Description
              </th>
              <th
                class="w-1/2 px-4 py-2 bg-slate-50 whitespace-nowrap border-b border-slate-200"
              >
                Link
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredData" :key="item.name">
              <td
                class="px-4 py-2 font-medium text-slate-900 break-words border-b border-slate-100"
              >
                {{ item.name }}
              </td>
              <td
                class="px-4 py-2 font-medium text-slate-900 break-words border-b border-slate-100"
              >
                {{ item.description }}
              </td>
              <td
                class="px-4 py-2 font-medium text-slate-900 border-b border-slate-100"
              >
                <a
                  v-if="item.url"
                  :href="item.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-heigit-red underline break-all"
                >
                  {{ item.url }}
                </a>
                <span v-else class="text-slate-400">—</span>
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>
    </div>
  </section>
</template>
