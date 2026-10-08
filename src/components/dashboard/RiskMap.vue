<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import maplibregl from "maplibre-gl";
import * as pmtiles from "pmtiles";
import { storeToRefs } from "pinia";
import Map from "@/components/map/map.vue";
import RiskLegend from "@/components/dashboard/RiskLegend.vue";
import { COLORFUL_STYLE } from "@/config/basemaps";
import { useRiskMapStore } from "@/store/riskMapStore";
import { cn } from "@/utils/cn";
import type { RiskViewMode } from "@/composables/useRiskLogic";
import { useIsEmbedded } from "@/composables/use-is-embedded";

const riskMapStore = useRiskMapStore();
const { dimensions } = storeToRefs(riskMapStore);
const isEmbedded = useIsEmbedded();

const props = withDefaults(
  defineProps<{
    pmtilesUrl: string;
    pcodeField: string;
    matchArray: [string, string, number][];
    highlightedPcode?: string | null;
    isAnalysisVisible?: boolean;
    availableCountries?: string[];
    isMobile?: boolean;
    riskViewMode?: RiskViewMode;
    legendTitle?: string;
    showZoomControls?: boolean;
  }>(),
  { showZoomControls: true },
);

const emit = defineEmits<{
  (e: "country-click", code: string): void;
  (e: "toggle-analysis"): void;
  (e: "update:riskViewMode", value: RiskViewMode): void;
  (e: "click:info"): void;
}>();

// Matches Map's own default center/zoom (map.vue) - the view shown on first
// load. Only the zoom is overridden on <Map>, for mobile (see below).
const DEFAULT_CENTER: [number, number] = [-40, -20];
const DEFAULT_ZOOM = 2.8;
// At 2.8 the globe is far wider than a phone screen - zoom out so the whole
// globe fits the narrow mobile viewport.
const MOBILE_DEFAULT_ZOOM = 1.1;
const globalViewZoom = props.isMobile ? MOBILE_DEFAULT_ZOOM : DEFAULT_ZOOM;

// Slow auto-spin on the world-overview globe, stopping as soon as the user
// interacts or zooms into a country - matches the Climate Action Navigator.
const SPIN_SECONDS_PER_REVOLUTION = 240;
const MAX_SPIN_ZOOM = 5;
let spinAnimationFrame: number | null = null;
let spinLastTime = 0;

function stopSpinning() {
  if (spinAnimationFrame !== null) {
    cancelAnimationFrame(spinAnimationFrame);
    spinAnimationFrame = null;
  }
}

function startSpinning() {
  const mapInstance = map.value;
  if (!mapInstance || spinAnimationFrame !== null) return;
  spinLastTime = 0;
  const spin = (timestamp: number) => {
    if (!spinLastTime) spinLastTime = timestamp;
    const deltaTime = (timestamp - spinLastTime) / 1000;
    spinLastTime = timestamp;

    if (mapInstance.getZoom() < MAX_SPIN_ZOOM) {
      const center = mapInstance.getCenter();
      center.lng -= (360 / SPIN_SECONDS_PER_REVOLUTION) * deltaTime;
      mapInstance.setCenter(center);
      spinAnimationFrame = requestAnimationFrame(spin);
    } else {
      spinAnimationFrame = null;
    }
  };
  spinAnimationFrame = requestAnimationFrame(spin);
}

// Shared by the exposed resetView() (house button / header logo) and the
// "country deselected" branch of updateLayer() below - eases back to the
// world-overview and resumes spinning once it gets there. Uses easeTo
// rather than flyTo: flyTo's fly-out-and-back arc briefly zooms out much
// further than DEFAULT_ZOOM for a dramatic effect, which on the globe
// shows empty space beyond the tiles that are actually loaded (a grey
// flash) - easeTo interpolates center/zoom directly with no such overshoot.
function resetToGlobalView() {
  stopSpinning();
  const mapInstance = map.value;
  mapInstance?.easeTo({
    center: DEFAULT_CENTER,
    zoom: globalViewZoom,
    duration: 3000,
    essential: true,
  });
  mapInstance?.once("moveend", () => {
    if (!props.pmtilesUrl) startSpinning();
  });
}

const activeDimension = computed(() =>
  dimensions.value.find((d) => d.value === props.riskViewMode),
);
const isViewingCustomData = computed(() => !!activeDimension.value?.isCustom);

