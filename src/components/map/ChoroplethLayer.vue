<script setup lang="ts">
import { computed, ref, watch } from "vue";
import maplibregl from "maplibre-gl";
import type {
  FillLayerSpecification,
  LineLayerSpecification,
  VectorSourceSpecification,
} from "maplibre-gl";
import type { ChoroplethStop } from "@/types/story-map";

const props = withDefaults(
  defineProps<{
    map: maplibregl.Map | null;
    sourceUrl: string;
    sourceLayer: string;
    pcodeField: string;
    valuesUrl: string;
    stops: ChoroplethStop[];
    layerId?: string;
    unit?: string;
    fallbackColor?: string;
    belowLayerId?: string;
  }>(),
  {
    layerId: "choropleth-layer",
    fallbackColor: "#e2e8f0",
  },
);

const sourceId = computed(() => `${props.layerId}-source`);
const outlineLayerId = computed(() => `${props.layerId}-outline`);
const hoverLayerId = computed(() => `${props.layerId}-hover`);

const resolvedSourceUrl = computed(() => {
  const url = props.sourceUrl;
  if (!url) return url;
  return url.startsWith("pmtiles://") ? url : `pmtiles://${url}`;
});

const resolvedValuesUrl = computed(() => {
  const url = props.valuesUrl;
  if (!url || /^([a-z][a-z0-9+.-]*:)?\/\//i.test(url)) return url;
  return `${import.meta.env.BASE_URL}${url.replace(/^\//, "")}`;
});

const sourceSpec = computed<VectorSourceSpecification | null>(() =>
  resolvedSourceUrl.value
    ? {
        type: "vector",
        url: resolvedSourceUrl.value,
        promoteId: props.pcodeField,
      }
    : null,
);

const valuesByPcode = ref<Map<string, number>>(new Map());

watch(
  resolvedValuesUrl,
  async (url) => {
    valuesByPcode.value = new Map();
    if (!url) return;
    try {
      const resp = await fetch(url);
      const rows: { pcode: string; value: number }[] = await resp.json();
      valuesByPcode.value = new Map(rows.map((r) => [r.pcode, r.value]));
    } catch (err) {
      console.error("Failed to load choropleth values", err);
    }
  },
  { immediate: true },
);

function colorForValue(value: number): string {
  for (const stop of props.stops) {
    if (value <= stop.max) return stop.color;
  }
  return props.stops[props.stops.length - 1]?.color ?? props.fallbackColor;
}

const fillColorExpression = computed<unknown>(() => {
  const entries = Array.from(valuesByPcode.value.entries());
  if (!entries.length || !props.stops?.length) return props.fallbackColor;

  const expression: unknown[] = ["match", ["get", props.pcodeField]];
  for (const [pcode, value] of entries) {
    expression.push(pcode, colorForValue(value));
  }
  expression.push(props.fallbackColor);
  return expression;
});

const fillLayerSpec = computed<FillLayerSpecification | null>(() => {
  if (!sourceSpec.value) return null;
  return {
    id: props.layerId,
    type: "fill",
    source: sourceId.value,
    "source-layer": props.sourceLayer,
    paint: {
      "fill-color": fillColorExpression.value as never,
      "fill-opacity": 0.75,
    },
  };
});

const outlineLayerSpec = computed<LineLayerSpecification | null>(() => {
  if (!sourceSpec.value) return null;
  return {
    id: outlineLayerId.value,
    type: "line",
    source: sourceId.value,
    "source-layer": props.sourceLayer,
    paint: {
      "line-color": "#94a3b8",
      "line-width": 1,
      "line-opacity": 0.6,
    },
  };
});

const hoverLayerSpec = computed<LineLayerSpecification | null>(() => {
  if (!sourceSpec.value) return null;
  return {
    id: hoverLayerId.value,
    type: "line",
    source: sourceId.value,
    "source-layer": props.sourceLayer,
    paint: {
      "line-color": "#ca2333",
      "line-width": 2,
      "line-opacity": [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        1,
        0,
      ],
    },
  };
});

watch(
  [() => props.map, sourceSpec, fillLayerSpec, outlineLayerSpec, hoverLayerSpec],
  (_values, _prev, onCleanup) => {
    const map = props.map;
    const source = sourceSpec.value;
    const fillLayer = fillLayerSpec.value;
    const outlineLayer = outlineLayerSpec.value;
    const hoverLayer = hoverLayerSpec.value;
    const sId = sourceId.value;

    if (!map || !source || !fillLayer || !outlineLayer || !hoverLayer) return;

    const addAll = () => {
      try {
        if (!map.getSource(sId)) map.addSource(sId, source);
        if (!map.getLayer(fillLayer.id))
          map.addLayer(fillLayer, props.belowLayerId);
        if (!map.getLayer(outlineLayer.id))
          map.addLayer(outlineLayer, props.belowLayerId);
        if (!map.getLayer(hoverLayer.id))
          map.addLayer(hoverLayer, props.belowLayerId);
        if (map.getLayer(fillLayer.id)) {
          map.setPaintProperty(
            fillLayer.id,
            "fill-color",
            fillColorExpression.value as never,
          );
        }
      } catch {
        // Style isn't done parsing yet; retry once it is.
        map.once("styledata", addAll);
      }
    };

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: "risk-tooltip",
    });

    let hoveredId: string | number | undefined = undefined;

    const clearHover = () => {
      if (hoveredId !== undefined) {
        map.setFeatureState(
          { source: sId, sourceLayer: props.sourceLayer, id: hoveredId },
          { hover: false },
        );
      }
      hoveredId = undefined;
    };

    const setPointerCursor = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const handleMouseMove = (e: maplibregl.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const pcode = feature.properties?.[props.pcodeField];

      if (hoveredId !== pcode) {
        clearHover();
        hoveredId = pcode;
        map.setFeatureState(
          { source: sId, sourceLayer: props.sourceLayer, id: hoveredId },
          { hover: true },
        );
      }

      const value = valuesByPcode.value.get(pcode);
      popup
        .setLngLat(e.lngLat)
        .setHTML(
          `
          <div class="p-3 bg-white text-slate-900 rounded-xl border border-slate-200 shadow-2xl min-w-[120px]">
            <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 border-b border-slate-100 pb-1">${pcode}</div>
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center gap-2">
                <div class="w-2.5 h-2.5 rounded-full ring-2 ring-slate-100" style="background-color: ${
                  value !== undefined
                    ? colorForValue(value)
                    : props.fallbackColor
                }"></div>
                <div class="text-[11px] font-extrabold text-slate-600 uppercase tracking-tight">Count</div>
              </div>
              <div class="text-2xl font-black text-slate-900 tabular-nums">
                ${
                  value !== undefined
                    ? value.toLocaleString("en-US")
                    : "No data"
                }${value !== undefined && props.unit ? ` ${props.unit}` : ""}
              </div>
            </div>
          </div>
       `,
        )
        .addTo(map);
    };
    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = "";
      clearHover();
      popup.remove();
    };

    addAll();

    map.on("mousemove", fillLayer.id, setPointerCursor);
    map.on("mousemove", fillLayer.id, handleMouseMove);
    map.on("mouseleave", fillLayer.id, handleMouseLeave);

    onCleanup(() => {
      map.off("styledata", addAll);
      map.off("mousemove", fillLayer.id, setPointerCursor);
      map.off("mousemove", fillLayer.id, handleMouseMove);
      map.off("mouseleave", fillLayer.id, handleMouseLeave);
      clearHover();
      popup.remove();

      try {
        if (map.getLayer(hoverLayer.id)) map.removeLayer(hoverLayer.id);
        if (map.getLayer(outlineLayer.id)) map.removeLayer(outlineLayer.id);
        if (map.getLayer(fillLayer.id)) map.removeLayer(fillLayer.id);
        if (map.getSource(sId)) map.removeSource(sId);
      } catch {
        // Style already torn down.
      }
    });
  },
  { immediate: true },
);
</script>

<template />

<style>
.risk-tooltip .maplibregl-popup-content {
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
}
</style>
