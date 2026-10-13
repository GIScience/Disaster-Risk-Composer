<script setup lang="ts">
import type { Legend, layerConfigType, MapConfig, StackLayer } from "@/types/story-map";
import StoryMapCanvas from "./StoryMapCanvas.vue";
import StoryLegend from "./StoryLegend.vue";

defineProps<{
  control: MapConfig;
  layer?: layerConfigType;
  layerLabel?: string;
  baseLayer?: layerConfigType;
  baseLayerLabel?: string;
  legend?: Legend;
  visible?: boolean;
  stackLayers?: StackLayer[];
  /** Stacked layers replacing the base layer (the primary layer is still drawn on top). */
  baseStackLayers?: StackLayer[];
}>();
</script>

<template>
  <div class="relative bg-[#f3f4f2]">
    <slot :layer-id="layer?.layerId">
      <div
        class="absolute inset-0 flex items-center justify-center text-xs text-gray-300"
        :data-layer-id="layer?.layerId"
      >
        Map layer: {{ layer?.layerId }}
      </div>
    </slot>

    <StoryMapCanvas
      v-if="layer"
      :center="control.center"
      :zoom="control.zoom"
      interactive
      :rasterMin="layer.min ?? 0"
      :rasterMax="layer.max ?? 1"
      :rasterSwatch="layer.legendSwatch"
      :rasterUrl="stackLayers || layer.type === 'vector' || layer.type === 'choropleth' ? undefined : layer.sourceUrl"
      :stackLayers="stackLayers ?? baseStackLayers"
      :stackLegend="control.stackLegend"
      :layer-id="layer.layerId"
      :raster-color-scheme="layer.colorScheme"
      :mode="layer.mode"
      :baseLayerId="baseLayer?.layerId"
      :baseRasterUrl="baseStackLayers || baseLayer?.type === 'vector' || baseLayer?.type === 'choropleth' ? undefined : baseLayer?.sourceUrl"
      :baseRasterColorScheme="baseLayer?.colorScheme"
      :baseMode="baseLayer?.mode"
      :baseRasterMin="baseLayer?.min ?? 0"
      :baseRasterMax="baseLayer?.max ?? 1"
      :baseRasterSwatch="baseLayer?.legendSwatch"
      :layerLabel="layerLabel"
      :baseLayerLabel="baseLayerLabel"
      :vectorUrl="layer.type === 'vector' ? layer.sourceUrl : undefined"
      :vectorCategoryProperty="layer.categoryProperty"
      :vectorCategories="layer.categories"
      :vectorSourceLayer="layer.sourceLayer"
      :choroplethUrl="layer.type === 'choropleth' ? layer.sourceUrl : undefined"
      :choroplethSourceLayer="layer.sourceLayer"
      :choroplethPcodeField="layer.pcodeField"
      :choroplethValuesUrl="layer.valuesUrl"
      :choroplethStops="layer.stops"
      :choroplethUnit="layer.unit"
      :showOpacityControl="control?.showOpacityControl"
      :visible="visible"
    />

    <StoryLegend
      v-if="legend"
      class="absolute bottom-3 left-3 z-30"
      :legend="legend"
      floating
    />

    <!-- Example results box, e.g. the top districts of the mapped indicator -->
    <div
      v-if="control.results"
      class="absolute right-14 top-3 z-30 w-60 rounded-lg border border-gray-200 bg-white/95 p-3 shadow-sm backdrop-blur"
    >
      <div class="text-xs font-semibold text-gray-800">{{ control.results.title }}</div>
      <ul class="mt-2 divide-y divide-gray-100">
        <li
          v-for="row in control.results.rows"
          :key="row.name"
          class="flex items-baseline justify-between gap-2 py-1.5"
        >
          <span class="text-xs text-gray-600">{{ row.name }}</span>
          <span class="flex-none text-right">
            <span class="block text-sm font-bold tabular-nums text-gray-900">{{ row.value.toLocaleString("en") }}</span>
            <span class="block text-[9px] leading-tight text-gray-400">{{ control.results.unit }}</span>
          </span>
        </li>
      </ul>
      <a
        v-if="control.results.link"
        :href="control.results.link.href"
        class="mt-2 flex items-center justify-end gap-1 text-xs font-semibold text-heigit-red no-underline hover:underline"
      >
        {{ control.results.link.label }}
        <v-icon icon="mdi-open-in-new" size="13" />
      </a>
    </div>
  </div>
</template>
