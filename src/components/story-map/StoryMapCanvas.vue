<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type maplibregl from "maplibre-gl";
import { getCogMetadata } from "@geomatico/maplibre-cog-protocol";
import Map from "@/components/map/map.vue";
import COGLayer from "@/components/map/COGLayer.vue";
import VectorLayer from "@/components/map/VectorLayer.vue";
import ChoroplethLayer from "@/components/map/ChoroplethLayer.vue";
import MapLegend from "@/components/story-map/MapLegend.vue";
import type { MapLegendLayer } from "@/components/story-map/MapLegend.vue";
import { cn } from "@/utils/cn";
import { useStoryText } from "@/composables/useStoryText";
import type { ChoroplethStop, StackLayer, VectorCategoryStyle } from "@/types/story-map";
import { COLORFUL_STYLE } from "@/config/basemaps";
const props = withDefaults(
  defineProps<{
    center?: [number, number];
    zoom?: number;
    height?: string;
    caption?: string;
    mapStyle?: string | maplibregl.StyleSpecification;
    layerId?: string;
    interactive?: boolean;
    rasterUrl?: string;
    rasterColorScheme?: string;
    rasterMin?: number;
    rasterMax?: number;
    rasterSwatch?: { value: number; label?: string };
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
    baseRasterMin?: number;
    baseRasterMax?: number;
    baseRasterSwatch?: { value: number; label?: string };
    stackLayers?: StackLayer[];
    stackLegend?: { title: string; subtitle?: string };
    /** Raster layers to load in the background once the map is ready, so switching to them is fast. */
    preloadUrls?: string[];
    layerLabel?: string;
    baseLayerLabel?: string;
  }>(),
  {
    center: () => [20, 10],
    zoom: 1.8,
    height: "440px",
    mapStyle: () => COLORFUL_STYLE,
    interactive: true,
    layerId: "story-map-raster",
    mode: "rgb",
    showOpacityControl: false,
  },
);

const { t } = useStoryText();
const el = ref<HTMLElement | null>(null);
const isVisible = ref(false);
// The map is created when it comes into view, or shortly after the page has loaded (to preload).
const shouldMount = ref(false);
const isLoaded = ref(false);
const layerOpacity = ref(1);

let intersectionObserver: IntersectionObserver | null = null;

// Stacked map: the selected layer is drawn in the darkest shade, the others in mid shades of the
// same ramp (lighter for earlier options). The shades stay dark enough to stand out on the light
// basemap, so the reader sees how the layers relate.
const STACK_ACTIVE_SHADE = 1;
const STACK_INACTIVE_OPACITY = 0.9;
function stackRampMax(l: StackLayer, i: number) {
  const shade = l.active ? STACK_ACTIVE_SHADE : 0.4 + 0.15 * i;
  return (l.legendSwatch?.value ?? 1) / shade;
}

const legendLayers = computed<MapLegendLayer[]>(() => [
  ...(props.stackLayers?.length
    ? [
        {
          label: props.stackLegend?.title,
          sublabel: props.stackLegend?.subtitle,
          stack: props.stackLayers.map((l, i) => ({
            label: l.label,
            colorScheme: l.colorScheme,
            min: 0,
            max: stackRampMax(l, i),
            value: l.legendSwatch?.value ?? 1,
            active: l.active,
          })),
        },
      ]
    : []),
  ...(props.baseRasterUrl && props.baseMode === "ramp"
    ? [
        {
          label: props.baseLayerLabel,
          rasterColorScheme: props.baseRasterColorScheme,
          rasterMin: props.baseRasterMin,
          rasterMax: props.baseRasterMax,
          swatch: props.baseRasterSwatch,
        },
      ]
    : []),
  ...(props.vectorUrl
    ? [{ label: props.layerLabel, vectorCategories: props.vectorCategories }]
    : props.rasterUrl && props.mode === "ramp"
      ? [
          {
            label: props.layerLabel,
            rasterColorScheme: props.rasterColorScheme,
            rasterMin: props.rasterMin,
            rasterMax: props.rasterMax,
            swatch: props.rasterSwatch,
          },
        ]
      : []),
]);


const baseLayerAnchorId = "story-map-base-layer-anchor";

// Background preloading: the COG library keeps the raw data of every tile it read for an hour
// (per file and tile, whatever the colours). Switching back to a layer seen before is therefore
// fast; the first time it has to fetch all tiles of the view. So once the map shows its first
// layer, it draws each other layer of the step once, invisibly and one after another, at the same
// view, then removes it again. This is repeated whenever the reader zooms or pans, so a layer
// they switch to later finds its tiles for the current view in the cache.
const PRELOAD_PREFIX = "story-map-preload";
// Wait this long after the map stopped moving, so zooming in several steps preloads only once
const PRELOAD_AFTER_MOVE_MS = 600;
let unmounted = false;
let preloadRun = 0; // a new run (after the view changed) stops the previous one
let preloading: Promise<void> = Promise.resolve();
let moveTimer: ReturnType<typeof setTimeout> | undefined;
let cancelWait: (() => void) | undefined; // ends the wait for the hidden layer being loaded

const shownUrls = () =>
  new Set(
    [props.rasterUrl, props.baseRasterUrl, ...(props.stackLayers ?? []).map((l) => l.sourceUrl)].filter(
      (u): u is string => !!u,
    ),
  );

