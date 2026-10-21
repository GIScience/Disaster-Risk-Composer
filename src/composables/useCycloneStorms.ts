import { computed, ref, toValue, type MaybeRefOrGetter } from "vue";

export interface CycloneStorm {
  name: string | null;
  year: number;
  /** Highest Saffir-Simpson category on the track segments that reached the country */
  category: number;
}
export interface CountryStorms {
  storms: number;
  from: number | null;
  to: number | null;
  list: CycloneStorm[];
}

interface StormsFile {
  /** Last date of the track data used, the date of GAIA's cyclone exposure data */
  until?: string;
  countries: Record<string, CountryStorms>;
}

// public/data/cyclone-storms.json, made by scripts/generate_cyclone_storms.py: the historical storms
// the cyclone indicators of each country are built from. Loaded once, when first needed.
let loading: Promise<StormsFile> | null = null;
const data = ref<StormsFile>({ countries: {} });

function load() {
  loading ??= fetch(`${import.meta.env.BASE_URL}data/cyclone-storms.json`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    // A missing or unexpected file only hides the storm line; it must never break the dashboard
    .then((d) => (data.value = d?.countries && typeof d.countries === "object" ? d : { countries: {} }));
  return loading;
}

/** The storms behind a country's cyclone indicators, with a short label, an explanation and the list. */
export function useCycloneStorms(countryCode: MaybeRefOrGetter<string | undefined>) {
  load();
  const info = computed(() => {
    const code = toValue(countryCode);
    return code ? data.value.countries[code] : undefined;
  });
  const label = computed(() => {
    const i = info.value;
    if (!i || !Array.isArray(i.list)) return "";
    if (!i.storms) return "No cyclones with wind data found";
    const period = i.from === i.to ? `${i.from}` : `${i.from}–${i.to}`;
    return `Based on ${i.storms} cyclone${i.storms === 1 ? "" : "s"}, ${period}`;
  });
  // Explanation shown above the storm list
  const intro = computed(() => {
    if (!info.value) return "";
    const until = data.value.until
      ? `, data up to ${new Date(data.value.until).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
      : "";
    return (
      "Cyclones of Saffir-Simpson Category 1 or stronger whose 34-knot winds reached the country " +
      `(IBTrACS, since 1980${until}; cyclones without wind radii are not included).`
    );
  });
  // Newest first
  const storms = computed(() => (Array.isArray(info.value?.list) ? [...info.value.list].reverse() : []));
  return { info, label, intro, storms };
}