const mapViewRef = ref<InstanceType<typeof Map> | null>(null);
const map = computed<maplibregl.Map | null>(
  () => mapViewRef.value?.map ?? null,
);

const floodLayerId = "risk-layer";
const interactLayerId = "world-fills";

// Admin-unit names live in the pmtiles vector tiles as "<LEVEL>_NAME" (e.g. "ADM2_NAME"), for
// OCHA and NUTS countries alike, rather than in the parquet data. The level comes from the file
// name, since the ID column ("ADM2_PCODE" vs "NUTS3_CODE") doesn't carry it for NUTS countries.
const nameField = computed(() => {
  const level = props.pmtilesUrl?.match(/_(ADM\d)\.pmtiles$/)?.[1];
  return level ? `${level}_NAME` : "";
});

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

// Best-effort: pull whatever pcode -> name pairs are in the currently loaded
// tiles and merge them into the shared store, so the statistics panels (which
// only have the parquet data, with no NAME field) can look names up too.
function collectPcodeNames() {
  const mapInstance = map.value;
  if (!mapInstance || !nameField.value || !mapInstance.getSource(floodLayerId))
    return;

  const features = mapInstance.querySourceFeatures(floodLayerId, {
    sourceLayer: "boundary",
  });
  if (!features.length) return;

  const names: Record<string, string> = {};
  for (const feature of features) {
    const pcode = feature.properties?.[props.pcodeField];
    const name = feature.properties?.[nameField.value];
    if (pcode && name) names[pcode] = name;
  }
  if (Object.keys(names).length) riskMapStore.addPcodeNames(names);
}

const layerOpacity = ref(0.7);
// Unfolded by default in the normal dashboard; folded by default when
// embedded in an iframe or on mobile, where screen space is tight.
const isLayersCollapsed = ref(props.isMobile || isEmbedded);

const countryBounds = ref<maplibregl.LngLatBoundsLike | null>(null);
// Tracks which pmtilesUrl we've already fit the view to, so re-adding the risk
// layer after a basemap switch doesn't re-trigger a fitBounds/zoom.
const boundsFittedForUrl = ref<string | null>(null);

// Safeguard against parquet and PMTiles of a country that don't describe the same regions (e.g.
// tiles already rebuilt on NUTS boundaries while the parquet still holds old OCHA P-codes): the
// map would stay empty or silently colour only part of the country. Checked once per country,
// after the map has fitted the country and its tiles have loaded.
const REGION_MATCH_THRESHOLD = 0.9;
const regionMismatch = ref<{ matched: number; data: number; tiles: number } | null>(null);
let regionCheckDoneFor: string | null = null;

function checkRegionMatch() {
  const mapInstance = map.value;
  if (!mapInstance || !props.pmtilesUrl || !props.pcodeField) return;
  if (!props.matchArray.length || regionCheckDoneFor === props.pmtilesUrl) return;
  if (boundsFittedForUrl.value !== props.pmtilesUrl) return; // still flying to the country
  if (!mapInstance.getSource(floodLayerId) || !mapInstance.isSourceLoaded(floodLayerId)) return;

  const features = mapInstance.querySourceFeatures(floodLayerId, { sourceLayer: "boundary" });
  if (!features.length) return;
  regionCheckDoneFor = props.pmtilesUrl;

  const tileIds = new Set<string>();
  const anyIds = new Set<string>(); // in case the tiles use a different ID property entirely
  for (const feature of features) {
    const id = feature.properties?.[props.pcodeField];
    if (id !== undefined && id !== null) tileIds.add(String(id));
    anyIds.add(String(feature.id ?? JSON.stringify(feature.properties)));
  }
  const dataIds = new Set(props.matchArray.map((m) => String(m[0])));
  let matched = 0;
  dataIds.forEach((id) => {
    if (tileIds.has(id)) matched += 1;
  });
  const tiles = tileIds.size || anyIds.size;
  const ok =
    matched >= REGION_MATCH_THRESHOLD * dataIds.size &&
    matched >= REGION_MATCH_THRESHOLD * tiles;
  regionMismatch.value = ok ? null : { matched, data: dataIds.size, tiles };
}

const styleUrl = COLORFUL_STYLE;

