/** All Cloud-Optimized GeoTIFF URLs (`sourceUrl` ending in .tif/.tiff) anywhere in a config object. */
export function collectCogUrls(value: unknown, urls = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => collectCogUrls(v, urls));
  else if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (typeof v.sourceUrl === "string" && /\.tiff?$/i.test(v.sourceUrl)) urls.add(v.sourceUrl);
    Object.values(v).forEach((child) => collectCogUrls(child, urls));
  }
  return urls;
}
