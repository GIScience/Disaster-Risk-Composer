import type { StyleSpecification } from "maplibre-gl";
import { colorful, graybeard } from "@versatiles/style";

/**
 * Self-approved basemaps, matching those used by HeiGIT's Climate Action
 * Navigator (climate-action.heigit.org): VersaTiles-hosted OSM vector
 * styles (tiles, glyphs and sprites all served from tiles.versatiles.org)
 * plus Esri World Imagery satellite tiles.
 */
const VERSATILES_BASE_URL = "https://tiles.versatiles.org";

// The stock styles fade country borders in from zoom 2-3 (line-width 0
// below that). Keep borders on at every zoom. Country name labels are
// handled by our own layer instead (see RiskMap.vue) - the basemap's own
// label points simply don't exist in the vector tiles below zoom ~2 (a
// data limitation of the tileset, not a style setting), so its label
// layers are turned off entirely rather than left half-working.
function alwaysShowCountryBoundaries(
  style: StyleSpecification,
): StyleSpecification {
  const BORDER_LAYER_IDS = new Set([
    "boundary-country",
    "boundary-country:outline",
    "boundary-country-disputed",
    "boundary-country-disputed:outline",
  ]);
  const LABEL_LAYER_IDS = new Set([
    "label-boundary-country-small",
    "label-boundary-country-medium",
    "label-boundary-country-large",
  ]);

  style.layers = style.layers.map((layer) => {
    if (BORDER_LAYER_IDS.has(layer.id) && "paint" in layer && layer.paint) {
      const paint = { ...layer.paint } as Record<string, unknown>;
      const width = paint["line-width"];
      if (
        width &&
        typeof width === "object" &&
        "stops" in width &&
        Array.isArray((width as { stops: unknown }).stops)
      ) {
        const stops = (width as { stops: [number, number][] }).stops;
        // Raise the zoom-0 width off zero, keep the rest of the curve as-is.
        const firstNonZero =
          stops.find(([, w]) => w > 0)?.[1] ?? stops[stops.length - 1][1];
        paint["line-width"] = {
          stops: [[0, firstNonZero], ...stops.filter(([z]) => z > 0)],
        };
      }
      return { ...layer, paint };
    }
    if (LABEL_LAYER_IDS.has(layer.id)) {
      return { ...layer, layout: { ...layer.layout, visibility: "none" } };
    }
    return layer;
  });

  return style;
}

export const COLORFUL_STYLE = alwaysShowCountryBoundaries(
  colorful({ baseUrl: VERSATILES_BASE_URL }) as StyleSpecification,
);

export const GRAYBEARD_STYLE = alwaysShowCountryBoundaries(
  graybeard({ baseUrl: VERSATILES_BASE_URL }) as StyleSpecification,
);

export const ESRI_WORLD_IMAGERY_STYLE: StyleSpecification = {
  version: 8,
  // No vector data of its own, but our custom world-country-labels layer
  // (RiskMap.vue) needs somewhere to resolve its font glyphs from.
  glyphs: `${VERSATILES_BASE_URL}/assets/glyphs/{fontstack}/{range}.pbf`,
  sources: {
    "raster-tiles": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution:
        "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "satellite-layer",
      type: "raster",
      source: "raster-tiles",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};
