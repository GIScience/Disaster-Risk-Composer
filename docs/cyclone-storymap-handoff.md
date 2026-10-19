# Cyclone story map (Myanmar): hand-off

For the Disaster Risk Composer "Cyclone exposure" story map (MMR). Code references are to this repository (`src/gaia/...`). Values that come from the IBTrACS documentation rather than from the code are marked as such.

## Story map text

- **Category 1 / 2 / 3:** "The categories group past storms by strength on the Saffir-Simpson scale: 1 = Category 1 hurricanes/typhoons, 2 = Categories 2–3, 3 = Categories 4–5 (the strongest); each place is counted once, in the strongest category that ever reached it."
- **34 knots:** "34 knots (about 63 km/h) is the threshold for tropical-storm-force winds; the shaded zone shows where the storm produced winds at least this strong."

## Task 1: How GAIA computes cyclone exposure

### 1. What "kt34" means
"kt34" stands for **34 knots** (34 kt × 1.852 = **63 km/h**), the threshold for tropical-storm-force winds. GAIA does not compute wind speeds itself. It uses the **radius of 34-kt winds** that IBTrACS reports for each storm position, in nautical miles, separately for the four quadrants NE, SE, SW and NW. GAIA averages the four quadrants into one radius and draws a circular buffer of that radius around the track. According to the IBTrACS documentation (not stated in the code), these `USA_*` values come from the US agencies (JTWC for the North Indian Ocean), which use **1-minute sustained winds at 10 m height**.
Code: `fetch_cyclones_ncei.py:101-105` (mean of `USA_R34_SE/NE/NW/SW`, × 1852 m, buffer).

### 2. What cat1, cat2 and cat3 mean
They are **groups of the Saffir-Simpson hurricane category** of the storm (`USA_SSHS`) on that track segment. They are **not** return periods or probabilities:

| GAIA class | Saffir-Simpson category | Storm max. sustained wind (1-min) |
|---|---|---|
| cat1 | 1 | 119–153 km/h |
| cat2 | 2–3 | 154–208 km/h |
| cat3 | 4–5 | ≥ 209 km/h |

How a zone is built:
1. Only track segments with category ≥ 1 (hurricane/typhoon strength) are kept.
2. Each segment is buffered by its 34-kt radius, and the buffers are clipped to Myanmar.
3. The buffers are rasterised from weakest to strongest, so where buffers overlap the **highest category wins**.
4. Every location ends up in **exactly one** class: the strongest storm that ever brought ≥ 34-kt winds there.

Code: `fetch_cyclones_ncei.py:84` (category ≥ 1), `:101-114` (buffer and clip), `:147-165` (sort by category and rasterise, last one wins), `:167-170` (1 → cat1, 2–3 → cat2, 4–5 → cat3).

**Why cat3 is the widest zone in Myanmar:** only 6 storms contribute: an unnamed storm (2004, Cat 1), Mala (2006, Cat 4), Akash (2007, Cat 1), Nargis (2008, Cat 4), Giri (2010, Cat 4) and Mocha (2023, Cat 5). Four of them were Category 4–5 near Myanmar, and stronger storms have much larger 34-kt wind fields: on average 108 nm for Category 4 segments and 165 nm for Mocha, against 74 nm for Category 1. Because the highest category wins where zones overlap, the large Category 4–5 wind fields cover most of the area that weaker storms also reached. The cat1 zone is only what remains where no stronger storm got to. This gives 27.2 M people in cat3, compared with 5.9 M in cat1 and 7.8 M in cat2.

### 3. Input dataset
- **Name:** IBTrACS (International Best Track Archive for Climate Stewardship), version **v04r01**, "since1980" subset, track **line segments** (shapefile).
- **Provider:** NOAA National Centers for Environmental Information (NCEI).
- **Link:** https://www.ncei.noaa.gov/products/international-best-track-archive (file: `.../ibtracs/v04r01/access/shapefile/IBTrACS.since1980.list.v04r01.lines.zip`).
- **Type:** **historical** observed best tracks, not synthetic storms.
- **Time period in practice:** 1980 onwards, but segments without 34-kt radii are dropped. For Myanmar the radii only exist from 2004, so the zones are built from storms between **2004 and 2023**.
- **Resolution:** vector tracks, with positions every 3 hours according to IBTrACS. The zone is rasterised onto the WorldPop population grid of the country: about 100 m at the time of the published run, about 1 km in the current code.

Code: `fetch_cyclones_ncei.py:39-46` (URL, cached in `downloads/`, not refreshed automatically), `:137-145` (raster grid = WorldPop grid).