const resizeHandler = () => {
  map.value?.resize();
};

onBeforeUnmount(() => {
  window.removeEventListener("resize", resizeHandler);
  stopSpinning();
  if (highlightClearTimer) clearTimeout(highlightClearTimer);
});

// Countries whose full extent includes far-off islands, which would make the initial zoom tiny.
// Fit to the mainland instead; the islands are still on the map, just outside the first view.
const MAINLAND_BOUNDS: Record<string, [[number, number], [number, number]]> = {
  ESP: [[-9.4, 35.2], [4.4, 43.8]], // without the Canary Islands (incl. Balearics, Ceuta, Melilla)
  PRT: [[-9.6, 36.9], [-6.1, 42.2]], // without the Azores and Madeira
};

function fitToCountryBounds(duration = 1200) {
  const mapInstance = map.value;
  if (!mapInstance || !countryBounds.value) return;
  mapInstance.fitBounds(countryBounds.value, { padding: 40, duration });
}

function selectDimension(value: RiskViewMode) {
  emit("update:riskViewMode", value);
  fitToCountryBounds();
}

// Our own world-overview country outlines are off for now - the basemap's own
// always-visible country boundary lines (see alwaysShowCountryBoundaries in
// config/basemaps.ts) may be enough on their own.
const SHOW_WORLD_BOUNDARIES = false;

function setupWorldLayer() {
  const mapInstance = map.value;
  if (!mapInstance) return;

  const isLoaded =
    props.availableCountries && props.availableCountries.length > 0;
  const validCountries = isLoaded ? props.availableCountries : ["NONE"];

  // world.json is simplified for the globe view (all fills/hover only need coarse shapes):
  //   mapshaper world.json -filter-fields iso_a3 -simplify interval=2000 keep-shapes \
  //     -o precision=0.001 format=geojson
  if (!mapInstance.getSource("world")) {
    mapInstance.addSource("world", {
      type: "geojson",
      data: `${import.meta.env.BASE_URL}data/world.json`,
      promoteId: "iso_a3",
    });
  }

  // Unavailable Countries Layer
  if (!mapInstance.getLayer("unavailable-countries")) {
    mapInstance.addLayer({
      id: "unavailable-countries",
      type: "fill",
      source: "world",
      paint: {
        "fill-color": "#cbd5e1", // Slate 300
        "fill-opacity": 0.6,
      },
      filter: isLoaded
        ? ["!", ["in", ["get", "iso_a3"], ["literal", validCountries]]]
        : ["==", "iso_a3", "DOES_NOT_EXIST"],
    });
  }

  if (!mapInstance.getLayer(interactLayerId)) {
    mapInstance.addLayer({
      id: interactLayerId,
      type: "fill",
      source: "world",
      paint: {
        "fill-color": "#ca2333",
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          0.1,
          0,
        ],
      },
      filter: isLoaded
        ? ["in", ["get", "iso_a3"], ["literal", validCountries]]
        : ["==", "iso_a3", "DOES_NOT_EXIST"],
    });
  }

  // Separate, pre-deduplicated line source for the boundary layer below.
  // Each country's own polygon traces its shared borders independently
  // (from separately-sourced per-country ADM data), so drawing lines
  // straight from "world" would stroke every internal border twice, once
  // per neighbouring country. world-boundaries.json instead keeps only one
  // copy of each shared border (see scripts/generate_world_boundaries.py).
  // Only added while the layer is enabled, so its 4 MB file isn't downloaded
  // for a layer that is never shown.
  if (SHOW_WORLD_BOUNDARIES && !mapInstance.getSource("world-lines")) {
    mapInstance.addSource("world-lines", {
      type: "geojson",
      data: `${import.meta.env.BASE_URL}data/world-boundaries.json`,
    });
  }

  // Country outlines for the world-overview map, drawn from our own source
  // so they stay visible on every basemap. Hidden once a country is
  // selected (see updateWorldBoundariesVisibility below) so it doesn't
  // compete with that country's own (more precise) boundary from
  // updateLayer().
  if (SHOW_WORLD_BOUNDARIES && !mapInstance.getLayer("world-boundaries")) {
    mapInstance.addLayer({
      id: "world-boundaries",
      type: "line",
      source: "world-lines",
      paint: {
        "line-color": "#ca2333", // HeiGIT red
        "line-width": 1,
        "line-opacity": 0.6,
      },
    });
  }

  // Country name labels, drawn from our own always-available data instead
  // of the basemap's (now disabled, see alwaysShowCountryBoundaries in
  // config/basemaps.ts): the basemap's label points simply don't exist in
  // its vector tiles below zoom ~2, which isn't fixable via style overrides.
  // Ours has no such tile-pyramid gating, so it's visible at every zoom,
  // and also shows on the satellite basemap, which otherwise has no labels
  // at all.
  if (!mapInstance.getSource("world-labels")) {
    mapInstance.addSource("world-labels", {
      type: "geojson",
      data: `${import.meta.env.BASE_URL}data/world-labels.json`,
    });
  }

  // Tiered by country area so the world-overview isn't cluttered with all
  // 191 names at once: large countries (Russia, Brazil, ...) label from
  // zoom 0, progressively smaller ones join in as you zoom past 2 and 4.
  const LABEL_TIERS: { id: string; filter: maplibregl.FilterSpecification; minzoom: number }[] = [
    { id: "world-country-labels-large", filter: [">=", ["get", "area"], 100], minzoom: 0 },
    { id: "world-country-labels-medium", filter: ["all", [">=", ["get", "area"], 10], ["<", ["get", "area"], 100]], minzoom: 2 },
    { id: "world-country-labels-small", filter: ["<", ["get", "area"], 10], minzoom: 4 },
  ];
  for (const tier of LABEL_TIERS) {
    if (mapInstance.getLayer(tier.id)) continue;
    mapInstance.addLayer({
      id: tier.id,
      type: "symbol",
      source: "world-labels",
      filter: tier.filter,
      minzoom: tier.minzoom,
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["noto_sans_regular"],
        "text-transform": "uppercase",
        "text-size": 11,
        "text-optional": true,
      },
      paint: {
        "text-color": "rgb(51,51,68)",
        "text-halo-color": "rgba(255,255,255,0.8)",
        "text-halo-width": 2,
        "text-halo-blur": 1,
      },
    });
  }

  updateWorldBoundariesVisibility();
}

