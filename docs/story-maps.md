# Story Maps: JSON setup and update guide

This covers the **JSON-driven story map system**, served at `/story-map/:id`.

> **Naming note:** the route `/story-map` uses the *renderer* components in
> `src/components/story-map-two/` and `src/components/story-map/` (`StoryMapCanvas.vue`,
> `MapLegend.vue`, `Map.vue`, `COGLayer.vue`, `VectorLayer.vue`, `ChoroplethLayer.vue`).
> There is a separate, older **Markdown-driven** system at `/story-map-2/:id`
> (`src/content/story-maps/*.md`, rendered by components in `src/components/story-map/`
> such as `StoryMapNavbar.vue`/`StoryMapHero.vue`). The two systems share a folder name
> but are unrelated — this doc is only about the JSON one.

## 1. Where files live

| Path | Purpose |
|---|---|
| `src/content/story-maps/*.json` | One file per story map. Filename (minus `.json`) is the URL id, e.g. `flood-exposure.json` → `/story-map/flood-exposure`. |
| `src/types/story-map.ts` | TypeScript source of truth for the JSON schema (`StoryMapConfig`). |
| `src/pages/story-map/index.vue` | Listing page — auto-discovers every JSON file via `import.meta.glob` and renders a card per story map. No registration step needed; drop a new JSON file in and it appears. |
| `src/pages/story-map/[id]/[[section]].vue` | Detail page — loads the matching JSON by id and passes it to `<StoryMap>`. |
| `src/components/story-map-two/StoryMap.vue` and siblings | Renderer. You should not need to touch these for a content update — only for new interaction types. |
| `public/data/*.json`, `public/data/*.geojson` | Data files referenced by `sourceUrl`/`valuesUrl` for vector/choropleth layers (see §4). |

Adding a new story map = adding a new JSON file with a unique filename. There is no manifest to update.

## 2. Top-level shape

```json
{
  "meta": { ... },
  "storyMap": {
    "hero": { ... },
    "sidebar": { ... },
    "header": { ... },
    "sections": [ ... ]
  },
  "footer": { ... }
}
```

### `meta`
```json
"meta": {
  "id": "flood-exposure-story-map",
  "type": "story-map",
  "category": "flood",
  "version": 1,
  "locale": "en",
  "updatedAt": "2026-07-07",
  "notes": ""
}
```
- `category` is used by the listing page's category filter buttons (currently `flood` and `cyclone` are wired into `src/pages/story-map/index.vue`'s `categories` array — add a new value there if you introduce a new category).
- The rest of `meta` is informational; `id`/`version`/`notes` aren't rendered anywhere today.

### `storyMap.hero`
Shown at the top of the detail page and used for the card image/title on the listing page.
```json
"hero": {
  "image": "/floods.jpeg",
  "alt": "Flood hazard illustration",
  "title": "Flood Exposure For Myanmar, Thailand",
  "subtitle": "One or two sentences of framing copy."
}
```
`image` is resolved relative to `public/` (put the file in `public/`, reference it as `/filename.ext`).

