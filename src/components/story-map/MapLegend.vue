<script setup lang="ts">
import { computed } from "vue";
import { colorScale } from "@geomatico/maplibre-cog-protocol";
import type { VectorCategoryStyle } from "@/types/story-map";

export interface MapLegendLayer {
  label?: string;
  sublabel?: string;
  rasterColorScheme?: string;
  rasterMin?: number;
  rasterMax?: number;
  /** Single-value zone raster: one solid swatch (colour of `value` on the ramp) with a label. */
  swatch?: { value: number; label: string };
  /** Stacked map: one swatch per layer, the active one highlighted. */
  stack?: {
    label: string;
    colorScheme?: string;
    min: number;
    max: number;
    value: number;
    active: boolean;
  }[];
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

// Same colour the map gives the zone value (same scheme and range as the COG layer)
function swatchCssFor(layer: MapLegendLayer) {
  if (!layer.rasterColorScheme || !layer.swatch) return null;
  try {
    const [r, g, b] = colorScale({
      colorScheme: layer.rasterColorScheme,
      min: layer.rasterMin ?? 0,
      max: layer.rasterMax ?? 1,
      isContinuous: true,
    })(layer.swatch.value);
    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return null;
  }
}

const visibleLayers = computed(() =>
  props.layers
    .map((layer) => ({
      label: layer.label,
      sublabel: layer.sublabel,
      vectorCategories: layer.vectorCategories?.length
        ? layer.vectorCategories
        : undefined,
      swatch: layer.swatch ? { label: layer.swatch.label, css: swatchCssFor(layer) } : null,
      stack: layer.stack?.map((s) => ({
        label: s.label,
        active: s.active,
        css: swatchCssFor({
          rasterColorScheme: s.colorScheme,
          rasterMin: s.min,
          rasterMax: s.max,
          swatch: { value: s.value, label: s.label },
        }),
      })),
      gradientCss: layer.rasterColorScheme
        ? gradientCssFor(layer.rasterColorScheme)
        : null,
    }))
    .filter(
      (layer) => layer.vectorCategories || layer.stack?.length || layer.swatch?.css || layer.gradientCss,
    ),
);
</script>

<template>
  <div
    v-if="visibleLayers.length"
    :class="visibleLayers.some((l) => l.stack?.length) ? 'w-52' : 'max-w-[9rem]'"
    class="absolute right-14 top-3 z-30 flex flex-col gap-2.5 rounded-lg border border-gray-200 bg-white/95 p-2.5 shadow-sm backdrop-blur"
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
        <div v-if="layer.sublabel" class="mt-0.5 text-[10px] font-normal tracking-normal text-slate-400">
          {{ layer.sublabel }}
        </div>
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

      <ul v-else-if="layer.stack?.length" class="flex flex-col gap-1.5">
        <li
          v-for="s in layer.stack"
          :key="s.label"
          class="flex items-center gap-1.5 text-[11px] leading-tight transition-opacity"
          :class="s.active ? 'font-bold text-slate-800' : 'text-slate-500'"
        >
          <span class="h-3 w-3 flex-none rounded-sm" :style="{ backgroundColor: s.css ?? undefined }" />
          {{ s.label }}
        </li>
      </ul>

      <div
        v-else-if="layer.swatch?.css"
        class="flex items-center gap-1.5 text-[11px] leading-tight text-slate-600"
      >
        <span class="h-3 w-3 flex-none rounded-sm" :style="{ backgroundColor: layer.swatch.css }" />
        {{ layer.swatch.label }}
      </div>

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