// Hide the world-overview outlines once a country is selected and showing
// its own boundary (from updateLayer()) - otherwise the two compete.
// No-op while SHOW_WORLD_BOUNDARIES is off, since the layer isn't added then.
function updateWorldBoundariesVisibility() {
  const mapInstance = map.value;
  if (!mapInstance || !mapInstance.getLayer("world-boundaries")) return;
  mapInstance.setLayoutProperty(
    "world-boundaries",
    "visibility",
    props.pmtilesUrl ? "none" : "visible",
  );
}

function handleMapLoad(mapInstance: maplibregl.Map) {
  // Add World Boundaries for Click Interaction
  updateLayer();
  setupWorldLayer();

  mapInstance.on("mousedown", stopSpinning);
  mapInstance.on("touchstart", stopSpinning);
  mapInstance.on("wheel", stopSpinning);
  if (!props.pmtilesUrl) startSpinning();

  // Tiles for the risk layer load incrementally (e.g. as the fit-bounds
  // animation pans/zooms in) - re-collect names every time more of them load.
  mapInstance.on("idle", checkRegionMatch);

  mapInstance.on("sourcedata", (e) => {
    if (
      e.sourceId === floodLayerId &&
      mapInstance.getSource(floodLayerId) &&
      mapInstance.isSourceLoaded(floodLayerId)
    ) {
      collectPcodeNames();
    }
  });

  const popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    className: "risk-tooltip",
  });

  mapInstance.on("mousemove", floodLayerId, (e) => {
    if (!e.features || e.features.length === 0) return;
    mapInstance.getCanvas().style.cursor = "pointer";

    const feature = e.features[0];
    const pcode = feature.properties[props.pcodeField];
    const name = feature.properties[nameField.value];
    const match = props.matchArray.find((m) => m[0] === pcode);

    if (match) {
      popup
        .setLngLat(e.lngLat)
        .setHTML(
          `
          <div class="p-3 bg-white text-slate-900 rounded-xl border border-slate-200 shadow-2xl min-w-[120px]">
            <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 border-b border-slate-100 pb-1">${name ? `${escapeHtml(name)} <span class="normal-case font-medium">(${escapeHtml(String(pcode))})</span>` : escapeHtml(String(pcode))}</div>
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center gap-2">
                <div class="w-2.5 h-2.5 rounded-full ring-2 ring-slate-100" style="background-color: ${match[1]}"></div>
                <div class="text-[11px] font-extrabold text-slate-600 uppercase tracking-tight">Risk Score</div>
              </div>
              <div class="text-2xl font-black text-slate-900 tabular-nums">
                ${Number(match[2]).toFixed(2)}
              </div>
            </div>
          </div>
        `,
        )
        .addTo(mapInstance);
    }
  });

  mapInstance.on("mouseleave", floodLayerId, () => {
    mapInstance.getCanvas().style.cursor = "";
    popup.remove();
  });

  // Country Click & Hover Interaction
  let hoveredCountryId: string | number | null = null;

  mapInstance.on("mousemove", interactLayerId, (e) => {
    if (e.features && e.features.length > 0) {
      if (hoveredCountryId !== null) {
        mapInstance.setFeatureState(
          { source: "world", id: hoveredCountryId },
          { hover: false },
        );
      }
      hoveredCountryId = e.features[0].id || e.features[0].properties.iso_a3;
      mapInstance.setFeatureState(
        { source: "world", id: hoveredCountryId! },
        { hover: true },
      );
      mapInstance.getCanvas().style.cursor = "pointer";
    }
  });

  mapInstance.on("mouseleave", interactLayerId, () => {
    if (hoveredCountryId !== null) {
      mapInstance.setFeatureState(
        { source: "world", id: hoveredCountryId },
        { hover: false },
      );
    }
    hoveredCountryId = null;
    mapInstance.getCanvas().style.cursor = "";
  });

  mapInstance.on("click", interactLayerId, (e) => {
    if (e.features && e.features.length > 0) {
      const isoCode = e.features[0].properties.iso_a3;
      if (isoCode) {
        emit("country-click", isoCode);
      }
    }
  });

  mapInstance.on("style.load", onStyleLoad);
  window.addEventListener("resize", resizeHandler);

  onStyleLoad();
}