// Resolves once the map has loaded every tile of the current view
function whenIdle(map: maplibregl.Map) {
  return new Promise<void>((resolve) => {
    if (map.loaded() && map.areTilesLoaded()) resolve();
    else map.once("idle", () => resolve());
  });
}

// Resolves once the visible raster layer has been added (it waits for its file's metadata first)
function whenRasterShown(map: maplibregl.Map) {
  const hasCog = () =>
    Object.entries(map.getStyle().sources).some(
      ([id, src]) => !id.startsWith(PRELOAD_PREFIX) && "url" in src && src.url?.startsWith("cog://"),
    );
  return new Promise<void>((resolve) => {
    if (hasCog()) return resolve();
    const check = () => {
      if (!hasCog()) return;
      map.off("sourcedata", check);
      resolve();
    };
    map.on("sourcedata", check);
  });
}

// Draws every other layer of the step once at the current view, invisibly, one after another
async function preloadView(map: maplibregl.Map, run: number) {
  for (const url of props.preloadUrls ?? []) {
    if (unmounted || run !== preloadRun) return;
    if (shownUrls().has(url)) continue;
    const id = `${PRELOAD_PREFIX}-${run}-${url}`;
    try {
      const meta = await getCogMetadata(url);
      const zooms = meta.images.filter((i) => !i.isMask).map((i) => i.zoom);
      if (unmounted || run !== preloadRun) return;
      map.addSource(id, {
        type: "raster",
        // Any colour ramp: only the tiles' raw data is cached
        url: `cog://${url}#color:BrewerBlues9,0,1,c`,
        tileSize: 256,
        minzoom: Math.max(0, Math.floor(Math.min(...zooms))),
        maxzoom: Math.ceil(Math.max(...zooms)),
      });
      // Opacity 0 (not visibility "none"): the map still loads the tiles, but nothing is seen
      map.addLayer(
        { id, type: "raster", source: id, paint: { "raster-opacity": 0, "raster-fade-duration": 0 } },
        map.getStyle().layers[1]?.id,
      );
      // Wait until its tiles are loaded, or until the run is stopped
      await Promise.race([whenIdle(map), new Promise<void>((r) => (cancelWait = r))]);
    } catch {
      // A layer that fails here simply loads when it's selected
    } finally {
      if (!unmounted && map.getLayer(id)) map.removeLayer(id);
      if (!unmounted && map.getSource(id)) map.removeSource(id);
    }
  }
}

// Starts a new run for the current view once the previous one has stopped
function schedulePreload(map: maplibregl.Map) {
  const run = ++preloadRun;
  preloading = preloading.then(async () => {
    if (run !== preloadRun) return;
    await whenIdle(map);
    await preloadView(map, run);
  });
}

async function startPreloading(map: maplibregl.Map) {
  // Let the visible layer and the initial fit to its extent come first
  await whenRasterShown(map);
  await whenIdle(map);
  await new Promise((r) => setTimeout(r, 300));
  if (unmounted) return;
  schedulePreload(map);
  // After zooming or panning, and when the reader switches layers (the selected layer loads
  // first), stop the current run right away and start a new one after a short pause
  const restart = () => {
    clearTimeout(moveTimer);
    preloadRun++;
    cancelWait?.(); // removes the hidden layer now, so its tiles stop competing
    moveTimer = setTimeout(() => !unmounted && schedulePreload(map), PRELOAD_AFTER_MOVE_MS);
  };
  map.on("moveend", restart);
  watch(() => [...shownUrls()].join(" "), restart);
}

function handleMapLoad(map: maplibregl.Map) {
  isLoaded.value = true;
  if (props.preloadUrls?.length) startPreloading(map);
  if (!map.getLayer(baseLayerAnchorId)) {
    map.addLayer({
      id: baseLayerAnchorId,
      type: "background",
      paint: { "background-opacity": 0 },
    });
  }
}

onMounted(() => {
  // Create maps with layers to preload soon after the page has loaded, even if further down
  if (props.preloadUrls?.length) {
    const start = () => (shouldMount.value = true);
    if ("requestIdleCallback" in window) requestIdleCallback(start, { timeout: 2000 });
    else setTimeout(start, 1000);
  }

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
  unmounted = true;
  clearTimeout(moveTimer);
  intersectionObserver?.disconnect();
});
</script>

<template>
  <figure ref="el" data-no-reveal class="h-full">
    <div
      class="relative overflow-hidden h-[700px] max-h-full lg:h-full rounded-r-md shadow-sm transition-all duration-700 ease-out"
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
          {{ t("map.opacity") }}:
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
        v-if="isVisible || shouldMount"
        :map-style="mapStyle"
        :center="center"
        :zoom="zoom"
        basemap-placement="corner"
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
            v-for="(l, i) in stackLayers ?? []"
            :key="`stack-${i}`"
            :map="map"
            :source-url="l.sourceUrl!"
            :layer-id="`${l.layerId}-stack-${i}`"
            :color-scheme="l.colorScheme"
            :opacity="layerOpacity * (l.active ? 1 : STACK_INACTIVE_OPACITY)"
            :min="0"
            :max="stackRampMax(l, i)"
            continuous
            mode="ramp"
            :below-layer-id="baseLayerAnchorId"
          />
          <COGLayer
            v-if="baseRasterUrl"
            :map="map"
            :source-url="baseRasterUrl"
            :layer-id="baseLayerId"
            :color-scheme="baseRasterColorScheme"
            :opacity="layerOpacity"
            :min="baseRasterMin"
            :max="baseRasterMax"
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
