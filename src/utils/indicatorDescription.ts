/**
 * Builds the "additional information" text for an indicator column from its name, so every
 * column that follows the pipeline's naming convention gets a description without a
 * hand-maintained per-column list (e.g. "exp_flo_RP100_children_u5_30cm" ->
 * "Number of children under 5 exposed to flood water of 30 cm or deeper in a 1-in-100-year
 * flood (1% chance each year)."). Returns null for columns it doesn't recognize.
 */

const POPULATION_GROUPS: Record<string, string> = {
  total_pop: "people",
  female_pop: "women",
  children_u5: "children under 5",
  female_u5: "women under 5",
  elderly: "elderly people (65+)",
  pop_u15: "people under 15",
  female_u15: "women under 15",
  wra_pop: "women of reproductive age (15–49)",
  dependents: "dependents (under 15 and 65+)",
  working: "working-age people (15–64)",
};

const FACILITIES: Record<string, string> = {
  education: "educational facilities",
  hospitals: "hospitals",
  primary_healthcare: "primary healthcare facilities",
};

const STATS: Record<string, string> = {
  mean: "Mean",
  median: "Median",
  max: "Maximum",
};

const COMPOSITES: Record<string, string> = {
  vul: "Combined vulnerability score of the district (0–1), the weighted mean of the active vulnerability indicators.",
  cop: "Combined lack-of-coping-capacity score of the district (0–1), the weighted mean of the active coping capacity indicators.",
  exp_flood: "Combined flood exposure score of the district (0–1), the weighted mean of the active flood exposure indicators.",
  exp_cyclone: "Combined cyclone exposure score of the district (0–1), the weighted mean of the active cyclone exposure indicators.",
};

const DEPENDENCY_RATIO =
  "dependents (under 15 and 65+) per 100 working-age people (15–64)";

const GROUP_PATTERN = Object.keys(POPULATION_GROUPS).join("|");
const FACILITY_PATTERN = Object.keys(FACILITIES).join("|");

function floodEvent(returnPeriod: string): string {
  const years = Number(returnPeriod);
  const chance = +(100 / years).toFixed(1);
  return `a 1-in-${years}-year flood (${chance}% chance each year)`;
}

function cycloneEvent(category: string): string {
  return `Category ${category} cyclone winds`;
}

function hazardEvent(hazardKey: string): string {
  return hazardKey === "kt34" ? "cyclone winds" : floodEvent(hazardKey.slice(2));
}

function describeVulnerability(name: string): string | null {
  if (name === "dependency_ratio") return `Dependency ratio: ${DEPENDENCY_RATIO}.`;
  if (name === "dependency_ratio_rural")
    return `Dependency ratio in rural areas: ${DEPENDENCY_RATIO}.`;
  if (name === "rural_pop_perc")
    return "Share (%) of the population living in rural areas.";

  const match = name.match(new RegExp(`^(${GROUP_PATTERN})(_rural)?$`));
  if (!match) return null;
  return match[2]
    ? `Number of ${POPULATION_GROUPS[match[1]]} living in rural areas.`
    : `Number of ${POPULATION_GROUPS[match[1]]}.`;
}

function describeCopingCapacity(name: string): string | null {
  let match = name.match(
    new RegExp(`^access_pop_(${FACILITY_PATTERN})_(\\d+)(km|min|h)$`),
  );
  if (match) {
    const [, facility, amount, unit] = match;
    const limit =
      unit === "km"
        ? `${amount} km`
        : unit === "min"
          ? `${amount} minutes of travel`
          : `${amount} hour${amount === "1" ? "" : "s"} of travel`;
    return `Number of people who can reach ${FACILITIES[facility]} within ${limit}.`;
  }

  match = name.match(new RegExp(`^(${FACILITY_PATTERN})_count$`));
  if (match) return `Number of ${FACILITIES[match[1]]} in the district.`;

  match = name.match(/^(RP\d+|kt34)_evac_time_minutes_(mean|median|max)$/);
  if (match)
    return `${STATS[match[2]]} evacuation time in minutes for areas exposed to ${hazardEvent(match[1])}.`;

  match = name.match(/^(RP\d+|kt34)_pixels_at_risk$/);
  if (match)
    return `Number of grid cells at risk from ${hazardEvent(match[1])}.`;

  if (name === "rural_access_dependency_ratio")
    return `Dependency ratio of the rural population living within 2 km of an all-season road: ${DEPENDENCY_RATIO}.`;

  match = name.match(new RegExp(`^rural_access_(${GROUP_PATTERN})$`));
  if (match)
    return `Number of rural ${POPULATION_GROUPS[match[1]]} living within 2 km of an all-season road.`;

  match = name.match(new RegExp(`^RAI_(${GROUP_PATTERN})$`));
  if (match)
    return `Rural Access Index: share (%) of rural ${POPULATION_GROUPS[match[1]]} living within 2 km of an all-season road.`;

  return null;
}

function describeFloodExposure(name: string): string | null {
  const event = name.match(/^RP(\d+)_(.+)$/);
  if (!event) return null;
  const [, returnPeriod, rest] = event;
  const flood = `flood water of 30 cm or deeper in ${floodEvent(returnPeriod)}`;

  if (rest === "dependency_ratio_30cm")
    return `Dependency ratio of the people exposed to ${flood}: ${DEPENDENCY_RATIO}.`;
  if (rest === "crops_30cm_km2") return `Cropland area (km²) exposed to ${flood}.`;
  if (rest === "crops_30cm_areapct")
    return `Cropland exposed to ${flood}, as a share (%) of the district's total area.`;
  if (rest === "crops_30cm_croppct")
    return `Share (%) of the district's cropland exposed to ${flood}.`;

  let match = rest.match(new RegExp(`^(${GROUP_PATTERN})_30cm$`));
  if (match) return `Number of ${POPULATION_GROUPS[match[1]]} exposed to ${flood}.`;

  match = rest.match(new RegExp(`^(${FACILITY_PATTERN})_30cm_(count|pct)$`));
  if (match)
    return match[2] === "count"
      ? `Number of ${FACILITIES[match[1]]} exposed to ${flood}.`
      : `Share (%) of ${FACILITIES[match[1]]} exposed to ${flood}.`;

  return null;
}

function describeCycloneExposure(name: string): string | null {
  let match = name.match(/^kt34_dependency_ratio_cat(\d)$/);
  if (match)
    return `Dependency ratio of the people exposed to ${cycloneEvent(match[1])}: ${DEPENDENCY_RATIO}.`;

  match = name.match(new RegExp(`^kt34_(${GROUP_PATTERN})_cat(\\d)$`));
  if (match)
    return `Number of ${POPULATION_GROUPS[match[1]]} exposed to ${cycloneEvent(match[2])}.`;

  match = name.match(
    new RegExp(`^kt34_(${FACILITY_PATTERN})_(count|perc)_cat(\\d)$`),
  );
  if (match)
    return match[2] === "count"
      ? `Number of ${FACILITIES[match[1]]} exposed to ${cycloneEvent(match[3])}.`
      : `Share (%) of ${FACILITIES[match[1]]} exposed to ${cycloneEvent(match[3])}.`;

  return null;
}

export function describeIndicator(col: string): string | null {
  if (COMPOSITES[col]) return COMPOSITES[col];
  if (col.startsWith("vul_")) return describeVulnerability(col.slice(4));
  if (col.startsWith("cop_")) return describeCopingCapacity(col.slice(4));
  if (col.startsWith("exp_flo_")) return describeFloodExposure(col.slice(8));
  if (col.startsWith("exp_cyc_")) return describeCycloneExposure(col.slice(8));
  return null;
}