const DIM_LAYER_ID = "risk-layer-dim";

async function updateLayer() {
  const mapInstance = map.value;
  if (!mapInstance) return;
  if (!mapInstance.isStyleLoaded()) {
    mapInstance.once("idle", updateLayer);
    return;
  }

  updateWorldBoundariesVisibility();

  if (!props.pmtilesUrl) {
    if (mapInstance.getLayer("risk-layer-highlight"))
      mapInstance.removeLayer("risk-layer-highlight");
    if (mapInstance.getLayer(DIM_LAYER_ID)) mapInstance.removeLayer(DIM_LAYER_ID);
    if (mapInstance.getLayer(floodLayerId))
      mapInstance.removeLayer(floodLayerId);
    if (mapInstance.getSource(floodLayerId))
      mapInstance.removeSource(floodLayerId);

    // Only reset the view on an actual transition to "no country selected" -
    // updateLayer() also re-runs on every basemap switch, which shouldn't
    // re-trigger this flyTo if we were already at the home view.
    if (boundsFittedForUrl.value !== null) {
      countryBounds.value = null;
      boundsFittedForUrl.value = null;
      resetToGlobalView();
    }
    return;
  }

  if (!props.pcodeField) return;

  stopSpinning();

  const currentSource = mapInstance.getSource(floodLayerId);
  const sourceUrl = `pmtiles://${props.pmtilesUrl}`;

  if (!currentSource || (currentSource as any).url !== sourceUrl) {
    if (mapInstance.getLayer("risk-layer-highlight"))
      mapInstance.removeLayer("risk-layer-highlight");
    if (mapInstance.getLayer(DIM_LAYER_ID)) mapInstance.removeLayer(DIM_LAYER_ID);
    if (mapInstance.getLayer(floodLayerId))
      mapInstance.removeLayer(floodLayerId);
    if (mapInstance.getSource(floodLayerId))
      mapInstance.removeSource(floodLayerId);

    mapInstance.addSource(floodLayerId, {
      type: "vector",
      url: sourceUrl,
      promoteId: props.pcodeField,
    });

    mapInstance.addLayer({
      id: floodLayerId,
      type: "fill",
      source: floodLayerId,
      "source-layer": "boundary",
      paint: {
        "fill-color": "#AAAAAA",
        "fill-opacity": Number(layerOpacity.value),
        "fill-outline-color": "#94a3b8", // Grey for subnational boundaries
      },
    });

    // Greys out every other region while one is highlighted from the statistics panel, so the
    // hovered region stands out. Drawn above the risk fill, below the red highlight outline.
    mapInstance.addLayer({
      id: DIM_LAYER_ID,
      type: "fill",
      source: floodLayerId,
      "source-layer": "boundary",
      paint: {
        "fill-color": "#e8ebed", // Slate 500
        "fill-opacity": 0.55,
      },
      layout: { visibility: props.highlightedPcode ? "visible" : "none" },
      filter: ["!=", props.pcodeField, props.highlightedPcode || ""],
    });

    mapInstance.addLayer({
      id: "risk-layer-highlight",
      type: "line",
      source: floodLayerId,
      "source-layer": "boundary",
      paint: {
        "line-color": "#ca2333", // HeiGIT red
        "line-width": 1,
        "line-opacity": 0.9,
      },
      filter: ["==", props.pcodeField, props.highlightedPcode || ""],
    });

    // Fit bounds - only for a genuinely new dataset, not when the layer is
    // simply being re-added after a basemap switch.
    if (boundsFittedForUrl.value !== props.pmtilesUrl) {
      const pmtilesFile = new pmtiles.PMTiles(props.pmtilesUrl);
      try {
        const metadata = (await pmtilesFile.getMetadata()) as any;
        const countryCode = props.pmtilesUrl.match(/\/([A-Z]{3})_ADM\d\.pmtiles$/)?.[1];
        const override = countryCode ? MAINLAND_BOUNDS[countryCode] : undefined;
        if (override) {
          countryBounds.value = override;
          fitToCountryBounds(2000);
        } else if (metadata?.antimeridian_adjusted_bounds) {
          const bounds = (metadata.antimeridian_adjusted_bounds as string)
            .split(",")
            .map(Number);
          if (bounds.length === 4 && bounds.every((v) => !isNaN(v))) {
            const [minLon, minLat, maxLon, maxLat] = bounds;
            countryBounds.value = [
              [minLon, minLat],
              [maxLon, maxLat],
            ];
            fitToCountryBounds(2000);
          }
        }
        boundsFittedForUrl.value = props.pmtilesUrl;
      } catch (err) {
        console.log("Could not read PMTiles bounds");
      }
    }
  }

  // Update paint properties
  // Extract only [pcode, color] pairs for the match expression
  const mapMatches = props.matchArray.flatMap((m) => [m[0], m[1]]);
  let fillColor: any = "#AAAAAA";

  if (mapMatches.length >= 2) {
    fillColor = ["match", ["get", props.pcodeField], ...mapMatches, "#AAAAAA"];
  }

  mapInstance.setPaintProperty(floodLayerId, "fill-color", fillColor);
}