### `storyMap.sidebar`
The sticky left-hand nav with numbered steps.
```json
"sidebar": {
  "icon": "mdi-home-flood",
  "title": "Flood Exposure",
  "subtitle": "One-line description.",
  "steps": [
    { "number": 1, "sectionRef": "sec-scenario", "title": "...", "body": "Markdown-ish text, **bold** works." }
  ],
  "aside": {
    "variant": "info",
    "icon": "mdi-information",
    "title": "About this story map",
    "body": "Small callout box under the steps."
  }
}
```
- Each `steps[].sectionRef` must match a `sections[].id` exactly — it's used for the click-to-scroll nav and active-step highlighting. Nothing validates this at build time, so a typo silently breaks that step's link.
- Icons are `mdi-*` names from [Material Design Icons](https://pictogrammers.com/library/mdi/) — check the icon exists before using it; unrecognized names just render blank.

### `storyMap.header`
The intro card above the sections.
```json
"header": {
  "title": "The core concept...",
  "description": "Plain text explanation.",
  "equation": { "terms": [ ... ] }
}
```
`equation.terms` is defined in the schema but **not currently rendered** by `StoryMap.vue` — you can omit it or leave it as-is; filling it in has no visual effect today.

### `footer`
```json
"footer": {
  "callouts": [
    {
      "variant": "positive",
      "icon": "mdi-check-circle",
      "title": "What this indicator tells us",
      "body": "..."
    },
    {
      "variant": "warning",
      "icon": "mdi-alert",
      "title": "What this indicator does not tell us",
      "items": ["Caveat one.", "Caveat two."]
    }
  ],
  "figure": { "source": "/flood_impact_diagram.svg", "alt": "..." }
}
```
Use `body` for a single paragraph or `items` for a bullet list — not both on the same callout.

## 3. Sections — the core building block

`storyMap.sections` is an ordered array; each entry renders as one full-width row (text column + optional map column). Minimal required fields: `id`, `number`, `title`.

```json
{
  "id": "sec-scenario",
  "number": 1,
  "title": "Flood scenario (return period)",
  "subtitle": "optional",
  "hasInfoIcon": true,
  "icon": "mdi-water",
  "control": { ... },
  "baseControl": { ... },
  "equation": { ... },
  "note": { ... },
  "figure": { ... },
  "dataset": { ... },
  "legend": { ... },
  "map": { ... }
}
```

What each optional block does:

- **`figure`** — a static illustration image shown above the controls (SVG/PNG in `public/`).
- **`control`** — the primary interactive selector (segmented buttons or a slider). Selecting an option swaps the map's main layer, note, and figure. See §3.1.
- **`baseControl`** — a *second*, independent selector that drives an underlay layer rendered beneath `control`'s layer on the same map (e.g. flood extent under a population/facilities layer). Only meaningful when `map` is also present.
- **`equation`** — renders a compact "A + B" strip combining the active `control` selection and the active `baseControl` selection. Only shows if the section has **both** `control` and `baseControl`, and `equation` is set:
  ```json
  "equation": { "baseLabel": "Flood Extent", "baseIcon": "mdi-water", "operator": "+" }
  ```
  `baseLabel`/`baseIcon` describe the `baseControl` side; the sublabel (e.g. "50-years") and the `control` side are filled in automatically from whichever options are currently selected.
- **`note`** — a callout box (`variant: "info" | "warning"`) with Markdown-lite `body` (bold, links, lists — rendered via `markdown-it`; see `RichText.vue`). This is the *default* note shown when no `control` option overrides it (see §3.1).
- **`dataset`** — a small "data source" line (icon + title + source text). Purely informational, no map effect.
- **`legend`** — a floating legend box overlaid on the map. Two forms:
  - `"type": "categorical"` — list of `{ color, label }` swatches.
  - `"type": "graduated"` — same shape, used for ramped/choropleth values; add `excluded: true` on an item to grey it out.
- **`map`** — presence of this key is what makes the section render a map panel at all. See §3.2.

### 3.1 `control` (and `baseControl`) — segmented vs slider

**Segmented** (the only variant with real data-binding today):
```json
"control": {
  "type": "segmented",
  "id": "return-period",
  "variant": "cards",
  "options": [
    {
      "value": "10",
      "label": "10-years",
      "icon": "mdi-...",
      "selected": true,
      "layerConfig": { ... },
      "note": { ... },
      "figure": { ... }
    }
  ]
}
```
- Exactly one option should have `"selected": true` — that's the initial state on page load. If none is marked, the UI still defaults to the first option in the array, but be explicit.
- `variant: "cards"` renders a 4-column icon-grid; omit `variant` (or use any other value) for the default pill/tab style.
- Per-option `layerConfig` replaces the section's map layer when that option is clicked. Per-option `note`/`figure` likewise override the section's default note/figure — omit them on an option to fall back to the section-level `note`/`figure`.
- `id` should be unique within the file; it isn't rendered but is good practice for readability/debugging.

**Slider** (defined in the schema, used for continuous/threshold-style controls):
```json
"control": {
  "type": "slider",
  "id": "depth-threshold",
  "label": "Flood depth threshold",
  "unit": "cm",
  "min": 0,
  "max": 100,
  "value": 30,
  "ticks": [{ "value": 30, "label": "30cm", "selected": true }]
}
```
Note: the slider currently has **no layer-swapping behavior wired up** (unlike segmented) — moving it only updates the visual position of the handle. Don't rely on it to change map data yet; use `segmented` for anything that must change what's shown on the map.

### 3.2 `map` and `layerConfig` — wiring an actual map layer

A section only shows a map if it has a `map` object:
```json
"map": {
  "layerId": "flood-extent",
  "center": [96, 19],
  "zoom": 5.5,
  "controls": ["home", "zoom-in", "zoom-out"],
  "showOpacityControl": true,
  "legend": { ... }
}
```
- `layerId` is just an internal MapLibre layer id — keep it stable and descriptive; it doesn't need to be globally unique across the file but shouldn't collide with another layer active on the *same* map instance.
- `center`/`zoom` set the initial camera. Omit to inherit the map's defaults (`[20, 10]`, zoom `1.8`).
- If the section has no `control` (so there's nothing to select a layer from), give `map.layerConfig` directly — that's the fixed layer shown.
- `showOpacityControl: true` adds a top-left opacity slider over the layer.

**`layerConfig`** (used inside `control.options[].layerConfig`, `baseControl.options[].layerConfig`, or `map.layerConfig`) describes *what* to draw. Four shapes, chosen by `type`:

**a) Raster / COG (single-band, colour-ramped)**
```json
{
  "type": "raster",
  "layerId": "flood-extent",
  "colorScheme": "BrewerBlues9",
  "mode": "ramp",
  "sourceUrl": "https://.../MMR_flooded_RP50_cog_3857.tif"
}
```
- `sourceUrl` must be a **Cloud-Optimized GeoTIFF (COG)**, reprojected to EPSG:3857, served over HTTPS with range-request support (the existing files live in HEiGIT's `hot.storage.heigit.org` bucket).
- `mode: "ramp"` colours pixels by value using `colorScheme` (see the palette list below); `min`/`max` for the ramp are currently hardcoded to `0`–`1` by the renderer (`StoryMapPanel.vue`) — the underlying `COGLayer` supports other `min`/`max`, but the story-map JSON schema doesn't expose them yet, so pre-normalize your raster values to that range, or ask for the schema to be extended before adding a new ramped raster with a different range.
- `mode: "rgb"` (default if omitted) renders the raw pixel values as an RGB image — use for pre-styled/3-band COGs.
- You'll also see `"type": "cog"` used interchangeably with `"type": "raster"` in the existing content — the renderer treats anything that isn't `"vector"` or `"choropleth"` as a raster/COG URL, so either string works, but prefer `"raster"` for new content since that's the documented type in `layerConfigType`.
- Valid `colorScheme` values are the Brewer ramps from `@geomatico/maplibre-cog-protocol`, named `Brewer<Palette><N>` where `N` is 3–9, e.g. `BrewerBlues9`, `BrewerPurples9`, `BrewerReds9`, `BrewerYlOrRd9`, `BrewerGreens9`, `BrewerOranges9`, `BrewerRdPu9`, `BrewerPuRd9`, `BrewerYlGnBu9`, `BrewerGnBu9`, `BrewerBuGn9`, `BrewerPuBuGn9`, `BrewerPuBu9`, `BrewerBuPu9`, `BrewerYlGn9`, `BrewerYlOrBr9`. Pick the palette + step count (3–9) that best separates your data; higher N = smoother ramp.

**b) Vector (point features, categorized)**
```json
{
  "type": "vector",
  "layerId": "flood-facilities-pois",
  "sourceUrl": "/data/myanmar_gaia_pois.geojson",
  "categoryProperty": "amenity",
  "categories": [
    { "value": "school", "label": "School", "icon": "mdi-school", "color": "#2563eb" },
    { "value": "hospital", "label": "Hospital", "icon": "mdi-hospital-box", "color": "#dc2626" }
  ]
}
```
- `sourceUrl` can be a static GeoJSON file in `public/data/` (referenced as `/data/....geojson`) or a `.pmtiles` URL — in the latter case also set `sourceLayer` to the tileset's layer name.
- `categoryProperty` is the GeoJSON feature property used to bucket points into `categories`; only categories listed will render (with their `icon`/`color`) — features with other values for that property are dropped.
- Points auto-cluster by default unless the source is `.pmtiles` (see `VectorLayer.vue`).

**c) Choropleth (admin-boundary polygons, value-driven)**
```json
{
  "type": "choropleth",
  "layerId": "adm2-exposure-choropleth",
  "sourceUrl": "https://.../MMR_ADM2.pmtiles",
  "sourceLayer": "boundary",
  "pcodeField": "ADM2_PCODE",
  "valuesUrl": "/data/mmr-adm2-vul_children_u5.json",
  "stops": [
    { "max": 19000, "color": "#ffffff" },
    { "max": 43000, "color": "#f6a44d" },
    { "max": 68000, "color": "#e86b3e" },
    { "max": 190000, "color": "#cc0130" }
  ],
  "unit": "people"
}
```
- `sourceUrl` is a PMTiles vector tileset of administrative boundaries; `sourceLayer` is the layer name inside it.
- `pcodeField` is the feature property (e.g. P-code) used to join boundary features to values.
- `valuesUrl` points at a small JSON file — **array of `{ "pcode": string, "value": number }`** — placed under `public/data/`. This is the file you generate/update from your analysis output; see §4.
- `stops` are evaluated in order as "value ≤ max → color"; the last stop also serves as the fallback for anything above the highest `max`, so make sure your highest `max` actually covers your data's max value (a district value above every `max` still gets the last stop's color today, but keeping the numbers correct avoids a legend/data mismatch).

