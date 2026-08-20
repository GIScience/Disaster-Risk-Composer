<script setup lang="ts">
import { computed } from "vue";
import { colorScale } from "@geomatico/maplibre-cog-protocol";
import type { VectorCategoryStyle } from "@/types/story-map";

export interface MapLegendLayer {
  label?: string;
  rasterColorScheme?: string;
  vectorCategories?: VectorCategoryStyle[];
}

const props = defineProps<{
  layers: MapLegendLayer[];
}>();

const GRADIENT_STOPS = 8;

function gradientCssFor(colorScheme: string) {
  try {
    const scale = colorScale({
      colorScheme,
      min: 0,
      max: 1,
      isContinuous: true,
    });
    const stops = Array.from({ length: GRADIENT_STOPS }, (_, i) => {
      const [r, g, b] = scale(i / (GRADIENT_STOPS - 1));
      return `rgb(${r}, ${g}, ${b})`;
    });
    return `linear-gradient(to right, ${stops.join(", ")})`;
  } catch {
    return null;
  }
}

const visibleLayers = computed(() =>
  props.layers
    .map((layer) => ({
      label: layer.label,
      vectorCategories: layer.vectorCategories?.length
        ? layer.vectorCategories
        : undefined,
      gradientCss: layer.rasterColorScheme
        ? gradientCssFor(layer.rasterColorScheme)
        : null,
    }))
    .filter((layer) => layer.vectorCategories || layer.gradientCss),
);
</script>

<template>
  <div
    v-if="visibleLayers.length"
    class="absolute bottom-3 left-3 z-30 flex max-w-[8rem] flex-col gap-2.5 rounded-md bg-white/95 p-2.5 shadow-md backdrop-blur"
  >
    <div
      v-for="(layer, i) in visibleLayers"
      :key="i"
      :class="{ 'border-t border-slate-200 pt-2.5': i > 0 }"
    >
      <div
        v-if="layer.label"
        class="mb-1.5 text-[10px] font-bold  tracking-widest text-slate-500"
      >
        {{ layer.label }}
      </div>

      <ul v-if="layer.vectorCategories" class="flex flex-col gap-1.5">
        <li
          v-for="category in layer.vectorCategories"
          :key="category.value"
          class="flex items-center gap-1.5 text-[11px] leading-tight text-slate-600"
        >
          <v-icon
            :icon="category.icon"
            size="14"
            :style="category.color ? { color: category.color } : undefined"
          />
          {{ category.label }}
        </li>
      </ul>

      <template v-else-if="layer.gradientCss">
        <div
          class="h-2.5 w-full rounded-full"
          :style="{ backgroundImage: layer.gradientCss }"
        />
        <div
          class="mt-1 flex justify-between text-[0.38rem] font-bold uppercase tracking-widest text-slate-500"
        >
          <span>Low</span>
          <span>High</span>
        </div>
      </template>
    </div>
  </div>
</template>
