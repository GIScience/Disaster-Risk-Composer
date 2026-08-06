<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type maplibregl from "maplibre-gl";
import type {
  CircleLayerSpecification,
  GeoJSONSourceSpecification,
  SymbolLayerSpecification,
  VectorSourceSpecification,
} from "maplibre-gl";
import { renderMdiIconImage } from "@/utils/geo/mdi-icon-image";
import type { VectorCategoryStyle } from "@/types/story-map";

const props = withDefaults(
  defineProps<{
    map: maplibregl.Map | null;
    sourceUrl: string;
    layerId?: string;
    categoryProperty: string;
    categories: VectorCategoryStyle[];
    sourceLayer?: string;
    iconSize?: number;
    belowLayerId?: string;
    cluster?: boolean;
  }>(),
  {
    layerId: "vector-layer",
    iconSize: 0.85,
    cluster: true,
  },
);

const isPmtiles = computed(() => /\.pmtiles($|\?)/i.test(props.sourceUrl));
const clusteringEnabled = computed(() => props.cluster && !isPmtiles.value);

const sourceId = computed(() => `${props.layerId}-source`);
const clusterLayerId = computed(() => `${props.layerId}-clusters`);
const clusterCountLayerId = computed(() => `${props.layerId}-cluster-count`);

const imageIdFor = (value: string) => `${props.layerId}-icon-${value}`;

const resolvedSourceUrl = computed(() => {
  const url = props.sourceUrl;
  if (!url || /^([a-z][a-z0-9+.-]*:)?\/\//i.test(url)) return url;
  return `${import.meta.env.BASE_URL}${url.replace(/^\//, "")}`;
});

const sourceSpec = computed<
  GeoJSONSourceSpecification | VectorSourceSpecification | null
>(() => {
  if (!resolvedSourceUrl.value) return null;

  if (isPmtiles.value) {
    const url = resolvedSourceUrl.value.startsWith("pmtiles://")
      ? resolvedSourceUrl.value
      : `pmtiles://${resolvedSourceUrl.value}`;
    return { type: "vector", url };
  }

  return {
    type: "geojson",
    data: resolvedSourceUrl.value,
    ...(clusteringEnabled.value
      ? { cluster: true, clusterMaxZoom: 14, clusterRadius: 50 }
      : {}),
  };
});


const registeredVersion = ref(0);

watch(
  [() => props.map, () => props.categories],
  async ([map, categories]) => {
    if (!map || !categories?.length) return;

    await Promise.all(
      categories.map(async (category) => {
        const id = imageIdFor(category.value);
        if (map.hasImage(id)) return;

        const image = await renderMdiIconImage(category.icon, {
          color: category.color,
        });
        if (image && !map.hasImage(id)) {
          map.addImage(id, image);
        }
      }),
    );

    registeredVersion.value += 1;
  },
  { immediate: true },
);

const iconImagesReady = computed(() => {
  void registeredVersion.value;
  const map = props.map;
  if (!map || !props.categories?.length) return false;
  return props.categories.every((category) =>
    map.hasImage(imageIdFor(category.value)),
  );
});

const iconImageExpression = computed(() => {
  if (!props.categories?.length) return null;

  const fallback = imageIdFor(props.categories[0].value);
  const expression: unknown[] = ["match", ["get", props.categoryProperty]];
  for (const category of props.categories) {
    expression.push(category.value, imageIdFor(category.value));
  }
  expression.push(fallback);
  return expression;
});

const pointLayerSpec = computed<SymbolLayerSpecification | null>(() => {
  if (!sourceSpec.value || !iconImageExpression.value) return null;

  return {
    id: props.layerId,
    type: "symbol",
    source: sourceId.value,
    ...(isPmtiles.value && props.sourceLayer
      ? { "source-layer": props.sourceLayer }
      : {}),
    ...(clusteringEnabled.value
      ? { filter: ["!", ["has", "point_count"]] }
      : {}),
    layout: {
      "icon-image": iconImageExpression.value as never,
      "icon-size": props.iconSize,
      "icon-allow-overlap": true,
      "icon-anchor": "bottom",
    },
  } as SymbolLayerSpecification;
});

const clusterCircleLayerSpec = computed<CircleLayerSpecification | null>(() => {
  if (!clusteringEnabled.value || !sourceSpec.value) return null;

  return {
    id: clusterLayerId.value,
    type: "circle",
    source: sourceId.value,
    filter: ["has", "point_count"],
    paint: {
      "circle-color": [
        "step",
        ["get", "point_count"],
        "#ffd156",
        100,
        "#f6a44d",
        750,
        "#e86b3e",
      ],
      "circle-radius": ["step", ["get", "point_count"], 16, 100, 20, 750, 26],
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
    },
  };
});

const clusterCountLayerSpec = computed<SymbolLayerSpecification | null>(() => {
  if (!clusteringEnabled.value || !sourceSpec.value) return null;

  return {
    id: clusterCountLayerId.value,
    type: "symbol",
    source: sourceId.value,
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-font": ["Inter Bold", "Arial Unicode MS Bold"],
      "text-size": 12,
    },
    paint: {
      "text-color": "#ffffff",
    },
  };
});

