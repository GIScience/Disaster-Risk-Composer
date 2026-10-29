# Maintaining the dashboard

The Disaster Risk Composer is a static Vue 3 site. There is no backend: the browser downloads
a country's data files from HeiGIT's storage, computes the risk scores itself and draws them on
a MapLibre map. Story maps are documented separately (see the README).

## Run, build, release

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type check + production build into dist/
```

There are no tests. Check changes in the browser with a few countries: one with ADM2 data
(Myanmar), a large one (Brazil), an EU country with NUTS regions (Germany) and one with cyclone
data (Haiti).

Releases are built by Jenkins (`Jenkinsfile`, `Dockerfile`: nginx serving `dist/`):

- every push to `main` → image `repo.heigit.org/heigit/disaster-risk-composer:main`
- a version tag → `:<version>` and `:latest`

To release, with a clean working tree on `main`:

```bash
npm version patch   # or minor; bumps package.json, commits and tags
git push
git push --tags
```

Use `minor` when the risk calculation changes (scores differ from the previous release),
`patch` otherwise. Always tag through `npm version`: Jenkins doesn't compare the tag with the
version in `package.json`. The version is shown in the About dialog. Deploying the image to the
live site happens outside this repo.

## Where the data comes from

All country data is produced by the GAIA pipeline (separate repo) and lives under
`https://hot.storage.heigit.org/heigit-hdx-public/risk_assessment_inputs/<iso3>/`:

- `<ISO3>_ADM2.pmtiles`: district boundaries (vector tiles)
- `<ISO3>_ADM2_risk.parquet`: one row per district, one column per indicator

If there is no ADM2 file, the dashboard uses the ADM1 files instead. The district ID column is
`ADM2_PCODE` (OCHA boundaries) or `NUTS3_CODE` etc. (EU countries); it's detected per file
(`src/utils/regionId.ts`). Parquet files are read with hyparquet (`src/utils/parquet.ts`).

Other inputs:

- `public/data/available_countries.json`: the countries in the dropdown. To add a country,
  add its ISO3 code here once its files are on the storage.
- `countries.yaml` on the storage: the OSM extract name of each country, used for the HDX
  link in the About dialog.
- `public/data/world-labels.json`: the country names (OCHA names, a few short forms), used on
  the map and in the dropdown.
- `sources.json` on the storage: the data sources shown in the Metadata tab.

## How risk is computed

`src/utils/riskCalculation.ts`. A column's role comes from its name:

- `exp_flo_*`, `exp_cyc_*`: exposure for flood / cyclone
- `vul_*`: vulnerability
- `cop_*`: coping capacity (`cop_RP<n>_*` flood only, `cop_kt34_*` cyclone only)
- any other `<prefix>_*` with numbers (e.g. from an upload): an extra dimension
- `risk_*`, `sus_*`, `rank_*`, `vul`, `cop`, `exp_flood` etc. are pipeline results and are
  ignored as inputs. New result columns from the pipeline must be added to `isOutputColumn`.

Each indicator is min-max normalised within the country. Coping columns are inverted (more
coping = less risk), except the ones that already measure a lack of coping (evacuation time,
pixels at risk, dependency ratio). A dimension is the weighted mean of its indicators;
susceptibility is the geometric mean of vulnerability, coping and any extra dimensions; risk is
`sqrt(exposure × susceptibility)`. The map colours are quartiles within the country, so colours
can't be compared between countries.

The parquet files also contain risk scores from the pipeline. The dashboard doesn't use them:
it recomputes everything, so weights and uploads take effect. The two can differ while the
pipeline uses an older method.

Hazards are listed in `src/enums/hazards.ts`. The hazard dropdown shows every `risk_*` column of
a country's file. A new hazard needs its prefix in `hazards.ts`, its exposure and risk columns
in `riskCalculation.ts` (flood and cyclone are written out there) and `exp_<prefix>_*` columns
in the data.

## Where to change things

| What | Where |
|---|---|
| Loading a country, hazard switch, map colours | `src/composables/useRiskLogic.ts` |
| Weights, switching indicators on/off, weight CSV | `src/composables/useIndicatorWeights.ts` |
| Grouping of indicators in the tabs | `src/composables/useIndicatorColumns.ts` |
| Indicator descriptions (info icons) | `src/utils/indicatorDescription.ts` |
| Custom data upload | `src/components/dashboard/modals/UploadModal.vue` |
| Tabs of the analysis panel | `src/components/dashboard/statistics/` |
| Map, layers, basemaps | `src/components/dashboard/RiskMap.vue`, `src/config/basemaps.ts` |
| About dialog, data sources, disclaimer | `AboutModal.vue`, `src/content/resources.json` |
| Districts left out (e.g. Taiwan in China's files) | `src/config/excludedRegions.ts` |
| Desktop / phone layout | `src/components/dashboard/MainView.vue` / `MobileView.vue` |

## Generated files

Some files in `public/data/` are made by scripts in `scripts/` and committed. Rerun the script
when the source changes; don't edit the output by hand.

| File | Script | When to rerun |
|---|---|---|
| `world-labels.json` | `generate_world_labels.py` | country names change |
| `world.json` (grey countries, hover shapes) | `fix_world_un_practice.py` | boundaries change; the file was simplified with mapshaper first (command in `RiskMap.vue`) |
| `cyclone-storms.json` | `generate_cyclone_storms.py` | GAIA reruns the cyclone data (set `DATA_DATE` in the script to the data's date) |

Each script explains how to run it at the top. `cyclone-storms.json` repeats GAIA's storm
selection, because GAIA doesn't export which storms it used; for Myanmar it matches GAIA's
6 storms.

## Outside services

The site loads basemap tiles, fonts and icons from `tiles.versatiles.org` on every visit, and
satellite tiles from `server.arcgisonline.com` when the satellite basemap is chosen. Everything
else comes from HeiGIT's storage or is bundled. Keep it that way when adding features: no CDNs,
no requests to other sites on page load.

## Embedding

The dashboard can be shown in an iframe (e.g. on HDX). It detects this
(`src/composables/use-is-embedded.ts`) and starts with the analysis panel closed.
