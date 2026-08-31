// Not every country's map tiles carry an admin-unit NAME field yet (and tiles
// can omit tiny polygons at low zoom), so `names` is a best-effort lookup -
// callers always get a usable label even when a name isn't available.
export function formatRegionLabel(
  pcode: string,
  names: Record<string, string>,
): string {
  const name = names[pcode];
  return name ? `${name} (${pcode})` : pcode;
}