const onStyleLoad = () => {
  const mapInstance = map.value;
  if (!mapInstance) return;

  // Apply distinct colors: Red for National, Grey for Subnational
  const nationalLayers = ["boundary_2", "boundary_disputed"];
  const subnationalLayers = [
    "boundary_3",
    "boundary_4",
    "boundary_5",
    "boundary_6",
  ];

  nationalLayers.forEach((layerId) => {
    if (mapInstance.getLayer(layerId)) {
      mapInstance.setPaintProperty(layerId, "line-color", "#ca2333");
      mapInstance.setPaintProperty(layerId, "line-opacity", 0.8);
    }
  });

  subnationalLayers.forEach((layerId) => {
    if (mapInstance.getLayer(layerId)) {
      mapInstance.setPaintProperty(layerId, "line-color", "#94a3b8");
      mapInstance.setPaintProperty(layerId, "line-opacity", 0.4);
    }
  });

  // Re-add the risk layer after a basemap switch, if it was already present
  setupWorldLayer();
  updateLayer();
};

// Moving the pointer across a chart briefly passes over gaps between bars/rows (highlight
// becomes null, then the next region). Clearing only after a short pause keeps the grey overlay
// from flickering off and on while the pointer travels; a new region applies immediately.
const HIGHLIGHT_CLEAR_DELAY_MS = 150;
let highlightClearTimer: ReturnType<typeof setTimeout> | null = null;

