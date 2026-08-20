<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type maplibregl from "maplibre-gl";
import Map from "@/components/map/map.vue";
import COGLayer from "@/components/map/COGLayer.vue";
import VectorLayer from "@/components/map/VectorLayer.vue";
import ChoroplethLayer from "@/components/map/ChoroplethLayer.vue";
import MapLegend from "@/components/story-map/MapLegend.vue";
import type { MapLegendLayer } from "@/components/story-map/MapLegend.vue";
import { cn } from "@/utils/cn";
import type { ChoroplethStop, VectorCategoryStyle } from "@/types/story-map";
const props = withDefaults(
  defineProps<{
    center?: [number, number];
    zoom?: number;
    height?: string;
    caption?: string;
    mapStyle?: string;
    layerId?: string;
    interactive?: boolean;
    rasterUrl?: string;
    rasterColorScheme?: string;
    rasterMin?: number;
    rasterMax?: number;
    mode?: "rgb" | "ramp" | "categorical";
    showOpacityControl?: boolean;
    vectorUrl?: string;
    vectorCategoryProperty?: string;
    vectorCategories?: VectorCategoryStyle[];
    vectorSourceLayer?: string;
    choroplethUrl?: string;
    choroplethSourceLayer?: string;
    choroplethPcodeField?: string;
    choroplethValuesUrl?: string;
    choroplethStops?: ChoroplethStop[];
    choroplethUnit?: string;
    baseLayerId?: string;
    baseRasterUrl?: string;
    baseRasterColorScheme?: string;
    baseMode?: "rgb" | "ramp" | "categorical";
    layerLabel?: string;
    baseLayerLabel?: string;
  }>(),
  {
    center: () => [20, 10],
    zoom: 1.8,
    height: "440px",
    mapStyle: "https://tiles.openfreemap.org/styles/positron",
    interactive: true,
    layerId: "story-map-raster",
    mode: "rgb",
    showOpacityControl: false,
  },
);

const el = ref<HTMLElement | null>(null);
const isVisible = ref(false);
const isLoaded = ref(false);
const layerOpacity = ref(1);

let intersectionObserver: IntersectionObserver | null = null;

const legendLayers = computed<MapLegendLayer[]>(() => [
  ...(props.baseRasterUrl && props.baseMode === "ramp"
    ? [{ label: props.baseLayerLabel, rasterColorScheme: props.baseRasterColorScheme }]
    : []),
  ...(props.vectorUrl
    ? [{ label: props.layerLabel, vectorCategories: props.vectorCategories }]
    : props.rasterUrl && props.mode === "ramp"
      ? [{ label: props.layerLabel, rasterColorScheme: props.rasterColorScheme }]
      : []),
]);


const baseLayerAnchorId = "story-map-base-layer-anchor";

function handleMapLoad(map: maplibregl.Map) {
  isLoaded.value = true;
  if (!map.getLayer(baseLayerAnchorId)) {
    map.addLayer({
      id: baseLayerAnchorId,
      type: "background",
      paint: { "background-opacity": 0 },
    });
  }
}

onMounted(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    isVisible.value = true;
    return;
  }

  intersectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          isVisible.value = true;
          intersectionObserver?.disconnect();
        }
      });
    },
    {
      threshold: 0.15,
      rootMargin: "120px",
    },
  );

  if (el.value) intersectionObserver.observe(el.value);
  
});

onBeforeUnmount(() => {
  intersectionObserver?.disconnect();
});
</script>

<template>
  <figure ref="el" data-no-reveal class="h-full">
    <div
      class="relative overflow-hidden h-[700px] rounded-r-md shadow-sm transition-all duration-700 ease-out"
      :class="isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]'"
    >
      <!-- Layer Opacity Control -->
      <div
        v-if="showOpacityControl"
        class="absolute top-3 left-3 z-40 bg-white rounded-md p-2 flex flex-col gap-1.5 mb-2 shadow-md"
      >
        <label
          :class="
            cn(
              'block font-bold uppercase tracking-widest whitespace-nowrap text-slate-500 text-[9px]',
            )
          "
        >
          Opacity:
          <span class="font-extrabold text-slate-700">
            {{ Math.round(layerOpacity * 100) }}%
          </span>
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          v-model.number="layerOpacity"
          :class="
            cn(
              'w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-heigit-red h-1.5',
            )
          "
        />
      </div>
      <!-- Legend -->
      <MapLegend :layers="legendLayers" />
      <Map
        v-if="isVisible"
        :map-style="mapStyle"
        :center="center"
        :zoom="zoom"
        @load="handleMapLoad"
      >
        <template #default="{ map }">
          <!--
            Base layer anchors below baseLayerAnchorId (see script), which
            sits just above the basemap. The primary layer below
            (COGLayer/VectorLayer/ChoroplethLayer) must NOT be given a
            belowLayerId — MapLibre then always adds it (and every sub-layer
            it manages) at the very top of the style, above the base layer,
            regardless of mount order, reloads, or how many sub-layers it has.
          -->
          <COGLayer
            v-if="baseRasterUrl"
            :map="map"
            :source-url="baseRasterUrl"
            :layer-id="baseLayerId"
            :color-scheme="baseRasterColorScheme"
            :opacity="layerOpacity"
            :min="rasterMin"
            :max="rasterMax"
            continuous
            :mode="baseMode"
            :below-layer-id="baseLayerAnchorId"
          />
          <COGLayer
            v-if="rasterUrl"
            :map="map"
            :source-url="rasterUrl"
            :layer-id="layerId"
            :color-scheme="rasterColorScheme"
            :opacity="layerOpacity"
            :min="rasterMin"
            :max="rasterMax"
            continuous
            :mode="mode"
          />
          <VectorLayer
            v-if="vectorUrl && vectorCategoryProperty && vectorCategories"
            :map="map"
            :source-url="vectorUrl"
            :layer-id="layerId"
            :category-property="vectorCategoryProperty"
            :categories="vectorCategories"
            :source-layer="vectorSourceLayer"
          />
          <ChoroplethLayer
            v-if="
              choroplethUrl &&
              choroplethSourceLayer &&
              choroplethPcodeField &&
              choroplethValuesUrl &&
              choroplethStops
            "
            :map="map"
            :source-url="choroplethUrl"
            :layer-id="layerId"
            :source-layer="choroplethSourceLayer"
            :pcode-field="choroplethPcodeField"
            :values-url="choroplethValuesUrl"
            :stops="choroplethStops"
            :unit="choroplethUnit"
          />
        </template>
      </Map>
      <div
        v-if="!isLoaded"
        class="absolute inset-0 flex items-center justify-center"
      >
        <div
          class="h-8 w-8 animate-spin rounded-full border-4 border-heigit-red border-t-transparent"
        />
      </div>
    </div>
    <figcaption
      v-if="caption"
      class="mt-3 text-center text-xs italic text-slate-500"
    >
      {{ caption }}
    </figcaption>
  </figure>
</template>