### 4. How something counts as "exposed"
- **Population:** a WorldPop cell counts towards class k if its centre lies in the class-k zone. Its population is summed per district. Code: `fetch_cyclones_ncei.py:247-263`.
- **Facilities:** a facility counts if its location (the centroid, for buildings or areas) falls in the class-k zone. `perc` is the share of all facilities of that type in the district. Code: `:278-325`.
- **Weighting:** there is **no probability or frequency weighting**. A place hit by five storms counts the same as a place hit once, and it is counted only in its strongest class. The values are counts of "people/facilities that have been inside a ≥ 34-kt wind zone of a Category k storm at least once since 2004". They are not annual risk.

### 5. Population and facilities data
- **Population:** WorldPop age/sex structures, release **R2025A**, series `Global_2015_2030`, year **2030** (projection), **constrained**, 100 m (`fetch_worldpop.py:44-47, 212`). The current code aggregates this to about 1 km before use (`fetch_worldpop.py:51`). `children_u5` = ages 0–4, both sexes.
- **Facilities** (OpenStreetMap via the ohsome API, `fetch_facilities_ohsome_overpass.py:50-56`):
  - education: `amenity=school`
  - hospitals: `amenity=hospital` or `healthcare=hospital`
  - primary_healthcare: `amenity=doctors|clinic` or `healthcare=clinic|doctors|midwife|nurse|center`, excluding anything tagged as a hospital

### 6. `cop_kt34_evac_time_minutes_*` and `cop_kt34_pixels_at_risk`
- **`cop_kt34_evac_time_minutes_mean|max|median`:** estimated motorised travel time, in minutes, from places inside any cyclone zone (class ≥ 1) to the nearest place outside all zones. It uses a least-cost path over a global 2020 motorised friction surface and is summarised over the at-risk cells of each district. Code: `calculate_evacuatability.py:161-170` (at risk = class ≥ 1, safe = 0), `:576` (input = the same cyclone raster), `:630-667` (columns).
- **`cop_kt34_pixels_at_risk`:** the number of at-risk cells per district. It was written by an older version of the code; the current version no longer produces it.
- **Important:** neither column is currently in the published `MMR_ADM2_risk.parquet`. Myanmar does have an evacuability file (`MMR_ADM2_evacuability.csv` on S3, with `kt34_evac_time_minutes_*`), but a pipeline bug dropped it from the coping file on reruns (also affects AUT, BEL, CZE, DEU, MKD, RWA). The bug is fixed: after `evacuability_asset` → `coping_asset` → upload → `visualization_job` are rerun for MMR, the parquet will contain `cop_kt34_evac_time_minutes_mean|max|median`. `cop_kt34_pixels_at_risk` will not come back, because the current code no longer produces it.

### 7. Limitations a non-expert should know
- **Only wind is covered.** Storm surge, heavy rain and the resulting floods are not included; for river floods see the flood layers.
- **The data is historical**, based on only 6 storms (2004–2023). It is not a probabilistic hazard map. Areas not hit in this period show no exposure even if they are at risk.
- **Wind fields are drawn as circles.** The radius is the mean of the four quadrants, so real asymmetric wind fields (often stronger on the right-hand side of the track) are smoothed out.
- **Storms that passed outside Myanmar's bounding box are ignored**, even if their wind field reached the coast. The tracks are filtered by the country's bounding box before the buffer is applied (`fetch_cyclones_ncei.py:91-92`).
- **The category is the storm's peak intensity on that segment.** It is not the wind speed at every point of the zone. Within the zone, winds are only known to be ≥ 34 kt.
- **Offshore areas are cut away** (zones are clipped to the land boundary, `:114`). The population grid is 2030 projected population on top of past storms.

## Task 2: Cyclone zone rasters

Produced with `src/gaia/scripts/export_storymap_rasters.py`. The script uses the pipeline's own classified cyclone raster, the same one behind `exp_cyc_kt34_*_cat<k>`, and puts it onto the exact grid of the existing story-map raster `MMR_flooded_RP50_cog_3857.tif`, so all layers align pixel for pixel. Nothing was uploaded.

```sh
python -m gaia.scripts.export_storymap_rasters MMR \
    --reference MMR_flooded_RP50_cog_3857.tif --out-dir data/MMR/storymap \
    --flood MMR_flooded_RP10_cog_3857.tif MMR_flooded_RP50_cog_3857.tif \
            MMR_flooded_RP100_cog_3857.tif MMR_flooded_RP500_cog_3857.tif
```

**Shared properties of all files:**
- **Format:** Cloud Optimized GeoTIFF, EPSG:3857, Byte (UInt8), DEFLATE with predictor 2, 512×512 tiles, 6 internal overview levels (nearest).
- **Grid:** 10258 × 22978 pixels, 97.65 m, identical to the flood story-map rasters.
- **Extent:** EPSG:3857 (10260549.55, 1074278.61) – (11262215.22, 3318017.51), i.e. lon 92.172–101.170, lat 9.605–28.546.
- **Validation:** `gdalinfo` reports `LAYOUT=COG` for every file.

