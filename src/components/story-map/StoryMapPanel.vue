<script setup lang="ts">
import type { Legend, layerConfigType, MapConfig } from "@/types/story-map";
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
}>();
</script>

<template>
  <div class="relative h-full bg-[#f3f4f2]">
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
      :rasterMin="0"
      :rasterMax="1"
      :rasterUrl="layer.type === 'vector' || layer.type === 'choropleth' ? undefined : layer.sourceUrl"
      :layer-id="layer.layerId"
      :raster-color-scheme="layer.colorScheme"
      :mode="layer.mode"
      :baseLayerId="baseLayer?.layerId"
      :baseRasterUrl="baseLayer?.type === 'vector' || baseLayer?.type === 'choropleth' ? undefined : baseLayer?.sourceUrl"
      :baseRasterColorScheme="baseLayer?.colorScheme"
      :baseMode="baseLayer?.mode"
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
  </div>
</template>
