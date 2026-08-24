<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import SatelliteImage from "@/assets/basemap/satellite.svg";
import PositronImage from "@/assets/basemap/positron.svg";
import OpenStreetMapImage from "@/assets/basemap/osm.svg";
import { useRoute, useRouter } from "vue-router";
import type maplibregl from "maplibre-gl";

export interface BasemapOption {
  id: string;
  label: string;
  style: string | maplibregl.StyleSpecification;
  image?: string;
}

const props = withDefaults(
  defineProps<{
    map: maplibregl.Map | null;
    position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    options?: BasemapOption[];
    isMobile?: boolean;
    defaultStyleId?: string;
  }>(),
  {
    position: "top-right",
    options: () => [
      {
        id: "positron",
        label: "Positron",
        style: "https://tiles.openfreemap.org/styles/positron",
        image: PositronImage,
      },
      {
        id: "osm",
        label: "OpenStreetMap",
        style: "https://tiles.openfreemap.org/styles/bright",
        image: OpenStreetMapImage,
      },
      {
        id: "satellite",
        label: "Satellite",
        image: SatelliteImage,
        style: {
          version: 8,
          sources: {
            "satellite-tiles": {
              type: "raster",
              tiles: [
                "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
              ],
              tileSize: 256,
              attribution:
                "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
            },
          },
          layers: [
            {
              id: "satellite-layer",
              type: "raster",
              source: "satellite-tiles",
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        },
      },
    ],
  },
);

const emit = defineEmits<{
  (e: "change", style: string | maplibregl.StyleSpecification): void;
}>();

const route = useRoute();
const router = useRouter();

function basemapIdFromUrl(): string | null {
  const value = route.query.basemap;
  return typeof value === "string" && props.options.some((o) => o.id === value)
    ? value
    : null;
}

const defaultId = props.defaultStyleId || props.options[0]?.id || "";
const activeStyleId = ref<string>(basemapIdFromUrl() || defaultId);
const activeOption = computed(
  () =>
    props.options.find((o) => o.id === activeStyleId.value) || props.options[0],
);

const isOpen = ref(false);
const controlRef = ref<HTMLElement | null>(null);

function openDropdown() {
  isOpen.value = true;
}

function closeDropdown() {
  isOpen.value = false;
}

function toggleDropdown() {
  isOpen.value = !isOpen.value;
}

function handleClickOutside(event: MouseEvent) {
  if (controlRef.value && !controlRef.value.contains(event.target as Node)) {
    closeDropdown();
  }
}

onMounted(() => document.addEventListener("click", handleClickOutside));
onUnmounted(() => document.removeEventListener("click", handleClickOutside));

function switchBasemap(option: BasemapOption) {
  closeDropdown();
  if (!props.map || activeStyleId.value === option.id) return;

  activeStyleId.value = option.id;
  emit("change", option.style);
  router
    .replace({ query: { ...route.query, basemap: option.id } })
    .catch(() => {});
}

// If the URL requested a non-default basemap, apply it once the map is ready.
watch(
  () => props.map,
  (mapInstance) => {
    if (!mapInstance || activeStyleId.value === defaultId) return;
    const option = props.options.find((o) => o.id === activeStyleId.value);
    if (option) emit("change", option.style);
  },
  { immediate: true },
);
</script>

<template>
  <div
    v-if="map"
    ref="controlRef"
    class="absolute z-30 animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white/80 backdrop-blur-xl border border-slate-200 rounded-lg shadow-2xl animate-in"
    :class="props.isMobile ? 'bottom-4 right-4' : 'bottom-32 right-4'"
    @mouseenter="openDropdown"
    @mouseleave="closeDropdown"
  >
    <button
      type="button"
      :title="`Basemap: ${activeOption?.label}`"
      class="flex items-center justify-center p-1 w-12 h-12 text-slate-700 hover:text-heigit-red hover:border-heigit-red transition-colors overflow-hidden rounded-md"
      @click="toggleDropdown"
    >
      <img
        v-if="activeOption?.image"
        :src="activeOption.image"
        :alt="activeOption.label"
        class="w-full h-full object-cover rounded-md"
      />
      <v-icon v-else icon="mdi-map" class="w-5 h-5" />
    </button>

    <div
      v-if="isOpen"
      class="absolute right-full top-2 -translate-y-1/2 min-w-[9.5rem] bg-white border border-slate-200 rounded-lg shadow-2xl py-1 animate-in fade-in slide-in-from-right-2 duration-200"
    >
      <button
        v-for="option in options"
        :key="option.id"
        type="button"
        :title="`Switch to ${option.label}`"
        class="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 cursor-pointer flex items-center justify-between gap-3 transition-colors"
        :class="
          activeStyleId === option.id
            ? 'text-heigit-red bg-red-50 font-semibold'
            : 'text-slate-700'
        "
        @click="switchBasemap(option)"
      >
        <span class="truncate capitalize">{{ option.label }}</span>
        <span
          v-if="activeStyleId === option.id"
          class="text-heigit-red text-xs shrink-0"
          >●</span
        >
      </button>
    </div>
  </div>
</template>
