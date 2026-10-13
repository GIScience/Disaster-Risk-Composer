import { computed, ref, watch } from "vue";
import type { ComputedRef } from "vue";
import type maplibregl from "maplibre-gl";
import type {
  RasterLayerSpecification,
  RasterSourceSpecification,
} from "maplibre-gl";
import { useDynamicMapLayer } from "@/composables/use-map-layer";

type Bounds = [number, number, number, number];

export interface UseRasterMapLayerOptions {
  map: () => maplibregl.Map | null;
  layerId: () => string;
  opacity: () => number;
  sourceSpec: ComputedRef<RasterSourceSpecification | null>;
  bounds?: () => Bounds | null;
  belowLayerId?: () => string | undefined;
}

/**
 * Shared plumbing for raster layers: derives the source id, builds the raster
 * layer spec from opacity, fits the map to bounds when they appear, and wires
 * everything through useDynamicMapLayer. Each caller supplies its own
 * sourceSpec (COG url, TMS tiles, etc).
 */
export function useRasterMapLayer(options: UseRasterMapLayerOptions) {
  const sourceId = computed(() => `${options.layerId()}-source`);

  const layerSpec = computed<RasterLayerSpecification | null>(() => {
    if (!options.sourceSpec.value) return null;
    return {
      id: options.layerId(),
      type: "raster",
      source: sourceId.value,
      paint: {
        "raster-opacity": options.opacity(),
        // Show tiles as soon as they're ready instead of fading them in over 300 ms
        "raster-fade-duration": 0,
      },
    };
  });

  if (options.bounds) {
    const boundsGetter = options.bounds;
    // Fit the map to the bounds when they first appear. We only want to do this
    const hasFitBounds = ref(false);
    watch(
      [boundsGetter, options.map],
      ([bounds, map]) => {
        if (!bounds || !map || hasFitBounds.value) return;
        hasFitBounds.value = true;
        map.fitBounds(bounds, { padding: 40 });
      },
      { immediate: true },
    );
  }

  useDynamicMapLayer(
    options.map,
    sourceId,
    options.layerId,
    options.sourceSpec,
    layerSpec,
    [],
    true,
    () => {
      const below = options.belowLayerId?.();
      return below ? [below] : [];
    },
  );

  return { sourceId, layerSpec };
}