## 4. Updating the numbers/data behind an existing story map

To swap in fresh data without touching the JSON's structure:

1. **Raster layers** (flood extent, population COGs): replace the file at the existing `sourceUrl`, or upload a new COG and update `sourceUrl` in the relevant `layerConfig`. Keep it a COG in EPSG:3857 with values pre-scaled to the `0–1` range the renderer expects for ramps.
2. **Choropleth values**: regenerate the `public/data/*.json` file referenced by `valuesUrl`, keeping the `[{ "pcode": ..., "value": ... }]` shape and the same `pcode` values used in the vector tileset's `pcodeField`. Update `stops[].max` if the new data's range no longer matches the old breakpoints (and update the matching `legend.items` in the section so the legend stays in sync — the two are not linked automatically).
3. **Facility/POI points**: edit or replace the GeoJSON in `public/data/`, keeping the `categoryProperty` values consistent with `categories[].value` in the JSON.
4. **Copy/text-only edits** (titles, notes, sidebar steps, footer callouts): edit the story map's `.json` file directly — no other file needs to change.

## 5. Adding a brand-new story map

1. Copy an existing file (e.g. `src/content/story-maps/flood-exposure.json`) as a starting template — the structures are consistent across the ones in this repo.
2. Rename it to `<your-id>.json`; the filename becomes the URL slug.
3. Update `meta`, `hero`, `sidebar`, `header`, `sections`, and `footer` for the new content.
4. If it's a new `category`, add the value to the `categories` array in `src/pages/story-map/index.vue`.
5. Add any new images/SVGs to `public/`, and any new data files to `public/data/`.
6. Run the dev server and open `/story-map/<your-id>` to check it renders, then check `/story-map` to confirm the new card shows up with correct title/image/category.

## 6. Gotchas / things not enforced by the schema

- `sidebar.steps[].sectionRef` must match a real `sections[].id` — no build-time check.
- `equation` on a section only renders if **both** `control` and `baseControl` are present.
- `header.equation` (top-level, not per-section) is unused by the current renderer.
- Choropleth `stops` and the section's `legend.items` are two separate lists that must be kept manually in sync.
- Slider controls don't drive map layers yet — use `segmented` for anything that needs to change the map.
- Raster ramp `min`/`max` are fixed at `0`/`1` by the renderer regardless of what's in the JSON — normalize source COG values accordingly.