const layerSpecs = computed<
  (SymbolLayerSpecification | CircleLayerSpecification)[]
>(() =>
  [
    clusterCircleLayerSpec.value,
    clusterCountLayerSpec.value,
    pointLayerSpec.value,
  ].filter(
    (layer): layer is SymbolLayerSpecification | CircleLayerSpecification =>
      layer !== null,
  ),
);

watch(
  [() => props.map, sourceSpec, layerSpecs, iconImagesReady],
  (_values, _prev, onCleanup) => {
    const map = props.map;
    const source = sourceSpec.value;
    const layers = layerSpecs.value;
    const sId = sourceId.value;

    if (!map || !source || !layers.length || !iconImagesReady.value) return;

    const addAll = () => {
      if (!map.isStyleLoaded()) return;
      if (!map.getSource(sId)) map.addSource(sId, source);
      const beforeId = props.belowLayerId;
      for (const layer of layers) {
        if (!map.getLayer(layer.id)) map.addLayer(layer, beforeId);
      }
    };

    const setPointerCursor = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const resetCursor = () => {
      map.getCanvas().style.cursor = "";
    };

    const handleClusterClick = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [clusterLayerId.value],
      });
      const clusterId = features[0]?.properties?.cluster_id;
      const geojsonSource = map.getSource(sId) as
        | maplibregl.GeoJSONSource
        | undefined;
      if (clusterId === undefined || !geojsonSource?.getClusterExpansionZoom)
        return;

      geojsonSource
        .getClusterExpansionZoom(clusterId)
        .then((zoom) => {
          const coordinates = (features[0].geometry as GeoJSON.Point)
            .coordinates as [number, number];
          map.easeTo({ center: coordinates, zoom });
        })
        .catch(() => {});
    };

    if (map.isStyleLoaded()) {
      addAll();
    } else {
      map.once("load", addAll);
    }

    if (clusteringEnabled.value) {
      map.on("click", clusterLayerId.value, handleClusterClick);
      map.on("mouseenter", clusterLayerId.value, setPointerCursor);
      map.on("mouseleave", clusterLayerId.value, resetCursor);
    }

    onCleanup(() => {
      map.off("load", addAll);
      map.off("click", clusterLayerId.value, handleClusterClick);
      map.off("mouseenter", clusterLayerId.value, setPointerCursor);
      map.off("mouseleave", clusterLayerId.value, resetCursor);

      if (!map.isStyleLoaded()) return;
      for (const layer of layers) {
        if (map.getLayer(layer.id)) map.removeLayer(layer.id);
      }
      if (map.getSource(sId)) map.removeSource(sId);
    });
  },
  { immediate: true },
);
</script>

<template />