function applyHighlight(pcode: string | null) {
  const mapInstance = map.value;
  if (mapInstance && mapInstance.getLayer(DIM_LAYER_ID)) {
    mapInstance.setFilter(DIM_LAYER_ID, ["!=", props.pcodeField, pcode || ""]);
    mapInstance.setLayoutProperty(
      DIM_LAYER_ID,
      "visibility",
      pcode ? "visible" : "none",
    );
  }
  if (mapInstance && mapInstance.getLayer("risk-layer-highlight")) {
    mapInstance.setFilter("risk-layer-highlight", [
      "==",
      props.pcodeField,
      pcode || "",
    ]);
  }
}

watch(
  () => props.highlightedPcode,
  (newVal) => {
    if (highlightClearTimer) {
      clearTimeout(highlightClearTimer);
      highlightClearTimer = null;
    }
    if (newVal) {
      applyHighlight(newVal);
    } else {
      highlightClearTimer = setTimeout(() => {
        highlightClearTimer = null;
        applyHighlight(null);
      }, HIGHLIGHT_CLEAR_DELAY_MS);
    }
  },
);

watch(layerOpacity, (newVal) => {
  const mapInstance = map.value;
  if (mapInstance && mapInstance.getLayer(floodLayerId)) {
    mapInstance.setPaintProperty(floodLayerId, "fill-opacity", Number(newVal));
  }
});

watch(
  () => props.pmtilesUrl,
  () => {
    regionMismatch.value = null;
    regionCheckDoneFor = null;
    updateLayer();
  },
);
watch(() => props.matchArray, updateLayer);

watch(
  () => props.availableCountries,
  (newVal) => {
    const mapInstance = map.value;
    if (
      mapInstance &&
      mapInstance.getLayer("unavailable-countries") &&
      mapInstance.getLayer(interactLayerId)
    ) {
      const isLoaded = newVal && newVal.length > 0;
      const validCountries = isLoaded ? newVal : ["NONE"];
      const availableFilter: maplibregl.FilterSpecification = isLoaded
        ? ["in", ["get", "iso_a3"], ["literal", validCountries]]
        : ["==", "iso_a3", "DOES_NOT_EXIST"];
      mapInstance.setFilter(
        "unavailable-countries",
        isLoaded
          ? ["!", ["in", ["get", "iso_a3"], ["literal", validCountries]]]
          : ["==", "iso_a3", "DOES_NOT_EXIST"],
      );
      mapInstance.setFilter(interactLayerId, availableFilter);
      if (mapInstance.getLayer(interactLayerId + "-outline")) {
        mapInstance.setFilter(interactLayerId + "-outline", availableFilter);
      }
    }
  },
  { deep: true },
);

defineExpose({
  resetView: resetToGlobalView,
});
</script>

