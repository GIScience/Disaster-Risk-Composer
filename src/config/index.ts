import type { StyleSpecification } from "maplibre-gl";
import { COLORFUL_STYLE } from "@/config/basemaps";

/**
 * Helper function to safely parse environment variables as integers.
 */
export const parseIntEnv = (
  value: string | undefined,
  defaultValue: number,
): number =>
  value !== undefined && !isNaN(parseInt(value, 10))
    ? parseInt(value, 10)
    : defaultValue;

/**
 * The maximum zoom level for the map.
 */

export const MAX_ZOOM_LEVEL: number = parseIntEnv(undefined, 21);

export const MAP_STYLES: Record<string, string | StyleSpecification> = {
  OSM: COLORFUL_STYLE,
};

export const DataSourcesURL =
  "https://hot.storage.heigit.org/heigit-hdx-public/risk_assessment_inputs/sources.json";