**Cyclone zones.** Values: **1 = inside the zone, nodata (0) elsewhere.** The zones carry no meaningful continuous value: inside the zone, winds are only known to be ≥ 34 kt.

| File | Size | Zone cells |
|---|---|---|
| `data/MMR/storymap/MMR_cyclone_kt34_cat1_cog_3857.tif` | 490 KB | 7,803,592 |
| `data/MMR/storymap/MMR_cyclone_kt34_cat2_cog_3857.tif` | 473 KB | 6,890,169 |
| `data/MMR/storymap/MMR_cyclone_kt34_cat3_cog_3857.tif` | 647 KB | 21,715,917 |

### Sanity check: children under 5 per district

Two calculations compared against `exp_cyc_kt34_children_u5_cat<k>` in the published `MMR_ADM2_risk.parquet`:
- **A:** the produced rasters, with WorldPop children under 5 resampled onto the same grid.
- **B:** the current pipeline method, with WorldPop on its ~1 km grid and the zones rasterised onto that grid.

| Class | Published | A (map files) | Diff A | B (pipeline method) | Diff B | Districts (pub / A / B) | Largest district diff A |
|---|---|---|---|---|---|---|---|
| cat1 | 458,726 | 462,355 | +0.79 % | 461,188 | +0.54 % | 26 / 26 / 26 | 2,272 |
| cat2 | 521,461 | 520,938 | −0.10 % | 521,046 | −0.08 % | 21 / 21 / 21 | 548 |
| cat3 | 1,931,086 | 1,960,171 | +1.51 % | 1,939,436 | +0.43 % | 36 / 36 / 36 | 9,021 |

- **Same districts:** the affected districts per class are identical in all three. The national totals agree within 1.5%.
- **Where the differences come from:** they are concentrated at zone edges. A cell on the edge counts as inside or outside depending on the grid resolution: the published values used a coarser population grid than the 98 m story-map grid.
- **Largest differences:** in absolute terms in MMR013002, MMR013003 and MMR012005 (cat3, up to about 9,000 children, under 7%). Three cat1 districts and four cat3 districts with more than 1,000 children differ by more than 5%.
- **What this means for the story map:** the map can be shown together with the published district numbers. Readers should not expect a pixel-exact sum to match a district value.

## Optional Task 3: 8-bit flood depth rasters

Converted from the existing story-map flood rasters. They have the same grid and the same properties as above.

**Values:** flood depth in **cm, 0–254**; depths of 2.54 m or more are **capped at 254**; **255 = nodata** (not flooded). Flood depth starts at 10 cm in the source data.

| File | Size | Flooded cells | Share capped at 254 |
|---|---|---|---|
| `data/MMR/storymap/MMR_flooded_RP10_cog_3857_u8.tif` | 9.4 MB | 6,506,123 | 28.9 % |
| `data/MMR/storymap/MMR_flooded_RP50_cog_3857_u8.tif` | 9.9 MB | 7,991,776 | 40.1 % |
| `data/MMR/storymap/MMR_flooded_RP100_cog_3857_u8.tif` | 9.9 MB | 8,369,579 | 45.1 % |
| `data/MMR/storymap/MMR_flooded_RP500_cog_3857_u8.tif` | 9.6 MB | 9,049,744 | 53.0 % |

The conversion is exact for depths below 2.54 m (largest difference 0 cm). **However, 29–53% of the flooded area is deeper than 2.54 m and shows as 254**, so the deep areas lose their differences. If the map should distinguish them, a coarser step would fit into 8 bits, e.g. **2 cm steps (0–5.08 m)** or **4 cm steps (0–10.16 m)**; that's a one-line change in `export_flood_u8`. The source also contains a few implausible depths of up to 87 m, which are capped either way.

## Open questions

1. **`cop_kt34_*` columns:** they will only appear in `MMR_ADM2_risk.parquet` once MMR has been rerun with the fix (see Task 1, question 6). Until then, the story map can't use them. `cop_kt34_pixels_at_risk` won't come back at all.
2. **Exact reproduction of the published numbers:** the cyclone CSV on S3 (17 Sep 2026) can't be reproduced exactly, even with the current method (0.1–0.5% off nationally, same districts). The server run probably used a different IBTrACS download or boundary version; the IBTrACS file is cached and the server's download date is unknown.
3. **Wind convention** (1-minute sustained, 10 m): this comes from the IBTrACS documentation for the `USA_*` fields. The code doesn't state it.
4. **Flood u8 scale:** keep 1 cm steps with the cap at 254 cm, or switch to 2 cm or 4 cm steps (see Task 3)?