<template>
  <div class="relative w-full h-full">
    <transition name="fade">
      <div
        v-if="pmtilesUrl"
        :class="
          cn(
            'absolute z-[60] left-4 flex flex-col gap-2 rounded-lg bg-white/90 shadow-sm backdrop-blur-md transition-[width] duration-300 ease-in-out',
            props.isMobile
              ? 'bottom-36 px-2 py-1.5'
              : 'top-8 rounded-md px-3 py-2',
            isLayersCollapsed
              ? props.isMobile
                ? 'w-10'
                : 'w-12'
              : props.isMobile
                ? 'w-45'
                : 'w-56',
          )
        "
      >
        <div v-if="riskViewMode" class="flex flex-col">
          <div class="flex flex-col gap-1">
            <button
              :class="
                cn(
                  'flex items-center gap-2 text-slate-500 transition-colors hover:text-heigit-red',
                  isLayersCollapsed ? 'justify-center' : 'justify-between',
                )
              "
              @click="isLayersCollapsed = !isLayersCollapsed"
              :title="isLayersCollapsed ? 'Expand layers' : 'Minimize layers'"
            >
              <template v-if="isLayersCollapsed">
                <v-icon icon="mdi-layers" size="24" />
              </template>
              <template v-else>
                <label
                  :class="
                    cn(
                      'block font-bold tracking-widest whitespace-nowrap text-slate-500',
                      props.isMobile ? 'text-[8px]' : 'text-[11px]',
                    )
                  "
                >
                  Layers:
                </label>
                <div class="flex items-center gap-1">
                  <span
                    v-if="isViewingCustomData"
                    :class="
                      cn(
                        'rounded-full bg-heigit-red/10 font-extrabold uppercase tracking-wider whitespace-nowrap text-heigit-red',
                        props.isMobile
                          ? 'px-1.5 py-0.5 text-[7px]'
                          : 'px-2 py-0.5 text-[8px]',
                      )
                    "
                    title="This layer is built from your uploaded custom data"
                  >
                    Viewing Custom Data
                  </span>
                  <v-icon icon="mdi-arrow-collapse" size="18" />
                </div>
              </template>
            </button>

            <div
              :class="
                cn(
                  'grid transition-[grid-template-rows] duration-300 ease-in-out',
                  isLayersCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
                )
              "
            >
              <div class="flex flex-col gap-1 overflow-hidden min-h-0">
                <button
                  v-for="dimension in dimensions"
                  :key="dimension.value"
                  @click="selectDimension(dimension.value)"
                  :class="
                    cn(
                      'flex items-center justify-between rounded text-left font-bold transition-colors whitespace-nowrap',
                      props.isMobile
                        ? 'px-1.5 py-0.5 text-[9px]'
                        : 'px-2 py-2 text-xs',
                      riskViewMode === dimension.value
                        ? 'bg-heigit-red  text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    )
                  "
                >
                  <div class="flex items-center gap-2">
                    <v-icon :icon="dimension.icon" size="18" />
                    <span>{{ dimension.label }}</span>
                  </div>
                </button>

                <v-divider class="my-2 bg-slate-200/70" />

                <div class="flex flex-col gap-1.5 mb-2">
                  <label
                    :class="
                      cn(
                        'block font-bold uppercase tracking-widest whitespace-nowrap text-slate-500',
                        props.isMobile ? 'text-[8px]' : 'text-[9px]',
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
                        'w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-heigit-red',
                        props.isMobile ? 'h-1' : 'h-1.5',
                      )
                    "
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <Map
      ref="mapViewRef"
      :map-style="styleUrl"
      :zoom="globalViewZoom"
      :scroll-zoom="true"
      @load="handleMapLoad"
      interactive
      :zoom-controls="props.showZoomControls && !isEmbedded"
      :compact-basemap="isEmbedded"
    />

    <div
      v-if="regionMismatch && pmtilesUrl"
      role="status"
      class="absolute z-20 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl shadow-lg px-4 py-2.5 text-sm flex gap-2.5 items-start"
      :class="
        props.isMobile
          ? 'top-[10.5rem] left-4 right-4'
          : 'bottom-9 left-1/2 -translate-x-1/2 w-[min(24rem,calc(100%-24rem))]'
      "
    >
      <v-icon icon="mdi-database-alert-outline" size="20" class="text-amber-600 mt-0.5 shrink-0" />
      <div>
        Data for this region is being updated. For further information contact us at
        <a
          href="mailto:humanitarian_gi@heigit.org"
          class="font-semibold underline underline-offset-2"
          >humanitarian_gi@heigit.org</a
        >.
      </div>
    </div>

    <RiskLegend
      v-if="matchArray && matchArray.length > 0"
      :is-mobile="props.isMobile"
      :title="legendTitle"
      :risk-view-mode="riskViewMode"
    />
  </div>
</template>

<style scoped>
:deep(.risk-tooltip .maplibregl-popup-content) {
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
}

/* Premium Zoom Controls */
:deep(.maplibregl-ctrl-group) {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  background: rgba(255, 255, 255, 0.8) !important;
  backdrop-filter: blur(8px);
  margin-top: 40px !important;
  margin-right: 17px !important;
}

:deep(.maplibregl-ctrl-group button) {
  width: 36px;
  height: 36px;
  background-color: transparent;
  transition: background-color 0.2s;
}

:deep(.maplibregl-ctrl-group button:hover) {
  background-color: #f1f5f9;
}

:deep(.maplibregl-ctrl-icon) {
  filter: grayscale(1) brightness(0.5);
}
</style>
