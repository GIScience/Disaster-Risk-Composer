import { addLayers, addSources } from "@/utils/geo/map-utils";
import type { LayerSpecification, Map, SourceSpecification } from "maplibre-gl";
import { toValue, watch, type MaybeRefOrGetter } from "vue";

export const useMapLayers = (
  layersSpec: MaybeRefOrGetter<LayerSpecification[]>,
  sourcesSpec: MaybeRefOrGetter<{ id: string; spec: SourceSpecification }[]>,
  map: MaybeRefOrGetter<Map | null>,
) => {
  const addSourcesAndLayers = () => {
    const mapInstance = toValue(map);
    if (!mapInstance) return;
    try {
      addSources(mapInstance, toValue(sourcesSpec));
      addLayers(mapInstance, toValue(layersSpec));
    } catch {
      // Style isn't done parsing yet; retry once it is.
      mapInstance.once("styledata", addSourcesAndLayers);
    }
  };

  watch(
    () => [toValue(map), toValue(sourcesSpec), toValue(layersSpec)],
    (_, __, onCleanup) => {
      const mapInstance = toValue(map);
      if (!mapInstance) return;

      addSourcesAndLayers();

      onCleanup(() => {
        mapInstance.off("styledata", addSourcesAndLayers);
      });
    },
    { immediate: true },
  );
};

//  Manages a single dynamic map layer.
export const useDynamicMapLayer = (
  map: MaybeRefOrGetter<Map | null>,
  sourceId: MaybeRefOrGetter<string>,
  layerId: MaybeRefOrGetter<string>,
  sourceSpec: MaybeRefOrGetter<SourceSpecification | null>,
  layerSpec: MaybeRefOrGetter<LayerSpecification | null>,
  dependencies: MaybeRefOrGetter<unknown[]> = [],
  enabled: MaybeRefOrGetter<boolean> = true,
  belowLayerIds: MaybeRefOrGetter<string[]> = [],
) => {
  watch(
    () => [
      toValue(map),
      toValue(sourceId),
      toValue(layerId),
      toValue(sourceSpec),
      toValue(layerSpec),
      toValue(enabled),
      ...toValue(dependencies),
      ...toValue(belowLayerIds),
    ],
    (_, __, onCleanup) => {
      const mapInstance = toValue(map);
      const source = toValue(sourceSpec);
      const layer = toValue(layerSpec);
      const sId = toValue(sourceId);
      const lId = toValue(layerId);

      if (!mapInstance || !source || !layer || !toValue(enabled)) return;

      const addLayer = () => {
        try {
          const existingLayer = mapInstance.getLayer(lId);
          if (!existingLayer && !mapInstance.getSource(sId)) {
            mapInstance.addSource(sId, source);
          }

          if (!existingLayer) {
            const beforeId = toValue(belowLayerIds).find((id) =>
              mapInstance.getLayer(id),
            );

            mapInstance.addLayer(layer, beforeId);
          }
        } catch {
          // Style isn't done parsing yet; retry once it is.
          mapInstance.once("styledata", addLayer);
        }
      };

      addLayer();

      onCleanup(() => {
        mapInstance.off("styledata", addLayer);

        try {
          if (mapInstance.getLayer(lId)) {
            mapInstance.removeLayer(lId);
          }

          if (mapInstance.getSource(sId)) {
            mapInstance.removeSource(sId);
          }
        } catch {
          // Style already torn down.
        }
      });
    },
    { immediate: true },
  );
};
