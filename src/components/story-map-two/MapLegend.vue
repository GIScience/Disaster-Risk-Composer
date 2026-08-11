<script setup lang="ts">
import { computed } from "vue";
import { colorScale } from "@geomatico/maplibre-cog-protocol";
import type { VectorCategoryStyle } from "@/types/story-map";

const props = defineProps<{
  rasterColorScheme?: string;
  vectorCategories?: VectorCategoryStyle[];
}>();

const GRADIENT_STOPS = 8;

const gradientCss = computed(() => {
  if (!props.rasterColorScheme) return null;
  try {
    const scale = colorScale({
      colorScheme: props.rasterColorScheme,
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
});
</script>

<template>
  <div
    v-if="vectorCategories?.length"
    class="absolute bottom-3 left-3 z-30 max-w-[160px] rounded-md bg-white/95 p-2.5 shadow-md backdrop-blur"
  >
    <ul class="flex flex-col gap-1.5">
      <li
        v-for="category in vectorCategories"
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
  </div>

  <div
    v-else-if="gradientCss"
    class="absolute bottom-3 left-3 z-30 w-36 rounded-md bg-white/95 p-2.5 shadow-md backdrop-blur"
  >
    <div
      class="h-2.5 w-full rounded-full"
      :style="{ backgroundImage: gradientCss }"
    />
    <div
      class="mt-1 flex justify-between text-[9px] font-bold uppercase tracking-widest text-slate-500"
    >
      <span>Low</span>
      <span>High</span>
    </div>
  </div>
</template>
