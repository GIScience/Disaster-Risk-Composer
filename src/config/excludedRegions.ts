/**
 * Districts the dashboard leaves out although they are in a country's data files. They are
 * removed right after loading (so scores, normalisation, quartiles, rankings and tables are
 * computed without them) and hidden on the map.
 *
 * Temporary: remove an entry once the backend (GAIA) no longer ships the district.
 */
export const EXCLUDED_REGIONS: Record<string, string[]> = {
  // Taiwan is part of China's files ("Taiwan province"); not shown as part of China
  CHN: ["CN071010"],
};

export function excludedRegionIds(countryCode: string | undefined): string[] {
  return (countryCode && EXCLUDED_REGIONS[countryCode]) || [];
}

/** Country code from a boundary file URL such as ".../CHN_ADM2.pmtiles". */
export function countryCodeFromBoundaryUrl(url: string | undefined): string | undefined {
  return url?.match(/\/([A-Z]{3})_ADM\d\.pmtiles$/)?.[1];
}
