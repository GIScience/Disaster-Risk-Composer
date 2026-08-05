<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import Map from "@/components/map/map.vue";
import COGLayer from "@/components/map/COGLayer.vue";
import { cn } from "@/utils/cn";
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

function handleMapLoad() {
  isLoaded.value = true;
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
      class="relative overflow-hidden h-[clamp(320px,55vh,600px)] rounded-md border border-slate-200 bg-slate-100 shadow-sm transition-all duration-700 ease-out"
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
      <Map
        v-if="isVisible"
        :map-style="mapStyle"
        :center="center"
        :zoom="zoom"
        @load="handleMapLoad"
      >
        <template #default="{ map }">
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
