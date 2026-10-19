"""
Bring public/data/world.json (grey "no data" countries and click/hover shapes on the world
view, see RiskMap.vue) in line with UN map practice:

- Drop the shapes without an ISO code ("-99"): they were three copies of Somaliland on top of
  Somalia, whose shape already includes it. Shape IDs are the ISO code (promoteId), so
  duplicates also clashed.
- Taiwan: cut out of China's shape and shown as its own grey "no data" shape. The dashboard
  leaves Taiwan out of China's data (src/config/excludedRegions.ts), so hovering or clicking
  China must not include it.
- Western Sahara: use the whole territory (Natural Earth's "W. Sahara" plus the part it counts
  as Moroccan-administered), cut so it doesn't overlap its neighbours' shapes.

Cyprus (one shape for the whole island) and Kosovo (inside Serbia's shape) already follow UN
practice and are left as they are.

Requirements: shapely  (e.g. `uv run --with shapely python scripts/fix_world_un_practice.py`)
"""

import json
import urllib.request
from pathlib import Path

from shapely.geometry import box, mapping, shape

NATURAL_EARTH_URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/"
    "geojson/ne_50m_admin_0_countries.geojson"
)
WORLD = Path(__file__).resolve().parent.parent / "public" / "data" / "world.json"
DROP = {"-99", "TWN"}  # TWN is re-added below from Natural Earth (keeps the script repeatable)
# Western Sahara lies south of 27°40'N and west of 8°40'W
WESTERN_SAHARA_BOX = box(-17.5, 20.5, -8.666, 27.667)


def round_coords(obj, digits=4):
    if isinstance(obj, (list, tuple)):
        return [round_coords(o, digits) for o in obj]
    return round(obj, digits) if isinstance(obj, float) else obj


def main():
    world = json.loads(WORLD.read_text())
    features = [f for f in world["features"] if f["properties"]["iso_a3"] not in DROP]

    with urllib.request.urlopen(NATURAL_EARTH_URL) as response:
        ne = {f["properties"]["ADM0_A3"]: shape(f["geometry"]) for f in json.load(response)["features"]}
    # simplify first, then cut: simplifying after the cut would widen it into the neighbours again
    territory = (
        ne["SAH"].union(ne["MAR"]).intersection(WESTERN_SAHARA_BOX).simplify(0.02, preserve_topology=True)
    )
    for f in features:  # Morocco, Mauritania, Algeria: neighbours win at the border
        other = shape(f["geometry"])
        if f["properties"]["iso_a3"] != "ESH" and other.intersects(territory):
            territory = territory.difference(other)
    western_sahara = territory

    for f in features:
        if f["properties"]["iso_a3"] == "ESH":
            f["geometry"] = round_coords(mapping(western_sahara))

    # Taiwan: its own shape, and cut out of China's (a small buffer removes coastline slivers)
    taiwan = ne["TWN"].simplify(0.01, preserve_topology=True)
    for f in features:
        if f["properties"]["iso_a3"] == "CHN":
            f["geometry"] = round_coords(mapping(shape(f["geometry"]).difference(taiwan.buffer(0.05))))
    features.append({"type": "Feature", "properties": {"iso_a3": "TWN"}, "geometry": round_coords(mapping(taiwan))})

    removed = len(world["features"]) - len(features)
    world["features"] = features
    WORLD.write_text(json.dumps(world, separators=(",", ":")))
    print(f"{len(features)} shapes (removed {removed}, re-added Taiwan), Western Sahara replaced -> {WORLD}")


if __name__ == "__main__":
    main()
