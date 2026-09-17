import jsyaml from "js-yaml";

export interface Country {
  code: string;
  name: string;
}

const COUNTRIES_YAML_URL =
  "https://hot.storage.heigit.org/heigit-hdx-public/oqapi_hdx/countries/countries.yaml";

// Several components independently need the countries YAML (the list itself,
// plus the availability check below). Sharing one in-flight request avoids
// firing a HEAD and multiple GETs at the same URL at once, which Chrome logs
// as a spurious net::ERR_ABORTED when it cancels the now-redundant HEAD.
let countriesYamlTextPromise: Promise<string> | null = null;

function fetchCountriesYamlText(): Promise<string> {
  if (!countriesYamlTextPromise) {
    countriesYamlTextPromise = fetch(COUNTRIES_YAML_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch countries.yaml: ${res.status}`);
        return res.text();
      })
      .catch((error) => {
        countriesYamlTextPromise = null; // allow a later call to retry
        throw error;
      });
  }
  return countriesYamlTextPromise;
}

export async function fetchCountries(): Promise<Country[]> {
  try {
    // Fetch the pre-generated list of available countries
    const resJson = await fetch(`${import.meta.env.BASE_URL}data/available_countries.json`);
    if (!resJson.ok) throw new Error("Failed to load available_countries.json");
    const validCodes: string[] = await resJson.json();

    // Fetch the YAML metadata to get proper country names
    const textYaml = await fetchCountriesYamlText();
    const countryYamlData = jsyaml.load(textYaml) as Record<string, { slug: string }>;

    function prettifySlug(slug: string) {
      if (!slug) return "";
      return slug.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
    }

    const result = validCodes.map(code => {
      const slug = countryYamlData[code]?.slug;
      return {
        code,
        name: slug ? prettifySlug(slug) : code
      };
    });

    return result.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Failed to fetch available countries", error);
    return [];
  }
}

export async function checkFileExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD", cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

// Used to verify the HeiGIT data bucket is actually reachable from this origin
// (e.g. not blocked by a CORS misconfiguration) before relying on it. Reuses
// the same request fetchCountries() needs anyway instead of a separate HEAD.
export async function checkDataSourceAvailable(): Promise<boolean> {
  try {
    await fetchCountriesYamlText();
    return true;
  } catch {
    return false;
  }
}
