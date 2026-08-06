<script setup lang="ts">
import type { Legend, layerConfigType, MapConfig } from "@/types/story-map";
import StoryMapCanvas from "@/components/story-map/StoryMapCanvas.vue";

defineProps<{
  control: MapConfig;
  layer?: layerConfigType;
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
      :rasterUrl="layer.type === 'vector' ? undefined : layer.sourceUrl"
      :layer-id="layer.layerId"
      :raster-color-scheme="layer.colorScheme"
      :mode="layer.mode"
      :vectorUrl="layer.type === 'vector' ? layer.sourceUrl : undefined"
      :vectorCategoryProperty="layer.categoryProperty"
      :vectorCategories="layer.categories"
      :vectorSourceLayer="layer.sourceLayer"
      :showOpacityControl="control?.showOpacityControl"
      :visible="visible"
    />
  </div>
</template>
