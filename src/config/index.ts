import type { StyleSpecification } from "maplibre-gl";

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
  OSM: "https://tiles.openfreemap.org/styles/positron",
  //   Satellite: "https://api.maptiler.com/maps/hybrid/style.json?key=YOUR_MAPTILER_KEY",
  //   Topographic: "https://api.maptiler.com/maps/topo/style.json?key=YOUR_MAPTILER_KEY",
};

export const DataSourcesURL =
  "https://hot.storage.heigit.org/heigit-hdx-public/risk_assessment_inputs/sources.json";

export const TooltipInfoList = {
  ADM2_PCODE: "Administrative division code (ADM2)",

  // Population Indicators
  access_pop_education_5km: "Population with access to education within 5km",
  access_pop_education_10km: "Population with access to education within 10km",
  access_pop_education_20km: "Population with access to education within 20km",

  // Healthcare Indicators
  access_pop_hospitals_30min:
    "Population with access to hospitals within 30 minutes",
  access_pop_hospitals_1h: "Population with access to hospitals within 1 hour",
  access_pop_hospitals_2h:
    "Population with access to hospitals within 2 hours",

  access_pop_primary_healthcare_30min:
    "Population with access to primary healthcare within 30 minutes",
  access_pop_primary_healthcare_1h:
    "Population with access to primary healthcare within 1 hour",
  access_pop_primary_healthcare_2h:
    "Population with access to primary healthcare within 2 hours",

  education_count: "Number of educational facilities",
  hospitals_count: "Number of hospitals",
  primary_healthcare_count: "Number of primary healthcare facilities",

  female_pop: "Female population",
  male_pop: "Male population",
  total_pop: "Total population",
  children_u5: "Children under 5 years old",
  female_u5: "Female children under 5 years old",
  elderly: "Elderly population (65+ years old)",
  pop_u15: "Population under 15 years old",
  female_u15: "Female population under 15 years old",

  // Rural Population Indicators
  female_pop_rural: "Female demographic population in rural areas",
  children_u5_rural: "Children under 5 years old in rural areas",
  female_u5_rural: "Female children under 5 years old in rural areas",
  elderly_rural: "Elderly population (65+ years old) in rural areas",
  pop_u15_rural: "Population under 15 years old in rural areas",
  female_u15_rural: "Female population under 15 years old in rural",
  rural_pop_perc: "Percentage of total population living in rural areas",

  // Flood Exposure Indicators
  female_pop_30cm: "Female population exposed to 30cm flood depth",
  children_u5_30cm: "Children under 5 years old exposed to 30cm flood depth",
  female_u5_30cm:
    "Female children under 5 years old exposed to 30cm flood depth",
  elderly_30cm:
    "Elderly population (65+ years old) exposed to 30cm flood depth",
  pop_u15_30cm: "Population under 15 years old exposed to 30cm flood depth",
  female_u15_30cm:
    "Female population under 15 years old exposed to 30cm flood depth",
  education_30cm_pct:
    "Percentage of educational facilities exposed to 30cm flood depth",
  hospitals_30cm_pct: "Percentage of hospitals exposed to 30cm flood depth",
  primary_healthcare_30cm_pct:
    "Percentage of primary healthcare facilities exposed to 30cm flood depth",
  education_30cm_count:
    "Number of educational facilities exposed to 30cm flood depth",
  hospitals_30cm_count: "Number of hospitals exposed to 30cm flood depth",
  primary_healthcare_30cm_count:
    "Number of primary healthcare facilities exposed to 30cm flood depth",

  // Cyclone Exposure Indicators
  kt34_female_pop_cat1: "Female population exposed to category 1 cyclone",
  kt34_children_u5_cat1:
    "Children under 5 years old exposed to category 1 cyclone",
  kt34_female_pop_cat2: "Female population exposed to category 2 cyclone",
  kt34_children_u5_cat2:
    "Children under 5 years old exposed to category 2 cyclone",
  kt34_female_pop_cat3: "Female population exposed to category 3 cyclone",
  kt34_children_u5_cat3:
    "Children under 5 years old exposed to category 3 cyclone",
  kt34_education_perc:
    "Percentage of educational facilities exposed to cyclone",
  kt34_hospitals_perc: "Percentage of hospitals exposed to cyclone",
  kt34_education_cat1:
    "Percentage of educational facilities exposed to category 1 cyclone",
  kt34_hospitals_cat1: "Percentage of hospitals exposed to category 1 cyclone",
  kt34_education_cat2:
    "Percentage of educational facilities exposed to category 2 cyclone",
  kt34_hospitals_cat2: "Percentage of hospitals exposed to category 2 cyclone",
  kt34_education_cat3:
    "Percentage of educational facilities exposed to category 3 cyclone",
  kt34_hospitals_cat3: "Percentage of hospitals exposed to category 3 cyclone",

  kt34_education_count_cat1:
    "Number of educational facilities exposed to category 1 cyclone",
  kt34_hospitals_count_cat1:
    "Number of hospitals exposed to category 1 cyclone",
  kt34_education_count_cat2:
    "Number of educational facilities exposed to category 2 cyclone",
  kt34_hospitals_count_cat2:
    "Number of hospitals exposed to category 2 cyclone",
  kt34_education_count_cat3:
    "Number of educational facilities exposed to category 3 cyclone",
  kt34_hospitals_count_cat3:
    "Number of hospitals exposed to category 3 cyclone",

  kt34_primary_healthcare_perc:
    "Percentage of primary healthcare facilities exposed to cyclone",
  kt34_primary_healthcare_cat1:
    "Percentage of primary healthcare facilities exposed to category 1 cyclone",
  kt34_primary_healthcare_cat2:
    "Percentage of primary healthcare facilities exposed to category 2 cyclone",
  kt34_primary_healthcare_cat3:
    "Percentage of primary healthcare facilities exposed to category 3 cyclone",

  kt34_primary_healthcare_count_cat1:
    "Number of primary healthcare facilities exposed to category 1 cyclone",
  kt34_primary_healthcare_count_cat2:
    "Number of primary healthcare facilities exposed to category 2 cyclone",
  kt34_primary_healthcare_count_cat3:
    "Number of primary healthcare facilities exposed to category 3 cyclone",
};
